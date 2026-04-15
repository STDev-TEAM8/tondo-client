import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { signup } from '../api/artworkApi';
import styles from './LandingPage.module.css';

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

export default function LandingPage() {
  const navigate = useNavigate();
  const scrollRef = useRef(null);
  const touchYRef = useRef(0);

  const [progress, setProgress] = useState(0); // 0(타이틀) → 1(폼)
  const [name, setName]   = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);

  const canStart = name.trim().length > 0 && phone.replace(/\D/g, '').length >= 10;

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
    el.scrollTop += e.deltaY;
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
    el.scrollTop += delta;
  }, []);

  // ── 전화번호 자동 포맷 ──
  const handlePhoneChange = (e) => {
    const d = e.target.value.replace(/\D/g, '').slice(0, 11);
    let fmt = d;
    if (d.length > 7)      fmt = `${d.slice(0,3)}-${d.slice(3,7)}-${d.slice(7)}`;
    else if (d.length > 3) fmt = `${d.slice(0,3)}-${d.slice(3)}`;
    setPhone(fmt);
  };

  // ── 체험 시작 ──
  const handleStart = async () => {
    if (!canStart || loading) return;
    setLoading(true);
    setError(null);
    try {
      await signup({ name: name.trim(), phoneNumber: phone.replace(/\D/g, '') });
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
  const s1p         = clamp(progress / 0.65, 0, 1);
  const s1Opacity   = 1 - s1p;
  const s1TranslateY = -s1p * 80;

  const s2p         = clamp((progress - 0.35) / 0.65, 0, 1);
  const s2Opacity   = s2p;
  const s2TranslateY = (1 - s2p) * 80;

  // 폼이 활성화되면 section2를 scroller 위로 올려서 입력 가능하게 함
  // 동시에 section2에서 휠/터치 이벤트를 포워딩해 위로 되돌아가기 지원
  const formActive = progress >= 0.95;

  return (
    <div className={styles.outer}>

      {/* 투명 스크롤 드라이버 (항상 pointer-events: auto) */}
      <div
        ref={scrollRef}
        className={styles.scroller}
        onScroll={handleScroll}
      >
        <div className={styles.spacer} />
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
        <p className={styles.eyebrow}>당신의 목소리가 예술이 됩니다</p>
        <h1 className={styles.title}>TonDo</h1>
        <p className={styles.description}>
          목소리를 내면 수학적 파동이 그려지고,<br />
          AI가 그 뼈대 위에 색채를 입혀<br />
          세상에 하나뿐인 미디어 아트를 만들어드립니다.
        </p>
        <p className={styles.scrollHint}>아래로 스크롤하여 시작하기</p>
      </div>

      {/* ── Section 2: 등록 폼 ── */}
      <div
        className={styles.section2}
        style={{
          opacity: s2Opacity,
          transform: `translateY(${s2TranslateY}px)`,
          // 활성화 시 scroller(z-index:10) 위로 올라와 입력 가능
          zIndex: formActive ? 11 : 1,
        }}
        onWheel={handleSection2Wheel}
        onTouchStart={handleSection2TouchStart}
        onTouchMove={handleSection2TouchMove}
      >
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
            type="tel"
            placeholder="010-0000-0000"
            value={phone}
            onChange={handlePhoneChange}
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
  );
}
