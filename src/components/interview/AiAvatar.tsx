import type { SpeechAnalyser } from "@/lib/speechAnalyser";
import { useEffect, useId, useRef } from "react";

/**
 * Animated AI interviewer avatar for the candidate room.
 *
 * Pure inline SVG, no external service and no extra dependency: the mouth is lip-synced from the
 * TTS audio through a SpeechAnalyser (loudness -> opening, spectral balance -> round vs. spread
 * lips), the eyes blink at random, the head bobs slightly while talking, nods while the candidate
 * speaks and looks away with raised brows while the next question is being generated.
 *
 * Every per-frame update writes straight to SVG attributes through refs (no React re-render), so
 * the loop runs at display refresh rate for a few microseconds per frame. Respects
 * `prefers-reduced-motion` (lip-sync and blinking stay, head motion is dropped).
 */

export type AvatarState = "idle" | "listening" | "thinking" | "speaking";
export type AvatarVariant = "female" | "male";

interface AiAvatarProps {
  state: AvatarState;
  /** Analyser sitting on the TTS playback path; null = mouth stays closed while "speaking". */
  analyser?: SpeechAnalyser | null;
  /** Look of the character; ideally matches the TTS voice (Gadis = female, Ardi = male). */
  variant?: AvatarVariant;
  /** The candidate is talking right now: the interviewer nods along occasionally. */
  attentive?: boolean;
  className?: string;
}

// Face geometry (viewBox 0 0 240 240)
const HEAD_CX = 120;
const HEAD_CY = 105;
const EYE_L = { cx: 101, cy: 97 };
const EYE_R = { cx: 139, cy: 97 };
const MOUTH = { cx: 120, cy: 137 };

const COLORS = {
  skin: "#E3B08A",
  skinShade: "#CF9469",
  hair: "#2E1F18",
  blazer: "#2B2842",
  blazerLight: "#3A3656",
  shirt: "#F4EFE6",
  accent: "#FFBE00",
  eye: "#3B2A20",
  lip: "#B5624E",
  mouthInner: "#4A1C27",
  tongue: "#C9586C",
  teeth: "#FFFFFF",
  blush: "#F0A08A",
};

const BLINK_MS = 140;
const NOD_MS = 650;

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;
const rand = (min: number, max: number) => min + Math.random() * (max - min);

/** Mouth outline for a given opening (0..1) and spread (0 round .. 1 wide). */
const mouthPath = (open: number, spread: number): string => {
  const halfW = 12 + spread * 6 - open * 3;
  const h = open * 17;
  const { cx, cy } = MOUTH;
  return `M ${cx - halfW} ${cy} Q ${cx} ${cy - h * 0.35} ${cx + halfW} ${cy} Q ${cx} ${cy + h * 0.95} ${cx - halfW} ${cy} Z`;
};

const SMILE_PATH = `M ${MOUTH.cx - 12} ${MOUTH.cy} Q ${MOUTH.cx} ${MOUTH.cy + 8} ${MOUTH.cx + 12} ${MOUTH.cy}`;

