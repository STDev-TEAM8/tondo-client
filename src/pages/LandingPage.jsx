import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './LandingPage.module.css';

/**
 * 랜딩 페이지
 * - 서비스 소개
 * - 마이크 권한 요청 및 Visualizer 진입
 */
export default function LandingPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      navigate('/visualizer');
    } catch {
      setError('마이크 권한을 허용해야 체험할 수 있어요.');
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <p className={styles.eyebrow}>당신의 목소리가 예술이 됩니다</p>
        <h1 className={styles.title}>TonDo</h1>
        <p className={styles.description}>
          목소리를 내면 수학적 파동이 그려지고,<br />
          AI가 그 뼈대 위에 색채를 입혀<br />
          세상에 하나뿐인 미디어 아트를 만들어드립니다.
        </p>

        {error && <p className={styles.error}>{error}</p>}

        <button
          className={styles.startButton}
          onClick={handleStart}
          disabled={loading}
        >
          {loading ? '권한 확인 중...' : '체험 시작하기'}
        </button>

        <p className={styles.hint}>마이크 사용 권한이 필요합니다</p>
      </div>
    </div>
  );
}
