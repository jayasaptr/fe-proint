import CandidateInterviewRoom from "@/components/interview/CandidateInterviewRoom";
import { Button } from "@/components/ui/button";
import {
  getInvitation,
  loginInvitation,
  portalErrorMessage,
  type InvitationStatus,
  type LoginResult,
} from "@/lib/api/interviewPortal";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowRight, Bot, CheckCircle2, Clock, Loader2, Mic, MonitorUp, Video, Volume2 } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";

const STATUS_MESSAGES: Partial<Record<InvitationStatus, string>> = {
  completed: "Interview ini sudah selesai. Terima kasih atas partisipasi Anda.",
  failed: "Interview ini sudah selesai. Terima kasih atas partisipasi Anda.",
  cancelled: "Undangan interview ini sudah dibatalkan oleh tim HR.",
  expired: "Link interview sudah lewat masa berlaku. Silakan hubungi tim HR untuk link baru.",
};

const CODE_LENGTH = 8;

// "ABCD-1234", "abcd1234", "ABCD 1234" all become "ABCD1234"; the server normalises the same way
const normaliseCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Display form while typing: XXXX-XXXX (the dash is inserted automatically). */
const formatCode = (value: string) => {
  const raw = normaliseCode(value).slice(0, CODE_LENGTH);
  return raw.length > 4 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw;
};

const CHECKLIST = [
  { icon: MonitorUp, text: "Laptop/PC dengan Chrome atau Edge. Seluruh layar wajib dibagikan selama sesi." },
  { icon: Mic, text: "Mikrofon berfungsi dan Anda berada di tempat yang tenang." },
  { icon: Video, text: "Kamera menyala. Browser akan meminta izin kamera dan mikrofon." },
  { icon: Volume2, text: "Speaker atau earphone aktif. Pertanyaan dibacakan AI, jawab dengan suara." },
];

/** Page frame: soft neutral ground, brand mark, content centred; full-bleed on phones. */
const Shell = ({ company, children }: { company?: string; children: React.ReactNode }) => (
  <div className="relative min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(60%_60%_at_50%_0%,rgba(255,190,0,0.18),transparent_70%)] dark:bg-[radial-gradient(60%_60%_at_50%_0%,rgba(255,190,0,0.10),transparent_70%)]"
    />
    <div className="relative mx-auto flex min-h-screen w-full max-w-lg flex-col px-4 py-8 sm:px-6 sm:py-14">
      <header className="mb-8 flex items-center justify-center gap-3 sm:mb-10">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFBE00] shadow-sm">
          <Bot className="h-5 w-5 text-slate-900" />
        </span>
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-tight">AI Interview</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{company ?? "PT Darma Henwa Tbk"}</div>
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center">{children}</main>
      <footer className="mt-10 text-center text-[11px] text-slate-400 dark:text-slate-500">
        Kesulitan masuk? Hubungi tim HR yang mengirim undangan ini.
      </footer>
    </div>
  </div>
);

/** Card is a flat surface on phones and a bordered panel from `sm` up. */
const Card = ({ children }: { children: React.ReactNode }) => (
  <div className="w-full rounded-2xl bg-white dark:bg-slate-900 sm:border sm:border-slate-200/80 sm:dark:border-slate-800 sm:shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.18)]">
    <div className="space-y-6 p-5 sm:p-8">{children}</div>
  </div>
);