const AiAvatar = ({ state, analyser = null, variant = "female", attentive = false, className }: AiAvatarProps) => {
  // Props read by the animation loop; kept in refs so the loop is started once
  const stateRef = useRef(state);
  const analyserRef = useRef(analyser);
  const attentiveRef = useRef(attentive);
  useEffect(() => {
    stateRef.current = state;
    analyserRef.current = analyser;
    attentiveRef.current = attentive;
  }, [state, analyser, attentive]);

  const headRef = useRef<SVGGElement | null>(null);
  const browsRef = useRef<SVGGElement | null>(null);
  const eyeLRef = useRef<SVGGElement | null>(null);
  const eyeRRef = useRef<SVGGElement | null>(null);
  const irisLRef = useRef<SVGGElement | null>(null);
  const irisRRef = useRef<SVGGElement | null>(null);
  const mouthRef = useRef<SVGPathElement | null>(null);
  const mouthClipRef = useRef<SVGPathElement | null>(null);
  const teethRef = useRef<SVGRectElement | null>(null);
  const tongueRef = useRef<SVGEllipseElement | null>(null);
  const smileRef = useRef<SVGPathElement | null>(null);
  const glowRef = useRef<SVGCircleElement | null>(null);

  useEffect(() => {
    const reduceMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    // Smoothed animation values
    let open = 0;
    let spread = 0.4;
    let tilt = 0;
    let headY = 0;
    let gazeX = 0;
    let gazeY = 0;
    let browLift = 0;
    let glow = 0;
    let blinkAt = performance.now() + rand(1500, 4000);
    let blinkStart = -1;
    let nodAt = performance.now() + rand(1200, 2500);
    let nodStart = -1;
    let frame = 0;

    const tick = (now: number) => {
      const s = stateRef.current;
      const a = analyserRef.current;

      // ---- mouth: fast attack, slower release so syllables read clearly
      const rawLevel = s === "speaking" && a ? a.level() : 0;
      const targetOpen = Math.pow(rawLevel, 0.8);
      open = targetOpen > open ? lerp(open, targetOpen, 0.55) : lerp(open, targetOpen, 0.28);
      if (rawLevel > 0.12 && a) spread = lerp(spread, a.spread(), 0.2);
      else spread = lerp(spread, 0.4, 0.05);

      const talking = open > 0.06;
      if (mouthRef.current && mouthClipRef.current && smileRef.current && teethRef.current && tongueRef.current) {
        if (talking) {
          const d = mouthPath(open, spread);
          mouthRef.current.setAttribute("d", d);
          mouthClipRef.current.setAttribute("d", d);
          mouthRef.current.style.opacity = "1";
          smileRef.current.style.opacity = "0";
          const h = open * 17;
          const halfW = 12 + spread * 6 - open * 3;
          teethRef.current.setAttribute("x", String(MOUTH.cx - halfW + 2));
          teethRef.current.setAttribute("y", String(MOUTH.cy - h * 0.3));
          teethRef.current.setAttribute("width", String(Math.max(0, halfW * 2 - 4)));
          teethRef.current.setAttribute("height", String(Math.min(5, h * 0.42)));
          teethRef.current.style.opacity = open > 0.22 ? "0.95" : "0";
          tongueRef.current.setAttribute("cy", String(MOUTH.cy + h * 0.62));
          tongueRef.current.setAttribute("rx", String(halfW * 0.55));
          tongueRef.current.setAttribute("ry", String(Math.max(0.5, h * 0.28)));
          tongueRef.current.style.opacity = open > 0.3 ? "1" : "0";
        } else {
          mouthRef.current.style.opacity = "0";
          teethRef.current.style.opacity = "0";
          tongueRef.current.style.opacity = "0";
          smileRef.current.style.opacity = "1";
        }
      }

      // ---- blink
      if (blinkStart < 0 && now >= blinkAt) blinkStart = now;
      let lid = 1;
      if (blinkStart >= 0) {
        const p = (now - blinkStart) / BLINK_MS;
        if (p >= 1) {
          blinkStart = -1;
          // Double blinks happen now and then, like a real face
          blinkAt = now + (Math.random() < 0.15 ? rand(180, 320) : rand(2200, 5500));
        } else {
          lid = Math.max(0.06, 1 - Math.sin(p * Math.PI));
        }
      }
      // Thinking: eyes narrow a touch (looking up at an imaginary note)
      if (s === "thinking") lid = Math.min(lid, 0.82);
      const eyeTransform = (cx: number, cy: number) => `translate(${cx} ${cy}) scale(1 ${lid.toFixed(3)}) translate(${-cx} ${-cy})`;
      eyeLRef.current?.setAttribute("transform", eyeTransform(EYE_L.cx, EYE_L.cy));
      eyeRRef.current?.setAttribute("transform", eyeTransform(EYE_R.cx, EYE_R.cy));

      // ---- gaze, brows, head
      const targetGaze = s === "thinking" ? { x: 3.2, y: -2.6 } : { x: 0, y: 0 };
      gazeX = lerp(gazeX, targetGaze.x, 0.08);
      gazeY = lerp(gazeY, targetGaze.y, 0.08);
      irisLRef.current?.setAttribute("transform", `translate(${gazeX.toFixed(2)} ${gazeY.toFixed(2)})`);
      irisRRef.current?.setAttribute("transform", `translate(${gazeX.toFixed(2)} ${gazeY.toFixed(2)})`);

      const targetBrow = s === "thinking" ? -3 : s === "speaking" ? -open * 2.2 : s === "listening" ? -0.8 : 0;
      browLift = lerp(browLift, targetBrow, 0.12);
      browsRef.current?.setAttribute("transform", `translate(0 ${browLift.toFixed(2)})`);

      const targetTilt = reduceMotion ? 0 : s === "thinking" ? 4 : s === "listening" ? -2.2 : 0;
      tilt = lerp(tilt, targetTilt, 0.05);

      let targetY = 0;
      if (!reduceMotion) {
        targetY = Math.sin(now / 1400) * 0.8; // breathing
        if (s === "speaking") targetY += Math.sin(now / 380) * 1.1 + open * 1.6;
        // Nod along while the candidate is talking
        if (attentiveRef.current && s === "listening") {
          if (nodStart < 0 && now >= nodAt) nodStart = now;
        }
        if (nodStart >= 0) {
          const p = (now - nodStart) / NOD_MS;
          if (p >= 1) {
            nodStart = -1;
            nodAt = now + rand(2200, 4500);
          } else {
            targetY += Math.sin(p * Math.PI) * 3.2;
          }
        }
      }
      headY = lerp(headY, targetY, 0.2);
      headRef.current?.setAttribute("transform", `translate(0 ${headY.toFixed(2)}) rotate(${tilt.toFixed(2)} ${HEAD_CX} ${HEAD_CY})`);

      // ---- glow behind the head while talking
      glow = lerp(glow, s === "speaking" ? 0.55 + open * 0.45 : s === "thinking" ? 0.3 : 0.18, 0.1);
      if (glowRef.current) glowRef.current.style.opacity = glow.toFixed(3);

      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const female = variant === "female";
  // Unique ids: the avatar can appear twice on one page (start card + room), and SVG ids are global
  const uid = useId().replace(/:/g, "");
  const glowId = `avatar-glow-${uid}`;
  const blazerId = `avatar-blazer-${uid}`;
  const clipId = `avatar-mouth-${uid}`;
  // The wrapper anchors the "thinking" bubble; callers may position it themselves
  const wrapperClass = /\b(absolute|fixed|relative)\b/.test(className ?? "") ? (className as string) : `relative ${className ?? ""}`;

  return (
    <div className={wrapperClass}>
      <svg viewBox="0 0 240 240" className="h-full w-full" role="img" aria-label="AI interviewer" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={COLORS.accent} stopOpacity="0.55" />
            <stop offset="60%" stopColor={COLORS.accent} stopOpacity="0.12" />
            <stop offset="100%" stopColor={COLORS.accent} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={blazerId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.blazerLight} />
            <stop offset="100%" stopColor={COLORS.blazer} />
          </linearGradient>
          <clipPath id={clipId}>
            <path ref={mouthClipRef} d={mouthPath(0, 0.4)} />
          </clipPath>
        </defs>

        {/* Glow */}
        <circle ref={glowRef} cx={HEAD_CX} cy={HEAD_CY + 20} r="105" fill={`url(#${glowId})`} style={{ opacity: 0.18 }} />

        {/* Body: blazer, shirt, lanyard + ID badge in the brand yellow */}
        <path d="M 22 240 C 26 198 66 186 98 178 L 120 202 L 142 178 C 174 186 214 198 218 240 Z" fill={`url(#${blazerId})`} />
        <path d="M 98 178 L 120 208 L 142 178 L 134 175 L 120 194 L 106 175 Z" fill={COLORS.shirt} />
        <path d="M 104 176 L 116 222 M 136 176 L 124 222" stroke={COLORS.accent} strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <rect x="111" y="219" width="18" height="21" rx="2.5" fill={COLORS.accent} />
        <rect x="114" y="224" width="12" height="2" rx="1" fill={COLORS.blazer} opacity="0.55" />
        <rect x="114" y="229" width="8" height="2" rx="1" fill={COLORS.blazer} opacity="0.35" />

        {/* Neck */}
        <rect x="107" y="146" width="26" height="38" rx="9" fill={COLORS.skinShade} />

        {/* Head group: bob + tilt */}
        <g ref={headRef}>
          {/* Shoulder-length hair behind the head, parted so the neck stays visible */}
          {female && (
            <path
              d="M 68 105 C 62 150 64 176 76 190 L 100 190 C 95 176 90 160 90 142 L 150 142 C 150 160 145 176 140 190 L 164 190 C 176 176 178 150 172 105 C 170 58 70 58 68 105 Z"
              fill={COLORS.hair}
            />
          )}

          <circle cx="73" cy="108" r="9" fill={COLORS.skin} />
          <circle cx="167" cy="108" r="9" fill={COLORS.skin} />
          <circle cx="73" cy="108" r="4" fill={COLORS.skinShade} opacity="0.5" />
          <circle cx="167" cy="108" r="4" fill={COLORS.skinShade} opacity="0.5" />

          {/* Face */}
          <path d="M 74 100 C 74 58 166 58 166 100 C 166 136 148 162 120 162 C 92 162 74 136 74 100 Z" fill={COLORS.skin} />

          {/* Hair front */}
          {female ? (
            <path d="M 72 104 C 68 48 172 48 168 104 C 166 82 152 70 141 71 C 129 72 122 80 118 86 C 104 70 84 74 72 104 Z" fill={COLORS.hair} />
          ) : (
            <path d="M 73 100 C 72 50 168 50 167 100 C 160 76 142 66 120 70 C 98 66 80 76 73 100 Z" fill={COLORS.hair} />
          )}
          {!female && <path d="M 76 96 C 82 84 96 76 120 77 C 144 76 158 84 164 96" stroke={COLORS.skin} strokeWidth="1.2" fill="none" opacity="0.25" />}

          {/* Cheeks */}
          <circle cx="93" cy="121" r="7" fill={COLORS.blush} opacity="0.32" />
          <circle cx="147" cy="121" r="7" fill={COLORS.blush} opacity="0.32" />

          {/* Brows */}
          <g ref={browsRef}>
            <path d="M 90 85 Q 101 78 112 83" stroke={COLORS.hair} strokeWidth="3.4" strokeLinecap="round" fill="none" />
            <path d="M 128 83 Q 139 78 150 85" stroke={COLORS.hair} strokeWidth="3.4" strokeLinecap="round" fill="none" />
          </g>

          {/* Eyes */}
          <g ref={eyeLRef}>
            <ellipse cx={EYE_L.cx} cy={EYE_L.cy} rx="9" ry="6.8" fill="#FFFFFF" />
            <g ref={irisLRef}>
              <circle cx={EYE_L.cx} cy={EYE_L.cy} r="4.6" fill={COLORS.eye} />
              <circle cx={EYE_L.cx} cy={EYE_L.cy} r="2.1" fill="#120A08" />
              <circle cx={EYE_L.cx + 1.6} cy={EYE_L.cy - 1.6} r="1.2" fill="#FFFFFF" opacity="0.9" />
            </g>
            <path d={`M ${EYE_L.cx - 9} ${EYE_L.cy} Q ${EYE_L.cx} ${EYE_L.cy - 9} ${EYE_L.cx + 9} ${EYE_L.cy}`} stroke={COLORS.hair} strokeWidth="1.6" fill="none" opacity="0.8" />
          </g>
          <g ref={eyeRRef}>
            <ellipse cx={EYE_R.cx} cy={EYE_R.cy} rx="9" ry="6.8" fill="#FFFFFF" />
            <g ref={irisRRef}>
              <circle cx={EYE_R.cx} cy={EYE_R.cy} r="4.6" fill={COLORS.eye} />
              <circle cx={EYE_R.cx} cy={EYE_R.cy} r="2.1" fill="#120A08" />
              <circle cx={EYE_R.cx + 1.6} cy={EYE_R.cy - 1.6} r="1.2" fill="#FFFFFF" opacity="0.9" />
            </g>
            <path d={`M ${EYE_R.cx - 9} ${EYE_R.cy} Q ${EYE_R.cx} ${EYE_R.cy - 9} ${EYE_R.cx + 9} ${EYE_R.cy}`} stroke={COLORS.hair} strokeWidth="1.6" fill="none" opacity="0.8" />
          </g>

          {/* Nose */}
          <path d="M 119 106 Q 113 119 121 122" stroke={COLORS.skinShade} strokeWidth="2.2" strokeLinecap="round" fill="none" />

          {/* Mouth: closed smile, or the lip-synced opening */}
          <path ref={smileRef} d={SMILE_PATH} stroke={COLORS.lip} strokeWidth="3" strokeLinecap="round" fill="none" />
          <path ref={mouthRef} d={mouthPath(0, 0.4)} fill={COLORS.mouthInner} stroke={COLORS.lip} strokeWidth="2" strokeLinejoin="round" style={{ opacity: 0 }} />
          <g clipPath={`url(#${clipId})`}>
            <rect ref={teethRef} x="110" y="134" width="20" height="0" rx="1" fill={COLORS.teeth} style={{ opacity: 0 }} />
            <ellipse ref={tongueRef} cx={MOUTH.cx} cy={MOUTH.cy + 6} rx="7" ry="3" fill={COLORS.tongue} style={{ opacity: 0 }} />
          </g>

        </g>
      </svg>

      {state === "thinking" && (
        <div
          className="absolute right-[18%] top-[14%] flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1.5 shadow-md"
          aria-label="Menyusun pertanyaan"
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-700"
              style={{ animationDelay: `${i * 0.15}s`, animationDuration: "1s" }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AiAvatar;
