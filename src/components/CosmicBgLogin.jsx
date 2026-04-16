import { useEffect, useRef } from 'react';

const COLORS = [
  { main: '#9575CD', glow: 'rgba(149, 117, 205, 0.2)' },
  { main: '#E991B0', glow: 'rgba(233, 145, 176, 0.2)' },
  { main: '#64B5D6', glow: 'rgba(100, 181, 214, 0.2)' },
  { main: '#D4B87A', glow: 'rgba(212, 184, 122, 0.2)' },
];

function makeObject(w, h) {
  const c = COLORS[Math.floor(Math.random() * COLORS.length)];
  return {
    x: Math.random() * w,
    y: Math.random() * (h * 0.7),
    radius: Math.random() * 50 + 25,
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.5) * 0.3,
    color: c.main,
    glowColor: c.glow,
    hasRing: Math.random() > 0.5,
    ringAngle: Math.random() * Math.PI,
  };
}

function makeParticle(w, h) {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    size: Math.random() * 1.5 + 0.5,
    alpha: Math.random() * 0.3 + 0.1,
    speed: Math.random() * 0.008 + 0.002,
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
    let time = 0;
    let objects = [];
    let particles = [];
    let craters = [];

    const build = () => {
      w = canvas.offsetWidth;
      h = canvas.offsetHeight;
      canvas.width = w;
      canvas.height = h;
      objects = Array.from({ length: 8 }, () => makeObject(w, h));
      particles = Array.from({ length: 120 }, () => makeParticle(w, h));
      craters = Array.from({ length: 30 }, () => ({
        angle: Math.PI * 1.1 + Math.random() * Math.PI * 0.8,
        dist:  Math.random() * 140 + 10,
        size:  Math.random() * 20 + 5,
      }));
    };

    const drawObject = (o) => {
      ctx.save();

      ctx.shadowBlur = 2;
      ctx.shadowColor = o.glowColor;

      const gradient = ctx.createRadialGradient(
        o.x - o.radius * 0.4, o.y - o.radius * 0.4, o.radius * 0.05,
        o.x, o.y, o.radius
      );
      gradient.addColorStop(0, '#FFFFFF');
      gradient.addColorStop(0.25, o.color);
      gradient.addColorStop(0.7, o.color + 'AA');
      gradient.addColorStop(1, o.color + '44');

      ctx.beginPath();
      ctx.arc(o.x, o.y, o.radius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(o.x, o.y, o.radius, 0, Math.PI * 2);
      const rimGrd = ctx.createRadialGradient(
        o.x + o.radius * 0.5, o.y + o.radius * 0.5, 0,
        o.x + o.radius * 0.5, o.y + o.radius * 0.5, o.radius
      );
      rimGrd.addColorStop(0, 'rgba(255,255,255,0.05)');
      rimGrd.addColorStop(0.8, 'rgba(255,255,255,0)');
      ctx.fillStyle = rimGrd;
      ctx.fill();

      if (o.hasRing) {
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.ellipse(o.x, o.y, o.radius * 2.3, o.radius * 0.5, o.ringAngle, 0, Math.PI * 2);
        const ringGrd = ctx.createLinearGradient(o.x - o.radius * 2, o.y, o.x + o.radius * 2, o.y);
        ringGrd.addColorStop(0, 'rgba(255,255,255,0)');
        ringGrd.addColorStop(0.5, o.glowColor);
        ringGrd.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = ringGrd;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      ctx.restore();
    };

    const drawWideRoundedMoonSurface = () => {
      ctx.save();
      const centerX = w / 2;
      const centerY = h * 2.3;
      const radius = h * 1.55;
      const surfaceRotation = time * 0.00005;

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);

      const terrainGrd = ctx.createLinearGradient(0, h * 0.75, 0, h);
      terrainGrd.addColorStop(0, '#4A4840');
      terrainGrd.addColorStop(0.5, '#2E2C26');
      terrainGrd.addColorStop(1, '#141310');
      ctx.fillStyle = terrainGrd;
      ctx.fill();

      for (const crater of craters) {
        const currentAngle = crater.angle + surfaceRotation;
        const cx = centerX + Math.cos(currentAngle) * (radius - crater.dist);
        const cy = centerY + Math.sin(currentAngle) * (radius - crater.dist);

        if (cy > h * 0.78 && cy < h + 100 && cx > -50 && cx < w + 50) {
          const cr = crater.size;
          const tilt = currentAngle + Math.PI / 2;
          // 광원은 왼쪽 상단 → 그림자는 오른쪽 하단
          const shadowOffsetX = cr * 0.3;
          const shadowOffsetY = cr * 0.15;

          // 1. 외곽 림(rim) — 밝은 테두리
          ctx.beginPath();
          ctx.ellipse(cx, cy, cr + 2, (cr + 2) * 0.4, tilt, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(180,180,160,0.07)';
          ctx.fill();

          // 2. 크레이터 내부 — 어두운 움푹 파인 느낌
          const innerGrd = ctx.createRadialGradient(
            cx + shadowOffsetX, cy + shadowOffsetY, 0,
            cx, cy, cr
          );
          innerGrd.addColorStop(0,   'rgba(0,0,0,0.45)');
          innerGrd.addColorStop(0.6, 'rgba(0,0,0,0.2)');
          innerGrd.addColorStop(1,   'rgba(0,0,0,0)');
          ctx.beginPath();
          ctx.ellipse(cx, cy, cr, cr * 0.4, tilt, 0, Math.PI * 2);
          ctx.fillStyle = innerGrd;
          ctx.fill();

          // 3. 하이라이트 — 빛 받는 쪽 림 밝게
          const hlGrd = ctx.createRadialGradient(
            cx - shadowOffsetX, cy - shadowOffsetY, 0,
            cx - shadowOffsetX, cy - shadowOffsetY, cr * 0.7
          );
          hlGrd.addColorStop(0,   'rgba(255,255,220,0.12)');
          hlGrd.addColorStop(1,   'rgba(255,255,220,0)');
          ctx.beginPath();
          ctx.ellipse(cx, cy, cr, cr * 0.4, tilt, 0, Math.PI * 2);
          ctx.fillStyle = hlGrd;
          ctx.fill();
        }
      }
      ctx.restore();
    };

    const render = () => {
      time++;

      const bgGradient = ctx.createLinearGradient(0, 0, 0, h);
      bgGradient.addColorStop(0, '#1E2E4A');
      bgGradient.addColorStop(0.7, '#334155');
      bgGradient.addColorStop(1, '#64748B');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, w, h);

      for (const p of particles) {
        p.x += p.speed;
        if (p.x > w) p.x = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${p.alpha})`;
        ctx.fill();
      }

      for (const o of objects) {
        o.x += o.vx;
        o.y += o.vy;
        if (o.x < -150) o.x = w + 150;
        if (o.x > w + 150) o.x = -150;
        if (o.y < -150) o.y = h + 150;
        if (o.y > h + 150) o.y = -150;
        drawObject(o);
      }

      drawWideRoundedMoonSurface();
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
