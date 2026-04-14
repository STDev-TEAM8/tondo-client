import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CROP_RATIOS, cropImage, downloadImage } from '../utils/imageUtils';
import styles from './ResultPage.module.css';

export default function ResultPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { imageUrl, docentText } = location.state ?? {};

  const isMock = !imageUrl;

  const [selectedCrop, setSelectedCrop] = useState('watch');
  const [croppedUrl, setCroppedUrl] = useState(null);
  const [isCropping, setIsCropping] = useState(false);

  // 실제 이미지가 있을 때만 크롭
  useEffect(() => {
    if (!imageUrl) return;

    let cancelled = false;
    setIsCropping(true);

    cropImage(imageUrl, selectedCrop).then((url) => {
      if (!cancelled) {
        setCroppedUrl(url);
        setIsCropping(false);
      }
    });

    return () => { cancelled = true; };
  }, [imageUrl, selectedCrop]);

  const handleDownload = () => {
    if (croppedUrl) downloadImage(croppedUrl, `tondo-${selectedCrop}.png`);
  };

  return (
    <div className={styles.container}>

      {/* 테스트 모드 뱃지 */}
      {isMock && (
        <div className={styles.mockBadge}>🧪 테스트 모드 — 서버 미연동</div>
      )}

      {/* 이미지 영역 */}
      <div className={styles.imageWrapper} data-crop={selectedCrop}>
        {isMock ? (
          <div className={styles.mockPlaceholder}>
            <span className={styles.mockIcon}>✦</span>
            <p>AI 이미지가 여기에 표시됩니다</p>
            <p className={styles.mockSub}>서버 연동 후 실제 이미지로 대체됩니다</p>
          </div>
        ) : isCropping ? (
          <div className={styles.cropLoading}>크롭 중...</div>
        ) : croppedUrl ? (
          <img
            src={croppedUrl}
            alt="생성된 미디어 아트"
            className={styles.resultImage}
            onContextMenu={(e) => e.preventDefault()}
          />
        ) : null}
      </div>

      {/* 비율 선택 */}
      <div className={styles.cropSelector}>
        {Object.entries(CROP_RATIOS).map(([key, { label, icon }]) => (
          <button
            key={key}
            className={`${styles.cropBtn} ${selectedCrop === key ? styles.active : ''}`}
            onClick={() => setSelectedCrop(key)}
          >
            <span className={styles.cropIcon}>{icon}</span>
            <span className={styles.cropLabel}>{label}</span>
          </button>
        ))}
      </div>

      {/* 도슨트 텍스트 */}
      {docentText && (
        <p className={`${styles.docent} ${isMock ? styles.docentMock : ''}`}>
          {docentText}
        </p>
      )}

      {/* 액션 버튼 */}
      <div className={styles.actions}>
        {!isMock && (
          <button className={styles.downloadBtn} onClick={handleDownload}>
            이미지 저장
          </button>
        )}
        <button className={styles.retryBtn} onClick={() => navigate('/visualizer')}>
          다시 체험하기
        </button>
      </div>
    </div>
  );
}
