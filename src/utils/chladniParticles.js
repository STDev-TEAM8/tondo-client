/**
 * 클라드니 파티클 시뮬레이션
 *
 * 원리: 실제 클라드니 판 실험처럼
 *   - 모래(파티클)가 판 위에 흩어져 있다가
 *   - 진동(클라드니 수식)에 따라 |u|가 낮은 절점(nodal line)으로 수렴
 *   - 절점에 모래가 쌓여 아름다운 기하 패턴이 만들어짐
 *
 * 렌더링: ImageData 직접 조작 (fillRect보다 ~10배 빠름)
 */

import { chladniValue } from './chladniMath';

// ─── 상수 ──────────────────────────────────────────────────────────────────────
const GRID = 64;       // 힘 필드 해상도 (64×64 격자)
const H    = 1 / GRID; // 그리드 간격

// STEP_SPEED: 절점선 쪽으로 끌어당기는 힘의 세기
//   강할수록 → 얇고 선명한 선    (좁은 분포)
//   약할수록 → 두껍고 넓게 퍼짐  (부드러운 글로우)
const STEP_SPEED     = 0.011;

// JITTER: 파티클의 무작위 흔들림
//   교차점 함정 탈출 + 절점선 방향 확산에 필요
const JITTER         = 0.026;

const SCATTER_LERP   = 0.035; // 침묵 시 랜덤 목표 위치로 이동 속도 (프레임당 ~3.5%)
const SCATTER_JITTER = 0.002; // 이동 중 미세 흔들림

// 파티클이 넓게 퍼질수록 픽셀당 겹침이 줄어드므로 밝기를 높임
const PARTICLE_BRIGHTNESS = 68;

// ─── 파티클 생성 ───────────────────────────────────────────────────────────────

/**
 * 랜덤 위치 파티클 배열 생성 (정규화 좌표 0~1)
 * @param {number} count
 */
export function createParticles(count = 25000) {
  const arr = new Array(count);
  for (let i = 0; i < count; i++) {
    arr[i] = { x: Math.random(), y: Math.random() };
  }
  return arr;
}

// ─── 힘 필드 (Force Field) ────────────────────────────────────────────────────

/**
 * 클라드니 수식의 |u| 기울기(gradient) 필드를 64×64 격자로 미리 계산
 * 파티클은 이 필드를 보간하여 방향을 결정함 → 직접 계산보다 ~10배 빠름
 *
 * @param {number} n  - 음고 파라미터
 * @param {number} m  - 음색 파라미터
 * @param {number} omega - 위상 파라미터
 * @returns {{ gx: Float32Array, gy: Float32Array }}
 */
export function buildForceField(n, m, omega) {
  const gx = new Float32Array(GRID * GRID);
  const gy = new Float32Array(GRID * GRID);

  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const x = i * H;
      const y = j * H;
      const u0 = Math.abs(chladniValue(x,          y,          n, m, omega));
      const ux = Math.abs(chladniValue(x + H, y,          n, m, omega));
      const uy = Math.abs(chladniValue(x,          y + H, n, m, omega));
      // 기울기 = 이웃과의 |u| 차이 (파티클은 이 방향의 반대로 이동)
      gx[j * GRID + i] = ux - u0;
      gy[j * GRID + i] = uy - u0;
    }
  }

  return { gx, gy };
}

/**
 * 힘 필드 쌍선형 보간 (Bilinear Interpolation)
 */
function sampleForce(gx, gy, x, y) {
  const fi = Math.max(0, Math.min(x * GRID - 0.5, GRID - 1.001));
  const fj = Math.max(0, Math.min(y * GRID - 0.5, GRID - 1.001));
  const i0 = fi | 0;
  const j0 = fj | 0;
  const tx = fi - i0;
  const ty = fj - j0;
  const i1 = Math.min(i0 + 1, GRID - 1);
  const j1 = Math.min(j0 + 1, GRID - 1);

  const w00 = (1 - tx) * (1 - ty);
  const w10 =       tx  * (1 - ty);
  const w01 = (1 - tx)  *       ty;
  const w11 =       tx  *       ty;

  return {
    fx: gx[j0*GRID+i0]*w00 + gx[j0*GRID+i1]*w10 + gx[j1*GRID+i0]*w01 + gx[j1*GRID+i1]*w11,
    fy: gy[j0*GRID+i0]*w00 + gy[j0*GRID+i1]*w10 + gy[j1*GRID+i0]*w01 + gy[j1*GRID+i1]*w11,
  };
}

