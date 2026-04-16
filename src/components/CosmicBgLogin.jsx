import { useEffect, useRef } from 'react';

const COLORS = [
  { main: '#D1C4E9', glow: 'rgba(209, 196, 233, 0.3)' },
  { main: '#F8BBD0', glow: 'rgba(248, 187, 208, 0.3)' },
  { main: '#B3E5FC', glow: 'rgba(179, 229, 252, 0.3)' },
  { main: '#FFECB3', glow: 'rgba(255, 236, 179, 0.3)' },
];

function makeObject(w, h) {
  const c = COLORS[Math.floor(Math.random() * COLORS.length)];
  return {
    x: Math.random() * w,
    y: Math.random() * (h * 0.7),
    radius: Math.random() * 35 + 10,
    vx: (Math.random() - 0.5) * 0.2,
    vy: (Math.random() - 0.5) * 0.2,
    color: c.main,
    glowColor: c.glow,
    hasRing: Math.random() > 0.6,
    ringAngle: Math.random() * Math.PI,
  };
}

function makeParticle(w, h) {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    size: Math.random() * 2 + 0.5,
    alpha: Math.random() * 0.4 + 0.1,
    speed: Math.random() * 0.15 + 0.05,
  };
}

export function CosmicBgLogin() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let w = 0, h = 0;
    let objects = [];
    let particles = [];

    const build = () => {
      w = canvas.offsetWidth;
      h = canvas.offsetHeight;
      canvas.width = w;
      canvas.height = h;
      objects = Array.from({ length: 10 }, () => makeObject(w, h));
      particles = Array.from({ length: 120 }, () => makeParticle(w, h));
    };

    const drawRoundedMoonSurface = () => {
      ctx.save();
      const centerX = w / 2;
      const centerY = h * 1.6;
      const radius = h * 0.85;

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);

      const terrainGrd = ctx.createLinearGradient(0, h * 0.7, 0, h);
      terrainGrd.addColorStop(0, '#334155');
      terrainGrd.addColorStop(0.6, '#1E293B');
      terrainGrd.addColorStop(1, '#0F172A');
      ctx.fillStyle = terrainGrd;
      ctx.fill();

      for (let i = 0; i < 20; i++) {
        const angle = Math.PI * 1.2 + Math.random() * Math.PI * 0.6;
        const dist = radius - 10 - Math.random() * 100;
        const cx = centerX + Math.cos(angle) * dist;
        const cy = centerY + Math.sin(angle) * dist;
        if (cy > h * 0.75) {
          const cr = 8 + Math.random() * 20;
          ctx.beginPath();
          ctx.ellipse(cx, cy, cr, cr * 0.5, angle + Math.PI / 2, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
          ctx.fill();
        }
      }
      ctx.restore();
    };

    const render = () => {
      const bgGradient = ctx.createLinearGradient(0, 0, 0, h);
      bgGradient.addColorStop(0, '#1A2533');
      bgGradient.addColorStop(0.6, '#4A6076');
      bgGradient.addColorStop(1, '#8E9EAB');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, w, h);

      for (const p of particles) {
        p.y -= p.speed;
        if (p.y < 0) p.y = h;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${p.alpha})`;
        ctx.fill();
      }

      for (const o of objects) {
        o.x += o.vx;
        o.y += o.vy;
        if (o.x < -100) o.x = w + 100;
        if (o.x > w + 100) o.x = -100;
        if (o.y < -100) o.y = h + 100;
        if (o.y > h + 100) o.y = -100;

        ctx.save();
        ctx.shadowBlur = 15;
        ctx.shadowColor = o.glowColor;
        const grd = ctx.createRadialGradient(
          o.x - o.radius * 0.3, o.y - o.radius * 0.3, o.radius * 0.1,
          o.x, o.y, o.radius
        );
        grd.addColorStop(0, '#FFFFFF');
        grd.addColorStop(0.4, o.color);
        grd.addColorStop(1, '#1A1A1A');
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.radius, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
        if (o.hasRing) {
          ctx.beginPath();
          ctx.ellipse(o.x, o.y, o.radius * 2.2, o.radius * 0.5, o.ringAngle, 0, Math.PI * 2);
          ctx.strokeStyle = o.glowColor;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        ctx.restore();
      }

      drawRoundedMoonSurface();
      animationFrameId = requestAnimationFrame(render);
    };

    build();
    const ro = new ResizeObserver(build);
    ro.observe(canvas);
    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
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
