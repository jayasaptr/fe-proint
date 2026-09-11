import EmojiAvatar from "@/components/interview/EmojiAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { avatarIdleUrl, avatarThumbUrl, DEFAULT_EMOJI_PARAMS, synthesizeSpeech, type EmojiParams } from "@/lib/aiApi";
import {
  activateInterviewAvatar,
  createEmojiAvatar,
  deleteInterviewAvatar,
  getInterviewAvatar,
  updateEmojiAvatarParams,
  uploadInterviewAvatar,
  type AvatarPhoto,
} from "@/lib/api/interview";
import { createSpeechAnalyser, type SpeechAnalyser } from "@/lib/speechAnalyser";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Cpu, ImagePlus, Loader2, Pencil, Play, Plus, Smile, Sparkles, Trash2, UserRound, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/**
 * Avatar Configuration (SYSTEM menu): every AI interviewer avatar in one place.
 * Engines: emoji (vector character matched to a photo, editable), toon/photo puppet (CPU),
 * MuseTalk (GPU, photo or video). One avatar is the global default; each invitation may pick
 * another one in the candidate's AI Interview options.
 */

type Engine = "emoji" | "toon" | "musetalk";
type ToonStyle = "toon" | "photo" | "emoji3d" | "cartoon";

const TOON_STYLES: { value: ToonStyle; label: string; hint: string; ai?: boolean }[] = [
  { value: "emoji3d", label: "Emoji 3D (AI)", hint: "Foto digambar ulang bergaya emoji 3D oleh Stable Diffusion di CPU, ±15–60 detik", ai: true },
  { value: "cartoon", label: "Kartun flat (AI)", hint: "Ilustrasi kartun garis tebal, ±15–60 detik", ai: true },
  { value: "toon", label: "Gaya kartun (filter)", hint: "Filter OpenCV instan: warna diratakan + garis tinta" },
  { value: "photo", label: "Foto asli", hint: "Tanpa perubahan gaya; gerak mulut bisa terasa buatan" },
];
const STYLE_LABEL: Record<ToonStyle, string> = { emoji3d: "emoji 3D (AI)", cartoon: "kartun flat (AI)", toon: "gaya kartun", photo: "foto asli" };

const MAX_PHOTO_MB = 12;
const MAX_VIDEO_MB = 60;
const ACCEPTED_IMAGES = ["image/jpeg", "image/png", "image/webp"];
const ACCEPTED_VIDEOS = ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v"];

