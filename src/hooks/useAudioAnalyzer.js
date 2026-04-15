import { useEffect, useRef, useState, useCallback } from 'react';
import { extractFeatures } from '../utils/audioFeatures';

/**
 * Web Audio API 분석기 훅
 *
 * 반환값:
 *   features      : 현재 프레임의 { pitch, timbre, phase, volume, freqBand }
 *   frequencyData : Uint8Array (원시 FFT 데이터)
 *   isReady       : 마이크 연결 완료 여부
 *   error         : 마이크 권한 오류
 *   analyserRef   : AnalyserNode ref (외부에서 직접 접근 필요 시)
 *   start         : 분석 시작
 *   stop          : 분석 중지
 */
export function useAudioAnalyzer() {
  const [features, setFeatures] = useState({
    pitch: 0, timbre: 0, phase: 0, volume: 0, freqBand: 0,
  });
  const [frequencyData, setFrequencyData] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);
  // FFT 파라미터 정보 (디버그 패널 표시용)
  const [audioInfo, setAudioInfo] = useState(null);

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const dataArrayRef = useRef(null);

  const stop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsReady(false);
  }, []);

  const start = useCallback(async () => {
    try {
      // 브라우저 noiseSuppression 은 군중 환경에서 목소리도 같이 억제하므로 OFF
      // 노이즈 제거는 Web Audio BPF(L2) + 적응형 SNR 게이트(L3)가 담당
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: false,
          echoCancellation: false,
          autoGainControl: false,
        },
        video: false,
      });
      streamRef.current = stream;

      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;

      // 레이어 2: 웹오디오 대역 통과 필터 (사람 목소리 80–4000 Hz)
      const highPass = ctx.createBiquadFilter();
      highPass.type = 'highpass';
      highPass.frequency.value = 80;
      highPass.Q.value = 0.7;

      const lowPass = ctx.createBiquadFilter();
      lowPass.type = 'lowpass';
      lowPass.frequency.value = 4000;
      lowPass.Q.value = 0.7;

      source.connect(highPass);
      highPass.connect(lowPass);
      lowPass.connect(analyser);

      const bufferLength = analyser.frequencyBinCount; // fftSize / 2
      const dataArray = new Uint8Array(bufferLength);
      dataArrayRef.current = dataArray;

      // FFT 파라미터 계산 및 노출
      const binWidth = (ctx.sampleRate / 2) / bufferLength; // Hz per bin
      setAudioInfo({
        sampleRate: ctx.sampleRate,
        fftSize: analyser.fftSize,
        binCount: bufferLength,
        binWidth: binWidth,          // Hz/bin
        filterMin: 80,
        filterMax: 4000,
        smoothing: analyser.smoothingTimeConstant,
        noiseSuppression: false,     // 브라우저 억제 비활성화
      });

      setIsReady(true);
      setError(null);

      const tick = () => {
        analyser.getByteFrequencyData(dataArray);
        const extracted = extractFeatures(dataArray, ctx.sampleRate);
        setFeatures(extracted);
        setFrequencyData(new Uint8Array(dataArray));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      setError(err.message ?? '마이크 접근 실패');
      setIsReady(false);
    }
  }, []);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return {
    features,
    frequencyData,
    isReady,
    error,
    audioInfo,
    analyserRef,
    start,
    stop,
  };
}