const Notice = ({ tone, title, children }: { tone: "error" | "info" | "success"; title: string; children?: React.ReactNode }) => {
  const styles = {
    error: "border-rose-200/80 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200",
    info: "border-amber-200/80 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200",
    success: "border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200",
  }[tone];
  const Icon = tone === "success" ? CheckCircle2 : AlertCircle;
  return (
    <div className={`flex gap-3 rounded-xl border p-3.5 text-sm ${styles}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">
        <div className="font-medium">{title}</div>
        {children && <div className="mt-0.5 text-xs opacity-80">{children}</div>}
      </div>
    </div>
  );
};

/**
 * Halaman kandidat: /interview/:token
 * 1. Tampilkan undangan (posisi, perusahaan) dan minta kode akses dari HR.
 * 2. Setelah kode benar, jalankan ruang interview. Skor tidak pernah ditampilkan ke kandidat.
 */
const CandidateInterviewPage = () => {
  const { token = "" } = useParams<{ token: string }>();

  const { data, error, isLoading } = useQuery({
    queryKey: ["interview-invitation", token],
    queryFn: () => getInvitation(token),
    enabled: Boolean(token),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const invitation = data?.data;

  const [code, setCode] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [session, setSession] = useState<LoginResult | null>(null);

  const codeComplete = normaliseCode(code).length === CODE_LENGTH;

  const submitCode = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalised = normaliseCode(code);
    if (normalised.length < 6) {
      setLoginError("Masukkan kode akses 8 karakter yang diberikan tim HR.");
      return;
    }
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const envelope = await loginInvitation(token, normalised);
      if (envelope.success && envelope.data?.session_token) setSession(envelope.data);
      else setLoginError(envelope.message || "Kode akses tidak valid.");
    } catch (err) {
      setLoginError(portalErrorMessage(err, "Tidak dapat menghubungi server. Coba lagi."));
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (session) {
    return (
      <Shell company={invitation?.company}>
        <CandidateInterviewRoom
          token={token}
          sessionToken={session.session_token}
          interview={session.interview}
          candidateName={invitation?.candidate_first_name}
        />
      </Shell>
    );
  }

  return (
    <Shell company={invitation?.company}>
      <Card>
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat undangan…
          </div>
        )}

        {!isLoading && (error || !invitation) && (
          <Notice tone="error" title="Link tidak ditemukan">
            {portalErrorMessage(error, "Link interview tidak valid. Periksa kembali link yang dikirim tim HR.")}
          </Notice>
        )}

        {invitation && !invitation.can_start && (
          <>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Interview</p>
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{invitation.position}</h1>
              <p className="text-sm text-slate-500">{invitation.candidate_first_name ? `Halo, ${invitation.candidate_first_name}.` : "Halo."}</p>
            </div>
            <Notice
              tone={invitation.status === "completed" ? "success" : "info"}
              title={invitation.status === "completed" ? "Interview selesai" : "Undangan tidak aktif"}
            >
              {STATUS_MESSAGES[invitation.status] ?? "Undangan interview ini tidak aktif."}
            </Notice>
          </>
        )}

        {invitation && invitation.can_start && (
          <>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Interview</p>
                {invitation.status === "in_progress" && (
                  <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                    Lanjutkan sesi
                  </span>
                )}
              </div>
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{invitation.position}</h1>
              <p className="text-sm leading-relaxed text-slate-500">
                {invitation.candidate_first_name ? `Halo, ${invitation.candidate_first_name}. ` : "Halo. "}
                Masukkan kode akses dari tim HR untuk memulai.
              </p>
            </div>

            <form onSubmit={submitCode} className="space-y-3">
              <label htmlFor="access-code" className="sr-only">
                Kode akses
              </label>
              <input
                id="access-code"
                value={code}
                onChange={(e) => {
                  setCode(formatCode(e.target.value));
                  if (loginError) setLoginError(null);
                }}
                placeholder="XXXX-XXXX"
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="one-time-code"
                spellCheck={false}
                maxLength={CODE_LENGTH + 1}
                autoFocus
                aria-invalid={Boolean(loginError)}
                className="h-14 w-full rounded-xl border border-slate-200 bg-slate-50 text-center font-mono text-xl font-semibold tracking-[0.35em] text-slate-900 placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:tracking-[0.3em] placeholder:text-slate-300 outline-none transition focus:border-[#FFBE00] focus:bg-white focus:ring-4 focus:ring-[#FFBE00]/25 aria-[invalid=true]:border-rose-300 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100 dark:placeholder:text-slate-600 dark:focus:bg-slate-900"
              />
              {loginError && (
                <p className="flex items-start gap-1.5 text-xs text-rose-600 dark:text-rose-400">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {loginError}
                </p>
              )}
              <Button
                type="submit"
                disabled={isLoggingIn || !codeComplete}
                className="h-12 w-full rounded-xl bg-slate-900 text-sm font-semibold text-white shadow-none hover:bg-slate-700 disabled:opacity-40 dark:bg-[#FFBE00] dark:text-slate-900 dark:hover:bg-[#FFDC1E]"
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memeriksa…
                  </>
                ) : (
                  <>
                    Masuk ke Interview <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="border-t border-slate-100 pt-5 dark:border-slate-800">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Sebelum mulai</p>
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <Clock className="h-3.5 w-3.5" /> 10–20 menit
                </span>
              </div>
              <ul className="grid gap-2.5 sm:grid-cols-2">
                {CHECKLIST.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex gap-3 text-[13px] leading-snug text-slate-600 dark:text-slate-300">
                    <span className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
                Sesi direkam (layar, kamera, suara, dan transkrip jawaban) dan disimpan oleh PT Darma Henwa Tbk untuk keperluan
                penilaian rekrutmen.
              </p>
            </div>
          </>
        )}
      </Card>
    </Shell>
  );
};

export default CandidateInterviewPage;
