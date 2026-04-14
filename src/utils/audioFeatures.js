/**
 * Web Audio API FFT 데이터에서 5가지 핵심 피처 추출
 *
 * 1. pitch (음고)    : F0, 에너지가 가장 높은 주파수 대역
 * 2. timbre (음색)   : Spectral Centroid (스펙트럼 중심)
 * 3. phase (위상)    : F0의 소수점 이하 편차
 * 4. volume (볼륨)   : 정규화된 진폭 [0, 1]
 * 5. freqBand        : F0 대역 (색상 매핑용, = pitch와 동일)
 */

// 레이어 3: 스펙트럼 음성 비율 — 사람 목소리 대역(85~3500 Hz) 에너지 / 전체 에너지
const VOICE_BAND_LOW  = 85;   // Hz
const VOICE_BAND_HIGH = 3500; // Hz

/**
 * FFT 데이터에서 피처 추출
 * @param {Uint8Array} frequencyData - analyser.getByteFrequencyData() 결과
 * @param {number} sampleRate       - AudioContext.sampleRate (보통 44100 또는 48000)
 * @returns {{ pitch, timbre, phase, volume, freqBand, voiceRatio }}
 */
export function extractFeatures(frequencyData, sampleRate) {
  const binCount = frequencyData.length;
  const binWidth = sampleRate / 2 / binCount; // Hz per bin

  let maxAmplitude = 0;
  let maxBinIndex = 0;
  let totalAmplitude = 0;
  let weightedFreqSum = 0;
  let voiceBandAmplitude = 0;

  for (let i = 0; i < binCount; i++) {
    const amplitude = frequencyData[i];
    const freq = i * binWidth;

    if (amplitude > maxAmplitude) {
      maxAmplitude = amplitude;
      maxBinIndex = i;
    }

    totalAmplitude += amplitude;
    weightedFreqSum += freq * amplitude;

    // 음성 대역 에너지 누적
    if (freq >= VOICE_BAND_LOW && freq <= VOICE_BAND_HIGH) {
      voiceBandAmplitude += amplitude;
    }
  }

  // 1. pitch: 에너지 최고 주파수 (Hz)
  const pitch = maxBinIndex * binWidth;

  // 2. timbre: 스펙트럼 중심 (Spectral Centroid, Hz)
  const timbre = totalAmplitude > 0 ? weightedFreqSum / totalAmplitude : 0;

  // 3. phase: F0 주파수의 소수점 이하 편차 (0~1 범위로 정규화 후 π 배)
  const pitchFractional = (pitch % 1.0);
  const phase = pitchFractional * Math.PI;

  // 4. volume: 최대 진폭을 [0, 1]로 정규화 (Uint8Array 최대 255)
  const volume = maxAmplitude / 255;

  // 5. freqBand: 색상 매핑용 주파수 = pitch와 동일
  const freqBand = pitch;

  // 6. voiceRatio: 음성 대역 에너지 비율 (0~1) — 높을수록 목소리에 가까움
  const voiceRatio = totalAmplitude > 0 ? voiceBandAmplitude / totalAmplitude : 0;

  return { pitch, timbre, phase, volume, freqBand, voiceRatio };
}

/**
 * 발화 구간 전체의 평균 FFT 피처 계산 (서버 전송용)
 * @param {Array<{pitch, timbre, phase, volume, freqBand}>} featureHistory
 * @returns {{ avgPitch, avgVolume, avgTimbre }}
 */
export function computeAverageFeatures(featureHistory) {
  if (!featureHistory.length) {
    return { avgPitch: 0, avgVolume: 0, avgTimbre: 0 };
  }
  const len = featureHistory.length;
  const avgPitch = featureHistory.reduce((s, f) => s + f.pitch, 0) / len;
  const avgVolume = featureHistory.reduce((s, f) => s + f.volume, 0) / len;
  const avgTimbre = featureHistory.reduce((s, f) => s + f.timbre, 0) / len;
  return { avgPitch, avgVolume, avgTimbre };
}
