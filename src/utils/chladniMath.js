/**
 * 클라드니 도형 수식 계산 유틸
 *
 * u = sin(n*π*x + ω) * sin(m*π*y) - sin(m*π*x + ω) * sin(n*π*y)
 *
 * 변수 의미:
 *   n (음고)   : 기본 주파수(F0) → 가로 그리드 밀도
 *   m (음색)   : 스펙트럼 중심(Spectral Centroid) → 세로 그리드 밀도
 *   ω (위상)   : 미세 주파수 편차 → 비대칭 개인화
 */

const PI = Math.PI;

/**
 * 단일 픽셀의 클라드니 u 값 계산
 * @param {number} x  - 정규화된 x 좌표 [0, 1]
 * @param {number} y  - 정규화된 y 좌표 [0, 1]
 * @param {number} n  - 음고 파라미터
 * @param {number} m  - 음색 파라미터
 * @param {number} omega - 위상 파라미터
 * @returns {number} u 값
 */
export function chladniValue(x, y, n, m, omega) {
  // 오프셋 0.15: x=0(왼쪽), y=0(위쪽) 경계가 항상 sin(0)=0이 되어
  // 절점선으로 고정되는 현상을 제거 → 파티클이 상단/좌측에 쏠리지 않음
  const ox = x + 0.15;
  const oy = y + 0.15;
  return (
    Math.sin(n * PI * ox + omega) * Math.sin(m * PI * oy) -
    Math.sin(m * PI * ox + omega) * Math.sin(n * PI * oy)
  );
}

/**
 * 오디오 피처를 클라드니 파라미터로 매핑
 *
 * @param {object} features - { pitch, timbre, phase, volume, freqBand }
 * @returns {{ n, m, omega, threshold, color }}
 */
export function mapFeaturesToChladni(features) {
  const { pitch, timbre, phase, volume, freqBand } = features;

  // n: 기본 주파수(Hz) → [2, 12] 범위로 정규화
  // 사람 목소리 F0: 80~300Hz
  const n = clamp(mapRange(pitch, 80, 300, 2, 12), 2, 12);

  // m: 스펙트럼 중심(Hz) → [2, 12] 범위
  // 스펙트럼 중심 일반 범위: 500~4000Hz
  const m = clamp(mapRange(timbre, 500, 4000, 2, 12), 2, 12);

  // ω: 미세 위상 편차 → [0, π] 범위
  const omega = clamp(phase % PI, 0, PI);

  // 임계값: 볼륨(dB)에 비례하여 선 굵기 결정
  // volume: 0~1 (정규화된 진폭)
  // 낮은 볼륨 → 좁은 임계값(가는 선), 높은 볼륨 → 넓은 임계값(굵은 선)
  const threshold = clamp(mapRange(volume, 0, 1, 0.03, 0.18), 0.03, 0.18);

  // 색상: 주파수 대역 → 빛 스펙트럼 (낮음=빨강, 높음=파랑/보라)
  const color = freqBandToColor(freqBand);

  return { n, m, omega, threshold, color };
}

/**
 * 기본 주파수 대역을 빛 스펙트럼 색상으로 변환
 * 물리학 스펙트럼: 낮은 주파수(저음) = 빨강, 높은 주파수(고음) = 파랑/보라
 * @param {number} freqBand - 기본 주파수 Hz (80~4000)
 * @returns {string} HSL 색상 문자열
 */
export function freqBandToColor(freqBand) {
  // Hz → 색조(Hue): 낮음=0(빨강), 높음=270(보라)
  const hue = clamp(mapRange(freqBand, 80, 1200, 0, 270), 0, 270);
  // 네온 느낌: 높은 채도, 밝은 명도
  return `hsl(${hue}, 100%, 60%)`;
}

/**
 * 캔버스에 클라드니 도형 렌더링
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} height
 * @param {object} params - { n, m, omega, threshold, color }
 * @param {boolean} bw - true면 흑백 모드 (캡처용)
 */
export function drawChladni(ctx, width, height, params, bw = false) {
  const { n, m, omega, threshold, color } = params;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const x = px / width;
      const y = py / height;

      const u = chladniValue(x, y, n, m, omega);
      const absU = Math.abs(u);

      if (absU < threshold) {
        const idx = (py * width + px) * 4;

        if (bw) {
          // 흑백 스냅샷: 선 = 흰색
          data[idx] = 255;
          data[idx + 1] = 255;
          data[idx + 2] = 255;
          data[idx + 3] = 255;
        } else {
          // 컬러 모드: HSL 파싱 후 적용
          const [r, g, b] = hslStringToRgb(color);
          // 중앙에 가까울수록 더 밝게
          const intensity = 1 - absU / threshold;
          data[idx] = Math.floor(r * intensity);
          data[idx + 1] = Math.floor(g * intensity);
          data[idx + 2] = Math.floor(b * intensity);
          data[idx + 3] = 255;
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

// ─── 내부 유틸 ────────────────────────────────────────────────────────────────

function mapRange(value, inMin, inMax, outMin, outMax) {
  return ((value - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * "hsl(H, S%, L%)" 문자열을 RGB [0~255]로 변환
 */
function hslStringToRgb(hslStr) {
  const match = hslStr.match(/hsl\((\d+\.?\d*),\s*(\d+)%,\s*(\d+)%\)/);
  if (!match) return [255, 255, 255];
  const h = parseFloat(match[1]) / 360;
  const s = parseFloat(match[2]) / 100;
  const l = parseFloat(match[3]) / 100;
  return hslToRgb(h, s, l);
}

function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
