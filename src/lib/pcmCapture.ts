/**
 * Microphone -> raw 16 kHz mono int16 PCM chunks, for the live speech-to-text WebSockets of the
 * AI Interview API (Deepgram proxy and local Whisper both expect this format).
 * Ported from backend/client/src/lib/pcmCapture.js.
 */

export const PCM_SAMPLE_RATE = 16000;
const CHUNK_SAMPLES = 4096; // ~256 ms at 16 kHz

export const MIC_CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    channelCount: 1,
    echoCancellation: true, // the interviewer's TTS plays from the speakers
    noiseSuppression: true,
    autoGainControl: true,
  },
};

// Minimal worklet that forwards raw Float32 frames to the main thread
const WORKLET_CODE = `
class PCMProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0]?.[0]
    if (channel) this.port.postMessage(channel.slice(0))
    return true
  }
}
registerProcessor('pcm-processor', PCMProcessor)
`;

/** Fallback resampler (box filter) for browsers that ignore the AudioContext sampleRate hint. */
function downsample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const output = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < output.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    output[i] = end > start ? sum / (end - start) : input[start];
  }
  return output;
}

function floatToInt16(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

export type StopCapture = () => Promise<void>;

/**
 * Start capturing `stream` as PCM. `onChunk` receives int16 little-endian frames of ~256 ms.
 * Returns an async `stop()` that flushes the buffer and releases the AudioContext.
 */
export async function startPcmCapture(
  stream: MediaStream,
  onChunk: (chunk: ArrayBuffer) => void,
): Promise<StopCapture> {
  const ctx = new AudioContext({ sampleRate: PCM_SAMPLE_RATE });
  const workletUrl = URL.createObjectURL(new Blob([WORKLET_CODE], { type: "application/javascript" }));
  try {
    await ctx.audioWorklet.addModule(workletUrl);
  } finally {
    URL.revokeObjectURL(workletUrl);
  }

  let pending = new Float32Array(0);
  const source = ctx.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(ctx, "pcm-processor");
  node.port.onmessage = (event: MessageEvent<Float32Array>) => {
    const frame = downsample(event.data, ctx.sampleRate, PCM_SAMPLE_RATE);
    const merged = new Float32Array(pending.length + frame.length);
    merged.set(pending);
    merged.set(frame, pending.length);
    if (merged.length >= CHUNK_SAMPLES) {
      onChunk(floatToInt16(merged).buffer as ArrayBuffer);
      pending = new Float32Array(0);
    } else {
      pending = merged;
    }
  };
  source.connect(node);
  node.connect(ctx.destination); // worklet outputs silence; keeps the graph alive

  return async () => {
    if (pending.length > 0) {
      onChunk(floatToInt16(pending).buffer as ArrayBuffer);
      pending = new Float32Array(0);
    }
    node.port.onmessage = null;
    try {
      source.disconnect();
      node.disconnect();
    } catch {
      // already disconnected
    }
    await ctx.close().catch(() => {});
  };
}
