import { useEffect, useRef } from 'react';

/**
 * 로그인 섹션 배경 — 달 표면 + 행성 + 파티클
 *
 * - 상단 어둡고 하단 밝은 배경 (CosmicBg 반전)
 * - 하단에 달 지형 실루엣
 * - 행성은 주로 상단에 배치
 */

const OBJECT_COUNT   = 10;
const PARTICLE_COUNT = 120;

const PALETTES = [
  { main: '#D1C4E9', glow: 'rgba(209,196,233,0.3)' },
  { main: '#F8BBD0', glow: 'rgba(248,187,208,0.3)' },
  { main: '#B3E5FC', glow: 'rgba(179,229,252,0.3)' },
  { main: '#FFECB3', glow: 'rgba(255,236,179,0.3)' },
];

export function CosmicBgLogin() {
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

      objects = Array.from({ length: OBJECT_COUNT }, () => {
        const p = PALETTES[Math.floor(Math.random() * PALETTES.length)];
        return {
          x:         Math.random() * w,
          y:         Math.random() * (h * 0.7), // 주로 상단
          radius:    Math.random() * 35 + 10,
          vx:        (Math.random() - 0.5) * 0.2,
          vy:        (Math.random() - 0.5) * 0.2,
          color:     p.main,
          glow:      p.glow,
          hasRing:   Math.random() > 0.6,
          ringAngle: Math.random() * Math.PI,
        };
      });

      particles = Array.from({ length: PARTICLE_COUNT }, () => ({
        x:     Math.random() * w,
        y:     Math.random() * h,
        size:  Math.random() * 2 + 0.5,
        alpha: Math.random() * 0.4 + 0.1,
        speed: Math.random() * 0.15 + 0.05,
      }));
    };

    const drawMoonSurface = () => {
      const horizonY = h * 0.82;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, horizonY);
      for (let x = 0; x <= w; x += 20) {
        const y = horizonY + Math.sin(x * 0.01) * 15 + Math.cos(x * 0.005) * 10;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();

      const terrainGrd = ctx.createLinearGradient(0, horizonY, 0, h);
      terrainGrd.addColorStop(0,   '#334155');
      terrainGrd.addColorStop(0.5, '#1E293B');
      terrainGrd.addColorStop(1,   '#0F172A');
      ctx.fillStyle = terrainGrd;
      ctx.fill();

      // 크레이터 텍스처
      for (let i = 0; i < 30; i++) {
        const cx = (i * 137.5) % w;
        const cy = horizonY + 20 + (i * 7.5) % (h - horizonY - 20);
        const cr = 5 + (i % 15);
        ctx.beginPath();
        ctx.ellipse(cx, cy, cr, cr * 0.4, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.fill();
      }
      ctx.restore();
    };

    const render = () => {
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0,   '#1A2533');
      bg.addColorStop(0.6, '#4A6076');
      bg.addColorStop(1,   '#8E9EAB');
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
        if (o.x < -100)    o.x = w + 100;
        if (o.x > w + 100) o.x = -100;
        if (o.y < -100)    o.y = h + 100;
        if (o.y > h + 100) o.y = -100;

        ctx.save();
        ctx.shadowBlur  = 15;
        ctx.shadowColor = o.glow;

        const grd = ctx.createRadialGradient(
          o.x - o.radius * 0.3, o.y - o.radius * 0.3, o.radius * 0.1,
          o.x, o.y, o.radius,
        );
        grd.addColorStop(0,   '#FFFFFF');
        grd.addColorStop(0.4, o.color);
        grd.addColorStop(1,   o.color + '88');
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.radius, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();

        if (o.hasRing) {
          ctx.beginPath();
          ctx.ellipse(o.x, o.y, o.radius * 2.2, o.radius * 0.6, o.ringAngle, 0, Math.PI * 2);
          ctx.strokeStyle = o.glow;
          ctx.lineWidth   = 1.5;
          ctx.stroke();
        }
        ctx.restore();
      }

      drawMoonSurface();

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
