/**
 * API 호출 모듈
 *
 * VITE_API_BASE_URL 이 비어있으면 → 모의(mock) 모드로 동작
 * 모의 모드에서는 실제 서버 없이 전체 흐름(전송→SSE→결과)을 테스트할 수 있음
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
const IS_MOCK = !BASE_URL;

// ─── 실제 API ─────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/signup  — 이름/전화번호 등록
 */
export async function signup({ name, password }) {
  if (IS_MOCK) {
    await delay(500);
    console.log('[TonDo] 🧪 Mock signup:', { username: name, password });
    return;
  }

  const res = await fetch(`${BASE_URL}/api/v1/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: name, password }),
  });

  if (!res.ok) throw new Error(`signup 실패: ${res.status}`);
}

/**
 * POST /api/v1/artworks  — 이미지 생성 요청
 * @returns {Promise<{ taskId: string }>}
 */
export async function requestArtwork({ uuid, avgPitch, avgVolume, avgTimbre, imageBase64 }) {
  if (IS_MOCK) {
    return mockRequestArtwork({ uuid, avgPitch, avgVolume, avgTimbre, imageBase64 });
  }

  const res = await fetch(`${BASE_URL}/api/v1/artworks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uuid,
      averageHz: avgPitch,
      averageVolume: avgVolume,
      averageTimbre: avgTimbre,
      base64Image: imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64,
    }),
  });

  if (!res.ok) throw new Error(`이미지 생성 요청 실패: ${res.status}`);

  const data = await res.json();
  return { taskId: data.taskId };
}

/**
 * GET /api/v1/artworks/:taskId  — 완성 이미지 및 도슨트 조회
 * @returns {Promise<{ imageUrl: string|null, docentText: string }>}
 */
export async function fetchArtworkResult(taskId, uuid) {
  if (taskId.startsWith('mock_')) {
    return mockFetchResult(taskId);
  }

  const res = await fetch(`${BASE_URL}/api/v1/artworks/${taskId}`, {
    headers: { 'X-User-UUID': uuid },
  });

  if (!res.ok) throw new Error(`결과 조회 실패: ${res.status}`);

  const data = await res.json();
  return {
    imageUrl: data.imageUrl,
    docentText: data.report ?? '',
  };
}

/**
 * 브라우저 세션 UUID 관리
 * 새 세션마다 새 UUID 생성 후 sessionStorage에 저장
 */
export function getOrCreateUUID() {
  const key = 'tondo_uuid';
  let uuid = sessionStorage.getItem(key);
  if (!uuid) {
    uuid = crypto.randomUUID();
    sessionStorage.setItem(key, uuid);
  }
  return uuid;
}

// ─── 모의(Mock) 구현 ──────────────────────────────────────────────────────────

async function mockRequestArtwork({ uuid, avgPitch, avgVolume, avgTimbre, imageBase64 }) {
  // 콘솔에서 캡처 데이터 확인용 로그
  console.group('[TonDo] 🧪 모의 서버 전송 — 실제 서버가 연동되면 자동으로 제거됩니다');
  console.log('UUID        :', uuid);
  console.log('avgPitch    :', avgPitch.toFixed(1), 'Hz');
  console.log('avgVolume   :', avgVolume.toFixed(4));
  console.log('avgTimbre   :', avgTimbre.toFixed(1), 'Hz');
  console.log('imageBase64 :', `${imageBase64.length} chars (앞 80자: ${imageBase64.slice(0, 80)}...)`);

  // 브라우저에서 캡처 이미지 미리보기 (새 탭)
  if (imageBase64) {
    const dataUrl = `data:image/png;base64,${imageBase64}`;
    console.log('캡처 이미지 미리보기 → 콘솔에서 아래 dataURL을 브라우저 주소창에 붙여넣으세요:');
    console.log(dataUrl.slice(0, 120) + '...');

    // 개발 환경에서만 새 탭으로 미리보기 열기
    if (import.meta.env.DEV) {
      const w = window.open();
      if (w) {
        w.document.write(`<img src="${dataUrl}" style="max-width:100%;background:#000">`);
        w.document.title = 'TonDo 캡처 미리보기';
      }
    }
  }
  console.groupEnd();

  // 서버 응답 시간 시뮬레이션 (0.6초)
  await delay(600);
  return { taskId: `mock_${Date.now()}` };
}

async function mockFetchResult(_taskId) {
  await delay(400);
  return {
    imageUrl: null,       // 실제 서버 연동 전까지 null
    docentText: '[테스트 모드] 실제 서버가 연동되면 AI가 생성한 이미지와 도슨트 텍스트가 여기에 표시됩니다.',
  };
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
