import { useEffect, useRef } from 'react';

/**
 * 페이지 하단 수직 막대 사운드 비주얼라이저
 *
 * 막대들의 높이 분포 = 가우시안 엔벨로프 × sin 애니메이션
 * → 중앙이 높고 양쪽으로 갈수록 낮아지는 파형 형태
 */

const BAR_COUNT = 72;
const GAP_RATIO = 0.35;  // 막대 너비 대비 간격 비율

// 위치(0~1) → HSL 색상
// 브랜드 그라디언트: 핑크 → 퍼플 → 블루
function barColor(t) {
  if (t < 0.5) {
    // 핑크(338°) → 퍼플(280°)
    const h = 338 - (338 - 280) * (t / 0.5);
    return `hsl(${h.toFixed(1)}, 55%, 32%)`;
  } else {
    // 퍼플(280°) → 블루(210°)
    const h = 280 - (280 - 210) * ((t - 0.5) / 0.5);
    return `hsl(${h.toFixed(1)}, 55%, 32%)`;
  }
}

// 중앙이 1, 양끝이 ~0.15인 가우시안 엔벨로프
function envelope(i, total) {
  const x = (i / (total - 1)) * 2 - 1; // -1 ~ 1
  return 0.15 + 0.85 * Math.exp(-x * x * 2.8);
}

export function SoundBars() {
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);
  const sizeRef   = useRef({ w: 0, h: 0 });

  // 각 막대의 개별 애니메이션 파라미터 (마운트 시 1회 생성)
  const barsRef = useRef(
    Array.from({ length: BAR_COUNT }, (_, i) => ({
      phase:     Math.random() * Math.PI * 2,
      speed:     0.018 + Math.random() * 0.022,
      env:       envelope(i, BAR_COUNT),
      colorStop: i / (BAR_COUNT - 1),
    }))
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      sizeRef.current = { w: canvas.width, h: canvas.height };
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = () => {
      const { w, h } = sizeRef.current;
      if (!w || !h) { rafRef.current = requestAnimationFrame(draw); return; }

      ctx.clearRect(0, 0, w, h);

      const bars    = barsRef.current;
      const slot    = w / BAR_COUNT;
      const barW    = slot * (1 - GAP_RATIO);
      const cy      = h / 2;          // 화면 중앙 기준선
      const maxHalf = h * 0.46;       // 위아래로 뻗는 최대 길이

      bars.forEach((bar, i) => {
        bar.phase += bar.speed;

        // 높이 = 엔벨로프 × sin 합성
        const wave =
          0.55 +
          0.28 * Math.sin(bar.phase) +
          0.12 * Math.sin(bar.phase * 1.7 + 0.9) +
          0.05 * Math.sin(bar.phase * 2.9 + 1.8);

        const half  = maxHalf * bar.env * wave; // 한쪽 길이
        const x     = i * slot + (slot - barW) / 2;
        const color = barColor(bar.colorStop);

        ctx.shadowColor = color;
        ctx.shadowBlur  = 6;

        // 위아래 대칭으로 그라디언트
        const gradUp = ctx.createLinearGradient(0, cy - half, 0, cy);
        gradUp.addColorStop(0,   'rgba(0,0,0,0)');
        gradUp.addColorStop(0.3, color);
        gradUp.addColorStop(1,   color);

        const gradDown = ctx.createLinearGradient(0, cy, 0, cy + half);
        gradDown.addColorStop(0,   color);
        gradDown.addColorStop(0.7, color);
        gradDown.addColorStop(1,   'rgba(0,0,0,0)');

        ctx.globalAlpha = 0.35;

        ctx.fillStyle = gradUp;
        ctx.fillRect(x, cy - half, barW, half);

        ctx.fillStyle = gradDown;
        ctx.fillRect(x, cy, barW, half);
      });

      ctx.globalAlpha = 1;
      ctx.shadowBlur  = 0;

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    />
  );
}
