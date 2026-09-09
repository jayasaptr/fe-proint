import { useCallback, useEffect, useRef, useState } from "react";

// WebM on Chromium/Firefox; MP4 is the only container Safari (iPhone/iPad) can record.
const MIME_CANDIDATES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "video/mp4;codecs=avc1,mp4a.40.2",
  "video/mp4",
];

const COMPOSITE_FPS = 10; // screen content changes slowly; keeps CPU and upload size low
const MAX_WIDTH = 1280; // cap the composite resolution (screens may be 4K)
const VIDEO_BITS_PER_SECOND = 1_000_000; // ~7.5 MB per minute including audio
const AUDIO_BITS_PER_SECOND = 48_000;
const PIP_RATIO = 0.25; // camera picture-in-picture width relative to the frame
const PIP_MARGIN = 16;
const TIMESLICE_MS = 1_000; // MediaRecorder hands out data once per second

export interface RecorderSources {
  screen: MediaStream | null;
  camera: MediaStream | null;
  /** Microphone stream for the recording's audio track (separate from the STT capture). */
  audio: MediaStream | null;
  /**
   * false = camera-only session (phone/tablet: the browser has no screen capture). The frame shows
   * the camera full-size with a "mobile" label instead of the red "share stopped" banner.
   * Default true: the screen is mandatory and its absence is flagged in the video.
   */
  screenRequired?: boolean;
}

export interface RecorderHandlers {
  onData: (blob: Blob) => void;
  /** The candidate stopped sharing (browser "Stop sharing" button or closing the shared window). */
  onScreenEnded?: () => void;
}

/** Create a muted, playing <video> bound to a stream (never attached to the DOM). */
const attachVideo = async (stream: MediaStream): Promise<HTMLVideoElement> => {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  await video.play().catch(() => {});
  return video;
};

/**
 * Frame size for the composite: the screen size capped to MAX_WIDTH; without a screen the camera's
 * own size (a phone held upright gives a portrait frame), else 720p.
 */
const frameSize = (screen: MediaStream | null, camera: MediaStream | null) => {
  const track = (screen ?? camera)?.getVideoTracks()[0];
  const { width = 1280, height = 720 } = track?.getSettings() ?? {};
  const safeWidth = width > 0 ? width : 1280;
  const safeHeight = height > 0 ? height : 720;
  const scale = Math.min(1, MAX_WIDTH / Math.max(safeWidth, safeHeight));
  // Even dimensions keep every encoder happy
  const even = (n: number) => Math.max(2, Math.round((n * scale) / 2) * 2);
  return { width: even(safeWidth), height: even(safeHeight) };
};

/** Draw `video` into a box, preserving aspect ratio (letterbox). */
const drawContain = (ctx: CanvasRenderingContext2D, video: HTMLVideoElement, x: number, y: number, w: number, h: number) => {
  const vw = video.videoWidth || w;
  const vh = video.videoHeight || h;
  const scale = Math.min(w / vw, h / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  ctx.drawImage(video, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
};

export const pickRecorderMimeType = (): string =>
  typeof MediaRecorder !== "undefined" ? MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t)) ?? "" : "";

/**
 * Records the candidate's interview session to one WebM stream: the shared screen fills the frame,
 * the webcam is composited as a picture-in-picture thumbnail, the microphone is the audio track.
 * Data is handed out through `onData` every second so it can be uploaded while the session runs.
 *
 * Screen sharing is mandatory on desktop. When the candidate stops sharing, the frame shows a red
 * banner ("share layar dihentikan") until `replaceScreen()` receives a new stream, and the caller is
 * notified through `onScreenEnded` so it can block the interview meanwhile. On phones and tablets
 * (no screen capture API) pass `screenRequired: false`: the camera fills the frame and a "mobile"
 * label replaces the banner.
 */
