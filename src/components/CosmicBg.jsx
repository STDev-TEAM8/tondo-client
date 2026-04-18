import { useEffect, useRef } from 'react';

/**
 * 우주 탐험 배경
 *
 * - 입체 행성(구체 + 고리) + 부유 파티클
 * - 연보라/분홍/하늘/골드 파스텔 색감
 */

const OBJECT_COUNT   = 6;
const PARTICLE_COUNT = 150;

const PALETTES = [
  { main: '#E8DEFF', glow: 'rgba(200,185,255,0.35)' }, // 연보라
  { main: '#FFD6E8', glow: 'rgba(255,180,210,0.35)' }, // 연분홍
  { main: '#C8EEFF', glow: 'rgba(160,220,255,0.35)' }, // 하늘
  { main: '#FFF0C8', glow: 'rgba(255,225,150,0.35)' }, // 연노랑
  { main: '#D6FFE8', glow: 'rgba(160,255,200,0.35)' }, // 민트
  { main: '#FFE0D0', glow: 'rgba(255,190,155,0.35)' }, // 복숭아
];

// 행성별 고정 크기 (모두 다르게)
const SIZES = [22, 48, 80, 35, 110, 62];

export function CosmicBg() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let rafId;
    let w = 0, h = 0;

    let objects   = [];
    let particles = [];

    const build = () => {
      w = canvas.offsetWidth;
      h = canvas.offsetHeight;
      canvas.width  = w;
      canvas.height = h;

      objects = Array.from({ length: OBJECT_COUNT }, (_, i) => {
        const p = PALETTES[i % PALETTES.length]; // 팔레트 순서 배정 (겹침 없음)
        return {
          x:         Math.random() * w,
          y:         Math.random() * h,
          radius:    SIZES[i],                   // 각자 고정된 다른 크기
          vx:        (Math.random() - 0.5) * 0.3,
          vy:        (Math.random() - 0.5) * 0.3,
          color:     p.main,
          glow:      p.glow,
          hasRing:   Math.random() > 0.5,
          ringAngle: Math.random() * Math.PI,
        };
      });

      particles = Array.from({ length: PARTICLE_COUNT }, () => ({
        x:     Math.random() * w,
        y:     Math.random() * h,
        size:  Math.random() * 3 + 1,
        alpha: Math.random() * 0.5 + 0.2,
        speed: Math.random() * 0.2 + 0.1,
      }));
    };

    const render = () => {
      // 배경 그라데이션
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0,   '#2C3E50');
      bg.addColorStop(0.5, '#4A6076');
      bg.addColorStop(1,   '#7F8C8D');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // 파티클
      for (const p of particles) {
        p.y -= p.speed;
        if (p.y < 0) p.y = h;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${p.alpha})`;
        ctx.fill();
      }

      // 행성
      for (const o of objects) {
        o.x += o.vx; o.y += o.vy;
        if (o.x < -100)      o.x = w + 100;
        if (o.x > w + 100)   o.x = -100;
        if (o.y < -100)      o.y = h + 100;
        if (o.y > h + 100)   o.y = -100;

        if (o.hasRing) {
          ctx.save();
          ctx.beginPath();
          ctx.ellipse(o.x, o.y, o.radius * 2.2, o.radius * 0.5, o.ringAngle, 0, Math.PI * 2);
          ctx.strokeStyle = o.glow;
          ctx.lineWidth   = 10;
          ctx.stroke();
          ctx.restore();
        }

        ctx.save();
        ctx.shadowBlur  = 20;
        ctx.shadowColor = o.glow;

        const grd = ctx.createRadialGradient(
          o.x - o.radius * 0.3, o.y - o.radius * 0.3, o.radius * 0.1,
          o.x, o.y, o.radius,
        );
        grd.addColorStop(0,   '#FFFFFF');
        grd.addColorStop(0.4, o.color);
        grd.addColorStop(1,   o.color + '88'); // 파스텔 그림자 (반투명)

        ctx.beginPath();
        ctx.arc(o.x, o.y, o.radius, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
        ctx.restore();
      }

      rafId = requestAnimationFrame(render);
    };

    build();
    const ro = new ResizeObserver(build);
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
        top: '-15%',
        left: 0,
        width: '100%',
        height: '130%',
        pointerEvents: 'none',
      }}
    />
  );
}
