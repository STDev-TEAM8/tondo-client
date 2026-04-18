import { useState, useEffect, useRef } from 'react';

/**
 * 서버가 25% 단위로 진행률을 보낼 때,
 * 각 구간(0-24, 25-49, 50-74, 75-99) 사이를 천천히 크리프하는 애니메이션 훅
 *
 * 동작 원리:
 *   - 실제 진행률(rawPercent)이 들어오면 즉시 해당 값으로 스냅
 *   - 이후 다음 25% 경계 직전(예: 24, 49, 74, 99)까지 CREEP_PPS(%/s) 속도로 천천히 올라감
 *   - 경계에 닿으면 멈춤 → 다음 실제 업데이트 대기
 */

const CREEP_PPS = 2; // % per second (경계까지 ~12초)

export function useAnimatedProgress(rawPercent) {
  const [displayPercent, setDisplayPercent] = useState(0);
  const displayRef  = useRef(0);
  const rafRef      = useRef(null);
  const lastTsRef   = useRef(null);

  useEffect(() => {
    // 실제 진행률이 현재 표시값보다 크면 즉시 스냅
    if (rawPercent > displayRef.current) {
      displayRef.current = rawPercent;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplayPercent(rawPercent);
    }

    // 다음 25% 경계 직전까지만 크리프 (100% 도달 시 그대로)
    const cap =
      rawPercent >= 100
        ? 100
        : Math.ceil((rawPercent + 1) / 25) * 25 - 1;

    // 기존 애니메이션 취소
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    lastTsRef.current = null;

    // 이미 상한에 도달했으면 크리프 불필요
    if (displayRef.current >= cap) return;

    const tick = (ts) => {
      if (lastTsRef.current === null) lastTsRef.current = ts;
      const elapsed = ts - lastTsRef.current;
      lastTsRef.current = ts;

      const next = Math.min(
        displayRef.current + CREEP_PPS * (elapsed / 1000),
        cap,
      );
      displayRef.current = next;
      setDisplayPercent(next);

      if (next < cap) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [rawPercent]);

  return displayPercent;
}
