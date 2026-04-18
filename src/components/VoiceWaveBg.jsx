import { useEffect, useRef } from 'react';

/**
 * TonDo 도입 배경 — 두 섹션을 하나의 캔버스로 잇는다.
 *
 * 구조:
 *   - 캔버스는 pageTrack(200vh)에 가득 차서 두 화면을 관통.
 *   - 위쪽 (h*0~0.5)  = 'listen' 영역 — 고요한 단일 파동.
 *   - 아래쪽 (h*0.5~1) = 'create' 영역 — 색이 입혀진 다중 파동.
 *   - 두 영역의 경계(h*0.5)에 "bridge wave" — 스크롤 시 두 화면을 이어주는
 *     글로우 파동. 정적 화면에서는 hint, 전환 중에는 연결자 역할.
 *
 * 인터랙션:
 *   - 커서/터치 근처에서 파동이 부풀어 오름.
 *   - micRef 가 전달되면 voice level 로 진폭이 살아남.
 *     freq 데이터로 색 파동 각각이 다른 주파수 대역에 반응.
 */

const WAVE_COLORS = [
  { r: 255, g: 213, b: 237 }, // 핑크
  { r: 222, g: 185, b: 255 }, // 보라
  { r: 202, g: 233, b: 255 }, // 블루
  { r: 255, g: 240, b: 200 }, // 크림
];

const rgba = (c, a) => `rgba(${c.r},${c.g},${c.b},${a})`;

