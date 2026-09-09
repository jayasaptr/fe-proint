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

/**
 * Streams raw 16 kHz PCM from the microphone to the AI Interview API's live STT WebSocket
 * (Deepgram proxy `/stt/live`, or `/stt/whisper-live?engine=whisper|whisper_cloud` for local
 * Whisper / Whisper via OpenRouter). Final segments accumulate in `transcript`; `interim` holds
 * the in-flight partial for live preview (always empty for whisper_cloud).
 */
export function useLiveTranscription(engine: SttEngine = "whisper") {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [interim, setInterim] = useState("");
  const [segments, setSegments] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopCaptureRef = useRef<StopCapture | null>(null);

  const cleanup = useCallback(async () => {
    const stopCapture = stopCaptureRef.current;
    stopCaptureRef.current = null;
    if (stopCapture) await stopCapture();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setIsRecording(false);
    setIsConnecting(false);
  }, []);

  const stop = useCallback(async () => {
    // Flush the capture buffer first, then ask the server to finalize; it closes the socket
    // after the last transcript.
    await cleanup();
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send("stop");
    }
  }, [cleanup]);

  const start = useCallback(async () => {
    setError(null);
    setInterim("");
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
      try {
        stopCaptureRef.current = await startPcmCapture(stream, (chunk) => {
          if (ws.readyState === WebSocket.OPEN) ws.send(chunk);
        });
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
          if (msg.text) setSegments((prev) => [...prev, msg.text as string]);
          setInterim("");
        } else if (msg.type === "error") setError(msg.message ?? "Transcription error");
        return;
      }
      if (msg.type === "Results") {
        const text = msg.channel?.alternatives?.[0]?.transcript ?? "";
        if (!text) return;
        if (msg.is_final) {
          setSegments((prev) => [...prev, text]);
          setInterim("");
        } else {
          setInterim(text);
        }
      } else if (msg.type === "Error" || msg.type === "error") {
        setError(msg.message || msg.description || "Transcription error");
      }
    };

    ws.onerror = () => setError("Koneksi ke layanan transkripsi gagal.");
    ws.onclose = () => void cleanup();
  }, [cleanup, stop, engine]);

  // Stop everything if the component unmounts mid-recording
  useEffect(() => {
    return () => {
      wsRef.current?.close();
      void cleanup();
    };
  }, [cleanup]);

  const reset = useCallback(() => {
    setSegments([]);
    setInterim("");
  }, []);

  return {
    isRecording,
    isConnecting,
    interim,
    transcript: segments.join(" "),
    error,
    start,
    stop,
    reset,
  };
}