const ENGINE_LABEL: Record<Engine, string> = { emoji: "Emoji (vektor)", toon: "Ringan (CPU)", musetalk: "Realistis (GPU)" };
const ENGINE_BADGE: Record<Engine, string> = {
  emoji: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  toon: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  musetalk: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

const HAIR_STYLES: { value: EmojiParams["hair_style"]; label: string }[] = [
  { value: "short", label: "Pendek" },
  { value: "medium", label: "Sedang" },
  { value: "long", label: "Panjang" },
  { value: "wavy", label: "Panjang bergelombang" },
  { value: "curly", label: "Keriting" },
  { value: "bun", label: "Sanggul" },
  { value: "tied", label: "Diikat" },
  { value: "spiky", label: "Berdiri" },
  { value: "bald", label: "Botak" },
];
const FACE_SHAPES: { value: EmojiParams["face_shape"]; label: string }[] = [
  { value: "oval", label: "Oval" },
  { value: "round", label: "Bulat" },
  { value: "square", label: "Kotak" },
  { value: "heart", label: "Hati" },
  { value: "long", label: "Panjang" },
];
const FACIAL_HAIR: { value: EmojiParams["facial_hair"]; label: string }[] = [
  { value: "none", label: "Tidak ada" },
  { value: "stubble", label: "Tipis" },
  { value: "mustache", label: "Kumis" },
  { value: "goatee", label: "Jenggot dagu" },
  { value: "beard", label: "Jenggot penuh" },
];
const SKIN_PRESETS = ["#f6d9c3", "#f1cdb5", "#e3b08a", "#d29a72", "#c98f63", "#b07850", "#9c6644", "#7a4b2d", "#5c3a21"];
const HAIR_PRESETS = ["#1b1512", "#2e1f18", "#5a3a25", "#7a5230", "#c9a35a", "#8a3a1e", "#8f8a85", "#e6e2dc"];
const CLOTH_PRESETS = ["#2b2842", "#1f3a5f", "#3b3b3b", "#5b2333", "#1f5f4a", "#7a5c2e", "#f4efe6", "#FFBE00"];

const extractMessage = (err: unknown, fallback: string) => {
  const axiosMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return axiosMessage || (err instanceof Error ? err.message : fallback);
};

const engineOf = (a: AvatarPhoto): Engine => (a.engine === "toon" ? "toon" : a.engine === "emoji" ? "emoji" : "musetalk");

/** Thumbnail for any engine: emoji draws itself, others load an image/video. */
const AvatarPreview = ({ avatar, className }: { avatar: AvatarPhoto; className?: string }) => {
  if (avatar.engine === "emoji") {
    return (
      <div className={`bg-gradient-to-br from-[#1c1a2c] to-[#101018] ${className ?? ""}`}>
        <EmojiAvatar params={avatar.params as Partial<EmojiParams>} state="idle" className="h-full w-full" />
      </div>
    );
  }
  if (avatar.kind === "video" && avatar.has_idle) {
    return <video src={avatarIdleUrl(avatar.id)} poster={avatarThumbUrl(avatar)} autoPlay loop muted playsInline className={`object-cover ${className ?? ""}`} />;
  }
  return <img src={avatarThumbUrl(avatar)} alt="" className={`object-cover ${className ?? ""}`} />;
};

const ColorField = ({ label, value, presets, onChange }: { label: string; value: string; presets?: string[]; onChange: (v: string) => void }) => (
  <div className="min-w-0 space-y-1.5">
    <Label className="text-xs text-slate-500">{label}</Label>
    <div className="flex flex-wrap items-center gap-1.5">
      {presets?.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`h-5 w-5 shrink-0 rounded-full border ${value.toLowerCase() === c.toLowerCase() ? "ring-2 ring-orange-500 ring-offset-1" : "border-slate-200 dark:border-slate-700"}`}
          style={{ background: c }}
          aria-label={c}
        />
      ))}
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-5 w-7 shrink-0 cursor-pointer rounded border border-slate-200 bg-transparent p-0 dark:border-slate-700" />
    </div>
  </div>
);

