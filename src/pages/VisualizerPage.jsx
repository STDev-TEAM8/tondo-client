import { useEffect, useRef, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAudioAnalyzer } from '../hooks/useAudioAnalyzer';
import { useChladniParams } from '../hooks/useChladniParams';
import { useAdaptiveVAD } from '../hooks/useAdaptiveVAD';
import { computeAverageFeatures } from '../utils/audioFeatures';
import {
  createParticles,
  buildForceField,
  stepParticles,
  stepParticlesScatter,
  renderParticles,
  hslToRgbArray,
} from '../utils/chladniParticles';
import { canvasToBase64 } from '../utils/imageUtils';
import { requestArtwork, getOrCreateUUID } from '../api/artworkApi';
import { hslToHex, calculateFinalColor } from '../utils/chladniMath';
import ntc from 'ntc-ts';
import styles from './VisualizerPage.module.css';

const DEFAULT_SNR_MULTIPLIER = 0.5;  // 노이즈 플로어 대비 배수
const PARTICLE_COUNT         = 40000;
const REBUILD_DELTA     = 0.04;
const SILENCE_HOLD_MS   = 1200; // 침묵 후 흩어지기 전 유예 시간 (ms)

// 파티클 색상 팔레트
// hue: undefined → 목소리 피치가 실시간으로 색상 결정
// hue: null      → 흰색/무채색
// hue: number    → 해당 색조를 베이스로 목소리와 블렌딩
const COLOR_PALETTE = [
  { id: 'voice',  hue: undefined, hex: null,      label: '목소리' }, // 피치에 따라 자동 변환
  { id: 'white',  hue: null,      hex: '#e8e8e8', label: '흰색'   },
  { id: 'warm',   hue: 25,        hex: '#fb923c', label: '따뜻'   }, // 주황 계열
  { id: 'cool',   hue: 210,       hex: '#38bdf8', label: '시원'   }, // 하늘 계열
];

