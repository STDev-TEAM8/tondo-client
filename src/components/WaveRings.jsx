import { useEffect, useRef } from 'react';

/**
 * 타이틀 주변을 감싸는 동심 파동 링 컴포넌트
 *
 * 각 링은 sin 파동으로 반지름이 변하는 닫힌 경로이며,
 * 개별 phase가 독립적으로 진행되어 유기적인 움직임을 만든다.
 */

// r     : 기준 반지름 (canvas 짧은변 절반 대비 비율)
// amp   : 파동 진폭 (동일 비율)
// freq  : 한 바퀴에 들어가는 파동 수
// speed : 위상 증가 속도 (rad/frame)
// color : 선 색상
// alpha : 불투명도
const RINGS = [
  { r: 0.55, amp: 0.028, freq: 6, speed:  0.013, color: '#ff2d78', alpha: 0.90 },
  { r: 0.59, amp: 0.034, freq: 7, speed:  0.010, color: '#e040fb', alpha: 0.85 },
  { r: 0.63, amp: 0.031, freq: 5, speed:  0.014, color: '#b060f4', alpha: 0.80 },
  { r: 0.67, amp: 0.037, freq: 6, speed:  0.008, color: '#8050f0', alpha: 0.75 },
  { r: 0.71, amp: 0.033, freq: 7, speed:  0.012, color: '#4878f0', alpha: 0.70 },
  { r: 0.75, amp: 0.029, freq: 5, speed:  0.010, color: '#1a9fe0', alpha: 0.62 },
  { r: 0.79, amp: 0.024, freq: 6, speed:  0.013, color: '#00c4f5', alpha: 0.52 },
];

const STEPS = 400; // 경로 정밀도

export function WaveRings() {
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);
  const phaseRef  = useRef(RINGS.map((_, i) => (i * Math.PI * 2) / RINGS.length));
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

    const draw = () => {
      const { w, h } = sizeRef.current;
      if (!w || !h) { rafRef.current = requestAnimationFrame(draw); return; }

      ctx.clearRect(0, 0, w, h);

      const cx   = w / 2;
      const cy   = h / 2;
      const half = Math.min(w, h) / 2;

      RINGS.forEach((ring, i) => {
        phaseRef.current[i] += ring.speed;
        const phase  = phaseRef.current[i];
        const baseR  = ring.r   * half;
        const amp    = ring.amp * half;

        ctx.beginPath();
        for (let s = 0; s <= STEPS; s++) {
          const angle = (s / STEPS) * Math.PI * 2;
          const r     = baseR + amp * Math.sin(ring.freq * angle + phase);
          const x     = cx + r * Math.cos(angle);
          const y     = cy + r * Math.sin(angle);
          s === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();

        ctx.strokeStyle  = ring.color;
        ctx.globalAlpha  = ring.alpha;
        ctx.lineWidth    = 1.5;
        ctx.shadowColor  = ring.color;
        ctx.shadowBlur   = 12;
        ctx.stroke();

        // 같은 링을 살짝 다른 위상으로 한번 더 그려 깊이감 추가
        ctx.beginPath();
        for (let s = 0; s <= STEPS; s++) {
          const angle = (s / STEPS) * Math.PI * 2;
          const r     = baseR + amp * Math.sin(ring.freq * angle + phase + 0.6);
          const x     = cx + r * Math.cos(angle);
          const y     = cy + r * Math.sin(angle);
          s === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.globalAlpha  = ring.alpha * 0.45;
        ctx.lineWidth    = 1;
        ctx.shadowBlur   = 6;
        ctx.stroke();
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
