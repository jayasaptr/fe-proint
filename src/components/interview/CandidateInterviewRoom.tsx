import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLiveTranscription, type SttEngine } from "@/hooks/useLiveTranscription";
import { useSessionRecorder } from "@/hooks/useSessionRecorder";
import { getSttConfig, resolveSttEngine, synthesizeSpeech, warmupWhisper } from "@/lib/aiApi";
import type { InterviewHistoryItem } from "@/lib/api/interview";
import { MIC_CONSTRAINTS } from "@/lib/pcmCapture";
import { RecordingUploader } from "@/lib/recordingUploader";
import {
  answerCandidateQuestion,
  completeInterview,
  fetchClosing,
  fetchNextQuestion,
  portalErrorMessage,
  portalErrorStatus,
  saveProgress,
  streamNextQuestion,
  type InterviewSessionConfig,
  type NextQuestionResult,
} from "@/lib/api/interviewPortal";
import { splitForSpeech, stripSpeechTags } from "@/lib/speech";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Loader2,
  Mic,
  MicOff,
  MonitorUp,
  Play,
  RefreshCw,
  Send,
  Timer,
  Volume2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

/** Message shown when the (mandatory) screen share could not be started. */
const screenShareErrorMessage = (err: unknown): string => {
  const name = (err as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Share layar dibatalkan. Interview ini wajib membagikan seluruh layar; klik Mulai lagi dan pilih \"Seluruh layar\" (Entire screen).";
  }
  if (name === "NotSupportedError" || name === "TypeError") {
    return "Browser ini tidak mendukung share layar. Gunakan Chrome atau Edge terbaru di laptop/PC.";
  }
  if (err instanceof Error && err.message) return err.message;
  return "Share layar tidak dapat dimulai. Coba lagi dengan Chrome atau Edge di laptop/PC.";
};

/**
 * Ask for the whole screen. The interview requires the entire display (not one window or tab), so
 * a pick of another surface is rejected and the candidate is asked again.
 */
const requestScreenShare = async (): Promise<MediaStream> => {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error("Share layar tidak tersedia. Buka link interview lewat HTTPS dengan Chrome atau Edge di laptop/PC.");
  }
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { displaySurface: "monitor" } as MediaTrackConstraints,
    audio: false,
    // Chromium hints: hide "this tab", don't offer switching surfaces mid-session, list monitors
    ...({ selfBrowserSurface: "exclude", surfaceSwitching: "exclude", monitorTypeSurfaces: "include", systemAudio: "exclude" } as object),
  });
  const track = stream.getVideoTracks()[0];
  const surface = (track?.getSettings() as MediaTrackSettings & { displaySurface?: string } | undefined)?.displaySurface;
  if (surface && surface !== "monitor") {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error("Yang dibagikan harus seluruh layar, bukan satu jendela atau tab. Klik Mulai lagi dan pilih \"Seluruh layar\" (Entire screen).");
  }
  return stream;
};

/**
 * Screen capture exists on desktop browsers only. Phones and tablets (Chrome Android, Safari iOS)
 * have no getDisplayMedia, so the interview there runs in camera mode: camera + mic are recorded,
 * screen share is not asked for, and leaving the page is counted instead of a stopped share.
 */
const isScreenShareSupported = (): boolean =>
  typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getDisplayMedia === "function";

const SILENCE_SUBMIT_MS = 2500; // pause listening and show the review step after this much silence (mic on)
const REVIEW_AUTO_SEND_S = 15; // review step sends automatically after this many idle seconds
const BARGE_IN_MIN_WORDS = 4; // sustained speech required to interrupt the AI voice
const BARGE_IN_GRACE_MS = 800; // ignore barge-in right after playback starts (AEC settling)
const MIN_ANSWER_WORDS = 3; // don't auto-submit shorter (likely noise) answers
const MAX_QA_ROUNDS = 3; // candidate questions answered before closing

const QA_INVITE =
  "Nah, itu tadi pertanyaan terakhir dari saya. Sebelum kita akhiri, apakah ada hal yang ingin Anda tanyakan tentang posisi atau perusahaan?";
const QA_AGAIN = "Ada lagi yang ingin Anda tanyakan?";

type Phase = "ready" | "interviewing" | "qa" | "closing" | "saving" | "done";
type SubmitState = "idle" | "sending" | "sent" | "failed";

interface CurrentQuestion extends NextQuestionResult {
  speech: string[];
}

interface CandidateInterviewRoomProps {
  token: string;
  sessionToken: string;
  interview: InterviewSessionConfig;
  candidateName?: string | null;
}

const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

const formatElapsed = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

/** Name tag in the corner of a video tile. */
const TileLabel = ({ children }: { children: React.ReactNode }) => (
  <span className="absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)] truncate rounded-md bg-black/45 px-2 py-0.5 text-[11px] text-white/90 backdrop-blur-sm">
    {children}
  </span>
);

/** Translucent panel used for the question, Q&A and closing text. */
const PANEL_CLASS = "rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 sm:px-5 sm:py-4";

/**
 * Ruang interview kandidat: pertanyaan dibacakan (TTS), kandidat menjawab dengan suara (live STT),
 * jawaban terkirim otomatis setelah jeda. Semua giliran LLM lewat portal Laravel; kandidat tidak
 * pernah melihat skor. Transkrip disimpan setelah tiap jawaban agar sesi terputus bisa dilanjutkan.
 */
