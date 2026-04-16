import { useEffect, useRef } from 'react';

/**
 * 은하수 배경
 *
 * - 일반 배경별 + 대각선 띠 형태의 은하수 밀집 별
 * - 반짝임(sin) + 아주 느린 흐름
 */

const STAR_COUNT      = 1200;
const MILKYWAY_COUNT  = 2500;

export function MilkywayBg() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let rafId;
    let w = 0, h = 0;

    let stars = [];

    const buildStars = () => {
      w = canvas.offsetWidth;
      h = canvas.offsetHeight;
      canvas.width  = w;
      canvas.height = h;

      const angle = -Math.PI / 4;
      const cosA  = Math.cos(angle);
      const sinA  = Math.sin(angle);

      stars = [];

      // 일반 배경별
      for (let i = 0; i < STAR_COUNT; i++) {
        stars.push({
          x:           Math.random() * w,
          y:           Math.random() * h,
          size:        Math.random() * 1.0 + 0.1,
          speed:       Math.random() * 0.02 + 0.01,
          opacity:     Math.random() * 0.5 + 0.1,
          flicker:     Math.random() * Math.PI,
          flickerSpd:  Math.random() * 0.05 + 0.01,
          hue:         null, // 흰색
          isMilkyWay:  false,
        });
      }

      // 은하수 띠
      for (let i = 0; i < MILKYWAY_COUNT; i++) {
        const dist   = (Math.random() - 0.5) * (w + h);
        const offset = (Math.random() - 0.5) * (h * 0.4);
        stars.push({
          x:           w / 2 + cosA * dist + sinA * offset,
          y:           h / 2 + sinA * dist - cosA * offset,
          size:        Math.random() * 1.2 + 0.2,
          speed:       Math.random() * 0.05 + 0.02,
          opacity:     Math.random() * 0.7 + 0.3,
          flicker:     Math.random() * Math.PI,
          flickerSpd:  Math.random() * 0.05 + 0.01,
          hue:         Math.random() > 0.8 ? 200 : 220, // 고정 hue
          isMilkyWay:  true,
        });
      }
    };

    const render = () => {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);

      // 은하수 베이스 글로우
      const grd = ctx.createLinearGradient(0, 0, w, h);
      grd.addColorStop(0,   'rgba(0,0,0,0)');
      grd.addColorStop(0.5, 'rgba(10,20,50,0.15)');
      grd.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);

      for (const s of stars) {
        s.x += s.speed;
        s.y += s.speed * 0.2;
        if (s.x > w) s.x = 0;
        if (s.y > h) s.y = 0;
        s.flicker += s.flickerSpd;

        const op = s.opacity * (0.7 + 0.3 * Math.sin(s.flicker));
        ctx.beginPath();
        ctx.fillStyle = s.hue !== null
          ? `hsla(${s.hue},100%,90%,${op.toFixed(3)})`
          : `rgba(255,255,255,${op.toFixed(3)})`;
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      }

      rafId = requestAnimationFrame(render);
    };

    buildStars();
    const ro = new ResizeObserver(buildStars);
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
