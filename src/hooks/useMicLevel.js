import { useEffect, useRef } from 'react';

/**
 * 배경 애니메이션용 경량 마이크 훅.
 * setState 없이 ref 로 데이터를 노출 — 60fps 캔버스 루프에서 직접 읽도록.
 *
 * dataRef.current = { level, freq, time }
 *   level : 0..~1 (RMS)
 *   freq  : Uint8Array | null  (스펙트럼)
 *   time  : Uint8Array | null  (파형)
 */
export function useMicLevel(enabled) {
  const dataRef = useRef({ level: 0, freq: null, time: null });

  useEffect(() => {
    if (!enabled) {
      dataRef.current.level = 0;
      dataRef.current.freq = null;
      dataRef.current.time = null;
      return;
    }

    let stream;
    let audioCtx;
    let rafId;
    let cancelled = false;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            noiseSuppression: false,
            echoCancellation: false,
            autoGainControl: false,
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.75;
        source.connect(analyser);

        const freq = new Uint8Array(analyser.frequencyBinCount);
        const time = new Uint8Array(analyser.fftSize);

        const tick = () => {
          analyser.getByteTimeDomainData(time);
          analyser.getByteFrequencyData(freq);
          let sum = 0;
          for (let i = 0; i < time.length; i++) {
            const v = (time[i] - 128) / 128;
            sum += v * v;
          }
          dataRef.current.level = Math.sqrt(sum / time.length);
          dataRef.current.freq = freq;
          dataRef.current.time = time;
          rafId = requestAnimationFrame(tick);
        };
        tick();
      } catch (e) {
        // Permission denied or device error — silently ignore, level stays 0
      }
    })();

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (audioCtx) audioCtx.close().catch(() => {});
      dataRef.current.level = 0;
      dataRef.current.freq = null;
      dataRef.current.time = null;
    };
  }, [enabled]);

  return dataRef;
}