const CandidateInterviewRoom = ({ token, sessionToken, interview, candidateName }: CandidateInterviewRoomProps) => {
  const [phase, setPhase] = useState<Phase>("ready");
  const [question, setQuestion] = useState<CurrentQuestion | null>(null);
  const [history, setHistory] = useState<InterviewHistoryItem[]>(interview.history ?? []);
  const [qaExchanges, setQaExchanges] = useState<InterviewHistoryItem[]>(interview.qa_exchanges ?? []);
  const [answer, setAnswer] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [isTtsPlaying, setIsTtsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [closingText, setClosingText] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  // Review step: after the candidate stops talking, the transcript is shown for checking/editing
  // before it is sent ("salah sebut" by STT can be fixed or re-spoken).
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewCountdown, setReviewCountdown] = useState<number | null>(null);
  const answerPrefixRef = useRef(""); // text kept when the candidate resumes speaking
  // Sequential speech queue: reaction -> question. Items are synthesized as soon as
  // they are enqueued (in parallel) but played strictly in order; a barge-in bumps the generation
  // so everything still queued is skipped.
  const speechChainRef = useRef<Promise<void>>(Promise.resolve());
  const speechPendingRef = useRef(0);
  const speechGenRef = useRef(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastActivityRef = useRef(Date.now());
  const answerRef = useRef("");
  const interimRef = useRef("");
  const submittingRef = useRef(false);
  const clarifyingRef = useRef(false); // current question is a clarification request
  const clarifyCountRef = useRef(0); // clarifications already asked for the current answer
  const interruptedRef = useRef(false);
  const playbackStartedAtRef = useRef(0);
  const startedAtRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const finalPayloadRef = useRef<{ history: InterviewHistoryItem[]; qaExchanges: InterviewHistoryItem[]; durationSeconds: number; screenInterruptions: number } | null>(null);

  // Session recording streamed to the portal while the interview runs (desktop: mandatory screen
  // share + camera PiP + mic; phone/tablet: camera + mic); Laravel uploads the finished file to DH
  // Asset on completion.
  const recordingRequired = interview.recording_required !== false;
  // Desktop: whole-screen share is mandatory. Mobile (no screen capture API): camera-only recording.
  const [screenShareSupported] = useState(isScreenShareSupported);
  const screenRequired = recordingRequired && screenShareSupported;
  const cameraOnlyMode = recordingRequired && !screenShareSupported;
  const recorder = useSessionRecorder();
  const screenStreamRef = useRef<MediaStream | null>(null);
  const recordingAudioRef = useRef<MediaStream | null>(null); // mixed mic + AI voice, fed to the recorder
  const micStreamRef = useRef<MediaStream | null>(null); // raw mic capture behind the mix
  // Web Audio mixer: the microphone and every TTS playback are routed into one destination stream so
  // the recording carries both sides of the conversation, not just the candidate.
  const audioMixRef = useRef<{ ctx: AudioContext; dest: MediaStreamAudioDestinationNode; ttsGain: GainNode } | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null); // kept alive after the mix stops; closed on unmount
  const uploaderRef = useRef<RecordingUploader | null>(null);
  const interruptionsRef = useRef(0);
  const [screenInterruptions, setScreenInterruptions] = useState(0);
  // Desktop: share stopped mid-session, interview blocked until re-shared.
  // Camera mode: the candidate left the page (switched app/tab); blocked until they tap "Lanjutkan".
  const [screenLost, setScreenLost] = useState(false);
  const [isResharing, setIsResharing] = useState(false);
  const [reshareError, setReshareError] = useState<string | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [isStartingMedia, setIsStartingMedia] = useState(false);

  // STT engine: HR's choice on the invitation, else VITE_STT_ENGINE, else the server's STT_ENGINE
  // default (whisper lokal, whisper_cloud via OpenRouter, or deepgram), falling back to whatever
  // is configured on the server.
  const { data: sttConfig } = useQuery({ queryKey: ["ai-stt-config"], queryFn: getSttConfig, staleTime: 5 * 60_000, retry: 1 });
  const sttEngine: SttEngine = resolveSttEngine(sttConfig, interview.stt_engine);
  const stt = useLiveTranscription(sttEngine);

  useEffect(() => {
    answerRef.current = answer;
  }, [answer]);
  useEffect(() => {
    interimRef.current = stt.interim;
  }, [stt.interim]);
  // Answer follows the live transcript, appended to whatever was kept before the mic was resumed
  useEffect(() => {
    if (stt.transcript) setAnswer([answerPrefixRef.current, stt.transcript].filter(Boolean).join(" "));
  }, [stt.transcript]);

  // Review countdown: auto-send unless the candidate edits, re-speaks, or sends manually
  useEffect(() => {
    if (!isReviewing || reviewCountdown === null || screenLost) return; // paused while the screen share is missing
    if (reviewCountdown <= 0) {
      if (phase === "qa") void submitCandidateQuestion();
      else void submitAnswer();
      return;
    }
    const id = window.setTimeout(() => setReviewCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReviewing, reviewCountdown, phase, screenLost]);

  // Session timer
  useEffect(() => {
    if (["interviewing", "qa", "closing", "saving"].includes(phase)) {
      if (!startedAtRef.current) startedAtRef.current = Date.now();
      const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - (startedAtRef.current ?? Date.now())) / 1000)), 1000);
      return () => window.clearInterval(id);
    }
  }, [phase]);

  // Attach the webcam stream to the video tile whenever the room is shown
  useEffect(() => {
    if (videoRef.current && cameraStreamRef.current) {
      videoRef.current.srcObject = cameraStreamRef.current;
    }
  }, [phase, cameraError]);

  const interruptTts = () => {
    speechGenRef.current += 1; // skip everything still queued
    audioRef.current?.pause();
    interruptedRef.current = true;
    setIsTtsPlaying(false);
  };

  // Speech activity from transcripts: refresh timer + barge-in while the AI is talking
  useEffect(() => {
    if (phase !== "interviewing" && phase !== "qa") return;
    if (stt.interim || stt.transcript) lastActivityRef.current = Date.now();
    if (isTtsPlaying) {
      const pastGrace = Date.now() - playbackStartedAtRef.current > BARGE_IN_GRACE_MS;
      if (pastGrace && countWords(stt.interim) >= BARGE_IN_MIN_WORDS) interruptTts();
    }
  }, [stt.interim, stt.transcript, isTtsPlaying, phase]);

  // Silence watcher: when the candidate stops talking (mic on), pause the mic and open the review
  // step instead of sending straight away, so a mis-transcribed answer can be fixed or re-spoken.
  useEffect(() => {
    if ((phase !== "interviewing" && phase !== "qa") || isThinking || isTtsPlaying || !stt.isRecording) return;
    const id = window.setInterval(() => {
      if (submittingRef.current) return;
      const quiet = Date.now() - lastActivityRef.current > SILENCE_SUBMIT_MS;
      if (quiet && countWords(answerRef.current) >= MIN_ANSWER_WORDS && !interimRef.current) {
        void enterReview();
      }
    }, 400);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, isThinking, isTtsPlaying, stt.isRecording, question]);

  // Stop camera, screen share and recording audio on unmount
  useEffect(
    () => () => {
      stopMedia();
      void audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /** Whole-screen share, mandatory for the interview. Resolves false (with `error` set) when refused. */
  const startScreenShare = async (): Promise<boolean> => {
    try {
      const screen = await requestScreenShare();
      screenStreamRef.current = screen;
      return true;
    } catch (err) {
      setError(screenShareErrorMessage(err));
      return false;
    }
  };

  /**
   * Audio track for the recording: microphone (own capture; the STT hook opens another per answer)
   * mixed with the AI interviewer's voice. Must run from the Start click so the AudioContext is
   * allowed to start.
   */
  const startRecordingAudio = async () => {
    try {
      const ctx = new AudioContext();
      const dest = ctx.createMediaStreamDestination();
      const ttsGain = ctx.createGain();
      ttsGain.gain.value = 0.9; // the synthetic voice is denser than room speech; keep it a touch under the mic
      ttsGain.connect(dest);
      audioMixRef.current = { ctx, dest, ttsGain };
      try {
        const mic = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS);
        micStreamRef.current = mic;
        ctx.createMediaStreamSource(mic).connect(dest);
      } catch {
        micStreamRef.current = null; // AI voice only is still better than a silent recording
      }
      await ctx.resume().catch(() => {});
      recordingAudioRef.current = dest.stream;
    } catch {
      audioMixRef.current = null;
      recordingAudioRef.current = null; // video-only recording is better than none
    }
  };

  /** Route a TTS playback element into the recording mix while keeping it audible on the speakers. */
  const attachTtsToRecording = (audio: HTMLAudioElement) => {
    const mix = audioMixRef.current;
    if (!mix) return;
    try {
      const source = mix.ctx.createMediaElementSource(audio); // from here on the element only plays through the graph
      source.connect(mix.ctx.destination);
      source.connect(mix.ttsGain);
      void mix.ctx.resume().catch(() => {});
    } catch {
      /* element already attached or context closed: it still plays through the speakers */
    }
  };

  /**
   * Stop feeding the recording. The AudioContext itself is left open: TTS elements already routed
   * through it (e.g. the closing statement, which plays while the recording is being finalised)
   * would go silent if the context were closed. It is closed on unmount.
   */
  const stopRecordingAudio = () => {
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;
    recordingAudioRef.current?.getTracks().forEach((track) => track.stop());
    recordingAudioRef.current = null;
    const mix = audioMixRef.current;
    audioMixRef.current = null; // later playbacks are no longer attached and play directly
    if (mix) audioCtxRef.current = mix.ctx;
  };

  const handleScreenEnded = () => {
    interruptionsRef.current += 1;
    setScreenInterruptions(interruptionsRef.current);
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current = null;
    setReshareError(null);
    setScreenLost(true);
    // Pause the interview: stop the AI voice and the mic; the review/answer state is kept.
    // This runs from the recorder's track listener (closure from start time), so it must only touch
    // refs and stable callbacks: stt.stop() is a no-op when the mic is already off.
    interruptTts();
    void stt.stop();
  };

  /**
   * Camera mode: the candidate left the interview page (home button, another app or tab). Counted
   * like a stopped share and the interview pauses until they come back and tap "Lanjutkan".
   */
  useEffect(() => {
    if (!cameraOnlyMode || !["interviewing", "qa"].includes(phase)) return;
    const onVisibility = () => {
      if (document.visibilityState !== "hidden") return;
      interruptionsRef.current += 1;
      setScreenInterruptions(interruptionsRef.current);
      setReshareError(null);
      setScreenLost(true);
      interruptTts();
      void stt.stop();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOnlyMode, phase]);

  /**
   * Resume after a pause. Desktop: the candidate must share the whole screen again. Camera mode:
   * nothing to re-share, the recording never stopped; just unblock.
   */
  const reshareScreen = async () => {
    if (cameraOnlyMode) {
      setScreenLost(false);
      lastActivityRef.current = Date.now();
      return;
    }
    setIsResharing(true);
    setReshareError(null);
    try {
      const screen = await requestScreenShare();
      screenStreamRef.current = screen;
      await recorder.replaceScreen(screen);
      setScreenLost(false);
      lastActivityRef.current = Date.now();
    } catch (err) {
      setReshareError(screenShareErrorMessage(err));
    } finally {
      setIsResharing(false);
    }
  };

  /** Start the composite recording and its uploader. Resolves false when the browser cannot record. */
  const startRecording = async (): Promise<boolean> => {
    interruptionsRef.current = 0;
    setScreenInterruptions(0);
    setRecordingError(null);
    const uploader = new RecordingUploader(
      token,
      sessionToken,
      recorder.getMimeType, // WebM on Chromium, MP4 on Safari: known only once recording starts
      () => interruptionsRef.current,
      (message) => setRecordingError(message),
    );
    uploaderRef.current = uploader;
    const ok = await recorder.start(
      {
        screen: screenStreamRef.current,
        camera: cameraStreamRef.current,
        audio: recordingAudioRef.current,
        screenRequired,
      },
      { onData: (blob) => uploader.push(blob), onScreenEnded: handleScreenEnded },
    );
    if (!ok) uploaderRef.current = null;
    return ok;
  };

  /** Stop the recorder, send the remaining parts and wait until the server has them all. */
  const stopRecording = async () => {
    await recorder.stop();
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current = null;
    stopRecordingAudio();
    const uploader = uploaderRef.current;
    uploaderRef.current = null;
    if (uploader) {
      const result = await uploader.drain();
      if (!result.ok && result.error) setRecordingError(result.error);
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      // Insecure origin (plain http on a LAN IP): the browser never even shows a permission prompt
      setCameraError("Kamera dan mikrofon hanya bisa diakses lewat halaman HTTPS. Buka link interview dengan https://.");
      return;
    }
    try {
      // Video only: the STT hook owns the microphone stream. Front camera on phones; sizes are
      // "ideal" so a phone camera without exact 720p still opens instead of failing.
      const camera = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: false,
      });
      cameraStreamRef.current = camera;
    } catch {
      setCameraError(
        cameraOnlyMode
          ? "Kamera tidak tersedia. Izinkan akses kamera di browser HP Anda; interview tetap berjalan dengan suara."
          : "Kamera tidak tersedia. Interview tetap berjalan tanpa video.",
      );
    }
  };

  const stopCamera = () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
  };

  const stopMedia = () => {
    stopCamera();
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current = null;
    stopRecordingAudio();
  };

  const micOn = stt.isRecording || stt.isConnecting;
  const isSpeaking = micOn && Boolean(stt.interim);

  /** Start listening; the current answer text is kept and new speech is appended to it. */
  const resumeMic = () => {
    answerPrefixRef.current = answerRef.current.trim();
    setIsReviewing(false);
    setReviewCountdown(null);
    stt.reset();
    void stt.start();
    lastActivityRef.current = Date.now();
  };

  const toggleMic = () => {
    if (micOn) void enterReview();
    else resumeMic();
  };

  /** Pause the mic and show the transcript for checking before it is sent. */
  const enterReview = async () => {
    if (stt.isRecording || stt.isConnecting) await stt.stop();
    if (!answerRef.current.trim()) return; // nothing to review yet
    setIsReviewing(true);
    setReviewCountdown(REVIEW_AUTO_SEND_S);
  };

  /** Discard the transcript and listen again from scratch. */
  const restartAnswer = () => {
    answerPrefixRef.current = "";
    setAnswer("");
    setIsReviewing(false);
    setReviewCountdown(null);
    stt.reset();
    void stt.start();
    lastActivityRef.current = Date.now();
  };

  const leaveReview = () => {
    setIsReviewing(false);
    setReviewCountdown(null);
    answerPrefixRef.current = "";
  };

  // Plays one audio blob; resolves when it ends, is paused (interrupted) or fails.
  const playBlob = (blob: Blob) =>
    new Promise<void>((resolve) => {
      const url = URL.createObjectURL(blob);
      audioRef.current?.pause();
      const audio = new Audio(url);
      audioRef.current = audio;
      attachTtsToRecording(audio); // AI voice goes into the session recording as well as the speakers
      const done = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
      audio.onended = done;
      audio.onpause = done;
      audio.onerror = done;
      audio.play().catch(done);
    });

  /**
   * Add one utterance to the speech queue. Synthesis starts immediately; playback waits for the
   * items queued before it. Resolves when this item has finished playing (or was skipped).
   */
  const enqueueSpeech = (source: string | Blob): Promise<void> => {
    const gen = speechGenRef.current;
    const blobPromise: Promise<Blob | null> =
      source instanceof Blob ? Promise.resolve(source) : synthesizeSpeech(source).catch(() => null);
    speechPendingRef.current += 1;
    interruptedRef.current = false;
    setIsTtsPlaying(true);
    const run = speechChainRef.current
      .then(async () => {
        if (gen !== speechGenRef.current) return; // interrupted while waiting in the queue
        const blob = await blobPromise;
        if (!blob || gen !== speechGenRef.current) return;
        playbackStartedAtRef.current = Date.now();
        await playBlob(blob);
      })
      .catch(() => {
        /* TTS is best-effort: the text is always shown on screen */
      })
      .finally(() => {
        speechPendingRef.current -= 1;
        if (speechPendingRef.current === 0) {
          setIsTtsPlaying(false);
          // Drop speaker echo picked up by an open mic, but never a real answer
          if (!interruptedRef.current && countWords(answerRef.current) < BARGE_IN_MIN_WORDS) {
            stt.reset();
            setAnswer("");
            lastActivityRef.current = Date.now();
          }
        }
      });
    speechChainRef.current = run;
    return run;
  };

  /** Speak one or more parts in order (each part is one TTS request). */
  const speak = async (parts: (string | null | undefined)[] | string) => {
    const texts = (Array.isArray(parts) ? parts : [parts])
      .filter((t): t is string => Boolean(t && t.trim()))
      .flatMap((t) => splitForSpeech(t, { maxChunks: 1 }));
    if (texts.length === 0) return;
    await Promise.all(texts.map((t) => enqueueSpeech(t)));
  };

  const persistProgress = (nextHistory: InterviewHistoryItem[], nextQa: InterviewHistoryItem[]) => {
    saveProgress(token, sessionToken, nextHistory, nextQa).catch(() => {
      /* best-effort; the final submit carries the full transcript */
    });
  };

  const applyNextQuestion = (data: NextQuestionResult, alreadySpoken: { reaction: boolean; question: boolean }) => {
    if (data.finished) {
      if (data.reaction && !alreadySpoken.reaction) void speak(data.reaction);
      enterQa();
      return;
    }
    clarifyingRef.current = Boolean(data.clarify);
    clarifyCountRef.current = clarifyingRef.current ? clarifyCountRef.current + 1 : 0;
    answerPrefixRef.current = "";
    const reaction = stripSpeechTags(data.reaction);
    const questionText = stripSpeechTags(data.question);
    setQuestion({ ...data, reaction, question: questionText, speech: [data.reaction ?? "", data.question ?? ""] });
    setPhase("interviewing");
    lastActivityRef.current = Date.now();
    // Speak whatever the stream did not already hand to the queue
    const remaining: string[] = [];
    if (!alreadySpoken.reaction && data.reaction) remaining.push(data.reaction);
    if (!alreadySpoken.question && data.question) remaining.push(data.question);
    if (remaining.length) void speak(remaining);
  };

  const loadNextQuestion = async (currentHistory: InterviewHistoryItem[]) => {
    setIsThinking(true);
    setError(null);
    const allowClarify = clarifyCountRef.current < 1;
    const estimatedNumber = currentHistory.length + 1;
    const spoken = { reaction: false, question: false };
    try {
      // Streaming: the reaction is spoken as soon as the model has written it, while the question
      // is still being generated, so the candidate hears the interviewer within ~2 s.
      let data: NextQuestionResult;
      try {
        data = await streamNextQuestion(token, sessionToken, currentHistory, allowClarify, null, {
          onReaction: (text) => {
            const clean = stripSpeechTags(text);
            if (!clean) return;
            spoken.reaction = true;
            void enqueueSpeech(text);
            // Show the reaction right away; the question fills in when it arrives
            setQuestion({ finished: false, number: estimatedNumber, reaction: clean, question: "", speech: [text] });
            setPhase("interviewing");
          },
          onQuestion: (text) => {
            const clean = stripSpeechTags(text);
            if (!clean) return;
            spoken.question = true;
            void enqueueSpeech(text);
            setQuestion((prev) => ({
              ...(prev ?? { finished: false, number: estimatedNumber, reaction: "", speech: [] }),
              question: clean,
              speech: [...(prev?.speech ?? []), text],
            }));
            setPhase("interviewing");
          },
        });
      } catch (streamErr) {
        if (spoken.reaction || spoken.question) throw streamErr; // partial speech already out; do not repeat
        // Fallback for proxies that buffer SSE: plain request/response
        const envelope = await fetchNextQuestion(token, sessionToken, currentHistory, allowClarify);
        if (!envelope.success || !envelope.data) throw new Error(envelope.message || "Gagal menyiapkan pertanyaan.");
        data = envelope.data;
      }
      applyNextQuestion(data, spoken);
    } catch (err) {
      setError(portalErrorMessage(err, "Tidak dapat menghubungi layanan interview."));
    } finally {
      setIsThinking(false);
    }
  };

  const enterQa = () => {
    setPhase("qa");
    setAnswer("");
    stt.reset();
    lastActivityRef.current = Date.now();
    void speak(QA_INVITE);
  };

  const submitCandidateQuestion = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      audioRef.current?.pause();
      setIsTtsPlaying(false);
      if (stt.isRecording) await stt.stop();
      const candidateQuestion = answerRef.current.trim();
      if (!candidateQuestion) return;
      leaveReview();
      setAnswer("");
      stt.reset();
      setIsThinking(true);
      let answerText = "";
      try {
        const envelope = await answerCandidateQuestion(token, sessionToken, history, candidateQuestion);
        if (envelope.success) answerText = envelope.data.answer;
        else setError(envelope.message);
      } catch (err) {
        setError(portalErrorMessage(err, "Tidak dapat menghubungi layanan interview."));
      } finally {
        setIsThinking(false);
      }
      if (!answerText) return;
      const nextQa = [...qaExchanges, { question: candidateQuestion, answer: stripSpeechTags(answerText) }];
      setQaExchanges(nextQa);
      persistProgress(history, nextQa);
      if (nextQa.length >= MAX_QA_ROUNDS) {
        await speak(answerText);
        void doClosing(history, nextQa);
      } else {
        void speak([answerText, QA_AGAIN]);
      }
    } finally {
      submittingRef.current = false;
    }
  };

  const durationSeconds = () => (startedAtRef.current ? Math.floor((Date.now() - startedAtRef.current) / 1000) : elapsed);

  const submitFinal = async (payload: NonNullable<typeof finalPayloadRef.current>) => {
    setSubmitState("sending");
    setError(null);
    // A 429 (rate limit) or a dropped connection right at the end should not leave the candidate with
    // a failure screen for something that succeeds seconds later: retry a few times with backoff first.
    const delays = [4_000, 8_000, 12_000];
    for (let attempt = 0; ; attempt++) {
      try {
        const envelope = await completeInterview(token, sessionToken, payload);
        if (!envelope.success) throw new Error(envelope.message);
        setSubmitState("sent");
        return;
      } catch (err) {
        const status = portalErrorStatus(err);
        const transient = status === 429 || status === undefined || status >= 500;
        if (transient && attempt < delays.length) {
          await new Promise((r) => window.setTimeout(r, delays[attempt]));
          continue;
        }
        setSubmitState("failed");
        setError(portalErrorMessage(err, "Jawaban Anda belum berhasil dikirim. Periksa koneksi lalu kirim ulang."));
        return;
      }
    }
  };

  const finish = async (finalHistory: InterviewHistoryItem[], finalQa: InterviewHistoryItem[]) => {
    const payload = { history: finalHistory, qaExchanges: finalQa, durationSeconds: durationSeconds(), screenInterruptions: interruptionsRef.current };
    finalPayloadRef.current = payload;
    // The server uploads the recording to DH Asset inside /complete, so every part must be there first
    await stopRecording();
    await submitFinal(payload);
    stopMedia();
    setPhase("done");
  };

  const doClosing = async (finalHistory: InterviewHistoryItem[], finalQa: InterviewHistoryItem[]) => {
    if (stt.isRecording) await stt.stop();
    audioRef.current?.pause();
    setIsTtsPlaying(false);
    setPhase("closing");
    setError(null);
    let closingPlayback: Promise<void> = Promise.resolve();
    try {
      const envelope = await fetchClosing(token, sessionToken, finalHistory);
      if (envelope.success) {
        setClosingText(stripSpeechTags(envelope.data.closing));
        closingPlayback = speak(envelope.data.closing);
      }
    } catch {
      // Closing is best-effort; the transcript is still submitted
    }
    // Let the candidate hear the whole closing while the server stores the transcript
    await Promise.all([closingPlayback, finish(finalHistory, finalQa)]);
  };

  const startInterview = async () => {
    setError(null);
    clarifyingRef.current = false;
    clarifyCountRef.current = 0;
    setIsStartingMedia(true);
    try {
      // Screen share first, straight from the click: getDisplayMedia needs a fresh user gesture and
      // the desktop interview cannot start without it. Skipped in camera mode (phone/tablet).
      if (screenRequired && !(await startScreenShare())) return;
      // Load the Whisper model now, so the candidate's first answer is not delayed by the model load
      if (sttEngine === "whisper") warmupWhisper().catch(() => {});
      await startCamera();
      if (recordingRequired) {
        await startRecordingAudio();
        if (!(await startRecording())) {
          stopMedia();
          setError(
            cameraOnlyMode
              ? "Browser ini tidak dapat merekam sesi. Gunakan Chrome terbaru (Android) atau Safari terbaru (iPhone/iPad), lalu izinkan kamera dan mikrofon."
              : "Browser ini tidak dapat merekam sesi. Gunakan Chrome atau Edge terbaru di laptop/PC.",
          );
          return;
        }
      }
    } finally {
      setIsStartingMedia(false);
    }
    await loadNextQuestion(history);
  };

  // A clarification answer extends the last history entry instead of adding a new one
  const mergeClarification = (base: InterviewHistoryItem[], clarified: string) =>
    base.map((item, i) => (i === base.length - 1 ? { ...item, answer: `${item.answer} (klarifikasi kandidat: ${clarified})` } : item));

  const submitAnswer = async () => {
    if (submittingRef.current || !question) return;
    submittingRef.current = true;
    try {
      audioRef.current?.pause();
      setIsTtsPlaying(false);
      if (stt.isRecording) await stt.stop();
      const finalAnswer = answerRef.current.trim();
      if (!finalAnswer) return;
      leaveReview();
      const nextHistory = clarifyingRef.current
        ? mergeClarification(history, finalAnswer)
        : [...history, { question: question.question ?? "", answer: finalAnswer }];
      setHistory(nextHistory);
      setAnswer("");
      stt.reset();
      persistProgress(nextHistory, qaExchanges);
      await loadNextQuestion(nextHistory);
    } finally {
      submittingRef.current = false;
    }
  };

  /** Candidate ends early: whatever was answered is submitted for assessment. */
  const endSession = async () => {
    if (!window.confirm("Akhiri interview sekarang? Jawaban yang sudah diberikan akan dikirim ke tim HR.")) return;
    audioRef.current?.pause();
    setIsTtsPlaying(false);
    if (stt.isRecording) await stt.stop();
    const pending = phase === "interviewing" ? answerRef.current.trim() : "";
    const finalHistory =
      pending && question
        ? clarifyingRef.current
          ? mergeClarification(history, pending)
          : [...history, { question: question.question ?? "", answer: pending }]
        : history;
    setHistory(finalHistory);
    if (finalHistory.length === 0) {
      // Nothing to assess: back to the start card. Parts already sent stay on the server and are
      // picked up by the scheduled finalizer; a restart begins a new recording segment.
      setPhase("saving");
      await stopRecording();
      stopMedia();
      setScreenLost(false);
      setPhase("ready");
      return;
    }
    setPhase("saving");
    await finish(finalHistory, qaExchanges);
  };

  const statusText = isThinking
    ? "Jawaban terkirim. Interviewer sedang menyiapkan pertanyaan berikutnya…"
    : isReviewing
      ? "Periksa transkrip jawaban Anda. Perbaiki teksnya, bicara lagi, atau kirim."
      : isTtsPlaying
      ? "AI sedang membacakan pertanyaan. Nyalakan mic dan bicara untuk menyela."
      : micOn
        ? isSpeaking
          ? "Suara terdeteksi, silakan lanjutkan…"
          : "Mendengarkan… berhenti bicara sekitar 2,5 detik dan jawaban terkirim otomatis."
        : answer.trim()
          ? "Mic dimatikan. Periksa jawaban Anda lalu klik Kirim."
          : phase === "qa"
            ? 'Tekan tombol mic untuk bertanya, atau klik "Lanjutkan" bila tidak ada.'
            : "Tekan tombol mic di bawah untuk mulai menjawab.";

  const roomActive = ["interviewing", "qa", "closing", "saving"].includes(phase);

  /** Transcript box: live preview while listening, editable review step once the mic pauses. */
  const transcriptPanel = isReviewing ? (
    <div className="space-y-3 rounded-2xl border border-[#FFBE00]/30 bg-[#15141d] p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-white/50">
          {phase === "qa" ? "Pertanyaan Anda" : "Jawaban Anda"}
        </p>
        {reviewCountdown !== null && (
          <span className="font-mono text-[11px] tabular-nums text-white/40">terkirim otomatis {reviewCountdown}s</span>
        )}
      </div>
      <Textarea
        value={answer}
        onChange={(e) => {
          setAnswer(e.target.value);
          setReviewCountdown(null); // editing cancels the auto-send
        }}
        onFocus={() => setReviewCountdown(null)}
        rows={3}
        className="resize-none border-white/10 bg-white/[0.04] text-[15px] leading-relaxed text-white placeholder:text-white/30 focus-visible:border-[#FFBE00]/50 focus-visible:ring-[#FFBE00]/20"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          onClick={() => void (phase === "qa" ? submitCandidateQuestion() : submitAnswer())}
          disabled={!answer.trim() || isThinking}
          className="h-9 rounded-full bg-[#FFBE00] px-4 text-slate-900 shadow-none hover:bg-[#FFDC1E]"
        >
          <Send className="mr-1.5 h-3.5 w-3.5" /> {phase === "qa" ? "Kirim Pertanyaan" : "Kirim Jawaban"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={resumeMic}
          disabled={isThinking}
          className="h-9 rounded-full border-white/15 bg-transparent px-4 text-white hover:bg-white/10 hover:text-white"
        >
          <Mic className="mr-1.5 h-3.5 w-3.5" /> Lanjut Bicara
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={restartAnswer}
          disabled={isThinking}
          className="h-9 rounded-full px-3 text-white/60 hover:bg-white/10 hover:text-white"
        >
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Ulangi
        </Button>
      </div>
    </div>
  ) : (
    (answer || stt.interim) && (
      <div className="max-h-24 overflow-y-auto rounded-2xl bg-white/[0.04] px-4 py-3 text-[15px] leading-relaxed text-white/85">
        {answer}
        {stt.interim && <span className="text-white/40"> {stt.interim}</span>}
      </div>
    )
  );

  const stageLabel =
    phase === "qa"
      ? "Sesi tanya jawab"
      : phase === "closing"
        ? "Penutup"
        : phase === "saving"
          ? "Menyimpan"
          : question
            ? `${question.clarify ? "Pendalaman · " : ""}Pertanyaan ${question.number}${
                question.total ? ` dari ${question.total}` : question.max_questions ? ` · maks ${question.max_questions}` : ""
              }`
            : "";

  // ------------------------------------------------------------------ ready / done cards
  if (phase === "ready") {
    return (
      <div className="w-full rounded-2xl bg-white dark:bg-slate-900 p-5 sm:p-8 space-y-5 sm:border sm:border-slate-200/80 sm:dark:border-slate-800 sm:shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.18)]">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Interview {interview.position}</h2>
          <p className="text-sm text-slate-500">Wawancara suara dengan AI interviewer PT Darma Henwa.</p>
        </div>
        {error && (
          <div className="flex gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
          </div>
        )}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4 text-sm space-y-2">
          <p className="text-slate-700 dark:text-slate-300">
            {candidateName ? `Halo ${candidateName}, ` : "Halo, "}Anda akan diwawancarai oleh AI interviewer untuk posisi{" "}
            <span className="font-medium">{interview.position}</span>.
          </p>
          <ul className="list-disc pl-5 text-slate-500 space-y-1">
            <li>Pertanyaan dibacakan dengan suara. Jawab dengan berbicara setelah menyalakan mic.</li>
            <li>Berhenti bicara sekitar 2,5 detik dan jawaban terkirim otomatis, atau klik Kirim.</li>
            <li>Di akhir sesi Anda boleh bertanya balik tentang posisi atau perusahaan.</li>
            <li>Browser akan meminta izin kamera dan mikrofon.</li>
            {screenRequired && (
              <li className="text-slate-700 dark:text-slate-300">
                <span className="font-medium">Share seluruh layar wajib.</span> Saat klik Mulai, pilih{" "}
                <span className="font-medium">"Seluruh layar"</span> (Entire screen), bukan satu jendela atau tab. Bila share
                dihentikan, interview terjeda sampai layar dibagikan lagi. Gunakan Chrome atau Edge di laptop/PC.
              </li>
            )}
            {cameraOnlyMode && (
              <li className="text-slate-700 dark:text-slate-300">
                <span className="font-medium">Interview lewat HP.</span> Kamera depan dan suara Anda direkam. Tetap di halaman ini
                sampai selesai: bila Anda berpindah aplikasi atau tab, interview terjeda dan hal itu tercatat untuk tim HR.
                Pastikan sinyal stabil dan baterai cukup.
              </li>
            )}
          </ul>
          {recordingRequired && (
            <p className="text-xs text-slate-500">
              Dengan menekan Mulai, Anda menyetujui sesi ini direkam ({cameraOnlyMode ? "kamera dan suara" : "layar, kamera, dan suara"})
              dan disimpan oleh PT Darma Henwa Tbk untuk keperluan penilaian rekrutmen.
            </p>
          )}
          {history.length > 0 && (
            <p className="text-xs text-slate-500">
              Anda sudah menjawab {history.length} pertanyaan sebelumnya. Sesi akan dilanjutkan dari sana.
            </p>
          )}
        </div>
        <Button onClick={startInterview} disabled={isThinking || isStartingMedia} className="w-full h-11 bg-slate-900 hover:bg-slate-700 text-white dark:bg-slate-100 dark:text-slate-900">
          {isThinking || isStartingMedia ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : screenRequired ? <MonitorUp className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
          {isStartingMedia
            ? screenRequired ? "Menyiapkan layar & kamera…" : "Menyiapkan kamera & mikrofon…"
            : isThinking
              ? "Menyiapkan…"
              : history.length > 0
                ? screenRequired ? "Bagikan Layar & Lanjutkan" : "Lanjutkan Interview"
                : screenRequired ? "Bagikan Layar & Mulai" : "Mulai Interview"}
        </Button>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="w-full rounded-2xl bg-white dark:bg-slate-900 p-5 sm:p-8 space-y-4 sm:border sm:border-slate-200/80 sm:dark:border-slate-800 sm:shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.18)]">
        {submitState === "failed" ? (
          <>
            <div className="flex gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
            </div>
            <Button onClick={() => finalPayloadRef.current && submitFinal(finalPayloadRef.current)} disabled={submitState !== "failed"} className="w-full">
              <RefreshCw className="w-4 h-4 mr-2" /> Kirim ulang jawaban
            </Button>
          </>
        ) : (
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 p-5 space-y-2">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold">
              <CheckCircle2 className="w-5 h-5" /> Terima kasih{candidateName ? `, ${candidateName}` : ""}. Interview Anda telah selesai.
            </div>
            <p className="text-sm text-emerald-700/80 dark:text-emerald-400/80">
              {history.length} pertanyaan terjawab dalam {formatElapsed(elapsed)}. Tim HR PT Darma Henwa akan menghubungi Anda untuk kabar
              selanjutnya. Anda boleh menutup halaman ini.
            </p>
            {submitState === "sending" && (
              <p className="text-xs text-emerald-700/70 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Menyimpan jawaban…</p>
            )}
          </div>
        )}
      </div>
    );
  }

  // ------------------------------------------------------------------ room
  return (
    <>
      {roomActive && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#0b0b10] text-white">
          {/* Top bar: position · timer + REC · progress */}
          <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#FFBE00]">
                <Bot className="h-4 w-4 text-slate-900" />
              </span>
              <div className="min-w-0 leading-tight">
                <div className="truncate text-sm font-medium">{interview.position}</div>
                <div className="hidden truncate text-[11px] text-white/40 sm:block">AI Interview · PT Darma Henwa Tbk</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1 font-mono text-xs tabular-nums text-white/80">
                <Timer className="h-3.5 w-3.5" /> {formatElapsed(elapsed)}
              </span>
              {recorder.isRecording && (
                <span
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    recorder.screenLive || cameraOnlyMode ? "bg-rose-500/15 text-rose-300" : "bg-amber-400/15 text-amber-300"
                  }`}
                  title={
                    cameraOnlyMode ? "Kamera dan suara direkam" : recorder.screenLive ? "Layar, kamera, dan suara direkam" : "Share layar terhenti"
                  }
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${recorder.screenLive || cameraOnlyMode ? "animate-pulse bg-rose-400" : "bg-amber-400"}`} />
                  REC
                </span>
              )}
            </div>
            <div className="hidden truncate text-right text-xs text-white/40 sm:block">{stageLabel}</div>
          </header>

          {screenLost && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
              <div className="w-full max-w-sm space-y-4 rounded-2xl border border-white/10 bg-[#15141d] p-6 text-white">
                <div className="flex items-center gap-2 font-semibold text-rose-300">
                  {cameraOnlyMode ? <AlertCircle className="h-5 w-5" /> : <MonitorUp className="h-5 w-5" />}
                  {cameraOnlyMode ? "Anda meninggalkan halaman interview" : "Share layar dihentikan"}
                </div>
                <p className="text-sm leading-relaxed text-white/65">
                  {cameraOnlyMode
                    ? "Interview dijeda. Tetap di halaman ini selama sesi berlangsung; jangan berpindah aplikasi atau tab. Jeda ini tercatat untuk tim HR."
                    : "Interview dijeda. Share seluruh layar wajib selama sesi berlangsung. Bagikan layar lagi untuk melanjutkan; jeda ini tercatat untuk tim HR."}
                </p>
                {reshareError && (
                  <div className="flex gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {reshareError}
                  </div>
                )}
                <Button
                  onClick={() => void reshareScreen()}
                  disabled={isResharing}
                  className="h-11 w-full rounded-xl bg-[#FFBE00] text-slate-900 shadow-none hover:bg-[#FFDC1E]"
                >
                  {isResharing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : cameraOnlyMode ? <Play className="mr-2 h-4 w-4" /> : <MonitorUp className="mr-2 h-4 w-4" />}
                  {cameraOnlyMode ? "Lanjutkan Interview" : "Bagikan Seluruh Layar Lagi"}
                </Button>
                <p className="text-center text-[11px] text-white/35">
                  {cameraOnlyMode ? "Meninggalkan halaman" : "Share layar terhenti"} {screenInterruptions} kali · {formatElapsed(elapsed)}
                </p>
              </div>
            </div>
          )}

          {/* Stage: tiles + conversation; bottom padding leaves room for the floating controls */}
          {/* Mobile: tiles side by side (small) and content top-aligned so nothing is clipped when it
              overflows; desktop: two large tiles, vertically centred. */}
          <main className="flex flex-1 flex-col items-center justify-start gap-3 overflow-y-auto px-3 pb-28 pt-1 sm:justify-center sm:gap-4 sm:px-6 sm:pb-32 sm:pt-2">
            <div className="grid w-full max-w-5xl grid-cols-2 gap-2 sm:gap-3">
              <div
                className={`relative aspect-video overflow-hidden rounded-2xl bg-gradient-to-br from-[#1c1a2c] to-[#101018] ring-1 transition-shadow ${
                  isTtsPlaying ? "ring-[#FFBE00]/60 shadow-[0_0_0_6px_rgba(255,190,0,0.08)]" : "ring-white/10"
                }`}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative flex h-24 w-24 items-center justify-center">
                    {isTtsPlaying && <span className="absolute inset-0 animate-ping rounded-full bg-[#FFBE00]/15" />}
                    <span className="absolute inset-2 rounded-full bg-[#FFBE00]/10" />
                    <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#FFBE00]">
                      <Bot className="h-7 w-7 text-slate-900" />
                    </span>
                  </div>
                </div>
                <TileLabel>AI Interviewer{isTtsPlaying ? " · berbicara" : isThinking ? " · menyusun pertanyaan" : ""}</TileLabel>
              </div>

              <div
                className={`relative aspect-video overflow-hidden rounded-2xl bg-[#15141d] ring-1 transition-shadow ${
                  isSpeaking ? "ring-emerald-400/70 shadow-[0_0_0_6px_rgba(52,211,153,0.10)]" : "ring-white/10"
                }`}
              >
                {cameraError ? (
                  <div className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-white/40">{cameraError}</div>
                ) : (
                  <video ref={videoRef} autoPlay playsInline muted className="h-full w-full -scale-x-100 object-cover" />
                )}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/55 to-transparent" />
                <TileLabel>{candidateName || "Kandidat"}</TileLabel>
                {micOn && (
                  <span className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/90 text-white shadow">
                    {stt.isConnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mic className="h-3.5 w-3.5" />}
                  </span>
                )}
              </div>
            </div>

            <p className="text-xs text-white/40 sm:hidden">{stageLabel}</p>

            <div className="w-full max-w-5xl space-y-2.5">
              {phase === "saving" && (
                <div className="flex items-center justify-center gap-2 py-2 text-sm text-white/70">
                  <Loader2 className="h-4 w-4 animate-spin" /> Menyimpan jawaban Anda…
                </div>
              )}

              {phase === "closing" && (
                <>
                  <div className={`${PANEL_CLASS} text-[15px] leading-relaxed`}>
                    {closingText || (
                      <span className="flex items-center gap-2 text-white/50">
                        <Loader2 className="h-4 w-4 animate-spin" /> Menyiapkan penutup…
                      </span>
                    )}
                  </div>
                  <p className="flex items-center justify-center gap-2 text-xs text-white/40">
                    <Loader2 className="h-3 w-3 animate-spin" /> Menyimpan jawaban Anda…
                  </p>
                </>
              )}

              {phase === "qa" && (
                <>
                  <div className={`${PANEL_CLASS} space-y-1.5`}>
                    {qaExchanges.length === 0 ? (
                      <p className="text-[15px] font-medium leading-relaxed">{QA_INVITE}</p>
                    ) : (
                      <>
                        <p className="text-sm text-white/50">Anda: {qaExchanges[qaExchanges.length - 1].question}</p>
                        <p className="text-[15px] font-medium leading-relaxed">{qaExchanges[qaExchanges.length - 1].answer}</p>
                      </>
                    )}
                  </div>
                  <p className="text-center text-xs text-white/45">{isThinking ? "Interviewer sedang menjawab…" : statusText}</p>
                  {transcriptPanel}
                  {(error || stt.error) && <p className="text-center text-xs text-rose-400">{error || stt.error}</p>}
                  <div className="flex justify-center">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void doClosing(history, qaExchanges)}
                      disabled={isThinking || micOn || isReviewing}
                      className="h-9 rounded-full border border-white/15 px-4 text-white/80 hover:bg-white/10 hover:text-white"
                    >
                      Tidak ada, lanjutkan
                    </Button>
                  </div>
                </>
              )}

              {phase === "interviewing" && question && (
                <>
                  <div className={PANEL_CLASS}>
                    {question.reaction && <p className="mb-1.5 text-sm leading-relaxed text-white/50">{question.reaction}</p>}
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[15px] font-medium leading-relaxed sm:text-base">{question.question}</p>
                      <button
                        type="button"
                        onClick={() => void speak(question.speech)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white/70 transition hover:bg-white/[0.12] hover:text-white disabled:opacity-40"
                        title="Putar ulang"
                        disabled={isThinking}
                      >
                        <Volume2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-center text-xs text-white/45">{statusText}</p>
                  {transcriptPanel}
                  {(error || stt.error) && <p className="text-center text-xs text-rose-400">{error || stt.error}</p>}
                </>
              )}

              {recordingError && (
                <p className="text-center text-[11px] text-amber-300/80">
                  Rekaman sesi tidak terkirim ke server ({recordingError}). Interview tetap berjalan dan transkrip tetap tersimpan.
                </p>
              )}
            </div>
          </main>

          {/* Floating controls */}
          <footer className="pointer-events-none fixed inset-x-0 bottom-0 z-[55] flex justify-center px-4 pb-5 sm:pb-6">
            <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-white/10 bg-[#15141d]/90 p-1.5 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.7)] backdrop-blur-md">
              <button
                type="button"
                onClick={toggleMic}
                disabled={(phase !== "interviewing" && phase !== "qa") || isThinking || screenLost}
                title={micOn ? "Matikan mic" : "Nyalakan mic untuk berbicara"}
                aria-pressed={micOn}
                className={`flex h-12 w-12 items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  micOn ? "bg-emerald-500 text-white hover:bg-emerald-400" : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {stt.isConnecting ? <Loader2 className="h-5 w-5 animate-spin" /> : micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </button>
              {(phase === "interviewing" || phase === "qa") && !micOn && !isThinking && !isReviewing && answer.trim() && (
                <Button
                  onClick={() => void enterReview()}
                  className="h-10 rounded-full bg-[#FFBE00] px-4 text-slate-900 shadow-none hover:bg-[#FFDC1E]"
                >
                  <Send className="mr-1.5 h-4 w-4" /> Periksa &amp; Kirim
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={() => void endSession()}
                disabled={phase === "saving" || phase === "closing"}
                className="h-10 rounded-full px-3 text-rose-300 hover:bg-rose-500/15 hover:text-rose-200 sm:px-4"
                title="Akhiri sesi"
              >
                <X className="h-4 w-4 sm:mr-1.5" /> <span className="hidden sm:inline">Akhiri Sesi</span>
              </Button>
            </div>
          </footer>
        </div>
      )}
    </>
  );
};

export default CandidateInterviewRoom;
