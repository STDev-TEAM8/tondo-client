import { useEffect, useRef } from 'react';

/**
 * 로그인 배경 — Section1(CosmicBg)에서 자연스럽게 이어지는 하늘 + 달 표면
 *
 * 연결 포인트
 * - canvas 오프셋은 CosmicBg와 동일 (top: -15%, height: 130%)
 *   → 화면에 보이는 fraction 구간은 0.115 ~ 0.885
 * - 상단 stop 0.115 = #738288 (= CosmicBg의 visible bottom 보간색)
 *   → 두 화면이 붙는 지점이 완전히 동일 색으로 맞물림
 * - 팔레트도 CosmicBg와 동일하게 사용해 행성 계열 통일
 */

// CosmicBg와 동일한 파스텔 팔레트
const PALETTES = [
  { main: '#E8DEFF', glow: 'rgba(200,185,255,0.35)' }, // 연보라
  { main: '#FFD6E8', glow: 'rgba(255,180,210,0.35)' }, // 연분홍
  { main: '#C8EEFF', glow: 'rgba(160,220,255,0.35)' }, // 하늘
  { main: '#FFF0C8', glow: 'rgba(255,225,150,0.35)' }, // 연노랑
  { main: '#D6FFE8', glow: 'rgba(160,255,200,0.35)' }, // 민트
  { main: '#FFE0D0', glow: 'rgba(255,190,155,0.35)' }, // 복숭아
];

const OBJECT_COUNT   = 5;
const PARTICLE_COUNT = 130;

// 행성들을 하늘 영역(상단 ~55%)에만 배치 — 달 표면과 안 겹치게
const SIZES = [28, 52, 38, 72, 44];

function makeObject(w, h, i) {
  const p = PALETTES[i % PALETTES.length];
  return {
    x:         Math.random() * w,
    y:         Math.random() * (h * 0.55),
    radius:    SIZES[i],
    vx:        (Math.random() - 0.5) * 0.3,
    vy:        (Math.random() - 0.5) * 0.2,
    color:     p.main,
    glow:      p.glow,
    hasRing:   Math.random() > 0.5,
    ringAngle: Math.random() * Math.PI,
  };
}

function makeParticle(w, h) {
  return {
    x:     Math.random() * w,
    y:     Math.random() * h,
    size:  Math.random() * 2 + 0.8,
    alpha: Math.random() * 0.4 + 0.15,
    speed: Math.random() * 0.15 + 0.05, // 상승 방향 (CosmicBg와 동일 계열)
  };
}

export function CosmicBgLogin() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let rafId;
    let w = 0, h = 0;
    let time = 0;
    let objects = [];
    let particles = [];
    let craters = [];

    const build = () => {
      w = canvas.offsetWidth;
      h = canvas.offsetHeight;
      canvas.width  = w;
      canvas.height = h;
      objects   = Array.from({ length: OBJECT_COUNT }, (_, i) => makeObject(w, h, i));
      particles = Array.from({ length: PARTICLE_COUNT }, () => makeParticle(w, h));
      craters   = Array.from({ length: 30 }, () => ({
        angle: Math.PI * 1.1 + Math.random() * Math.PI * 0.8,
        dist:  Math.random() * 140 + 10,
        size:  Math.random() * 20 + 5,
      }));
    };

    // 행성 — CosmicBg와 동일 스타일
    const drawObject = (o) => {
      ctx.save();
      ctx.shadowBlur  = 20;
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
        ctx.ellipse(o.x, o.y, o.radius * 2.2, o.radius * 0.5, o.ringAngle, 0, Math.PI * 2);
        ctx.strokeStyle = o.glow;
        ctx.lineWidth   = 2;
        ctx.stroke();
      }

      ctx.restore();
    };

    const drawMoonSurface = () => {
      ctx.save();
      const centerX = w / 2;
      const centerY = h * 2.3;
      const radius  = h * 1.55;
      const surfaceRotation = time * 0.00005;

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);

      // 하늘과 부드럽게 연결되는 살짝 차가운 달 표면 톤
      const terrainGrd = ctx.createLinearGradient(0, h * 0.75, 0, h);
      terrainGrd.addColorStop(0,   '#3A3B3E');
      terrainGrd.addColorStop(0.5, '#1F2022');
      terrainGrd.addColorStop(1,   '#0B0B0D');
      ctx.fillStyle = terrainGrd;
      ctx.fill();

      for (const crater of craters) {
        const currentAngle = crater.angle + surfaceRotation;
        const cx = centerX + Math.cos(currentAngle) * (radius - crater.dist);
        const cy = centerY + Math.sin(currentAngle) * (radius - crater.dist);

        if (cy > h * 0.78 && cy < h + 100 && cx > -50 && cx < w + 50) {
          const cr = crater.size;
          const tilt = currentAngle + Math.PI / 2;
          const shadowOffsetX = cr * 0.3;
          const shadowOffsetY = cr * 0.15;

          // 외곽 rim
          ctx.beginPath();
          ctx.ellipse(cx, cy, cr + 2, (cr + 2) * 0.4, tilt, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(180,180,160,0.07)';
          ctx.fill();

          // 크레이터 내부 — 어두운 움푹
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

          // 하이라이트
          const hlGrd = ctx.createRadialGradient(
            cx - shadowOffsetX, cy - shadowOffsetY, 0,
            cx - shadowOffsetX, cy - shadowOffsetY, cr * 0.7
          );
          hlGrd.addColorStop(0, 'rgba(255,255,220,0.12)');
          hlGrd.addColorStop(1, 'rgba(255,255,220,0)');
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

      // ── 하늘 그라데이션 ──
      // visible 구간 (fraction 0.115 ~ 0.885) 에서 자연스러운 atmosphere 연출
      // stop 0.115 = Section1 visible bottom 과 동일한 색으로 맞물림
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0,     '#738288');
      bg.addColorStop(0.115, '#738288'); // ← Section1 연결 지점
      bg.addColorStop(0.4,   '#4E5C6A');
      bg.addColorStop(0.7,   '#2F3846');
      bg.addColorStop(0.885, '#1A1C23'); // visible 구간 끝 — 지평선
      bg.addColorStop(1,     '#141015');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // 파티클 — 상승 (CosmicBg와 동일 방향)
      for (const p of particles) {
        p.y -= p.speed;
        if (p.y < 0) p.y = h;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${p.alpha})`;
        ctx.fill();
      }

      // 행성 — 하늘 영역 내에서만
      for (const o of objects) {
        o.x += o.vx;
        o.y += o.vy;
        if (o.x < -120)      o.x = w + 120;
        if (o.x > w + 120)   o.x = -120;
        if (o.y < -120)      o.y = h * 0.55;
        if (o.y > h * 0.6)   o.y = -120; // 달 표면 영역 침범 방지
        drawObject(o);
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
