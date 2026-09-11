import type { AvatarState } from "@/components/interview/AiAvatar";
import { getToonMeta, toonAssetUrl, type ToonMeta } from "@/lib/aiApi";
import type { SpeechAnalyser } from "@/lib/speechAnalyser";
import { useEffect, useRef, useState } from "react";

/**
 * CPU-only interviewer avatar: a stylized portrait prepared once from an HR photo (see
 * backend/app/services/toon_avatar.py) and animated here on a <canvas> as a 2.5D puppet.
 *
 * Nothing is rendered on the server per utterance. Speech is a plain TTS MP3; the same
 * SpeechAnalyser that lip-syncs the SVG avatar drives the mouth here. Motion:
 * - mouth: the lower face ("jaw" strip) stretches down with loudness while the mouth interior
 *   (dark cavity, teeth, tongue) is drawn between the inner lip contours, wider on spread sounds;
 * - eyes: random blinks, drawn as skin-colored lids closing over the eye polygons;
 * - brows: cut out server-side (inpainted away in the base image) and drawn as patches that lift
 *   with emphasis, curiosity ("thinking") and attention;
 * - head: breathing, a bob while talking, nods while the candidate speaks, a tilt when thinking.
 *
 * All per-frame work is a handful of drawImage/fill calls at the photo's own resolution (<= 768 px),
 * cheap enough for phones. Honors prefers-reduced-motion (lip-sync and blinks stay).
 */

interface ToonAvatarProps {
  avatarId: string;
  state: AvatarState;
  analyser?: SpeechAnalyser | null;
  attentive?: boolean;
  className?: string;
}

interface Assets {
  meta: ToonMeta;
  base: HTMLImageElement;
  browLeft: HTMLImageElement;
  browRight: HTMLImageElement;
  /** Lower-face strip with feathered edges, stretched vertically to open the jaw. */
  jaw: HTMLCanvasElement;
  jawRect: { x: number; y: number; w: number; h: number };
}

const BLINK_MS = 130;
const NOD_MS = 650;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const rand = (min: number, max: number) => min + Math.random() * (max - min);

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`gagal memuat ${url}`));
    img.src = url;
  });

/** Lower face strip (mouth line to below the chin) as an offscreen canvas with soft edges. */
const buildJaw = (meta: ToonMeta, base: HTMLImageElement): { jaw: HTMLCanvasElement; jawRect: Assets["jawRect"] } => {
  const [mx, my] = meta.mouth_center;
  const top = my - meta.mouth_width * 0.55; // include the upper lip so the whole mouth stretches as one piece
  const bottom = Math.min(meta.height, meta.chin_y + (meta.chin_y - my) * 0.45);
  const w = Math.min(meta.width, meta.face_width * 1.15);
  const x = Math.max(0, Math.min(meta.width - w, mx - w / 2));
  const h = bottom - top;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(2, Math.round(w));
  canvas.height = Math.max(2, Math.round(h));
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(base, x, top, w, h, 0, 0, canvas.width, canvas.height);
  // Feather left/right/bottom edges so the stretched strip melts into the untouched base image
  ctx.globalCompositeOperation = "destination-in";
  const feather = Math.max(6, w * 0.12);
  const gx = ctx.createLinearGradient(0, 0, canvas.width, 0);
  gx.addColorStop(0, "rgba(0,0,0,0)");
  gx.addColorStop(feather / canvas.width, "rgba(0,0,0,1)");
  gx.addColorStop(1 - feather / canvas.width, "rgba(0,0,0,1)");
  gx.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gx;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const gy = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gy.addColorStop(0, "rgba(0,0,0,1)");
  gy.addColorStop(0.72, "rgba(0,0,0,1)");
  gy.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gy;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = "source-over";
  return { jaw: canvas, jawRect: { x, y: top, w, h } };
};

