import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { CROP_RATIOS, cropImage, downloadImage } from '../utils/imageUtils';
import { fetchArtworkResult, getOrCreateUUID } from '../api/artworkApi';
import styles from './ResultPage.module.css';

export default function ResultPage() {
  const navigate = useNavigate();
  const { taskId } = useParams();
  const [searchParams] = useSearchParams();

  // uuid: URL 쿼리 파라미터 우선, 없으면 sessionStorage
  const uuid = searchParams.get('uuid') || getOrCreateUUID();

  // 결과 데이터
  const [imageUrl, setImageUrl] = useState(null);
  const [docentText, setDocentText] = useState('');
  const [isFetching, setIsFetching] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // 기기 선택 아코디언
  const [accordionOpen, setAccordionOpen] = useState(false);
  const [selectedCrop, setSelectedCrop] = useState('watch');

  // 크롭 이미지
  const [croppedUrl, setCroppedUrl] = useState(null);
  const [isCropping, setIsCropping] = useState(false);

  // 현재 페이지 URL (QR용) — uuid 포함된 URL 그대로
  const pageUrl = window.location.href;

  // 마운트 시 결과 fetch
  useEffect(() => {
    if (!taskId) {
      navigate('/');
      return;
    }

    // mock taskId 처리
    if (taskId.startsWith('mock_')) {
      setImageUrl(null);
      setDocentText('[테스트 모드] 실제 서버가 연동되면 AI가 생성한 도슨트 텍스트가 여기에 표시됩니다.');
      setIsFetching(false);
      return;
    }

    fetchArtworkResult(taskId, uuid)
      .then(({ imageUrl: img, docentText: docent }) => {
        setImageUrl(img || null);
        setDocentText(docent || '');
        setIsFetching(false);
      })
      .catch((err) => {
        console.error('결과 조회 실패:', err);
        setFetchError('결과를 불러오지 못했습니다.');
        setIsFetching(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  // 이미지 or 기기 선택 변경 시 크롭
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

  const isMock = !imageUrl;

  // ── 로딩 화면 ──
  if (isFetching) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <span className={styles.cropLoadingSpinner} />
          <p>작품을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // ── 에러 화면 ──
  if (fetchError) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <p className={styles.errorText}>{fetchError}</p>
          <button className={styles.retryBtn} onClick={() => navigate('/')}>
            처음으로
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>

      {/* 테스트 모드 뱃지 */}
      {isMock && (
        <div className={styles.mockBadge}>테스트 모드 — 서버 미연동</div>
      )}

      {/* ── 이미지 영역 ── */}
      <section className={styles.imageSection}>
        {isMock ? (
          <div className={styles.mockPlaceholder}>
            <span className={styles.mockIcon}>✦</span>
            <p>AI 이미지가 여기에 표시됩니다</p>
            <p className={styles.mockSub}>서버 연동 후 실제 이미지로 대체됩니다</p>
          </div>
        ) : isCropping ? (
          <div className={styles.cropLoading}>
            <span className={styles.cropLoadingSpinner} />
            크롭 중...
          </div>
        ) : croppedUrl ? (
          <>
            {selectedCrop === 'phone' && (
              <div className={styles.phoneMock}>
                <div className={styles.phoneScreen}>
                  <img src={croppedUrl} alt="생성된 미디어 아트" className={styles.resultImage} onContextMenu={(e) => e.preventDefault()} />
                </div>
              </div>
            )}
            {selectedCrop === 'watch' && (
              <div className={styles.watchWrapper}>
                <div className={styles.watchMock}>
                  <div className={styles.watchCrown} />
                  <div className={styles.watchScreen}>
                    <img src={croppedUrl} alt="생성된 미디어 아트" className={styles.resultImage} onContextMenu={(e) => e.preventDefault()} />
                  </div>
                </div>
              </div>
            )}
            {selectedCrop === 'laptop' && (
              <div className={styles.laptopMock}>
                <div className={styles.laptopScreen}>
                  <img src={croppedUrl} alt="생성된 미디어 아트" className={styles.resultImage} onContextMenu={(e) => e.preventDefault()} />
                </div>
                <div className={styles.laptopBase} />
              </div>
            )}
          </>
        ) : null}
      </section>

      {/* ── 도슨트 ── */}
      {(docentText || isMock) && (
        <section className={styles.docentSection}>
          <p className={styles.docentLabel}>작품 해설</p>
          <p className={`${styles.docentText} ${isMock ? styles.docentMock : ''}`}>
            {docentText || '[테스트 모드] 실제 서버가 연동되면 AI가 생성한 도슨트 텍스트가 여기에 표시됩니다.'}
          </p>
        </section>
      )}

      {/* ── 기기 선택 아코디언 + 저장 ── */}
      <section className={styles.cropSection}>
        <button
          className={styles.accordionTrigger}
          onClick={() => setAccordionOpen((v) => !v)}
        >
          <span>기기 선택</span>
          <span className={`${styles.accordionArrow} ${accordionOpen ? styles.accordionArrowOpen : ''}`}>
            ▾
          </span>
        </button>

        {accordionOpen && (
          <div className={styles.accordionBody}>
            <div className={styles.cropOptions}>
              {Object.entries(CROP_RATIOS).map(([key, { label, icon }]) => (
                <button
                  key={key}
                  className={`${styles.cropBtn} ${selectedCrop === key ? styles.cropBtnActive : ''}`}
                  onClick={() => setSelectedCrop(key)}
                >
                  <span className={styles.cropIcon}>{icon}</span>
                  <span className={styles.cropLabel}>{label}</span>
                  {selectedCrop === key && <span className={styles.cropCheck}>✓</span>}
                </button>
              ))}
            </div>

            {!isMock && (
              <button
                className={styles.saveBtn}
                onClick={handleDownload}
                disabled={isCropping || !croppedUrl}
              >
                {isCropping ? '준비 중...' : `${CROP_RATIOS[selectedCrop]?.icon} ${CROP_RATIOS[selectedCrop]?.label} 저장`}
              </button>
            )}
          </div>
        )}
      </section>

      {/* ── QR 코드 ── */}
      <section className={styles.qrSection}>
        <p className={styles.qrLabel}>핸드폰으로 보기</p>
        <div className={styles.qrWrapper}>
          <QRCodeSVG
            value={pageUrl}
            size={140}
            bgColor="#000"
            fgColor="#e8e8e8"
            level="M"
          />
        </div>
        <p className={styles.qrHint}>QR 코드를 스캔하면 이 페이지를 볼 수 있어요</p>
      </section>

      {/* ── 다시 체험 ── */}
      <section className={styles.retrySection}>
        <button className={styles.retryBtn} onClick={() => navigate('/visualizer')}>
          다시 체험하기
        </button>
      </section>

    </div>
  );
}
