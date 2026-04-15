import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSSE } from '../hooks/useSSE';
import styles from './WaitingPage.module.css';

/**
 * AI 파이프라인 대기 페이지
 *
 * - SSE로 진행 상태 실시간 수신
 * - 완료(100%) 시 "결과 확인하기" 버튼 노출 → 클릭 시 ResultPage로 이동
 */
export default function WaitingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { taskId, uuid } = location.state ?? {};

  const { progress, isDone, sseError, connect } = useSSE();
  const [isLoading, setIsLoading] = useState(false);

  // taskId가 없으면 랜딩으로
  useEffect(() => {
    if (!taskId) {
      navigate('/');
      return;
    }
    connect(taskId);
  }, [taskId, connect, navigate]);

  // "결과 확인하기" 버튼 클릭 → taskId를 URL에 담아 이동
  const handleViewResult = useCallback(() => {
    if (isLoading) return;
    setIsLoading(true);
    const query = uuid ? `?uuid=${encodeURIComponent(uuid)}` : '';
    navigate(`/result/${taskId}${query}`);
  }, [isLoading, taskId, uuid, navigate]);

  // 상태 메시지 → 아이콘 매핑
  const statusIcon = getStatusIcon(progress.status);

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={`${styles.orb} ${isDone ? styles.orbDone : ''}`} />

        <p className={`${styles.statusIcon} ${isDone ? styles.statusIconDone : ''}`}>
          {isDone ? '✓' : statusIcon}
        </p>
        <p className={styles.statusText}>
          {isDone ? '완성됐어요!' : (progress.status || 'AI 파이프라인 시작 중...')}
        </p>

        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        <p className={styles.percent}>{progress.percent}%</p>

        {isDone && (
          <button
            className={styles.viewResultBtn}
            onClick={handleViewResult}
            disabled={isLoading}
          >
            {isLoading ? '불러오는 중...' : '결과 확인하기'}
          </button>
        )}

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
