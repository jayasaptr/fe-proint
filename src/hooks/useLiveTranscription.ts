import { useCallback, useEffect, useRef, useState } from "react";
import { aiWebSocketUrl, type SttEngine } from "@/lib/aiApi";
import { MIC_CONSTRAINTS, startPcmCapture, type StopCapture } from "@/lib/pcmCapture";

export type { SttEngine };

/** Union of the Deepgram passthrough events and the local Whisper messages. */
interface SttMessage {
  type?: string; // Deepgram: "Results" | "Error" | ...; Whisper: "interim" | "final" | "error"
  is_final?: boolean;
  channel?: { alternatives?: { transcript?: string }[] };
  text?: string;
  message?: string;
  description?: string;
}

// After "stop" the server transcribes whatever audio is still buffered and then closes the socket.
// Local Whisper on CPU can take a few seconds for a long tail; give up waiting after this.
const FINALIZE_TIMEOUT_MS = 12_000;

/**
 * Streams raw 16 kHz PCM from the microphone to the AI Interview API's live STT WebSocket
 * (Deepgram proxy `/stt/live`, or `/stt/whisper-live?engine=whisper|whisper_cloud` for local
 * Whisper / Whisper via OpenRouter). Final segments accumulate in `transcript`; `interim` holds
 * the in-flight partial for live preview (always empty for whisper_cloud).
 *
 * Push-to-talk friendly: `stop()` flushes the microphone buffer, asks the server to finalize and
 * resolves with the complete transcript only after the server has sent its last segment (socket
 * closed) or the wait timed out. `isFinalizing` is true meanwhile.
 */
export function useLiveTranscription(engine: SttEngine = "whisper") {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [interim, setInterim] = useState("");
  const [segments, setSegments] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopCaptureRef = useRef<StopCapture | null>(null);
  // Mirror of `segments` readable synchronously (stop() returns the transcript before React re-renders)
  const segmentsRef = useRef<string[]>([]);

  const pushSegment = useCallback((text: string) => {
    segmentsRef.current = [...segmentsRef.current, text];
    setSegments(segmentsRef.current);
  }, []);

  const cleanup = useCallback(async () => {
    const stopCapture = stopCaptureRef.current;
    stopCaptureRef.current = null;
    if (stopCapture) await stopCapture();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setIsRecording(false);
    setIsConnecting(false);
  }, []);

  /** Resolve when `ws` has closed, or after the finalize timeout (the socket is then closed locally). */
  const waitForClose = (ws: WebSocket) =>
    new Promise<void>((resolve) => {
      if (ws.readyState === WebSocket.CLOSED) return resolve();
      const timer = window.setTimeout(() => {
        ws.close();
        resolve();
      }, FINALIZE_TIMEOUT_MS);
      ws.addEventListener(
        "close",
        () => {
          window.clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
    });

  const stop = useCallback(async (): Promise<string> => {
    const ws = wsRef.current;
    wsRef.current = null;
    // Flush the capture buffer first so the last ~250 ms of speech reaches the server before "stop".
    await cleanup();
    if (!ws) return segmentsRef.current.join(" ");
    if (ws.readyState === WebSocket.OPEN) {
      setIsFinalizing(true);
      try {
        ws.send("stop");
        await waitForClose(ws);
      } finally {
        setIsFinalizing(false);
      }
    } else {
      ws.close(); // still connecting: nothing was sent, drop the socket
    }
    return segmentsRef.current.join(" ");
  }, [cleanup]);

  const start = useCallback(async () => {
    setError(null);
    setInterim("");
    segmentsRef.current = [];
    setSegments([]);
    setIsConnecting(true);

    if (!navigator.mediaDevices?.getUserMedia) {
      // Insecure origin (plain http on a LAN IP): mediaDevices is undefined, no prompt is shown
      setError("Mikrofon hanya bisa diakses lewat halaman HTTPS (atau localhost). Buka link interview dengan https://.");
      setIsConnecting(false);
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS);
    } catch {
      setError("Akses mikrofon ditolak. Izinkan mikrofon di browser lalu coba lagi.");
      setIsConnecting(false);
      return;
    }
    streamRef.current = stream;

    // Both Whisper flavours share the local pause detector and message format; the cloud one
    // only differs server-side (no interim results).
    const isWhisper = engine === "whisper" || engine === "whisper_cloud";
    const ws = new WebSocket(
      isWhisper ? `${aiWebSocketUrl("/stt/whisper-live")}?engine=${engine}` : aiWebSocketUrl("/stt/live"),
    );
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = async () => {
      if (wsRef.current !== ws) {
        ws.close(); // stop() was called while connecting
        return;
      }
      try {
        stopCaptureRef.current = await startPcmCapture(stream, (chunk) => {
          if (ws.readyState === WebSocket.OPEN) ws.send(chunk);
        });
        if (wsRef.current !== ws) {
          // stop() ran while the worklet was loading: release what was just created
          const stopCapture = stopCaptureRef.current;
          stopCaptureRef.current = null;
          await stopCapture?.();
          return;
        }
        setIsConnecting(false);
        setIsRecording(true);
      } catch (err) {
        setError(`Gagal memulai perekaman audio: ${(err as Error).message}`);
        void stop();
      }
    };

    ws.onmessage = (event: MessageEvent<string>) => {
      let msg: SttMessage;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (isWhisper) {
        if (msg.type === "interim") setInterim(msg.text ?? "");
        else if (msg.type === "final") {
          if (msg.text) pushSegment(msg.text);
          setInterim("");
        } else if (msg.type === "error") setError(msg.message ?? "Transcription error");
        return;
      }
      if (msg.type === "Results") {
        const text = msg.channel?.alternatives?.[0]?.transcript ?? "";
        if (!text) return;
        if (msg.is_final) {
          pushSegment(text);
          setInterim("");
        } else {
          setInterim(text);
        }
      } else if (msg.type === "Error" || msg.type === "error") {
        setError(msg.message || msg.description || "Transcription error");
      }
    };

    ws.onerror = () => setError("Koneksi ke layanan transkripsi gagal.");
    ws.onclose = () => {
      if (wsRef.current === ws) wsRef.current = null; // closed by the server, not by stop()
      void cleanup();
    };
  }, [cleanup, stop, engine, pushSegment]);

  // Stop everything if the component unmounts mid-recording
  useEffect(() => {
    return () => {
      wsRef.current?.close();
      void cleanup();
    };
  }, [cleanup]);

  const reset = useCallback(() => {
    segmentsRef.current = [];
    setSegments([]);
    setInterim("");
  }, []);

  return {
    isRecording,
    isConnecting,
    isFinalizing,
    interim,
    transcript: segments.join(" "),
    error,
    start,
    stop,
    reset,
  };
}