export default function VisualizerPage() {
  const navigate = useNavigate();

  // ── 캔버스 & 파티클 refs ──────────────────────────────────────────────────────
  const canvasRef          = useRef(null);
  const particlesRef       = useRef(null);
  const forceFieldRef      = useRef(null);
  const imageDataRef       = useRef(null);
  const lastForceParamsRef = useRef(null);
  const lastParamsRef      = useRef(null);
  const featureHistoryRef  = useRef([]);
  const isSendingRef       = useRef(false);
  const capturedBase64Ref  = useRef('');
  const silenceTimerRef    = useRef(null);
  const isScatteringRef    = useRef(false);
  const scatterTargetsRef  = useRef(null); // Float32Array [x0,y0,x1,y1,...] 랜덤 목표 좌표
  const frameCountRef      = useRef(0);    // 프레임 카운터 (파티클 재공급용)
  const touchTimerRef      = useRef(null);

  // ── 상태 ─────────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState('setup');
  // 'idle' | 'setup' | 'recording' | 'preview' | 'sending' | 'error'
  const [snrMultiplier, setSnrMultiplier]             = useState(DEFAULT_SNR_MULTIPLIER);
  const [voiceRatioThreshold, setVoiceRatioThreshold] = useState(0.30);
  const [liveVolume, setLiveVolume]                   = useState(0);
  const [liveVoiceRatio, setLiveVoiceRatio]           = useState(0);
  const [selectedColor, setSelectedColor]             = useState(COLOR_PALETTE[0]);
  const [sendError, setSendError]                     = useState(null);

  // ── 디버그 패널 ──────────────────────────────────────────────────────────────
  const [debugOpen, setDebugOpen] = useState(false);
  const cornerTapRef   = useRef(0);
  const cornerTimerRef = useRef(null);

  const handleCornerTap = () => {
    cornerTapRef.current += 1;
    clearTimeout(cornerTimerRef.current);
    cornerTimerRef.current = setTimeout(() => { cornerTapRef.current = 0; }, 2000);
    if (cornerTapRef.current >= 5) {
      cornerTapRef.current = 0;
      setDebugOpen((v) => !v);
    }
  };

  // ── 오디오 & 클라드니 EMA ─────────────────────────────────────────────────────
  const { features, isReady, error: micError, audioInfo, start, stop } = useAudioAnalyzer();
  const { update: updateChladni, reset: resetChladni } = useChladniParams();
  const { update: vadUpdate, reset: resetVAD, noiseFloor } = useAdaptiveVAD();

  // ── 캔버스 초기화 (리사이즈 포함) ─────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const init = () => {
      const size = Math.min(window.innerWidth, window.innerHeight);
      canvas.width  = size;
      canvas.height = size;
      imageDataRef.current = canvas.getContext('2d').createImageData(size, size);
      if (!particlesRef.current) {
        particlesRef.current = createParticles(PARTICLE_COUNT);
      }
      renderAndFlush(canvas, [255, 255, 255], false);
    };
    init();
    window.addEventListener('resize', init);
    return () => window.removeEventListener('resize', init);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 파티클 렌더링 헬퍼 ──────────────────────────────────────────────────────
  const renderAndFlush = (canvas, rgb, bw) => {
    if (!canvas || !particlesRef.current || !imageDataRef.current) return;
    renderParticles(imageDataRef.current, particlesRef.current, canvas.width, canvas.height, rgb, bw);
    canvas.getContext('2d').putImageData(imageDataRef.current, 0, 0);
  };

  // ── 마운트 시 마이크 즉시 활성화 ─────────────────────────────────────────────
  useEffect(() => {
    start();
    return () => stop();
  }, [start, stop]);

  // ── idle/setup 에서 liveVolume 업데이트 + 노이즈 플로어 사전 누적 ──────────────
  // 녹음 시작 전부터 배경 소음 수준을 파악해 두어야 recording 첫 프레임부터 정확히 작동함
  useEffect(() => {
    if (!isReady || (phase !== 'idle' && phase !== 'setup')) return;
    const vol = features.volume;
    const vr  = features.voiceRatio ?? 0;
    setLiveVolume(vol);
    setLiveVoiceRatio(vr);
    vadUpdate(vol, vr, snrMultiplier, voiceRatioThreshold); // 플로어 누적만 (결과 무시)
  }, [features, isReady, phase, snrMultiplier, voiceRatioThreshold, vadUpdate]);

  // ── phase 전환 시 캔버스 1회 렌더 (recording/preview 제외) ───────────────────
  useEffect(() => {
    if (phase === 'recording' || phase === 'preview') return;
    const canvas = canvasRef.current;
    if (!canvas || !particlesRef.current || !imageDataRef.current) return;
    const rgb = lastParamsRef.current
      ? hslToRgbArray(lastParamsRef.current.color)
      : [255, 255, 255];
    renderAndFlush(canvas, rgb, false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── setup → recording ────────────────────────────────────────────────────────
  const startRecording = () => {
    if (phase !== 'setup') return;
    featureHistoryRef.current  = [];
    isSendingRef.current       = false;
    isScatteringRef.current    = false;
    frameCountRef.current      = 0;
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    setSendError(null);
    resetChladni();
    lastForceParamsRef.current = null;
    setPhase('recording');
  };

  // ── 캡처 → preview ──────────────────────────────────────────────────────────
  const handleCapture = useCallback(() => {
    if (phase !== 'recording') return;
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    isScatteringRef.current = false;
    const canvas = canvasRef.current;
    renderAndFlush(canvas, [255, 255, 255], true); // B&W 스냅샷
    capturedBase64Ref.current = canvas ? canvasToBase64(canvas) : '';
    setPhase('preview');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── 다시 녹음 (preview → recording) ─────────────────────────────────────────
  const handleRetry = useCallback(() => {
    featureHistoryRef.current  = [];
    isSendingRef.current       = false;
    isScatteringRef.current    = false;
    scatterTargetsRef.current  = null;
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    resetChladni();
    lastForceParamsRef.current = null;
    setPhase('recording');
  }, [resetChladni]);

  // ── AI 전송 ──────────────────────────────────────────────────────────────────
  const handleSendToAI = useCallback(() => {
    if (isSendingRef.current) return;
    isSendingRef.current = true;
    const { avgPitch, avgVolume, avgTimbre } = computeAverageFeatures(featureHistoryRef.current);
    const uuid = getOrCreateUUID();

    // ── 목소리 색상 → 자연어 이름 변환 ──
    const finalHsl = calculateFinalColor(avgPitch, selectedColor?.hue);
    const voiceColorHex = hslToHex(finalHsl);
    const voiceColor = ntc.name(voiceColorHex).name;

    setPhase('sending');
    setSendError(null);
    requestArtwork({
      uuid,
      avgPitch,
      avgVolume,
      avgTimbre,
      voiceColor,
      imageBase64: capturedBase64Ref.current,
    })
      .then(({ taskId }) => {
        stop();
        navigate('/waiting', { state: { taskId, uuid } });
      })
      .catch((err) => {
        console.error('[TonDo] 전송 실패:', err);
        setSendError('서버 전송에 실패했습니다. 다시 시도해주세요.');
        setPhase('preview');
        isSendingRef.current = false;
      });
  }, [stop, navigate]);

  // ── 캡처 이미지 저장 ──────────────────────────────────────────────────────────
  const downloadCapture = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.href     = canvas.toDataURL('image/png');
    link.download = 'tondo-capture.png';
    link.click();
  }, []);

  const handleCanvasContextMenu = useCallback((e) => {
    if (phase !== 'preview') return;
    e.preventDefault();
    downloadCapture();
  }, [phase, downloadCapture]);

  const handleTouchStart = useCallback(() => {
    if (phase !== 'preview') return;
    touchTimerRef.current = setTimeout(downloadCapture, 700);
  }, [phase, downloadCapture]);

  const handleTouchEnd = useCallback(() => {
    clearTimeout(touchTimerRef.current);
  }, []);

  // ── 매 프레임: 파티클 업데이트 (recording 중에만) ────────────────────────────
  useEffect(() => {
    if (!isReady || phase !== 'recording') return;
    const canvas = canvasRef.current;
    if (!canvas || !particlesRef.current || !imageDataRef.current) return;

    const vol = features.volume;
    const vr  = features.voiceRatio ?? 0;
    setLiveVolume(vol);
    setLiveVoiceRatio(vr);

    const { isSpeaking } = vadUpdate(vol, vr, snrMultiplier, voiceRatioThreshold);

    if (isSpeaking) {
      // 목소리 감지: 침묵 타이머 취소, 절점 수렴
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      isScatteringRef.current  = false;
      scatterTargetsRef.current = null; // 다음 침묵 시 새 랜덤 목표 생성

      featureHistoryRef.current.push({ ...features });
      const params = updateChladni(features, selectedColor?.hue);
      lastParamsRef.current = params;

      // ── 힘 필드 빌드 ────────────────────────────────────────────────────────────
      // EMA 수렴 후 힘 필드가 완전히 고정되면 교차점에 장기 누적이 생김.
      // omega를 ~8초 주기로 ±0.30 rad 진동시켜 절점선이 넓게 쓸고 지나가게 함.
      const effectiveOmega =
        params.omega + 0.30 * Math.sin(Date.now() * 0.00078);

      const lp = lastForceParamsRef.current;
      if (
        !lp ||
        Math.abs(params.n        - lp.n)     > REBUILD_DELTA ||
        Math.abs(params.m        - lp.m)     > REBUILD_DELTA ||
        Math.abs(effectiveOmega  - lp.omega) > REBUILD_DELTA * 0.3
      ) {
        forceFieldRef.current      = buildForceField(params.n, params.m, effectiveOmega);
        lastForceParamsRef.current = { n: params.n, m: params.m, omega: effectiveOmega };
      }

      if (forceFieldRef.current) {
        stepParticles(particlesRef.current, forceFieldRef.current);
      }

      // ── 파티클 소량 재공급 (~4초마다 1%) ────────────────────────────────────────
      // 교차점에 장기 누적된 파티클을 랜덤 위치로 돌려보내 순환시킴.
      frameCountRef.current += 1;
      if (frameCountRef.current % 240 === 0) {
        const pts  = particlesRef.current;
        const n400 = Math.floor(pts.length * 0.01); // 1%
        for (let i = 0; i < n400; i++) {
          const idx = Math.floor(Math.random() * pts.length);
          pts[idx].x = Math.random();
          pts[idx].y = Math.random();
        }
      }
    } else {
      // 침묵: SILENCE_HOLD_MS 후 흩어짐 시작
      if (!silenceTimerRef.current && !isScatteringRef.current) {
        silenceTimerRef.current = setTimeout(() => {
          isScatteringRef.current = true;
          silenceTimerRef.current = null;
        }, SILENCE_HOLD_MS);
      }
      if (isScatteringRef.current) {
        // 첫 scatter 프레임에 랜덤 목표 좌표 생성 (25000개 × 2)
        if (!scatterTargetsRef.current) {
          const targets = new Float32Array(PARTICLE_COUNT * 2);
          for (let i = 0; i < PARTICLE_COUNT; i++) {
            targets[i * 2]     = Math.random();
            targets[i * 2 + 1] = Math.random();
          }
          scatterTargetsRef.current = targets;
        }
        stepParticlesScatter(particlesRef.current, scatterTargetsRef.current);
      }
    }

    // 렌더 (침묵/발화 모두)
    const rgb = lastParamsRef.current
      ? hslToRgbArray(lastParamsRef.current.color)
      : selectedColor?.hue == null         // undefined(목소리 자동) or null(흰색) → 중립
        ? [200, 200, 200]
        : hslToRgbArray(`hsl(${selectedColor.hue}, 100%, 55%)`);
    renderAndFlush(canvas, rgb, false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [features, isReady, phase, snrMultiplier, voiceRatioThreshold, vadUpdate, updateChladni, selectedColor]);

  // ── 마이크 오류 ──────────────────────────────────────────────────────────────
  if (micError) {
    return (
      <div className={styles.errorScreen}>
        <p>{micError}</p>
        <button onClick={() => navigate('/')}>돌아가기</button>
      </div>
    );
  }

  const liveSNR         = noiseFloor > 0 ? liveVolume / noiseFloor : 0;
  const isOverThreshold = liveSNR >= snrMultiplier && liveVoiceRatio >= voiceRatioThreshold;

  return (
    <div className={`${styles.container} ${phase === 'preview' ? styles.containerBlack : ''}`}>

      {/* ── 캔버스 + 버튼을 하나로 묶어 중앙 정렬 ── */}
      <div className={styles.canvasGroup}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          onContextMenu={handleCanvasContextMenu}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchEnd}
        />

        {/* 녹음 컨트롤 — 캔버스 바로 아래, recording이 아닐 때 투명 */}
        <div className={`${styles.controls} ${phase !== 'recording' ? styles.controlsHidden : ''}`}>
          <p className={styles.recordHint}>
            {isOverThreshold ? '목소리를 분석하고 있어요' : '말을 해보세요'}
          </p>
          <div className={styles.controlBtns}>
            <button className={styles.backBtn} onClick={() => setPhase('setup')}>← 음성 설정</button>
            <button className={styles.captureButton} onClick={handleCapture}>캡처</button>
          </div>
        </div>
      </div>

      {/* 우상단 숨김 탭 (디버그) */}
      <div className={styles.cornerTap} onClick={handleCornerTap} />

      {/* ── PREVIEW: 캡처 확인 + 저장/전송 ── */}
      {phase === 'preview' && (
          <div className={styles.previewOverlay}>
            <p className={styles.previewHint}>길게 눌러 이미지 저장</p>
            <div className={styles.previewActions}>
              <button className={styles.previewBtn} onClick={handleRetry}>
                다시 녹음
              </button>
              <button className={`${styles.previewBtn} ${styles.previewBtnPrimary}`} onClick={handleSendToAI}>
                AI로 보내기
              </button>
            </div>
            {sendError && <p className={styles.errorMsg}>{sendError}</p>}
          </div>
        )}

      {/* ── SENDING ── */}
      {phase === 'sending' && (
        <div className={styles.sendingOverlay}>
          <div className={styles.sendingSpinner} />
          <p>AI에게 전달 중...</p>
        </div>
      )}

      {/* ── ERROR ── */}
      {phase === 'error' && (
        <div className={styles.overlay}>
          <p className={styles.idleHint}>다시 시도하기</p>
          {sendError && <p className={styles.errorMsg}>{sendError}</p>}
          <button className={styles.backBtn} onClick={() => setPhase('setup')}>← 음성 설정</button>
        </div>
      )}

      {/* ── 디버그 패널 (우상단 5회 탭으로 열기) ── */}
      {debugOpen && (
          <div className={styles.debugPanel}>
            <div className={styles.debugHeader}>
              <span>VAD 디버그</span>
              <button className={styles.debugClose} onClick={() => setDebugOpen(false)}>✕</button>
            </div>
            <div className={styles.debugSection}>
              <p className={styles.debugSectionTitle}>감지 주파수 범위</p>
              {audioInfo ? (
                <div className={styles.debugInfoGrid}>
                  <span className={styles.debugInfoLabel}>대역 통과 필터</span>
                  <span className={styles.debugInfoValue}>{audioInfo.filterMin} Hz ~ {audioInfo.filterMax.toLocaleString()} Hz</span>
                  <span className={styles.debugInfoLabel}>FFT 크기</span>
                  <span className={styles.debugInfoValue}>{audioInfo.fftSize.toLocaleString()} 포인트 ({audioInfo.binCount.toLocaleString()} 빈)</span>
                  <span className={styles.debugInfoLabel}>빈 해상도</span>
                  <span className={styles.debugInfoValue}>~{audioInfo.binWidth.toFixed(1)} Hz/빈</span>
                  <span className={styles.debugInfoLabel}>샘플레이트</span>
                  <span className={styles.debugInfoValue}>{(audioInfo.sampleRate / 1000).toFixed(1)} kHz</span>
                  <span className={styles.debugInfoLabel}>스무딩</span>
                  <span className={styles.debugInfoValue}>{audioInfo.smoothing}</span>
                </div>
              ) : (
                <span className={styles.debugInfoValue}>마이크 연결 대기 중...</span>
              )}
            </div>
            <div className={styles.debugSection}>
              <p className={styles.debugSectionTitle}>노이즈 제거 레이어</p>
              <div className={styles.debugInfoGrid}>
                <span className={styles.debugInfoLabel}>L1 브라우저</span>
                <span className={styles.debugInfoValue}>noiseSuppression + echoCancellation</span>
                <span className={styles.debugInfoLabel}>L2 Web Audio</span>
                <span className={styles.debugInfoValue}>BPF 80 ~ 4,000 Hz (Q=0.7)</span>
                <span className={styles.debugInfoLabel}>L3 voiceRatio</span>
                <span className={styles.debugInfoValue}>음성 대역(85~3,500 Hz) 에너지 비율</span>
              </div>
            </div>
            <div className={styles.debugSection}>
              <div className={styles.debugLabel}>
                볼륨 / SNR
                <span className={styles.debugValue}>{liveVolume.toFixed(3)} / {liveSNR.toFixed(1)}×</span>
                <span className={`${styles.debugBadge} ${isOverThreshold ? styles.speaking : styles.silent}`}>
                  {isOverThreshold ? '발화 중' : '침묵'}
                </span>
              </div>
              <div className={styles.meterTrack}>
                <div className={styles.meterNoiseLine} style={{ left: `${Math.min(noiseFloor * 100, 99)}%` }} />
                <div className={styles.meterThreshold} style={{ left: `${Math.min(noiseFloor * snrMultiplier * 100, 99)}%` }} />
                <div className={`${styles.meterFill} ${isOverThreshold ? styles.meterActive : ''}`} style={{ width: `${Math.min(liveVolume * 100, 100)}%` }} />
              </div>
              <div className={styles.meterLabels}><span>0</span><span>노이즈 {noiseFloor.toFixed(3)}</span><span>1</span></div>
            </div>
            <div className={styles.debugSection}>
              <div className={styles.debugLabel}>
                voiceRatio (L3 노이즈 게이트)
                <span className={styles.debugValue}>{liveVoiceRatio.toFixed(3)}</span>
                <span className={`${styles.debugBadge} ${liveVoiceRatio >= voiceRatioThreshold ? styles.speaking : styles.silent}`}>
                  {liveVoiceRatio >= voiceRatioThreshold ? '목소리' : '노이즈'}
                </span>
              </div>
              <div className={styles.meterTrack}>
                <div className={styles.meterThreshold} style={{ left: `${voiceRatioThreshold * 100}%` }} />
                <div className={`${styles.meterFill} ${liveVoiceRatio >= voiceRatioThreshold ? styles.meterActive : ''}`} style={{ width: `${Math.min(liveVoiceRatio * 100, 100)}%` }} />
              </div>
              <div className={styles.meterLabels}><span>0</span><span>임계 {voiceRatioThreshold.toFixed(2)}</span><span>1</span></div>
            </div>
            <div className={styles.debugSection}>
              <p className={styles.debugSectionTitle}>임계값 조정</p>
              <label className={styles.debugField}>
                <span>SNR 배수 (감도)</span>
                <input type="range" step="0.1" min="0.1" max="5.0" value={snrMultiplier} onChange={(e) => setSnrMultiplier(parseFloat(e.target.value))} className={styles.debugSlider} />
                <span className={styles.debugValue}>{snrMultiplier.toFixed(1)}×</span>
              </label>
              <label className={styles.debugField}>
                <span>노이즈 게이트 (voiceRatio)</span>
                <input type="range" step="0.01" min="0.00" max="0.99" value={voiceRatioThreshold} onChange={(e) => setVoiceRatioThreshold(parseFloat(e.target.value))} className={styles.debugSlider} />
                <span className={styles.debugValue}>{voiceRatioThreshold.toFixed(2)}</span>
              </label>
            </div>
            <button className={styles.debugReset} onClick={() => { setSnrMultiplier(DEFAULT_SNR_MULTIPLIER); setVoiceRatioThreshold(0.30); }}>
              기본값으로 초기화
            </button>
          </div>
        )}

      {/* ── SETUP: VAD 설정 + 색상 선택 (전체 화면 오버레이) ── */}
      {phase === 'setup' && (
        <div className={styles.setupOverlay}>
          <div className={styles.setupPanel}>
            <p className={styles.setupTitle}>목소리 설정</p>

            {/* VAD 미터 — SNR 기반 */}
            <div className={styles.setupSection}>
              <div className={styles.debugLabel}>
                목소리 감지
                <span className={styles.debugValue}>SNR {liveSNR.toFixed(1)}×</span>
                <span className={`${styles.debugBadge} ${isOverThreshold ? styles.speaking : styles.silent}`}>
                  {isOverThreshold ? '감지됨' : '대기 중'}
                </span>
              </div>
              <div className={styles.meterTrack}>
                {/* 노이즈 플로어 선 (노란색) */}
                <div className={styles.meterNoiseLine} style={{ left: `${Math.min(noiseFloor * 100, 99)}%` }} />
                {/* 유효 감지 임계선 (주황색) — 노이즈 플로어 × SNR 배수 */}
                <div className={styles.meterThreshold} style={{ left: `${Math.min(noiseFloor * snrMultiplier * 100, 99)}%` }} />
                <div
                  className={`${styles.meterFill} ${isOverThreshold ? styles.meterActive : ''}`}
                  style={{ width: `${Math.min(liveVolume * 100, 100)}%` }}
                />
              </div>
              <div className={styles.meterLabels}>
                <span>조용</span>
                <span>노이즈 {noiseFloor.toFixed(3)}</span>
                <span>크게</span>
              </div>
              <label className={styles.debugField}>
                <span>감도 (SNR 배수)</span>
                <input
                  type="range" step="0.1" min="0.1" max="5.0"
                  value={snrMultiplier}
                  onChange={(e) => setSnrMultiplier(parseFloat(e.target.value))}
                  className={styles.debugSlider}
                />
                <span className={styles.debugValue}>{snrMultiplier.toFixed(1)}×</span>
              </label>
            </div>

            {/* 색상 선택 */}
            <div className={styles.setupSection}>
              <p className={styles.setupSectionLabel}>파티클 색상</p>
              <div className={styles.colorPalette}>
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c.id}
                    className={`${styles.colorSwatch} ${selectedColor?.id === c.id ? styles.colorSwatchActive : ''}`}
                    onClick={() => setSelectedColor(c)}
                  >
                    <span
                      className={styles.swatchDot}
                      style={
                        c.id === 'voice'
                          ? { background: 'linear-gradient(135deg, #f87171, #facc15, #4ade80, #38bdf8, #a78bfa)' }
                          : { background: c.hex ?? '#e8e8e8' }
                      }
                    />
                    <span className={styles.swatchLabel}>{c.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <button className={styles.startButton} onClick={startRecording}>
              녹음 시작하기
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="36" height="36">
      <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4z" />
      <path d="M19 10a1 1 0 0 0-2 0 5 5 0 0 1-10 0 1 1 0 0 0-2 0 7 7 0 0 0 6 6.93V20H9a1 1 0 0 0 0 2h6a1 1 0 0 0 0-2h-2v-3.07A7 7 0 0 0 19 10z" />
    </svg>
  );
}
