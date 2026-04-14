import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSSE } from '../hooks/useSSE';
import { fetchArtworkResult } from '../api/artworkApi';
import styles from './WaitingPage.module.css';

/**
 * AI 파이프라인 대기 페이지
 *
 * - SSE로 진행 상태 실시간 수신
 * - 완료 시 결과 이미지 조회 후 ResultPage로 이동
 */
export default function WaitingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { taskId, uuid } = location.state ?? {};

  const { progress, isDone, sseError, connect } = useSSE();

  // taskId가 없으면 랜딩으로
  useEffect(() => {
    if (!taskId) {
      navigate('/');
      return;
    }
    connect(taskId);
  }, [taskId, connect, navigate]);

  // SSE 완료 → 결과 조회
  useEffect(() => {
    if (!isDone) return;

    (async () => {
      try {
        const result = await fetchArtworkResult(taskId, uuid);
        navigate('/result', { state: { ...result, taskId } });
      } catch (err) {
        console.error('결과 조회 실패:', err);
        navigate('/result', { state: { imageUrl: null, docentText: '', taskId } });
      }
    })();
  }, [isDone, taskId, uuid, navigate]);

  // 상태 메시지 → 아이콘 매핑
  const statusIcon = getStatusIcon(progress.status);

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.orb} />

        <p className={styles.statusIcon}>{statusIcon}</p>
        <p className={styles.statusText}>
          {progress.status || 'AI 파이프라인 시작 중...'}
        </p>

        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        <p className={styles.percent}>{progress.percent}%</p>

        {sseError && (
          <p className={styles.error}>{sseError}</p>
        )}
      </div>
    </div>
  );
}

function getStatusIcon(status) {
  if (!status) return '✦';
  if (status.includes('주파수')) return '〰';
  if (status.includes('AI') || status.includes('렌더링')) return '✦';
  if (status.includes('마감')) return '◎';
  if (status.includes('완료')) return '✓';
  return '✦';
}
