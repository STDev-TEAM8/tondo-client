import { useCallback, useEffect, useRef, useState } from 'react';
import { CosmicBg } from '../components/CosmicBg';
import { CosmicBgLogin } from '../components/CosmicBgLogin';
import { useNavigate } from 'react-router-dom';
import { signup } from '../api/artworkApi';
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

  // 디바이스 목업
  const [deviceType, setDeviceType] = useState('phone');

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
  const s1p          = clamp(progress / 0.65, 0, 1);
  const s1Opacity    = 1 - s1p;
  const s1TranslateY = -s1p * 80;

  const s2Opacity    = s1p;                                        // s1과 동일 구간 → 합 = 1
  const s2p          = clamp((progress - 0.35) / 0.65, 0, 1);    // translateY는 별도
  const s2TranslateY = (1 - s2p) * 80;

  const formActive = progress >= 0.95;

  const carousel = (
    <div
      className={styles.carousel}
      onTouchStart={onCarouselTouchStart}
      onTouchMove={onCarouselTouchMove}
      onTouchEnd={onCarouselTouchEnd}
    >
      <div
        className={styles.carouselTrack}
        style={{ transform: `translateX(-${slideIdx * 100}%)` }}
      >
        {SLIDES.map((src, i) => (
          <img key={i} src={src} alt="" className={styles.carouselImg} draggable={false} />
        ))}
      </div>
      {SLIDES.length > 1 && (
        <div className={styles.carouselDots}>
          {SLIDES.map((_, i) => (
            <button
              key={i}
              className={`${styles.carouselDot} ${i === slideIdx ? styles.carouselDotActive : ''}`}
              onClick={() => setSlideIdx(i)}
            />
          ))}
        </div>
      )}
    </div>
  );

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

      {/* ── Section 1: 타이틀 + 설명 ── */}
      <div
        className={styles.section1}
        style={{
          opacity: s1Opacity,
          transform: `translateY(${s1TranslateY}px)`,
          pointerEvents: progress >= 0.5 ? 'none' : 'auto',
        }}
      >
        <CosmicBg />
        <p className={styles.eyebrow}>당신의 목소리가 예술이 됩니다</p>
        <h1 className={styles.title}>TonDo</h1>
        <p className={styles.description}>
          목소리를 내면 수학적 파동이 그려지고,<br />
          AI가 그 뼈대 위에 색채를 입혀<br />
          세상에 하나뿐인 미디어 아트를 만들어드립니다.
        </p>
        <p className={styles.scrollHint}>아래로 스크롤하여 시작하기</p>
      </div>

      {/* ── Section 2: 좌우 분할 ── */}
      <div
        className={styles.section2}
        style={{
          opacity: s2Opacity,
          transform: `translateY(${s2TranslateY}px)`,
          zIndex: formActive ? 11 : 1,
        }}
        onWheel={handleSection2Wheel}
        onTouchStart={handleSection2TouchStart}
        onTouchMove={handleSection2TouchMove}
      >
        <CosmicBgLogin />

        {/* 왼쪽: 디바이스 목업 */}
        <div className={styles.section2Left}>
          <div className={styles.devicePicker} style={{ marginTop: '-11px' }}>
            {['phone', 'watch', 'laptop'].map((d) => (
              <button
                key={d}
                className={`${styles.deviceBtn} ${deviceType === d ? styles.deviceBtnActive : ''}`}
                onClick={() => setDeviceType(d)}
              >
                {d === 'phone' ? '폰' : d === 'watch' ? '워치' : '노트북'}
              </button>
            ))}
          </div>

          {deviceType === 'phone' && (
            <div className={styles.phoneMock}>
              <div className={styles.phoneScreen}>{carousel}</div>
            </div>
          )}

          {deviceType === 'watch' && (
            <div className={styles.watchWrapper}>
              <div className={styles.watchMock}>
                <div className={styles.watchCrown} />
                <div className={styles.watchScreen}>{carousel}</div>
              </div>
            </div>
          )}

          {deviceType === 'laptop' && (
            <div className={styles.laptopMock}>
              <div className={styles.laptopScreen}>{carousel}</div>
              <div className={styles.laptopBase} />
            </div>
          )}
        </div>

        {/* 오른쪽: 폼 */}
        <div className={styles.section2Right}>
          <div className={styles.loginBox}>
            <p className={styles.formTitle}>체험 등록</p>

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
  );
}
