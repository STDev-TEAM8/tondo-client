import { useRef, useCallback } from 'react';
import { mapFeaturesToChladni } from '../utils/chladniMath';

/**
 * 클라드니 파라미터 EMA(지수 이동 평균) 스무딩 훅
 *
 * Alpha 값 의미: 프레임당 목표치의 몇 %를 따라가느냐
 *   0.02 → ~2.5초에 95% 수렴 (60fps 기준)
 *   0.05 → ~1초에 95% 수렴
 */

const ALPHA_SHAPE     = 0.025;
const ALPHA_PHASE     = 0.04;
const ALPHA_THRESHOLD = 0.1;
const ALPHA_HUE       = 0.05; // 색상 반응 속도 (클수록 빠름 — 부드러운 전환 위해 낮춤)

const UPDATE_VOLUME_MIN = 0.05;

export function useChladniParams() {
  const currentRef = useRef(null);
  const hueRef     = useRef(0);

  /**
   * 매 프레임 호출. 스무딩된 최신 파라미터 반환.
   * @param {object} features  - { pitch, timbre, phase, volume, freqBand }
   * @param {number|null|undefined} baseHue
   *   undefined → 목소리 색상 그대로
   *   null      → 흰색(무채색)
   *   number    → 해당 hue를 베이스로 목소리와 30% 블렌딩
   */
  const update = useCallback((features, baseHue = undefined) => {
    const target = mapFeaturesToChladni(features);

    if (!currentRef.current) {
      currentRef.current = {
        n: target.n, m: target.m,
        omega: target.omega, threshold: target.threshold,
      };
      hueRef.current = hslToHue(target.color);
      return buildResult(currentRef.current, hueRef.current, baseHue);
    }

    if (features.volume >= UPDATE_VOLUME_MIN) {
      const cur = currentRef.current;
      cur.n         = lerp(cur.n,         target.n,         ALPHA_SHAPE);
      cur.m         = lerp(cur.m,         target.m,         ALPHA_SHAPE);
      cur.omega     = lerp(cur.omega,     target.omega,     ALPHA_PHASE);
      cur.threshold = lerp(cur.threshold, target.threshold, ALPHA_THRESHOLD);

      const targetHue = hslToHue(target.color);
      hueRef.current  = lerpAngle(hueRef.current, targetHue, ALPHA_HUE);
    }

    return buildResult(currentRef.current, hueRef.current, baseHue);
  }, []);

  const reset = useCallback(() => {
    currentRef.current = null;
    hueRef.current     = 0;
  }, []);

  return { update, reset };
}

// ─── 내부 유틸 ────────────────────────────────────────────────────────────────

function lerp(a, b, t) { return a + (b - a) * t; }

function lerpAngle(a, b, t) {
  let diff = b - a;
  if (diff >  180) diff -= 360;
  if (diff < -180) diff += 360;
  return (a + diff * t + 360) % 360;
}

function hslToHue(hslStr) {
  const m = hslStr.match(/hsl\((\d+\.?\d*)/);
  return m ? parseFloat(m[1]) : 0;
}

/**
 * @param {object}            cur      - { n, m, omega, threshold }
 * @param {number}            voiceHue - EMA 스무딩된 목소리 hue
 * @param {number|null|undefined} baseHue
 */
function buildResult(cur, voiceHue, baseHue) {
  let color;
  if (baseHue === null) {
    // 흰색/무채색 모드
    color = 'hsl(0, 0%, 88%)';
  } else if (typeof baseHue === 'number') {
    // 베이스 hue를 70%, 목소리 편차를 30% 반영
    let diff = voiceHue - baseHue;
    if (diff >  180) diff -= 360;
    if (diff < -180) diff += 360;
    const finalHue = (baseHue + diff * 0.3 + 360) % 360;
    color = `hsl(${finalHue.toFixed(1)}, 100%, 55%)`;
  } else {
    // undefined: 목소리 피치가 직접 색상 결정 (어두운 영역 제외: L=55%)
    color = `hsl(${voiceHue.toFixed(1)}, 100%, 55%)`;
  }
  return { n: cur.n, m: cur.m, omega: cur.omega, threshold: cur.threshold, color };
}
