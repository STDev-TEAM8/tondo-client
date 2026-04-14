import { useCallback, useRef } from 'react';

/**
 * Voice Activity Detection (VAD) 훅
 *
 * 동작 방식:
 *   - 매 프레임 volume(0~1)을 받아 발화 중/침묵 판단
 *   - SILENCE_THRESHOLD 이하로 SILENCE_DURATION ms 지속 시 onSilence 콜백 호출
 *   - 발화 중에는 피처를 featureHistory에 누적
 *
 * 파라미터 (당일 튜닝 가능):
 *   silenceThreshold  : 볼륨 임계값 (0~1), 기본 0.08
 *   silenceDuration   : 침묵 판정 지속 시간 ms, 기본 900
 *   minSpeechDuration : 최소 발화 시간 ms (짧은 잡음 무시), 기본 500
 */
export function useVAD({
  silenceThreshold = 0.08,
  silenceDuration = 900,
  minSpeechDuration = 500,
  onSilence,    // (featureHistory) => void : 발화 종료 시 콜백
  onSpeechStart, // () => void : 발화 시작 시 콜백
} = {}) {
  const isSpeakingRef = useRef(false);
  const silenceTimerRef = useRef(null);
  const speechStartTimeRef = useRef(null);
  const featureHistoryRef = useRef([]);

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  /**
   * 매 오디오 프레임마다 호출
   * @param {number} volume - 현재 볼륨 (0~1)
   * @param {object} features - 현재 피처
   */
  const feed = useCallback((volume, features) => {
    if (volume > silenceThreshold) {
      // 소리 감지
      clearSilenceTimer();

      if (!isSpeakingRef.current) {
        isSpeakingRef.current = true;
        speechStartTimeRef.current = Date.now();
        featureHistoryRef.current = [];
        onSpeechStart?.();
      }

      featureHistoryRef.current.push({ ...features });
    } else {
      // 침묵 감지
      if (isSpeakingRef.current && !silenceTimerRef.current) {
        silenceTimerRef.current = setTimeout(() => {
          const speechDuration = Date.now() - (speechStartTimeRef.current ?? 0);

          if (speechDuration >= minSpeechDuration) {
            onSilence?.(featureHistoryRef.current);
          }

          isSpeakingRef.current = false;
          featureHistoryRef.current = [];
          silenceTimerRef.current = null;
        }, silenceDuration);
      }
    }
  }, [silenceThreshold, silenceDuration, minSpeechDuration, onSilence, onSpeechStart]);

  /** VAD 상태 초기화 */
  const reset = useCallback(() => {
    clearSilenceTimer();
    isSpeakingRef.current = false;
    featureHistoryRef.current = [];
    speechStartTimeRef.current = null;
  }, []);

  return { feed, reset };
}
