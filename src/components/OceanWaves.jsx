import { useEffect, useRef } from 'react';

/**
 * 3안 — 바닷물 일렁임 전체 배경
 *
 * 여러 파도 레이어가 각기 다른 속도·주파수로 움직이며
 * 화면 전체에 깊은 바다의 출렁임을 만들어낸다.
 */

// baseline : 캔버스 높이 대비 파도 기준선 위치 (0=상단, 1=하단)
// amp      : 진폭 (높이 비율)
// f1, f2   : 주요·보조 주파수 (화면 너비 기준 사이클 수)
// s1, s2   : 위상 진행 속도 (rad/frame) — 음수면 반대 방향
// color    : 레이어 채우기 색
const LAYERS = [
  { baseline: 0.05, amp: 0.045, f1: 1.4, f2: 0.7, s1:  0.0028, s2: -0.0018, color: 'rgba(14, 42, 96,  0.18)' },
  { baseline: 0.20, amp: 0.055, f1: 1.1, f2: 0.9, s1: -0.0035, s2:  0.0022, color: 'rgba(10, 32, 78,  0.22)' },
  { baseline: 0.36, amp: 0.060, f1: 0.8, f2: 1.2, s1:  0.0042, s2: -0.0028, color: 'rgba( 7, 24, 60,  0.28)' },
  { baseline: 0.52, amp: 0.052, f1: 1.2, f2: 0.6, s1: -0.0030, s2:  0.0035, color: 'rgba( 5, 18, 46,  0.34)' },
  { baseline: 0.68, amp: 0.044, f1: 0.9, f2: 1.1, s1:  0.0038, s2: -0.0020, color: 'rgba( 3, 12, 32,  0.42)' },
  { baseline: 0.82, amp: 0.034, f1: 1.3, f2: 0.8, s1: -0.0025, s2:  0.0030, color: 'rgba( 2,  8, 22,  0.52)' },
];

// 파도 크레스트에 얇은 하이라이트 선 (수면 반사 느낌)
const CREST_COLOR = 'rgba(80, 140, 200, 0.12)';

const INITIAL_TIMES = LAYERS.map(() => ({ t1: Math.random() * Math.PI * 2, t2: Math.random() * Math.PI * 2 }));

export function OceanWaves() {
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);
  const timeRef   = useRef(INITIAL_TIMES);
  const sizeRef   = useRef({ w: 0, h: 0 });

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

    // x 위치에서 파도 y 좌표 계산
    const waveY = (layer, t, x, w, h) => {
      const sinA = Math.sin(layer.f1 * (x / w) * Math.PI * 2 + t.t1);
      const sinB = Math.sin(layer.f2 * (x / w) * Math.PI * 2 + t.t2);
      return (layer.baseline + layer.amp * (0.65 * sinA + 0.35 * sinB)) * h;
    };

    const draw = () => {
      const { w, h } = sizeRef.current;
      if (!w || !h) { rafRef.current = requestAnimationFrame(draw); return; }

      ctx.clearRect(0, 0, w, h);

      LAYERS.forEach((layer, i) => {
        const t = timeRef.current[i];
        t.t1 += layer.s1;
        t.t2 += layer.s2;

        const STEPS = Math.ceil(w / 2); // 2px 간격으로 샘플링

        // ── 채워진 파도 면 ─────────────────────────────────
        ctx.beginPath();
        ctx.moveTo(0, waveY(layer, t, 0, w, h));
        for (let s = 1; s <= STEPS; s++) {
          const x = (s / STEPS) * w;
          ctx.lineTo(x, waveY(layer, t, x, w, h));
        }
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        ctx.fillStyle = layer.color;
        ctx.fill();

        // ── 크레스트 하이라이트 선 ──────────────────────────
        ctx.beginPath();
        ctx.moveTo(0, waveY(layer, t, 0, w, h));
        for (let s = 1; s <= STEPS; s++) {
          const x = (s / STEPS) * w;
          ctx.lineTo(x, waveY(layer, t, x, w, h));
        }
        ctx.strokeStyle = CREST_COLOR;
        ctx.lineWidth   = 1;
        ctx.stroke();
      });

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
