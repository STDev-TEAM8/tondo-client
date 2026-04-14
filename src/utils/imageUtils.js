/**
 * 이미지 크롭 및 저장 유틸
 *
 * 지원 비율:
 *   watch  : 1:1   (애플워치)
 *   phone  : 9:16  (스마트폰)
 *   laptop : 16:9  (노트북)
 */

export const CROP_RATIOS = {
  watch: { label: '워치', ratio: 1 / 1, icon: '⌚' },
  phone: { label: '폰', ratio: 9 / 16, icon: '📱' },
  laptop: { label: '노트북', ratio: 16 / 9, icon: '💻' },
};

/**
 * 이미지 URL을 특정 비율로 크롭하여 새 canvas에 그리고 Blob URL 반환
 * @param {string} imageUrl - 원본 이미지 URL (S3 URL 또는 base64)
 * @param {'watch'|'phone'|'laptop'} cropType
 * @returns {Promise<string>} 크롭된 이미지의 Blob URL
 */
export async function cropImage(imageUrl, cropType) {
  const targetRatio = CROP_RATIOS[cropType]?.ratio ?? 1;

  const img = await loadImage(imageUrl);
  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;

  let cropW, cropH;

  if (srcW / srcH > targetRatio) {
    // 원본이 더 넓음 → 높이 기준으로 가로 크롭
    cropH = srcH;
    cropW = srcH * targetRatio;
  } else {
    // 원본이 더 좁음 → 가로 기준으로 세로 크롭
    cropW = srcW;
    cropH = srcW / targetRatio;
  }

  const offsetX = (srcW - cropW) / 2;
  const offsetY = (srcH - cropH) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(cropW);
  canvas.height = Math.round(cropH);

  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, offsetX, offsetY, cropW, cropH, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(URL.createObjectURL(blob));
    }, 'image/png');
  });
}

/**
 * Canvas를 흑백 PNG Base64로 변환 (서버 전송용)
 * @param {HTMLCanvasElement} canvas
 * @returns {string} base64 문자열 (data:image/png;base64,... 제외)
 */
export function canvasToBase64(canvas) {
  const dataUrl = canvas.toDataURL('image/png');
  return dataUrl.split(',')[1];
}

/**
 * Blob URL 이미지를 기기에 저장 (다운로드)
 * @param {string} blobUrl
 * @param {string} filename
 */
export function downloadImage(blobUrl, filename = 'tondo-art.png') {
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  a.click();
}

// ─── 내부 유틸 ────────────────────────────────────────────────────────────────

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
