import { useEffect, useRef } from 'react';

/**
 * 헬릭스 성운 스타일 배경 (고리 성운)
 *
 * 렌더 패스 (오프스크린 1회):
 *   1. 어두운 우주 배경 + 배경 별
 *   2. 밝은 파란 별 (이미지 특징적인 청색 항성들)
 *   3. 내부 청색 글로우 (링 안쪽 영역)
 *   4. 링 파티클 (내측: 청색/청록  →  중심: 주황  →  외측: 적색/주황)
 *   5. 링 바깥 외곽 와이스프 (붉은 연무)
 *   6. 내부 안쪽 헤이즈 (파란 산란광)
 *   7. 혜성형 돌기(cometary knots) — 링 안쪽을 향한 청색 섬유
 *   8. 중심 백색왜성 광원
 */

const ROTATION_SPEED = 0.000065; // 매우 느린 회전

// 박스-뮬러 가우시안
const gauss = () => {
  const u = Math.max(Math.random(), 1e-6);
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function GalaxyBg() {
  const canvasRef = useRef(null);
  const offRef    = useRef(null);
  const rafRef    = useRef(null);
  const angleRef  = useRef(0);
  const sizeRef   = useRef({ size: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const build = () => {
      const size = Math.min(canvas.offsetWidth, canvas.offsetHeight);
      if (size < 4) return;
      canvas.width  = size;
      canvas.height = size;
      sizeRef.current = { size };

      const cx   = size / 2;
      const cy   = size / 2;
      const maxR = size * 0.46;

      // 링 파라미터
      const ringR = maxR * 0.62;  // 링 중심 반경
      const ringW = maxR * 0.20;  // 링 두께 (가우시안 σ)

      const off = document.createElement('canvas');
      off.width = size; off.height = size;
      const oc  = off.getContext('2d');
      offRef.current = off;

      // ── ① 배경 ──────────────────────────────────────────────────
      oc.fillStyle = '#000008';
      oc.fillRect(0, 0, size, size);

      // 배경 별 (작고 희미)
      for (let i = 0; i < 1600; i++) {
        const sx = Math.random() * size;
        const sy = Math.random() * size;
        const sa = 0.08 + Math.random() * 0.42;
        const ss = Math.random() < 0.05 ? 1.5 : 0.65;
        const blue = Math.random() < 0.35;
        oc.fillStyle = blue
          ? `rgba(160,200,255,${sa.toFixed(2)})`
          : `rgba(230,230,255,${sa.toFixed(2)})`;
        oc.fillRect(sx, sy, ss, ss);
      }

      // ── ② 밝은 청색 항성들 ─────────────────────────────────────
      const BRIGHT = [
        { nx: 0.14, ny: 0.13, r: 3.2 },
        { nx: 0.83, ny: 0.11, r: 4.0 },
        { nx: 0.87, ny: 0.74, r: 3.5 },
        { nx: 0.09, ny: 0.82, r: 2.8 },
        { nx: 0.52, ny: 0.04, r: 2.2 },
        { nx: 0.60, ny: 0.90, r: 2.0 },
      ];
      for (const s of BRIGHT) {
        const bx = s.nx * size, by = s.ny * size;
        const grd = oc.createRadialGradient(bx, by, 0, bx, by, s.r * 9);
        grd.addColorStop(0,   'rgba(210,235,255,0.90)');
        grd.addColorStop(0.18,'rgba(140,195,255,0.45)');
        grd.addColorStop(0.5, 'rgba( 80,140,255,0.12)');
        grd.addColorStop(1,   'rgba(  0,  0,  0,0)');
        oc.fillStyle = grd;
        oc.fillRect(bx - s.r * 9, by - s.r * 9, s.r * 18, s.r * 18);
        oc.fillStyle = 'rgba(255,255,255,0.95)';
        oc.fillRect(bx - s.r * 0.5, by - s.r * 0.5, s.r, s.r);
      }

      // ── ③ 내부 청색 글로우 ─────────────────────────────────────
      const innerGrd = oc.createRadialGradient(cx, cy, 0, cx, cy, ringR * 1.08);
      innerGrd.addColorStop(0,    'rgba(100,165,255,0.28)');
      innerGrd.addColorStop(0.28, 'rgba( 65,125,240,0.20)');
      innerGrd.addColorStop(0.60, 'rgba( 38, 85,210,0.10)');
      innerGrd.addColorStop(0.88, 'rgba( 18, 45,160,0.03)');
      innerGrd.addColorStop(1,    'rgba(  0,  0,  0,0)');
      oc.fillStyle = innerGrd;
      oc.fillRect(0, 0, size, size);

      // ── ④⑤⑥⑦ 파티클 (ImageData additive blending) ────────────
      const img  = oc.getImageData(0, 0, size, size);
      const data = img.data;

      const addPixel = (px, py, r, g, b, a) => {
        px = px | 0; py = py | 0;
        if (px < 0 || px >= size || py < 0 || py >= size) return;
        const idx = (py * size + px) * 4;
        data[idx]     = clamp(data[idx]     + (r * a / 255 + 0.5 | 0), 0, 255);
        data[idx + 1] = clamp(data[idx + 1] + (g * a / 255 + 0.5 | 0), 0, 255);
        data[idx + 2] = clamp(data[idx + 2] + (b * a / 255 + 0.5 | 0), 0, 255);
      };

      // ④ 링 파티클
      const RING_N = 160000;
      for (let i = 0; i < RING_N; i++) {
        const angle      = Math.random() * Math.PI * 2;
        // 밀도 변화: 3회 주기 밝기 변동 (불균일한 링)
        const density    = 0.55 + 0.45 * (0.6 * Math.sin(angle * 3 + 0.8) + 0.4 * Math.sin(angle * 7 + 2.1));
        if (Math.random() > density) continue;

        const dr = gauss() * ringW * 0.55; // 링 중심으로부터 편차
        const r  = ringR + dr;
        const px = cx + Math.cos(angle) * r;
        const py = cy + Math.sin(angle) * r;

        const nd = dr / ringW; // 정규화 편차: 음=내측, 양=외측
        let rr, rg, rb, ra;

        if (nd < -0.5) {
          // 내측 경계: 청록
          const m = clamp((-nd - 0.5) / 0.6, 0, 1);
          rr = (55  + m * 25  + Math.random() * 20) | 0;
          rg = (150 + m * 45  + Math.random() * 30) | 0;
          rb = (235 + Math.random() * 20)            | 0;
          ra = (38  + m * 35  + Math.random() * 28)  | 0;
        } else if (nd < 0.25) {
          // 중간: 주황~노랑
          const m = clamp((nd + 0.5) / 0.75, 0, 1);
          rr = (225 + Math.random() * 30)             | 0;
          rg = (110 - m * 40  + Math.random() * 45)   | 0;
          rb = ( 15 + Math.random() * 18)              | 0;
          ra = ( 75 + m * 35  + Math.random() * 40)   | 0;
        } else {
          // 외측 경계: 적색~주황
          const m = clamp((nd - 0.25) / 0.75, 0, 1);
          rr = (215 - m * 25  + Math.random() * 30)   | 0;
          rg = ( 58 - m * 28  + Math.random() * 28)   | 0;
          rb = (  8 + Math.random() * 15)              | 0;
          ra = ( 65 - m * 22  + Math.random() * 32)   | 0;
        }
        addPixel(px, py, rr, rg, rb, ra);
      }

      // ⑤ 외곽 와이스프 (링 바깥 적색 연무)
      const WISP_N = 30000;
      for (let i = 0; i < WISP_N; i++) {
        const angle = Math.random() * Math.PI * 2;
        const extra = ringW * (0.9 + Math.random() * 2.0);
        const r     = ringR + extra;
        if (r > maxR * 1.12) continue;
        const fade = 1 - (extra - ringW * 0.9) / (ringW * 2.0);
        const a    = (fade * fade * 40 + Math.random() * 18) | 0;
        addPixel(
          cx + Math.cos(angle) * r,
          cy + Math.sin(angle) * r,
          (175 + Math.random() * 55) | 0,
          ( 45 + Math.random() * 35) | 0,
          (  8 + Math.random() * 14) | 0,
          a,
        );
      }

      // ⑥ 내부 파란 산란광 (링 안쪽)
      const INNER_N = 28000;
      for (let i = 0; i < INNER_N; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r     = Math.random() * (ringR - ringW * 0.4);
        const fade  = r / (ringR - ringW * 0.4);
        const a     = (fade * 32 + Math.random() * 14) | 0;
        addPixel(
          cx + Math.cos(angle) * r,
          cy + Math.sin(angle) * r,
          ( 38 + Math.random() * 28) | 0,
          (105 + Math.random() * 65) | 0,
          (225 + Math.random() * 30) | 0,
          a,
        );
      }

      // ⑦ 혜성형 돌기 (링 내측 → 중심 방향 파란 섬유)
      const KNOT_N = 180;
      for (let k = 0; k < KNOT_N; k++) {
        const angle   = (k / KNOT_N) * Math.PI * 2 + (Math.random() - 0.5) * 0.07;
        const headR   = ringR - ringW * 0.08;
        const tailLen = ringW * (0.9 + Math.random() * 1.3);
        for (let p = 0; p < 35; p++) {
          const t  = p / 35;
          const pr = headR - t * tailLen;
          const pa = angle + (Math.random() - 0.5) * 0.022;
          const a  = ((1 - t) * 55 + Math.random() * 18) | 0;
          addPixel(
            cx + Math.cos(pa) * pr,
            cy + Math.sin(pa) * pr,
            ( 90 + Math.random() * 70) | 0,
            (165 + Math.random() * 60) | 0,
            (235 + Math.random() * 20) | 0,
            a,
          );
        }
      }

      oc.putImageData(img, 0, 0);

      // ── ⑧ 중심 백색왜성 ────────────────────────────────────────
      const cwGrd = oc.createRadialGradient(cx, cy, 0, cx, cy, maxR * 0.05);
      cwGrd.addColorStop(0,   'rgba(255,255,255,0.88)');
      cwGrd.addColorStop(0.25,'rgba(195,225,255,0.55)');
      cwGrd.addColorStop(0.7, 'rgba(120,170,255,0.18)');
      cwGrd.addColorStop(1,   'rgba(  0,  0,  0,0)');
      oc.fillStyle = cwGrd;
      oc.fillRect(0, 0, size, size);
    };

    build();
    const ro = new ResizeObserver(build);
    ro.observe(canvas);

    const draw = () => {
      const { size } = sizeRef.current;
      const off = offRef.current;
      if (!size || !off) { rafRef.current = requestAnimationFrame(draw); return; }

      angleRef.current += ROTATION_SPEED;
      const c = size / 2;

      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.translate(c, c);
      ctx.rotate(angleRef.current);
      ctx.translate(-c, -c);
      ctx.drawImage(off, 0, 0);
      ctx.restore();

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
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(100%, 100svh)',
        height: 'min(100%, 100svh)',
        aspectRatio: '1 / 1',
        pointerEvents: 'none',
      }}
    />
  );
}