export function useSessionRecorder() {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenLiveRef = useRef(false);
  const screenRequiredRef = useRef(true);
  const mimeTypeRef = useRef("");
  const handlersRef = useRef<RecorderHandlers | null>(null);
  const stopPromiseRef = useRef<Promise<void> | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [screenLive, setScreenLive] = useState(false);
  const [mimeType, setMimeType] = useState("");

  const watchScreenTrack = useCallback((stream: MediaStream) => {
    const track = stream.getVideoTracks()[0];
    if (!track) return;
    track.addEventListener("ended", () => {
      screenLiveRef.current = false;
      setScreenLive(false);
      if (screenVideoRef.current) screenVideoRef.current.srcObject = null;
      screenVideoRef.current = null;
      handlersRef.current?.onScreenEnded?.();
    });
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { width, height } = canvas;
    const screenVideo = screenVideoRef.current;
    const cameraVideo = cameraVideoRef.current;

    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, width, height);
    if (screenLiveRef.current && screenVideo) {
      drawContain(ctx, screenVideo, 0, 0, width, height);
      if (cameraVideo) {
        const pipW = Math.round(width * PIP_RATIO);
        const pipH = Math.round((pipW * 9) / 16);
        const x = width - pipW - PIP_MARGIN;
        const y = height - pipH - PIP_MARGIN;
        ctx.fillStyle = "#000";
        ctx.fillRect(x - 2, y - 2, pipW + 4, pipH + 4);
        drawContain(ctx, cameraVideo, x, y, pipW, pipH);
      }
    } else {
      if (cameraVideo) {
        drawContain(ctx, cameraVideo, 0, 0, width, height);
      } else {
        ctx.fillStyle = "#666";
        ctx.font = "16px sans-serif";
        ctx.fillText("Kamera tidak tersedia · hanya suara", 12, Math.round(height / 2));
      }
      if (screenRequiredRef.current) {
        // Leave a visible marker in the video while the mandatory screen share is missing
        ctx.fillStyle = "rgba(220, 38, 38, 0.85)";
        ctx.fillRect(0, 0, width, 36);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 18px sans-serif";
        ctx.fillText("Share layar dihentikan oleh kandidat", 12, 25);
      } else {
        // Camera-only session (mobile): tell reviewers why there is no screen in this video
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0, height - 32, width, 32);
        ctx.fillStyle = "#fff";
        ctx.font = "14px sans-serif";
        ctx.fillText("Interview via HP · kamera & suara (tanpa share layar)", 12, height - 11);
      }
    }
    // Timestamp overlay helps reviewers correlate the video with the transcript
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(PIP_MARGIN, PIP_MARGIN, 190, 28);
    ctx.fillStyle = "#fff";
    ctx.font = "14px monospace";
    ctx.fillText(new Date().toLocaleTimeString(), PIP_MARGIN + 8, PIP_MARGIN + 19);
  }, []);

  const start = useCallback(
    async (sources: RecorderSources, handlers: RecorderHandlers): Promise<boolean> => {
      if (recorderRef.current) return true;
      if (!sources.screen && !sources.camera && !sources.audio) return false;
      if (typeof MediaRecorder === "undefined" || !HTMLCanvasElement.prototype.captureStream) return false;
      try {
        handlersRef.current = handlers;
        screenRequiredRef.current = sources.screenRequired !== false;
        const { width, height } = frameSize(sources.screen, sources.camera);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvasRef.current = canvas;

        const [screenVideo, cameraVideo] = await Promise.all([
          sources.screen ? attachVideo(sources.screen) : null,
          sources.camera ? attachVideo(sources.camera) : null,
        ]);
        screenVideoRef.current = screenVideo;
        cameraVideoRef.current = cameraVideo;
        screenLiveRef.current = Boolean(sources.screen);
        setScreenLive(screenLiveRef.current);
        if (sources.screen) watchScreenTrack(sources.screen);

        draw();
        // setInterval (not requestAnimationFrame): rAF pauses when the tab is hidden, which is exactly
        // when the screen recording matters most.
        timerRef.current = window.setInterval(draw, 1000 / COMPOSITE_FPS);

        const output = canvas.captureStream(COMPOSITE_FPS);
        sources.audio?.getAudioTracks().forEach((track) => output.addTrack(track));

        const type = pickRecorderMimeType();
        const recorder = new MediaRecorder(output, {
          ...(type ? { mimeType: type } : {}),
          videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
          audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
        });
        mimeTypeRef.current = recorder.mimeType || type || "video/webm";
        setMimeType(mimeTypeRef.current);
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) handlersRef.current?.onData(event.data);
        };
        recorder.start(TIMESLICE_MS);
        recorderRef.current = recorder;
        setIsRecording(true);
        return true;
      } catch {
        if (timerRef.current !== null) window.clearInterval(timerRef.current);
        timerRef.current = null;
        return false;
      }
    },
    [draw, watchScreenTrack],
  );

  /** Swap in a new screen stream after the candidate re-shares. */
  const replaceScreen = useCallback(
    async (screen: MediaStream) => {
      screenVideoRef.current = await attachVideo(screen);
      screenLiveRef.current = true;
      setScreenLive(true);
      watchScreenTrack(screen);
    },
    [watchScreenTrack],
  );

  /** Stop recording; resolves after the final `dataavailable` has been delivered. */
  const stop = useCallback((): Promise<void> => {
    const recorder = recorderRef.current;
    if (!recorder) return stopPromiseRef.current ?? Promise.resolve();
    if (stopPromiseRef.current) return stopPromiseRef.current;
    stopPromiseRef.current = new Promise<void>((resolve) => {
      const finish = () => {
        if (timerRef.current !== null) window.clearInterval(timerRef.current);
        timerRef.current = null;
        for (const video of [screenVideoRef.current, cameraVideoRef.current]) {
          if (video) video.srcObject = null;
        }
        screenVideoRef.current = null;
        cameraVideoRef.current = null;
        recorderRef.current = null;
        stopPromiseRef.current = null;
        setIsRecording(false);
        resolve();
      };
      if (recorder.state === "inactive") {
        finish();
        return;
      }
      recorder.onstop = finish;
      recorder.onerror = finish;
      try {
        recorder.stop(); // fires a last dataavailable, then onstop
      } catch {
        finish();
      }
    });
    return stopPromiseRef.current;
  }, []);

  useEffect(() => {
    return () => {
      void stop();
    };
  }, [stop]);

  /** Container/codec actually chosen by MediaRecorder (readable synchronously right after `start`). */
  const getMimeType = useCallback(() => mimeTypeRef.current || "video/webm", []);

  return { isRecording, screenLive, mimeType, getMimeType, start, stop, replaceScreen };
}
