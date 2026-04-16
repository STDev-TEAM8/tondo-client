import { useEffect, useRef } from 'react';

/**
 * 성운 배경 — 가스 구름 + 정적 별
 *
 * - 100개의 반투명 가스 구름이 매우 느리게 유동
 * - 별은 최초 1회 좌표 생성 후 고정 (매 프레임 깜빡임 방지)
 */

const PARTICLE_COUNT = 100;
const STAR_COUNT     = 250;

const COLORS = [
  'rgba(0, 212, 255, 0.10)',
  'rgba(161, 250, 255, 0.08)',
  'rgba(255, 81, 250, 0.08)',
  'rgba(70, 72, 76, 0.14)',
];

export function NebulaBg() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let rafId;

    let w = 0, h = 0;

    const resize = () => {
      w = canvas.offsetWidth;
      h = canvas.offsetHeight;
      canvas.width  = w;
      canvas.height = h;
    };
    resize();

    // 별 좌표 1회 생성 (고정)
    const stars = Array.from({ length: STAR_COUNT }, () => ({
      x:    Math.random() * w,
      y:    Math.random() * h,
      size: Math.random() * 1.5,
      a:    Math.random() * 0.5,
    }));

    // 가스 구름 파티클
    const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      x:      Math.random() * w,
      y:      Math.random() * h,
      radius: Math.random() * 200 + 100,
      vx:     (Math.random() - 0.5) * 0.2,
      vy:     (Math.random() - 0.5) * 0.2,
      color:  COLORS[Math.floor(Math.random() * COLORS.length)],
    }));

    const render = () => {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);

      // 별 (고정 위치)
      for (const s of stars) {
        ctx.globalAlpha = s.a;
        ctx.fillStyle   = 'white';
        ctx.fillRect(s.x, s.y, s.size, s.size);
      }
      ctx.globalAlpha = 1;

      // 가스 구름
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -p.radius)      p.x = w + p.radius;
        if (p.x > w + p.radius)   p.x = -p.radius;
        if (p.y < -p.radius)      p.y = h + p.radius;
        if (p.y > h + p.radius)   p.y = -p.radius;

        const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
        grd.addColorStop(0, p.color);
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.fillStyle = grd;
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      rafId = requestAnimationFrame(render);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    render();

    return () => {
      cancelAnimationFrame(rafId);
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