const polygon = (ctx: CanvasRenderingContext2D, pts: [number, number][], scale = 1, cx = 0, cy = 0) => {
  ctx.beginPath();
  pts.forEach(([x, y], i) => {
    const px = cx + (x - cx) * scale;
    const py = cy + (y - cy) * scale;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
};

const bounds = (pts: [number, number][]) => {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { x1: Math.min(...xs), x2: Math.max(...xs), y1: Math.min(...ys), y2: Math.max(...ys) };
};

/** Lighten (positive) or darken (negative) a #rrggbb color by a fixed amount per channel. */
const shade = (hex: string, amount: number) => {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r = clamp(((n >> 16) & 255) + amount);
  const g = clamp(((n >> 8) & 255) + amount);
  const b = clamp((n & 255) + amount);
  return `rgb(${r},${g},${b})`;
};

const ToonAvatar = ({ avatarId, state, analyser = null, attentive = false, className }: ToonAvatarProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Keyed by avatar id so a switch shows the loading state without resetting state inside the effect
  const [loaded, setLoaded] = useState<{ id: string; assets: Assets | null; error: string | null } | null>(null);
  const assets = loaded?.id === avatarId ? loaded.assets : null;
  const error = loaded?.id === avatarId ? loaded.error : null;

  const stateRef = useRef(state);
  const analyserRef = useRef(analyser);
  const attentiveRef = useRef(attentive);
  useEffect(() => {
    stateRef.current = state;
    analyserRef.current = analyser;
    attentiveRef.current = attentive;
  }, [state, analyser, attentive]);

  // Load meta + images once per avatar
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [meta, base, browLeft, browRight] = await Promise.all([
          getToonMeta(avatarId),
          loadImage(toonAssetUrl(avatarId, "base.png")),
          loadImage(toonAssetUrl(avatarId, "brow_left.png")),
          loadImage(toonAssetUrl(avatarId, "brow_right.png")),
        ]);
        if (cancelled) return;
        setLoaded({ id: avatarId, assets: { meta, base, browLeft, browRight, ...buildJaw(meta, base) }, error: null });
      } catch (err) {
        if (!cancelled) setLoaded({ id: avatarId, assets: null, error: err instanceof Error ? err.message : "gagal memuat avatar" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [avatarId]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!assets || !canvas) return;
    const { meta, base, browLeft, browRight, jaw, jawRect } = assets;
    canvas.width = meta.width;
    canvas.height = meta.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    const [fcx, fcy] = meta.face_center;
    const [mx, my] = meta.mouth_center;
    const faceW = meta.face_width;
    const eyes: [number, number][][] = [meta.left_eye, meta.right_eye];
    const eyeBounds = eyes.map(bounds);
    const lipsUpper = meta.lips_inner_upper;
    const lipsLower = meta.lips_inner_lower;
    const mouthSpan = meta.chin_y - my;
    // How far apart the inner lips already are in the photo (a toothy smile). When the photo's mouth
    // is open, the puppet paints the interior itself at all times, otherwise the photo's own teeth
    // would show as a flat white band that stretches with the jaw.
    const avg = (pts: [number, number][]) => pts.reduce((s, p) => s + p[1], 0) / pts.length;
    const restGap = Math.max(0, avg(lipsLower) - avg(lipsUpper));
    const mouthOpenInPhoto = restGap > meta.mouth_width * 0.04;
    const teeth = "#e9e2d6"; // ivory, not paper white
    // Tongue: the mouth tone pulled towards a warm red, not just a lighter cavity color
    const tongue = (() => {
      const n = parseInt(meta.colors.mouth.slice(1), 16);
      const r = Math.min(255, ((n >> 16) & 255) + 110);
      const g = Math.min(255, ((n >> 8) & 255) + 45);
      const b = Math.min(255, (n & 255) + 50);
      return `rgb(${r},${g},${b})`;
    })();

    let open = 0;
    let spread = 0.4;
    let tilt = 0;
    let headY = 0;
    let browLift = 0;
    let breath = 1;
    let blinkAt = performance.now() + rand(1500, 4000);
    let blinkStart = -1;
    let nodAt = performance.now() + rand(1200, 2500);
    let nodStart = -1;
    let frame = 0;

    const tick = (now: number) => {
      const s = stateRef.current;
      const a = analyserRef.current;

      const rawLevel = s === "speaking" && a ? a.level() : 0;
      const targetOpen = Math.pow(rawLevel, 0.8);
      open = targetOpen > open ? lerp(open, targetOpen, 0.55) : lerp(open, targetOpen, 0.28);
      spread = rawLevel > 0.12 && a ? lerp(spread, a.spread(), 0.2) : lerp(spread, 0.4, 0.05);

      // Blink
      if (blinkStart < 0 && now >= blinkAt) blinkStart = now;
      let lid = 0; // 0 = open, 1 = closed
      if (blinkStart >= 0) {
        const p = (now - blinkStart) / BLINK_MS;
        if (p >= 1) {
          blinkStart = -1;
          blinkAt = now + (Math.random() < 0.15 ? rand(180, 320) : rand(2200, 5500));
        } else {
          lid = Math.sin(p * Math.PI);
        }
      }
      if (s === "thinking") lid = Math.max(lid, 0.18);

      const targetBrow = s === "thinking" ? -0.05 : s === "speaking" ? -open * 0.03 : s === "listening" ? -0.012 : 0;
      browLift = lerp(browLift, targetBrow * faceW, 0.12);
      const targetTilt = reduceMotion ? 0 : s === "thinking" ? 3.5 : s === "listening" ? -2 : 0;
      tilt = lerp(tilt, targetTilt, 0.05);

      let targetY = 0;
      let targetBreath = 1;
      if (!reduceMotion) {
        targetBreath = 1 + Math.sin(now / 1400) * 0.004;
        if (s === "speaking") targetY += (Math.sin(now / 380) * 0.9 + open * 1.2) * (faceW / 200);
        if (attentiveRef.current && s === "listening" && nodStart < 0 && now >= nodAt) nodStart = now;
        if (nodStart >= 0) {
          const p = (now - nodStart) / NOD_MS;
          if (p >= 1) {
            nodStart = -1;
            nodAt = now + rand(2200, 4500);
          } else {
            targetY += Math.sin(p * Math.PI) * 2.6 * (faceW / 200);
          }
        }
      }
      headY = lerp(headY, targetY, 0.2);
      breath = lerp(breath, targetBreath, 0.1);

      // ---- draw
      ctx.clearRect(0, 0, meta.width, meta.height);
      ctx.save();
      ctx.translate(fcx, fcy + headY);
      ctx.rotate((tilt * Math.PI) / 180);
      ctx.scale(breath, breath);
      ctx.translate(-fcx, -fcy);

      ctx.drawImage(base, 0, 0);

      // Jaw: stretch the lower face strip downwards with the mouth opening
      const drop = open * mouthSpan * 0.32;
      if (drop > 0.2) {
        ctx.drawImage(jaw, jawRect.x, jawRect.y, jawRect.w, jawRect.h + drop);
      }

      // Mouth interior between the inner lips (lower contour follows the jaw)
      if (open > 0.04 || mouthOpenInPhoto) {
        const widen = 1 + spread * 0.14 - open * 0.04;
        const gap = drop * 0.9 + open * meta.mouth_width * 0.1; // visible even when the photo's lips touch
        const cavityH = restGap + gap; // total opening the interior has to fill
        const wx = (x: number) => mx + (x - mx) * widen;
        // Lip corners stay put while the middle opens: a lens shape, not a sliding rectangle
        const xl = lipsUpper[0][0];
        const xr = lipsUpper[lipsUpper.length - 1][0];
        const profile = (x: number) => {
          const t = Math.min(1, Math.max(0, (x - xl) / Math.max(1, xr - xl)));
          return Math.sin(Math.PI * t);
        };
        const upperY = (x: number, y: number) => y - gap * 0.18 * profile(x); // upper lip lifts a little
        const lowerY = (x: number, y: number) => y + gap * Math.pow(profile(x), 0.8);
        const cavity = new Path2D();
        lipsUpper.forEach(([x, y], i) => (i === 0 ? cavity.moveTo(wx(x), upperY(x, y)) : cavity.lineTo(wx(x), upperY(x, y))));
        lipsLower.forEach(([x, y]) => cavity.lineTo(wx(x), lowerY(x, y)));
        cavity.closePath();
        const ub = bounds(lipsUpper);
        const cavityBottom = bounds(lipsLower).y2 + gap;

        // Cavity: darker the deeper it goes, so it reads as a hollow, not a flat sticker
        const depth = ctx.createLinearGradient(0, ub.y1, 0, cavityBottom);
        depth.addColorStop(0, shade(meta.colors.mouth, 18));
        depth.addColorStop(0.55, meta.colors.mouth);
        depth.addColorStop(1, shade(meta.colors.mouth, -22));
        ctx.fillStyle = depth;
        ctx.fill(cavity);

        ctx.save();
        ctx.clip(cavity);
        // Upper teeth: a thin band hanging from the upper inner lip, at most ~a third of the
        // opening and never wider than a natural tooth row, so the cavity stays visibly dark
        const teethH = Math.min(cavityH * 0.34, meta.mouth_width * 0.075);
        const teethAlpha = Math.min(1, Math.max(0, (cavityH - meta.mouth_width * 0.03) / (meta.mouth_width * 0.08)));
        if (teethH > 0.8 && teethAlpha > 0) {
          // Band follows the lifted upper lip and tapers into the corners
          const band = new Path2D();
          lipsUpper.forEach(([x, y], i) => (i === 0 ? band.moveTo(wx(x), upperY(x, y)) : band.lineTo(wx(x), upperY(x, y))));
          for (let i = lipsUpper.length - 1; i >= 0; i--) {
            const [x, y] = lipsUpper[i];
            band.lineTo(wx(x), upperY(x, y) + teethH * (0.3 + 0.7 * profile(x)));
          }
          band.closePath();
          const enamel = ctx.createLinearGradient(0, ub.y1, 0, ub.y2 + teethH);
          enamel.addColorStop(0, "#9e948a"); // in the shadow of the upper lip
          enamel.addColorStop(0.45, teeth);
          enamel.addColorStop(1, "#b5ac9f"); // rounded edges falling into the dark
          ctx.globalAlpha = teethAlpha * 0.8;
          ctx.fillStyle = enamel;
          ctx.fill(band);
          // Gaps between teeth: faint vertical lines
          ctx.globalAlpha = teethAlpha * 0.18;
          ctx.strokeStyle = "#6b5a52";
          ctx.lineWidth = Math.max(0.6, faceW * 0.003);
          const toothW = meta.mouth_width * 0.11;
          for (let x = mx - toothW * 2.5; x <= mx + toothW * 2.5; x += toothW) {
            ctx.beginPath();
            ctx.moveTo(x, ub.y1);
            ctx.lineTo(x, ub.y2 + teethH);
            ctx.stroke();
          }
        }
        // Tongue only shows when the mouth is really open
        const tongueAlpha = Math.min(1, Math.max(0, (open - 0.35) / 0.3));
        if (tongueAlpha > 0) {
          ctx.globalAlpha = tongueAlpha * 0.9;
          ctx.fillStyle = tongue;
          ctx.beginPath();
          ctx.ellipse(mx, cavityBottom + gap * 0.05, meta.mouth_width * 0.26 * widen, Math.max(1, gap * 0.32), 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        ctx.globalAlpha = 1;

        // Soft inner-lip edge: a faint, slightly darker lip tone, not a hard outline
        ctx.strokeStyle = shade(meta.colors.lip, -25);
        ctx.lineWidth = Math.max(1, faceW * 0.005);
        ctx.globalAlpha = 0.28;
        ctx.stroke(cavity);
        ctx.globalAlpha = 1;
      }

      // Eyelids
      if (lid > 0.02) {
        eyes.forEach((pts, i) => {
          const b = eyeBounds[i];
          const ecx = (b.x1 + b.x2) / 2;
          const ecy = (b.y1 + b.y2) / 2;
          ctx.save();
          polygon(ctx, pts, 1.25, ecx, ecy);
          ctx.clip();
          const h = (b.y2 - b.y1) * 1.3;
          const lidY = b.y1 - h * 0.15 + h * lid;
          ctx.fillStyle = meta.colors.skin;
          ctx.fillRect(b.x1 - 10, b.y1 - h * 0.3, b.x2 - b.x1 + 20, lidY - (b.y1 - h * 0.3));
          ctx.strokeStyle = "rgba(40,25,20,0.55)";
          ctx.lineWidth = Math.max(1, faceW * 0.006);
          ctx.beginPath();
          ctx.moveTo(b.x1 - 4, lidY);
          ctx.quadraticCurveTo(ecx, lidY + h * 0.08, b.x2 + 4, lidY);
          ctx.stroke();
          ctx.restore();
        });
      }

      // Brows (patches over the inpainted base)
      ctx.drawImage(browLeft, meta.brow_left.pos[0], meta.brow_left.pos[1] + browLift, meta.brow_left.size[0], meta.brow_left.size[1]);
      ctx.drawImage(browRight, meta.brow_right.pos[0], meta.brow_right.pos[1] + browLift, meta.brow_right.size[0], meta.brow_right.size[1]);

      ctx.restore();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [assets]);

  const wrapperClass = /\b(absolute|fixed|relative)\b/.test(className ?? "") ? (className as string) : `relative ${className ?? ""}`;

  return (
    <div className={wrapperClass}>
      {/* Blurred fill behind the letterboxed portrait, like the photo tile */}
      <img src={toonAssetUrl(avatarId, "toon.png")} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-xl" />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full object-contain" aria-label="AI interviewer" role="img" />
      {!assets && !error && (
        <img src={toonAssetUrl(avatarId, "toon.png")} alt="AI interviewer" className="absolute inset-0 h-full w-full object-contain" />
      )}
      {error && <div className="absolute inset-x-0 bottom-8 text-center text-xs text-rose-300">{error}</div>}
      {state === "thinking" && (
        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1.5 shadow-md" aria-label="Menyusun pertanyaan">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-700" style={{ animationDelay: `${i * 0.15}s`, animationDuration: "1s" }} />
          ))}
        </div>
      )}
    </div>
  );
};

export default ToonAvatar;