/** Emoji editor: live preview (idle or a spoken sample) + every parameter. */
const EmojiEditor = ({ avatar, onClose, onSaved }: { avatar: AvatarPhoto; onClose: () => void; onSaved: () => Promise<unknown> }) => {
  const [params, setParams] = useState<EmojiParams>({ ...DEFAULT_EMOJI_PARAMS, ...((avatar.params ?? {}) as Partial<EmojiParams>) });
  const [name, setName] = useState(avatar.source_name || "");
  const [saving, setSaving] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const graphRef = useRef<{ ctx: AudioContext; analyser: SpeechAnalyser } | null>(null);
  const [analyser, setAnalyser] = useState<SpeechAnalyser | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(
    () => () => {
      audioRef.current?.pause();
      void graphRef.current?.ctx.close().catch(() => {});
    },
    [],
  );

  const set = <K extends keyof EmojiParams>(key: K, value: EmojiParams[K]) => setParams((prev) => ({ ...prev, [key]: value }));

  const trySpeak = async () => {
    if (speaking) return;
    setSpeaking(true);
    try {
      if (!graphRef.current && typeof AudioContext !== "undefined") {
        const ctx = new AudioContext();
        const an = createSpeechAnalyser(ctx);
        an.node.connect(ctx.destination);
        graphRef.current = { ctx, analyser: an };
        setAnalyser(an);
      }
      const blob = await synthesizeSpeech("Halo, selamat datang di sesi wawancara PT Darma Henwa. Silakan perkenalkan diri Anda secara singkat.");
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      const graph = graphRef.current;
      if (graph) {
        await graph.ctx.resume().catch(() => {});
        try {
          graph.ctx.createMediaElementSource(audio).connect(graph.analyser.node);
        } catch {
          /* plays directly */
        }
      }
      await new Promise<void>((resolve) => {
        const done = () => {
          URL.revokeObjectURL(url);
          resolve();
        };
        audio.onended = done;
        audio.onerror = done;
        audio.play().catch(done);
      });
    } catch (err) {
      toast.error(extractMessage(err, "Contoh suara tidak bisa diputar"));
    } finally {
      setSpeaking(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await updateEmojiAvatarParams(avatar.id, { ...params }, name.trim() || undefined);
      if (res.success) {
        toast.success("Avatar disimpan");
        await onSaved();
        onClose();
      } else toast.error(res.message || "Gagal menyimpan");
    } catch (err) {
      toast.error(extractMessage(err, "Gagal menyimpan avatar"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      {/* The dialog's own `sm:max-w-lg` wins over a plain `max-w-*`, so widen it at the same breakpoint;
          cap the height and scroll inside so long parameter lists never push the footer off-screen */}
      <DialogContent className="max-h-[92vh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Edit avatar emoji</DialogTitle>
          <DialogDescription>Parameter awal diisi otomatis dari foto referensi; rapikan di sini. Kandidat hanya melihat karakter ini, bukan fotonya.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 md:grid-cols-[280px_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="aspect-square overflow-hidden rounded-2xl bg-gradient-to-br from-[#1c1a2c] to-[#101018] ring-1 ring-slate-200 dark:ring-slate-800">
              <EmojiAvatar params={params} state={speaking ? "speaking" : "idle"} analyser={analyser} className="h-full w-full" />
            </div>
            <Button variant="outline" size="sm" className="w-full" onClick={() => void trySpeak()} disabled={speaking}>
              {speaking ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Volume2 className="mr-1.5 h-3.5 w-3.5" />}
              Coba bicara (contoh suara)
            </Button>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Nama avatar (untuk HR)</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="mis. Interviewer HR 1" className="h-9" />
            </div>
          </div>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Bentuk wajah</Label>
              <Select value={params.face_shape} onValueChange={(v) => set("face_shape", v as EmojiParams["face_shape"])}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{FACE_SHAPES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Model rambut</Label>
              <Select value={params.hair_style} onValueChange={(v) => set("hair_style", v as EmojiParams["hair_style"])} disabled={params.hijab}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{HAIR_STYLES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <ColorField label="Warna kulit" value={params.skin} presets={SKIN_PRESETS} onChange={(v) => set("skin", v)} />
            <ColorField label="Warna rambut &amp; alis" value={params.hair} presets={HAIR_PRESETS} onChange={(v) => set("hair", v)} />
            <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <div className="flex items-center justify-between gap-3">
                <Label className="text-xs text-slate-500">Hijab</Label>
                <Switch checked={params.hijab} onCheckedChange={(v) => set("hijab", v)} />
              </div>
              {params.hijab && <ColorField label="Warna hijab" value={params.hijab_color} presets={CLOTH_PRESETS} onChange={(v) => set("hijab_color", v)} />}
            </div>
            <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <div className="flex items-center justify-between gap-3">
                <Label className="text-xs text-slate-500">Kacamata</Label>
                <Switch checked={params.glasses} onCheckedChange={(v) => set("glasses", v)} />
              </div>
              {params.glasses && <ColorField label="Warna bingkai" value={params.glasses_color} presets={["#2a2a2a", "#5a3a25", "#8f8a85", "#c9a35a", "#1f3a5f"]} onChange={(v) => set("glasses_color", v)} />}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Kumis / jenggot</Label>
              <Select value={params.facial_hair} onValueChange={(v) => set("facial_hair", v as EmojiParams["facial_hair"])}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{FACIAL_HAIR.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Struktur wajah</Label>
              <Select value={params.build} onValueChange={(v) => set("build", v as EmojiParams["build"])}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="soft">Halus (rahang bulat, fitur lembut)</SelectItem>
                  <SelectItem value="medium">Sedang</SelectItem>
                  <SelectItem value="angular">Tegas (rahang kotak, alis berat, leher lebar)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Ketebalan alis</Label>
              <Select value={params.brow_thickness} onValueChange={(v) => set("brow_thickness", v as EmojiParams["brow_thickness"])}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="thin">Tipis</SelectItem>
                  <SelectItem value="medium">Sedang</SelectItem>
                  <SelectItem value="thick">Tebal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:col-span-2">
              {(
                [
                  { key: "lipstick", label: "Lipstik", hint: "Bibir berwarna; mati = warna bibir alami" },
                  { key: "lashes", label: "Bulu mata / eyeliner", hint: "Garis mata tebal dengan bulu mata" },
                  { key: "blush", label: "Blush pipi", hint: "Rona pipi merah muda" },
                  { key: "earrings", label: "Anting", hint: "Tersembunyi bila hijab aktif" },
                  { key: "age_lines", label: "Garis usia", hint: "Kerut dahi dan garis senyum halus" },
                ] as { key: "lipstick" | "lashes" | "blush" | "earrings" | "age_lines"; label: string; hint: string }[]
              ).map((o) => (
                <div key={o.key} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <div className="min-w-0">
                    <Label className="text-xs text-slate-600 dark:text-slate-300">{o.label}</Label>
                    <p className="text-[10px] text-slate-400">{o.hint}</p>
                  </div>
                  <Switch checked={params[o.key]} onCheckedChange={(v) => set(o.key, v)} disabled={o.key === "earrings" && params.hijab} />
                </div>
              ))}
            </div>
            <ColorField label="Warna mata" value={params.eyes} presets={["#3b2a20", "#1f1a17", "#4a6b3a", "#3a5f8f", "#7a5230"]} onChange={(v) => set("eyes", v)} />
            <ColorField label="Warna bibir" value={params.lips} presets={["#b5624e", "#a04a3c", "#c97b6a", "#8f3f3f", "#d48a7a"]} onChange={(v) => set("lips", v)} />
            <ColorField label="Warna pakaian" value={params.clothing} presets={CLOTH_PRESETS} onChange={(v) => set("clothing", v)} />
            <ColorField label="Warna aksen (lanyard, badge)" value={params.accent} presets={["#FFBE00", "#FFDC1E", "#FF6905", "#B9DCEB", "#FFFFFF"]} onChange={(v) => set("accent", v)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Batal</Button>
          <Button onClick={() => void save()} disabled={saving} className="bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900">
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />} Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const AvatarConfigurationPage = () => {
  const queryClient = useQueryClient();
  const queryKey = ["ai-interview-avatar"];
  const { data, isLoading, error } = useQuery({ queryKey, queryFn: getInterviewAvatar, staleTime: 15_000, retry: 1 });
  const cfg = data?.data ?? null;
  const [engine, setEngine] = useState<Engine>("emoji");
  const [style, setStyle] = useState<ToonStyle>("emoji3d");
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<AvatarPhoto | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const refresh = () =>
    Promise.all([queryClient.invalidateQueries({ queryKey }), queryClient.invalidateQueries({ queryKey: ["ai-avatar-config"] })]);

  const engineAvailable: Record<Engine, boolean> = {
    emoji: cfg?.emoji_enabled !== false,
    toon: cfg?.toon_enabled !== false,
    musetalk: cfg?.gpu_enabled !== false,
  };
  const accept = engine === "musetalk" ? [...ACCEPTED_IMAGES, ...ACCEPTED_VIDEOS].join(",") : ACCEPTED_IMAGES.join(",");
  const stylizerReady = cfg?.stylizer_ready === true;
  // AI styles need the CPU stylizer worker; fall back to the instant filter when it is down
  const effectiveStyle: ToonStyle = (style === "emoji3d" || style === "cartoon") && !stylizerReady ? "toon" : style;

  const onPickFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const isVideo = ACCEPTED_VIDEOS.includes(file.type);
    if (![...ACCEPTED_IMAGES, ...ACCEPTED_VIDEOS].includes(file.type)) return void toast.error("Format harus JPG, PNG, WebP (foto) atau MP4, WebM, MOV (video).");
    if (isVideo && engine !== "musetalk") return void toast.error("Video hanya untuk engine Realistis (GPU).");
    const maxMb = isVideo ? MAX_VIDEO_MB : MAX_PHOTO_MB;
    if (file.size > maxMb * 1024 * 1024) return void toast.error(`Ukuran maksimal ${maxMb} MB.`);
    setUploading(true);
    try {
      if (engine === "toon" && (effectiveStyle === "emoji3d" || effectiveStyle === "cartoon")) {
        toast.info("Foto sedang digambar ulang oleh AI di CPU, biasanya 15–60 detik…", { duration: 8000 });
      }
      const res = await uploadInterviewAvatar(file, cfg?.active == null, engine, effectiveStyle);
      if (res.success) {
        const secs = res.data?.avatar?.extra?.stylize?.seconds;
        toast.success(`${ENGINE_LABEL[engine]}: avatar disiapkan${secs ? ` (gaya AI ${secs} dtk)` : ""}.`);
        res.data?.avatar?.extra?.warnings?.forEach((w) => toast.warning(w, { duration: 9000 }));
        await refresh();
        if (engine === "emoji" && res.data?.avatar) setEditing(res.data.avatar);
      } else toast.error(res.message || "Gagal mengunggah");
    } catch (err) {
      toast.error(extractMessage(err, "Gagal mengunggah sumber avatar"));
    } finally {
      setUploading(false);
    }
  };

  const onCreateBlank = async () => {
    setUploading(true);
    try {
      const res = await createEmojiAvatar("Avatar baru", {}, cfg?.active == null);
      if (res.success) {
        await refresh();
        if (res.data?.avatar) setEditing(res.data.avatar);
      } else toast.error(res.message || "Gagal membuat avatar");
    } catch (err) {
      toast.error(extractMessage(err, "Gagal membuat avatar"));
    } finally {
      setUploading(false);
    }
  };

  const onActivate = async (a: AvatarPhoto) => {
    if (a.active) return;
    setBusyId(a.id);
    try {
      const res = await activateInterviewAvatar(a.id);
      if (res.success) toast.success("Avatar default diubah");
      else toast.error(res.message || "Gagal mengaktifkan");
    } catch (err) {
      toast.error(extractMessage(err, "Gagal mengaktifkan avatar"));
    } finally {
      setBusyId(null);
      await refresh();
    }
  };

  const onDelete = async (a: AvatarPhoto) => {
    if (!window.confirm(`Hapus avatar "${a.source_name || a.id}"? Undangan yang memakainya akan kembali ke avatar default.`)) return;
    setBusyId(a.id);
    try {
      const res = await deleteInterviewAvatar(a.id);
      if (res.success) toast.success("Avatar dihapus");
      else toast.error(res.message || "Gagal menghapus");
    } catch (err) {
      toast.error(extractMessage(err, "Gagal menghapus avatar"));
    } finally {
      setBusyId(null);
      await refresh();
    }
  };

  const avatars = cfg?.avatars ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Avatar Configuration</h1>
        <p className="mt-1 text-sm text-slate-500">
          Avatar AI interviewer yang dilihat kandidat. Satu avatar menjadi default; tiap undangan interview bisa memilih avatar lain di Opsi.
        </p>
      </div>

      <input ref={fileRef} type="file" accept={accept} className="hidden" onChange={onPickFile} />

      {/* Create */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-medium text-slate-800 dark:text-slate-200">Buat avatar baru</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {(
            [
              { id: "emoji", icon: Smile, title: "Emoji (vektor)", desc: "Karakter kartun 3D-look yang dicocokkan dari foto, bisa diedit. Tanpa GPU, gerak paling lengkap." },
              { id: "toon", icon: Cpu, title: "Ringan (CPU)", desc: "Foto digambar ulang AI (emoji 3D / kartun), filter kartun, atau foto asli; mulut dan ekspresi dianimasikan di browser." },
              { id: "musetalk", icon: Sparkles, title: "Realistis (GPU)", desc: "Foto atau video asli, mulut dirender MuseTalk per kalimat. Butuh worker GPU." },
            ] as { id: Engine; icon: typeof Smile; title: string; desc: string }[]
          ).map((opt) => {
            const Icon = opt.icon;
            const disabled = !engineAvailable[opt.id];
            return (
              <button
                key={opt.id}
                type="button"
                disabled={disabled}
                onClick={() => setEngine(opt.id)}
                className={`flex items-start gap-2.5 rounded-xl border p-3 text-left text-xs transition disabled:opacity-40 ${
                  engine === opt.id ? "border-orange-400 bg-orange-50 dark:bg-orange-500/10" : "border-slate-200 hover:border-slate-300 dark:border-slate-700"
                }`}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                <span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{opt.title}</span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">{opt.desc}</span>
                  {disabled && <span className="mt-1 block text-[11px] text-rose-500">Nonaktif di server AI</span>}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {engine === "toon" && (
            <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 p-0.5 text-[11px] dark:border-slate-700" role="radiogroup" aria-label="Gaya avatar ringan">
              {TOON_STYLES.map((s) => {
                const disabled = Boolean(s.ai) && !stylizerReady;
                return (
                  <button
                    key={s.value}
                    type="button"
                    role="radio"
                    aria-checked={effectiveStyle === s.value}
                    disabled={disabled}
                    title={disabled ? "Worker stylizer CPU tidak berjalan" : s.hint}
                    onClick={() => setStyle(s.value)}
                    className={`rounded-md px-2.5 py-1 transition disabled:opacity-40 ${
                      effectiveStyle === s.value ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          )}
          <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading || !engineAvailable[engine]} className="h-9 bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900">
            {uploading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-1.5 h-4 w-4" />}
            {uploading ? "Menyiapkan…" : engine === "musetalk" ? "Unggah foto / video" : "Unggah foto referensi"}
          </Button>
          {engine === "emoji" && (
            <Button size="sm" variant="outline" onClick={() => void onCreateBlank()} disabled={uploading} className="h-9">
              <Plus className="mr-1.5 h-4 w-4" /> Rancang manual tanpa foto
            </Button>
          )}
          {engine === "musetalk" && cfg?.worker_ready === false && (
            <span className="flex items-center gap-1 text-[11px] text-amber-600">
              <AlertTriangle className="h-3 w-3" /> Worker GPU belum siap{cfg.error ? `: ${cfg.error}` : ""}.
            </span>
          )}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
          Foto: close-up menghadap depan, mulut tertutup rileks, latar polos, JPG/PNG/WebP maks {MAX_PHOTO_MB} MB. Video (GPU saja): 10–20 detik diam
          menghadap kamera, MP4/WebM/MOV maks {MAX_VIDEO_MB} MB. Untuk engine Emoji, foto hanya dipakai membaca ciri (warna kulit, rambut, hijab,
          kacamata) dan tidak pernah ditampilkan ke kandidat. Pemakaian wajah orang nyata pada engine lain memerlukan persetujuan tertulis pemiliknya.
        </p>
      </div>

      {/* List */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-slate-800 dark:text-slate-200">Avatar tersedia ({avatars.length})</h2>
        {isLoading ? (
          <p className="flex items-center gap-1.5 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Memuat…</p>
        ) : error || !cfg ? (
          <p className="text-sm text-rose-500">Daftar avatar tidak bisa dimuat dari server AI.</p>
        ) : avatars.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
            <UserRound className="mx-auto mb-2 h-8 w-8 text-slate-300" />
            <p className="text-sm font-medium text-slate-500">Belum ada avatar</p>
            <p className="mt-1 text-xs text-slate-400">Kandidat melihat avatar vektor bawaan sampai satu avatar dibuat dan diaktifkan.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {avatars.map((a) => {
              const eng = engineOf(a);
              return (
                <div key={a.id} className={`overflow-hidden rounded-2xl border bg-white dark:bg-slate-900 ${a.active ? "border-orange-400 ring-1 ring-orange-300" : "border-slate-200 dark:border-slate-800"}`}>
                  <div className="relative aspect-[4/3] overflow-hidden bg-slate-100 dark:bg-slate-800">
                    <AvatarPreview avatar={a} className="h-full w-full" />
                    {a.active && (
                      <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-medium text-white">
                        <CheckCircle2 className="h-3 w-3" /> Default
                      </span>
                    )}
                  </div>
                  <div className="space-y-2 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{a.source_name || a.id}</div>
                        <div className="truncate text-[11px] text-slate-400">
                          {a.kind === "video"
                            ? `video · ${a.frames} frame`
                            : a.engine === "toon"
                              ? STYLE_LABEL[(a.style as ToonStyle) ?? "toon"] ?? a.style
                              : a.engine === "emoji"
                                ? a.extra?.vision_used ? "ciri dari foto + model visi" : a.width ? "ciri dari foto" : "rancangan manual"
                                : `${a.width}×${a.height}`}
                        </div>
                      </div>
                      <Badge variant="outline" className={`shrink-0 border-0 text-[10px] ${ENGINE_BADGE[eng]}`}>{ENGINE_LABEL[eng]}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant={a.active ? "ghost" : "outline"} className="h-8 text-xs" onClick={() => void onActivate(a)} disabled={a.active || busyId !== null}>
                        {busyId === a.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1 h-3.5 w-3.5" />}
                        {a.active ? "Default" : "Jadikan default"}
                      </Button>
                      {a.engine === "emoji" && (
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setEditing(a)} disabled={busyId !== null}>
                          <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-8 text-xs text-rose-500 hover:text-rose-600" onClick={() => void onDelete(a)} disabled={busyId !== null}>
                        <Trash2 className="mr-1 h-3.5 w-3.5" /> Hapus
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editing && <EmojiEditor avatar={editing} onClose={() => setEditing(null)} onSaved={refresh} />}
    </div>
  );
};

export default AvatarConfigurationPage;
