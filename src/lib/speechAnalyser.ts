/**
 * Real-time loudness and mouth-shape hints from the AI interviewer's voice, used to lip-sync the
 * avatar. One AnalyserNode sits between every TTS playback and the speakers (see
 * CandidateInterviewRoom.routeTtsPlayback); the avatar polls it once per animation frame.
 *
 * Values are derived from the audio only (no viseme timestamps from the TTS provider), which is
 * enough for a convincing cartoon mouth: loudness drives how far the mouth opens, the balance of
 * high- vs low-frequency energy decides between a round "a/o" and a spread "i/e/s" shape.
 */

export interface SpeechAnalyser {
  node: AnalyserNode;
  /** Loudness of the current frame, 0..1 (already normalised against typical TTS levels). */
  level(): number;
  /** Mouth shape hint, 0 = round/open vowel, 1 = spread lips / sibilant. Meaningful only while level() > 0. */
  spread(): number;
}

const FFT_SIZE = 1024;
// RMS of TTS speech at normal playback volume peaks around 0.25..0.35 on a -1..1 scale; scale so
// that a normal syllable reaches ~1 without clipping the mouth open all the time.
const LEVEL_GAIN = 3.2;
const NOISE_FLOOR = 0.02;

export const createSpeechAnalyser = (ctx: AudioContext): SpeechAnalyser => {
  const node = ctx.createAnalyser();
  node.fftSize = FFT_SIZE;
  node.smoothingTimeConstant = 0.5;

  const timeData = new Uint8Array(node.fftSize);
  const freqData = new Uint8Array(node.frequencyBinCount);
  const binHz = ctx.sampleRate / node.fftSize;
  // Band edges for the shape hint: vowel body vs. consonant/sibilant energy
  const lowFrom = Math.max(1, Math.round(150 / binHz));
  const lowTo = Math.round(1000 / binHz);
  const highFrom = Math.round(2000 / binHz);
  const highTo = Math.min(node.frequencyBinCount - 1, Math.round(6000 / binHz));

  const level = (): number => {
    node.getByteTimeDomainData(timeData);
    let sum = 0;
    for (let i = 0; i < timeData.length; i++) {
      const v = (timeData[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / timeData.length);
    if (rms < NOISE_FLOOR) return 0;
    return Math.min(1, (rms - NOISE_FLOOR) * LEVEL_GAIN);
  };

  const spread = (): number => {
    node.getByteFrequencyData(freqData);
    let low = 0;
    let high = 0;
    for (let i = lowFrom; i <= lowTo; i++) low += freqData[i];
    for (let i = highFrom; i <= highTo; i++) high += freqData[i];
    low /= Math.max(1, lowTo - lowFrom + 1);
    high /= Math.max(1, highTo - highFrom + 1);
    const total = low + high;
    if (total < 1) return 0.5;
    // High-band energy is naturally weaker; weight it so sibilants actually register as "spread"
    return Math.min(1, Math.max(0, (high * 1.8) / (total + high * 0.8)));
  };

  return { node, level, spread };
};