// ─── 파티클 이동 ──────────────────────────────────────────────────────────────

/**
 * 모든 파티클을 한 스텝 이동 (gradient descent + jitter)
 * @param {Array<{x,y}>} particles
 * @param {{ gx: Float32Array, gy: Float32Array }} forceField
 */
export function stepParticles(particles, forceField) {
  const { gx, gy } = forceField;
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    const { fx, fy } = sampleForce(gx, gy, p.x, p.y);
    // 기울기 반대 방향으로 이동 + 작은 무작위 흔들림
    p.x = Math.max(0, Math.min(1, p.x - fx * STEP_SPEED + (Math.random() - 0.5) * JITTER));
    p.y = Math.max(0, Math.min(1, p.y - fy * STEP_SPEED + (Math.random() - 0.5) * JITTER));
  }
}

/**
 * 목소리 멈춤 시 파티클을 랜덤 목표 위치로 부드럽게 이동 (초기 흩어짐 복귀)
 *
 * targets: Float32Array — [x0, y0, x1, y1, ...] 형태의 랜덤 목표 좌표
 *   VisualizerPage에서 scatter 모드 시작 시 한 번 생성해 전달.
 *
 * @param {Array<{x,y}>}  particles
 * @param {Float32Array}  targets
 */
export function stepParticlesScatter(particles, targets) {
  for (let i = 0; i < particles.length; i++) {
    const p  = particles[i];
    const tx = targets[i * 2];
    const ty = targets[i * 2 + 1];
    // 목표를 향해 LERP 이동 + 미세 흔들림
    p.x = Math.max(0, Math.min(1, p.x + (tx - p.x) * SCATTER_LERP + (Math.random() - 0.5) * SCATTER_JITTER));
    p.y = Math.max(0, Math.min(1, p.y + (ty - p.y) * SCATTER_LERP + (Math.random() - 0.5) * SCATTER_JITTER));
  }
}

// ─── 파티클 렌더링 ────────────────────────────────────────────────────────────

/**
 * 파티클을 ImageData에 직접 픽셀로 렌더링
 * 같은 픽셀에 여러 파티클이 겹치면 밝아짐 → 절점에 자연스러운 밝기 집중
 *
 * @param {ImageData} imageData  - 재사용할 ImageData 버퍼
 * @param {Array<{x,y}>} particles
 * @param {number} width
 * @param {number} height
 * @param {number[]} rgb  - [r, g, b] 0~255
 * @param {boolean} bw   - true면 흑백(캡처용), false면 컬러
 */
export function renderParticles(imageData, particles, width, height, rgb, bw = false) {
  const data = imageData.data;

  // 배경 검정으로 초기화
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 255;
  }

  const base = bw ? [255, 255, 255] : (rgb ?? [255, 255, 255]);
  // 파티클당 기여량 스케일 (밀도 쌓임 효과)
  const pr = Math.round(base[0] * PARTICLE_BRIGHTNESS / 255);
  const pg = Math.round(base[1] * PARTICLE_BRIGHTNESS / 255);
  const pb = Math.round(base[2] * PARTICLE_BRIGHTNESS / 255);

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    const px = (p.x * (width  - 1)) | 0;
    const py = (p.y * (height - 1)) | 0;

    // 2×2 픽셀로 렌더 → 더 두껍고 glow-blur와 잘 어울림
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        const nx = px + dx;
        const ny = py + dy;
        if (nx >= width || ny >= height) continue;
        const idx = (ny * width + nx) * 4;
        data[idx]     = Math.min(255, data[idx]     + pr);
        data[idx + 1] = Math.min(255, data[idx + 1] + pg);
        data[idx + 2] = Math.min(255, data[idx + 2] + pb);
      }
    }
  }
}

// ─── 색상 변환 ────────────────────────────────────────────────────────────────

/**
 * "hsl(H, S%, L%)" → [r, g, b] (0~255)
 */
export function hslToRgbArray(hslStr) {
  const m = hslStr.match(/hsl\((\d+\.?\d*),\s*(\d+)%,\s*(\d+)%\)/);
  if (!m) return [255, 255, 255];
  const h = parseFloat(m[1]) / 360;
  const s = parseFloat(m[2]) / 100;
  const l = parseFloat(m[3]) / 100;

  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  return [
    Math.round(hue2rgb(h + 1 / 3) * 255),
    Math.round(hue2rgb(h)         * 255),
    Math.round(hue2rgb(h - 1 / 3) * 255),
  ];
}
