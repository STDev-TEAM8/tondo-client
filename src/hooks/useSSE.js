import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * SSE(Server-Sent Events) 연결 훅
 *
 * GET /api/v1/tasks/{taskId}/stream
 * 서버 이벤트 형식: { percent: 0~100, status: string }
 *
 * taskId 가 "mock_" 으로 시작하면 → 모의 SSE 시뮬레이션 실행
 */
export function useSSE() {
  const [progress, setProgress] = useState({ percent: 0, status: '' });
  const [isDone, setIsDone] = useState(false);
  const [sseError, setSseError] = useState(null);
  const cleanupRef = useRef(null); // EventSource or mock interval

  const disconnect = useCallback(() => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
  }, []);

  const connect = useCallback((taskId) => {
    disconnect();
    setIsDone(false);
    setSseError(null);
    setProgress({ percent: 0, status: '연결 중...' });

    // ── 모의 SSE (서버 없을 때) ────────────────────────────────────────────────
    if (taskId.startsWith('mock_')) {
      const steps = [
        { percent: 15, status: '주파수 맵핑 중' },
        { percent: 35, status: '주파수 맵핑 중' },
        { percent: 55, status: 'AI 렌더링 중' },
        { percent: 75, status: 'AI 렌더링 중' },
        { percent: 92, status: '작품 마감 중' },
        { percent: 100, status: '완료' },
      ];

      let i = 0;
      const id = setInterval(() => {
        setProgress(steps[i]);
        if (i >= steps.length - 1) {
          clearInterval(id);
          setIsDone(true);
        }
        i++;
      }, 1200);

      cleanupRef.current = () => clearInterval(id);
      return;
    }

    // ── 실제 SSE ──────────────────────────────────────────────────────────────
    const url = `/api/v1/tasks/${taskId}/stream`;
    const es = new EventSource(url);

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        const percent = data.percent ?? 0;
        const status = data.status ?? '';
        setProgress({ percent, status });
        if (percent >= 100 || status === '완료') {
          setIsDone(true);
          es.close();
        }
      } catch {
        // 파싱 실패 무시
      }
    };

    es.onerror = () => {
      setSseError('AI 파이프라인 연결 오류가 발생했습니다.');
      es.close();
    };

    cleanupRef.current = () => es.close();
  }, [disconnect]);

  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return { progress, isDone, sseError, connect, disconnect };
}
