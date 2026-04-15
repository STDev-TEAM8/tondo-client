import { useRef, useState, useCallback } from 'react';

/**
 * 비대칭 EMA(지수 이동 평균) 기반 적응형 노이즈 플로어 VAD
 *
 * ── 퍼센타일 방식의 문제 ──────────────────────────────────────────────────────
 *   최근 3초 버퍼의 하위 25%를 노이즈 플로어로 사용하면,
 *   3초 이상 연속 발화 시 버퍼 전체가 높은 볼륨값으로 채워져
 *   노이즈 플로어 자체가 상승 → SNR 1.0에 수렴 → 발화를 침묵으로 잘못 판정
 *
 * ── 비대칭 EMA 해결 원리 ──────────────────────────────────────────────────────
 *   volume < noiseFloor (조용한 순간) → α_DECAY 로 빠르게 내려감
 *   volume > noiseFloor (발화/소음)   → α_ATTACK 으로 매우 천천히 올라감
 *
 *   α_DECAY  = 0.05   → ~0.5초 안에 조용한 수준으로 수렴
 *   α_ATTACK = 0.0001 → 60초 연속 발화해도 플로어 상승폭 ≈ 30% (SNR 여전히 충분)
 *
 * ── 실제 동작 예시 (대회장) ───────────────────────────────────────────────────
 *   배경 소음만:   vol=0.30, floor=0.25 → SNR=1.20 < 1.8 → 침묵 ✓
 *   대상자 발화:   vol=0.70, floor=0.25 → SNR=2.80 ≥ 1.8 → 발화 ✓
 *   60초 연속 발화: floor가 0.25 → 0.37로 상승해도 SNR=1.89 ≥ 1.8 → 발화 유지 ✓
 */

const ALPHA_DECAY   = 0.05;    // 조용한 순간 플로어 하강 속도 (빠름)
const ALPHA_ATTACK  = 0.0001;  // 발화 중 플로어 상승 속도  (매우 느림)
const MIN_NOISE_FLOOR = 0.015; // 절대 최솟값 (완전 무음 방지)
const UI_UPDATE_INTERVAL = 6;  // 6프레임마다 UI 갱신 (~10Hz)

export function useAdaptiveVAD() {
  const noiseFloorRef  = useRef(MIN_NOISE_FLOOR);
  const frameRef       = useRef(0);
  const [noiseFloor, setNoiseFloor] = useState(MIN_NOISE_FLOOR);

  /**
   * 매 프레임 호출
   * @param {number} volume          - 정규화 진폭 [0, 1]
   * @param {number} voiceRatio      - 음성 대역 에너지 비율 [0, 1]
   * @param {number} snrMultiplier   - SNR 임계 배수 (기본 1.8)
   * @param {number} vrThreshold     - voiceRatio 보조 조건 (기본 0.30)
   * @returns {{ isSpeaking: boolean, snr: number }}
   */
  const update = useCallback((volume, voiceRatio, snrMultiplier, vrThreshold) => {
    const floor = noiseFloorRef.current;

    // ── 비대칭 EMA ────────────────────────────────────────────────────────────
    // 내려갈 때(조용): α_DECAY — 빠르게 추적
    // 올라갈 때(발화): α_ATTACK — 거의 안 따라감 → 장시간 발화도 플로어 유지
    const alpha = volume < floor ? ALPHA_DECAY : ALPHA_ATTACK;
    const newFloor = Math.max(floor + alpha * (volume - floor), MIN_NOISE_FLOOR);
    noiseFloorRef.current = newFloor;

    // UI는 매 프레임 setState 하면 과부하 → 주기적으로만 갱신
    frameRef.current += 1;
    if (frameRef.current % UI_UPDATE_INTERVAL === 0) {
      setNoiseFloor(newFloor);
    }

    const snr        = newFloor > 0 ? volume / newFloor : 0;
    const isSpeaking = snr >= snrMultiplier && voiceRatio >= vrThreshold;

    return { isSpeaking, snr };
  }, []);

  const reset = useCallback(() => {
    noiseFloorRef.current = MIN_NOISE_FLOOR;
    frameRef.current      = 0;
    setNoiseFloor(MIN_NOISE_FLOOR);
  }, []);

  return { update, reset, noiseFloor };
}