export function VoiceWaveBg({ micRef }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let rafId;
    let w = 0, h = 0;
    let time = 0;

    let pointerX = -9999, pointerY = -9999;
    let smoothX = -9999, smoothY = -9999;
    let smoothLevel = 0;
    let particles = [];

    const build = () => {
      w = canvas.offsetWidth;
      h = canvas.offsetHeight;
      canvas.width  = w;
      canvas.height = h;

      particles = Array.from({ length: 220 }, () => ({
        x:         Math.random() * w,
        y:         Math.random() * h,
        size:      Math.random() * 1.6 + 0.4,
        baseAlpha: Math.random() * 0.4 + 0.1,
        speed:     Math.random() * 0.2 + 0.04,
        phase:     Math.random() * Math.PI * 2,
      }));
    };

    const onPointerMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const cx = e.touches ? e.touches[0]?.clientX : e.clientX;
      const cy = e.touches ? e.touches[0]?.clientY : e.clientY;
      if (cx == null) return;
      pointerX = cx - rect.left;
      pointerY = cy - rect.top;
    };
    const onPointerLeave = () => { pointerX = -9999; pointerY = -9999; };

    const drawWave = ({ y0, amplitude, frequency, phase, color, lineWidth, glow, influenceScale, micBoost }) => {
      ctx.save();
      if (glow) {
        ctx.shadowBlur  = glow;
        ctx.shadowColor = color;
      }
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (let x = 0; x <= w; x += 2) {
        const tx = x / w;
        let ampBoost = 1 + (micBoost ?? 0);
        if (smoothX > -9000) {
          const dx = (x - smoothX) / w;
          const dy = (y0 - smoothY) / h;
          const d2 = dx * dx * 6 + dy * dy * 2;
          ampBoost += Math.exp(-d2) * (influenceScale ?? 1.0);
        }
        const a = amplitude * ampBoost;
        const wave =
          Math.sin(tx * Math.PI * frequency + phase) * a +
          Math.sin(tx * Math.PI * frequency * 2.3 + phase * 0.7) * (a * 0.35) +
          Math.sin(tx * Math.PI * frequency * 0.5 + phase * 1.4) * (a * 0.4);
        const y = y0 + wave;
        if (x === 0) ctx.moveTo(x, y);
        else         ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth   = lineWidth;
      ctx.stroke();
      ctx.restore();
    };

    const render = () => {
      time++;
      const t = time * 0.01;

      // 커서 smoothing
      if (pointerX > -9000) {
        smoothX = smoothX < -9000 ? pointerX : smoothX + (pointerX - smoothX) * 0.12;
        smoothY = smoothY < -9000 ? pointerY : smoothY + (pointerY - smoothY) * 0.12;
      } else if (smoothX > -9000) {
        smoothY += 0.5;
        if (smoothY > h + 200) { smoothX = -9999; smoothY = -9999; }
      }

      // mic 데이터 (옵셔널) — RMS 는 부드럽게 추적해 화면이 떨리지 않게
      const mic       = micRef?.current;
      const rawLevel  = mic?.level ?? 0;
      smoothLevel    += (rawLevel - smoothLevel) * 0.18;
      const freqData  = mic?.freq;

      // ── 배경: 위(고요) → 경계(#14142A) → 아래(색채) 로 한 줄로 흐름 ──
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0,    '#050510');
      bg.addColorStop(0.25, '#0D0D1E');
      bg.addColorStop(0.5,  '#14142A');
      bg.addColorStop(0.7,  '#1D1940');
      bg.addColorStop(0.9,  '#110A2A');
      bg.addColorStop(1,    '#060418');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // ── 파티클 (먼지/별) ──
      for (const p of particles) {
        p.y -= p.speed;
        if (p.y < 0) { p.y = h; p.x = Math.random() * w; }
        const alpha = p.baseAlpha * (0.6 + Math.sin(t + p.phase) * 0.4);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fill();
      }

      // ── 위쪽 (Section 1 영역) — 고요한 단일 파동 ──
      const s1Center = h * 0.25;
      const micBoost1 = Math.min(smoothLevel * 6, 4);
      drawWave({
        y0: s1Center, amplitude: 14, frequency: 3, phase: t,
        color: rgba(WAVE_COLORS[1], 0.6),
        lineWidth: 1.4, glow: 12, influenceScale: 1.2, micBoost: micBoost1,
      });
      drawWave({
        y0: s1Center + 9, amplitude: 10, frequency: 2.5, phase: t * 0.8 + 0.6,
        color: rgba(WAVE_COLORS[0], 0.22),
        lineWidth: 0.8, glow: 6, influenceScale: 0.8, micBoost: micBoost1 * 0.7,
      });
      drawWave({
        y0: s1Center - 9, amplitude: 11, frequency: 2.8, phase: t * 1.1 - 0.4,
        color: rgba(WAVE_COLORS[2], 0.22),
        lineWidth: 0.8, glow: 6, influenceScale: 0.8, micBoost: micBoost1 * 0.7,
      });

      // ── 아래쪽 (Section 2 영역) — 색채가 입혀진 다중 파동 ──
      // 각 색은 mic 의 다른 주파수 대역에 반응.
      WAVE_COLORS.forEach((col, i) => {
        let bandLevel = 0;
        if (freqData) {
          const start = Math.floor((i       / WAVE_COLORS.length) * freqData.length * 0.6);
          const end   = Math.floor(((i + 1) / WAVE_COLORS.length) * freqData.length * 0.6);
          let sum = 0;
          for (let j = start; j < end; j++) sum += freqData[j];
          bandLevel = sum / Math.max(1, (end - start) * 255);
        }
        const micBoost2 = Math.min(bandLevel * 5 + smoothLevel * 3, 5);
        drawWave({
          y0: h * 0.75 + Math.sin(t * 0.7 + i * 1.3) * 14,
          amplitude: 34 + i * 10,
          frequency: 2 + i * 0.6,
          phase:     t * (0.9 + i * 0.15) + i * 0.8,
          color:     rgba(col, 0.42),
          lineWidth: 1.8, glow: 16, influenceScale: 1.5,
          micBoost: micBoost2,
        });
      });
      drawWave({
        y0: h * 0.75, amplitude: 22, frequency: 4, phase: t * 1.2,
        color: 'rgba(255,255,255,0.55)',
        lineWidth: 1.2, glow: 10, influenceScale: 1.8,
        micBoost: smoothLevel * 4,
      });

      rafId = requestAnimationFrame(render);
    };

    build();
    const ro = new ResizeObserver(build);
    ro.observe(canvas);
    window.addEventListener('mousemove',  onPointerMove);
    window.addEventListener('touchmove',  onPointerMove, { passive: true });
    window.addEventListener('mouseleave', onPointerLeave);
    render();

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener('mousemove',  onPointerMove);
      window.removeEventListener('touchmove',  onPointerMove);
      window.removeEventListener('mouseleave', onPointerLeave);
    };
  }, [micRef]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}
