import { useCallback, useEffect, useRef, useState } from 'react';
import { VoiceWaveBg } from '../components/VoiceWaveBg';
import { useMicLevel } from '../hooks/useMicLevel';
import { useNavigate } from 'react-router-dom';
import { signup } from '../api/artworkApi';
import phoneImage from '../assets/img.png';
import ipadImage from '../assets/ex2.png';
import styles from './LandingPage.module.css';

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

// 나중에 이미지 추가 시 여기에 경로만 추가
const SLIDES = ['/ref1.jpg', '/ref2.jpg'];

export default function LandingPage() {
  const navigate = useNavigate();
  const scrollRef  = useRef(null);
  const touchYRef  = useRef(0);

  const [progress, setProgress] = useState(0); // 0(타이틀) → 1(폼)
  const [name, setName] = useState('');
  const [pin, setPin]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  // 캐러셀
  const [slideIdx, setSlideIdx] = useState(0);
  const carouselDragRef = useRef({ x: 0, y: 0 });

  // 마이크 — 두 섹션의 파동을 사용자의 목소리로 살리는 인터랙티브
  const [micEnabled, setMicEnabled] = useState(false);
  const micRef = useMicLevel(micEnabled);

  // 이미지 2장 이상일 때 자동 슬라이드
  useEffect(() => {
    if (SLIDES.length <= 1) return;
    const t = setInterval(() => setSlideIdx(i => (i + 1) % SLIDES.length), 3500);
    return () => clearInterval(t);
  }, []);

  const onCarouselTouchStart = (e) => {
    carouselDragRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onCarouselTouchMove = (e) => {
    const dx = Math.abs(e.touches[0].clientX - carouselDragRef.current.x);
    const dy = Math.abs(e.touches[0].clientY - carouselDragRef.current.y);
    if (dx > dy * 1.5) e.stopPropagation(); // 가로 스와이프 → 섹션 스크롤 차단
  };
  const onCarouselTouchEnd = (e) => {
    const dx = carouselDragRef.current.x - e.changedTouches[0].clientX;
    const dy = Math.abs(carouselDragRef.current.y - e.changedTouches[0].clientY);
    if (Math.abs(dx) > 40 && Math.abs(dx) > dy * 1.5) {
      setSlideIdx(i => dx > 0 ? (i + 1) % SLIDES.length : (i - 1 + SLIDES.length) % SLIDES.length);
    }
  };

  const canStart = name.trim().length > 0 && pin.length === 4;

  const handlePinChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
    setPin(digits);
  };

  // ── 스크롤 진행도 ──
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    setProgress(max > 0 ? el.scrollTop / max : 0);
  }, []);

  // ── Section2 위에서 휠/터치 → 스크롤러에 포워딩 (위로 되돌아가기 지원) ──
  const handleSection2Wheel = useCallback((e) => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    // 방향에 따라 스냅 포인트로 즉시 점프 → sections CSS transition이 시각적 전환 처리
    el.scrollTop = e.deltaY < 0 ? 0 : max;
  }, []);

  const handleSection2TouchStart = useCallback((e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
    touchYRef.current = e.touches[0].clientY;
  }, []);

  const handleSection2TouchMove = useCallback((e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
    const el = scrollRef.current;
    if (!el) return;
    const delta = touchYRef.current - e.touches[0].clientY;
    touchYRef.current = e.touches[0].clientY;
    const max = el.scrollHeight - el.clientHeight;
    el.scrollTop = delta > 0 ? max : 0;
  }, []);


  // ── 체험 시작 ──
  const handleStart = async () => {
    if (!canStart || loading) return;
    setLoading(true);
    setError(null);
    try {
      await signup({ name: name.trim(), password: pin });
      await navigator.mediaDevices.getUserMedia({ audio: true });
      navigate('/visualizer');
    } catch (err) {
      setError(
        err.name === 'NotAllowedError'
          ? '마이크 권한을 허용해야 체험할 수 있어요.'
          : '등록에 실패했습니다. 다시 시도해주세요.',
      );
      setLoading(false);
    }
  };

  // ── 애니메이션 값 ──
  // 두 섹션이 이어진 단일 트랙을 progress에 맞춰 위로 당긴다.
  // pageTrack 높이 = 200% → translateY(-50%) 이면 section2가 뷰포트에 꽉 참.
  const trackTranslateY = -progress * 50;

  // 폼이 활성화되면 pageTrack을 scroller 위로 올려서 입력 가능하게 함
  // 동시에 section2에서 휠/터치 이벤트를 포워딩해 위로 되돌아가기 지원
  const formActive = progress >= 0.95;
  // 슬라이드 + 페이드를 하나의 값으로 묶어 완전히 동시에 진행
  const phoneReveal = clamp((progress - 0.1) / 0.55, 0, 1);
  // 맥북 뒤 레이어의 워치/아이폰 밀어내기 — 스크롤이 진행되면 좌우로 빠져나간다
  const pushOut = progress >= 0.5;

  return (
    <div className={styles.outer}>

      {/* 투명 스크롤 드라이버 (항상 pointer-events: auto) */}
      <div
        ref={scrollRef}
        className={styles.scroller}
        onScroll={handleScroll}
      >
        <div className={styles.snapPoint} />
        <div className={styles.snapPoint} />
      </div>

      {/* ── 두 섹션이 이어진 세로 트랙 ── */}
      <div
        className={styles.pageTrack}
        style={{
          transform: `translateY(${trackTranslateY}%)`,
          zIndex: formActive ? 11 : 1,
        }}
      >

      {/* 두 섹션을 관통하는 단일 파동 캔버스 — 경계를 가로지르는 bridge wave */}
      <VoiceWaveBg micRef={micRef} />

      {/* ── Section 1: 타이틀 + 설명 ── */}
      <div
        className={styles.section1}
        style={{
          pointerEvents: progress >= 0.5 ? 'none' : 'auto',
        }}
      >
        <p className={styles.eyebrow}>소리를 그리다,</p>
        <h1 className={styles.title}>TonDo</h1>
        <p className={styles.description}>
          목소리를 들려주세요. 당신의 파동이 세상에 하나뿐인 작품이 됩니다.
        </p>
        <button
          type="button"
          className={`${styles.micToggle} ${micEnabled ? styles.micToggleActive : ''}`}
          onClick={() => setMicEnabled((v) => !v)}
        >
          <span className={styles.micDot} />
          {micEnabled ? '소리를 내보세요' : '마이크로 파동 만들기'}
        </button>
        <p className={styles.scrollHint}>아래로 스크롤하여 시작하기</p>
      </div>

      {/* ── Section 2: 비주얼 + 폼 영역 ── */}
      <div
        className={styles.section2}
        onWheel={handleSection2Wheel}
        onTouchStart={handleSection2TouchStart}
        onTouchMove={handleSection2TouchMove}
      >
        <div className={styles.section2Left}>
          {/* ── 기존 iPhone 16 메인 목업 (주석 처리) ──
          <div className={styles.phoneMock}>
            <div className={styles.phoneScreen}>
              <div className={styles.screenGlass}>
                <img className={styles.phoneScreenImage} src={phoneImage} alt="phone content" />
                <div className={styles.phoneNotch} />
              </div>
            </div>
          </div>
          */}

          {/* ── 뒤 레이어: Apple Watch SE2 (왼쪽으로 밀어내기) ── */}
          <div
            className={`${styles.watchMock} ${pushOut ? styles.watchMockPushed : ''}`}
          >
            <div className={styles.watchScreen}>
              <img className={styles.watchScreenImage} src={phoneImage} alt="watch content" />
            </div>
            <div className={styles.watchCrown} />
            <div className={styles.watchSideButton} />
          </div>

          {/* ── 뒤 레이어: iPhone 16 (오른쪽으로 밀어내기) ── */}
          <div
            className={`${styles.iphoneSideMock} ${pushOut ? styles.iphoneSideMockPushed : ''}`}
          >
            <div className={styles.iphoneSideScreen}>
              <div className={styles.screenGlass}>
                <img className={styles.iphoneSideScreenImage} src={phoneImage} alt="iphone content" />
                <div className={styles.iphoneSideNotch} />
              </div>
            </div>
          </div>

          {/* ── 앞 레이어: iPad Pro 목업 ── */}
          <div className={styles.ipadMock}>
            <div className={styles.ipadScreenWrap}>
              <div className={styles.ipadNotch} />
              <div className={styles.ipadScreen}>
                <img className={styles.ipadScreenImage} src={ipadImage} alt="ipad content" />
              </div>
            </div>
          </div>
        </div>

        <div className={styles.section2Right}>
          <div className={styles.loginBox}>
            <div className={styles.formGroup}>
              <input
                className={styles.input}
                type="text"
                placeholder="이름"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
              />
              <input
                className={styles.input}
                type="password"
                inputMode="numeric"
                placeholder="비밀번호 4자리"
                value={pin}
                onChange={handlePinChange}
                maxLength={4}
              />
            </div>

            <div
              className={styles.btnWrap}
              style={{
                opacity: canStart ? 1 : 0,
                transform: canStart ? 'translateY(0)' : 'translateY(14px)',
                pointerEvents: canStart ? 'auto' : 'none',
              }}
            >
              <button
                className={styles.startButton}
                onClick={handleStart}
                disabled={loading || !canStart}
              >
                {loading ? '확인 중...' : '체험 시작하기'}
              </button>
            </div>

            {error && <p className={styles.error}>{error}</p>}
          </div>
        </div>
      </div>

      </div>
      {/* pageTrack 끝 */}

    </div>
  );
}
