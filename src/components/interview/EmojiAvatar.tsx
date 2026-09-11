import type { AvatarState } from "@/components/interview/AiAvatar";
import { DEFAULT_EMOJI_PARAMS, type EmojiParams } from "@/lib/aiApi";
import type { SpeechAnalyser } from "@/lib/speechAnalyser";
import { useEffect, useId, useRef } from "react";

/**
 * Parametric "emoji" interviewer in a 3D-look (Memoji-like) vector style. Looks come from `params`
 * (derived from an HR photo on the server, editable on the Avatar Configuration page).
 *
 * How the 3D impression is built without any 3D:
 * - layered shading: two radial gradients on the face (key light upper-left, rim shadow lower-right),
 *   a soft forehead highlight, volumetric nose/ears/lips, hair with a highlight streak and a dark underside;
 * - parallax "head turn": features, front hair and back hair sit in separate groups that slide by
 *   different amounts when the head turns (towards the candidate while listening, up-right while
 *   thinking, a gentle sway while talking), which reads as rotation;
 * - the same rig as the other avatars: mouth from the TTS audio analyser (loudness -> opening,
 *   spectral balance -> round "o" vs spread "e"), random blinks, brow lift, nods, breathing.
 *
 * Per-frame updates write to SVG attributes through refs; React only re-renders on param changes.
 */

interface EmojiAvatarProps {
  params?: Partial<EmojiParams> | null;
  state?: AvatarState;
  analyser?: SpeechAnalyser | null;
  attentive?: boolean;
  className?: string;
}

const CX = 120; // head centre x
const HEAD_CY = 104;
const EYE_Y = 100;
const EYE_DX = 21; // half distance between eye centres
const BLINK_MS = 140;
const NOD_MS = 650;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const rand = (min: number, max: number) => min + Math.random() * (max - min);

const shade = (hex: string, amount: number) => {
  const n = parseInt(hex.replace("#", ""), 16);
  const c = (v: number) => Math.max(0, Math.min(255, v));
  return `rgb(${c(((n >> 16) & 255) + amount)},${c(((n >> 8) & 255) + amount)},${c((n & 255) + amount)})`;
};
/** Face outline control values per shape; big head, small chin, Memoji proportions. */
const FACE: Record<EmojiParams["face_shape"], { rx: number; top: number; jawY: number; jawCtrl: number; chin: number }> = {
  oval: { rx: 54, top: 44, jawY: 142, jawCtrl: 30, chin: 168 },
  round: { rx: 57, top: 42, jawY: 148, jawCtrl: 40, chin: 164 },
  square: { rx: 55, top: 42, jawY: 154, jawCtrl: 44, chin: 166 },
  heart: { rx: 56, top: 42, jawY: 134, jawCtrl: 20, chin: 168 },
  long: { rx: 50, top: 40, jawY: 148, jawCtrl: 28, chin: 176 },
};

const facePath = (g: (typeof FACE)["oval"], inset = 0) =>
  `M ${CX - g.rx + inset} ${HEAD_CY} C ${CX - g.rx + inset} ${g.top + inset} ${CX + g.rx - inset} ${g.top + inset} ${CX + g.rx - inset} ${HEAD_CY} ` +
  `C ${CX + g.rx - inset} ${g.jawY} ${CX + g.jawCtrl} ${g.chin - inset} ${CX} ${g.chin - inset} ` +
  `C ${CX - g.jawCtrl} ${g.chin - inset} ${CX - g.rx + inset} ${g.jawY} ${CX - g.rx + inset} ${HEAD_CY} Z`;

/** Mouth cavity outline for a given opening (0..1) and spread (0 round .. 1 wide). */
const mouthPath = (cy: number, open: number, spread: number): string => {
  const halfW = 13 + spread * 7 - open * 4;
  const h = open * 19;
  return `M ${CX - halfW} ${cy} Q ${CX} ${cy - h * 0.38} ${CX + halfW} ${cy} Q ${CX} ${cy + h * 1.0} ${CX - halfW} ${cy} Z`;
};

const EmojiAvatar = ({ params, state = "idle", analyser = null, attentive = false, className }: EmojiAvatarProps) => {
  const p: EmojiParams = { ...DEFAULT_EMOJI_PARAMS, ...(params ?? {}) };
  const base = FACE[p.face_shape] ?? FACE.oval;
  // Facial structure: angular widens and squares the jaw, softens nothing; soft rounds it further
  const angular = p.build === "angular";
  const soft = p.build === "soft";
  const g = angular
    ? { rx: base.rx + 2, top: base.top, jawY: base.jawY + 10, jawCtrl: Math.min(52, base.jawCtrl + 16), chin: base.chin - 2 }
    : soft
      ? { rx: base.rx, top: base.top, jawY: base.jawY - 4, jawCtrl: Math.max(16, base.jawCtrl - 6), chin: base.chin }
      : base;
  const rx = g.rx;
  const mouthY = g.chin - (angular ? 33 : 30);
  const noseY = mouthY - (angular ? 25 : 22);
  const eyeRy = angular ? 8.4 : soft ? 10.5 : 9.6;
  const eyeRx = angular ? 11.5 : 12;
  const browY = angular ? EYE_Y - 20 : EYE_Y - 23; // heavier brow sits lower
  const neckW = angular ? 38 : soft ? 26 : 30;
  const shoulder = angular ? 12 : soft ? -4 : 0; // widens the body path

  const stateRef = useRef(state);
  const analyserRef = useRef(analyser);
  const attentiveRef = useRef(attentive);
  useEffect(() => {
    stateRef.current = state;
    analyserRef.current = analyser;
    attentiveRef.current = attentive;
  }, [state, analyser, attentive]);
  const mouthYRef = useRef(mouthY);
  useEffect(() => {
    mouthYRef.current = mouthY;
  }, [mouthY]);

  const headRef = useRef<SVGGElement | null>(null);
  const backHairRef = useRef<SVGGElement | null>(null);
  const frontHairRef = useRef<SVGGElement | null>(null);
  const featuresRef = useRef<SVGGElement | null>(null);
  const browsRef = useRef<SVGGElement | null>(null);
  const eyeLRef = useRef<SVGGElement | null>(null);
  const eyeRRef = useRef<SVGGElement | null>(null);
  const irisLRef = useRef<SVGGElement | null>(null);
  const irisRRef = useRef<SVGGElement | null>(null);
  const mouthRef = useRef<SVGPathElement | null>(null);
  const mouthClipRef = useRef<SVGPathElement | null>(null);
  const teethRef = useRef<SVGPathElement | null>(null);
  const tongueRef = useRef<SVGEllipseElement | null>(null);
  const restMouthRef = useRef<SVGGElement | null>(null);
  const glowRef = useRef<SVGCircleElement | null>(null);
  const shadowRef = useRef<SVGEllipseElement | null>(null);

  useEffect(() => {
    const reduceMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let open = 0;
    let spread = 0.4;
    let tilt = 0;
    let turn = 0; // -1 .. 1, positive = towards the viewer's right
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
      const cy = mouthYRef.current;

      // ---- mouth
      const rawLevel = s === "speaking" && a ? a.level() : 0;
      const targetOpen = Math.pow(rawLevel, 0.8);
      open = targetOpen > open ? lerp(open, targetOpen, 0.55) : lerp(open, targetOpen, 0.28);
      spread = rawLevel > 0.12 && a ? lerp(spread, a.spread(), 0.2) : lerp(spread, 0.4, 0.05);
      const talking = open > 0.06;
      if (mouthRef.current && mouthClipRef.current && restMouthRef.current && teethRef.current && tongueRef.current) {
        if (talking) {
          const d = mouthPath(cy, open, spread);
          mouthRef.current.setAttribute("d", d);
          mouthClipRef.current.setAttribute("d", d);
          mouthRef.current.style.opacity = "1";
          restMouthRef.current.style.opacity = "0";
          const h = open * 19;
          const halfW = 13 + spread * 7 - open * 4;
          const teethH = Math.min(6, h * 0.36);
          // Teeth follow the upper lip curve: a band under the top edge of the cavity
          teethRef.current.setAttribute(
            "d",
            `M ${CX - halfW + 2} ${cy} Q ${CX} ${cy - h * 0.34} ${CX + halfW - 2} ${cy} L ${CX + halfW - 4} ${cy + teethH} Q ${CX} ${cy - h * 0.34 + teethH + 1} ${CX - halfW + 4} ${cy + teethH} Z`,
          );
          teethRef.current.style.opacity = open > 0.18 ? String(Math.min(0.92, (open - 0.18) * 4)) : "0";
          tongueRef.current.setAttribute("cy", String(cy + h * 0.7));
          tongueRef.current.setAttribute("rx", String(halfW * 0.5));
          tongueRef.current.setAttribute("ry", String(Math.max(0.5, h * 0.3)));
          tongueRef.current.style.opacity = open > 0.35 ? "0.95" : "0";
        } else {
          mouthRef.current.style.opacity = "0";
          teethRef.current.style.opacity = "0";
          tongueRef.current.style.opacity = "0";
          restMouthRef.current.style.opacity = "1";
        }
      }

      // ---- blink
      if (blinkStart < 0 && now >= blinkAt) blinkStart = now;
      let lid = 1;
      if (blinkStart >= 0) {
        const prog = (now - blinkStart) / BLINK_MS;
        if (prog >= 1) {
          blinkStart = -1;
          blinkAt = now + (Math.random() < 0.15 ? rand(180, 320) : rand(2200, 5500));
        } else lid = Math.max(0.06, 1 - Math.sin(prog * Math.PI));
      }
      if (s === "thinking") lid = Math.min(lid, 0.85);
      const eyeT = (ex: number) => `translate(${ex} ${EYE_Y}) scale(1 ${lid.toFixed(3)}) translate(${-ex} ${-EYE_Y})`;
      eyeLRef.current?.setAttribute("transform", eyeT(CX - EYE_DX));
      eyeRRef.current?.setAttribute("transform", eyeT(CX + EYE_DX));

      // ---- gaze, brows
      const targetGaze = s === "thinking" ? { x: 3.5, y: -3 } : s === "listening" ? { x: 1.2, y: 0.5 } : { x: 0, y: 0 };
      gazeX = lerp(gazeX, targetGaze.x, 0.08);
      gazeY = lerp(gazeY, targetGaze.y, 0.08);
      irisLRef.current?.setAttribute("transform", `translate(${gazeX.toFixed(2)} ${gazeY.toFixed(2)})`);
      irisRRef.current?.setAttribute("transform", `translate(${gazeX.toFixed(2)} ${gazeY.toFixed(2)})`);
      const targetBrow = s === "thinking" ? -3.5 : s === "speaking" ? -open * 2.5 : s === "listening" ? -1 : 0;
      browLift = lerp(browLift, targetBrow, 0.12);
      browsRef.current?.setAttribute("transform", `translate(0 ${browLift.toFixed(2)})`);

      // ---- head: tilt, turn (parallax), bob
      const targetTilt = reduceMotion ? 0 : s === "thinking" ? 4 : s === "listening" ? -2.5 : 0;
      tilt = lerp(tilt, targetTilt, 0.05);
      let targetTurn = 0;
      if (!reduceMotion) {
        if (s === "listening") targetTurn = 0.35;
        else if (s === "thinking") targetTurn = -0.45;
        else if (s === "speaking") targetTurn = Math.sin(now / 1900) * 0.25;
        else targetTurn = Math.sin(now / 3100) * 0.12;
      }
      turn = lerp(turn, targetTurn, 0.04);
      let targetY = 0;
      if (!reduceMotion) {
        targetY = Math.sin(now / 1400) * 0.9;
        if (s === "speaking") targetY += Math.sin(now / 380) * 1.1 + open * 1.8;
        if (attentiveRef.current && s === "listening" && nodStart < 0 && now >= nodAt) nodStart = now;
        if (nodStart >= 0) {
          const prog = (now - nodStart) / NOD_MS;
          if (prog >= 1) {
            nodStart = -1;
            nodAt = now + rand(2200, 4500);
          } else targetY += Math.sin(prog * Math.PI) * 3.4;
        }
      }
      headY = lerp(headY, targetY, 0.2);
      headRef.current?.setAttribute("transform", `translate(${(turn * 2).toFixed(2)} ${headY.toFixed(2)}) rotate(${tilt.toFixed(2)} ${CX} ${HEAD_CY})`);
      // Parallax: features slide most, front hair less, back hair the other way
      featuresRef.current?.setAttribute("transform", `translate(${(turn * 9).toFixed(2)} 0) scale(${(1 - Math.abs(turn) * 0.05).toFixed(3)} 1)`);
      frontHairRef.current?.setAttribute("transform", `translate(${(turn * 4).toFixed(2)} 0)`);
      backHairRef.current?.setAttribute("transform", `translate(${(-turn * 5).toFixed(2)} 0)`);
      if (shadowRef.current) shadowRef.current.setAttribute("cx", String(CX - turn * 6));

      glow = lerp(glow, s === "speaking" ? 0.5 + open * 0.4 : s === "thinking" ? 0.3 : 0.2, 0.1);
      if (glowRef.current) glowRef.current.style.opacity = glow.toFixed(3);

      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const uid = useId().replace(/:/g, "");
  const id = (k: string) => `em-${k}-${uid}`;
  const wrapperClass = /\b(absolute|fixed|relative)\b/.test(className ?? "") ? (className as string) : `relative ${className ?? ""}`;

  const skin = p.skin;
  const skinDark = shade(skin, -34);
  const skinDeep = shade(skin, -58);
  const hair = p.hair;
  const hairDark = shade(hair, -30);
  const hairLight = shade(hair, 42);
  // Without lipstick the lips are a natural, slightly darker skin tone regardless of the stored color
  const lips = p.lipstick ? p.lips : shade(skin, -40);
  const browWidth = p.brow_thickness === "thin" ? 2.8 : p.brow_thickness === "thick" ? 5.6 : 4.2;
  const showHair = !p.hijab && p.hair_style !== "bald";
  const longHair = p.hair_style === "long" || p.hair_style === "wavy";
  const mediumHair = p.hair_style === "medium";
  const eyeWhite = "#fbfaf7";

  // ---- hair geometry (relative to the face radius)
  // The face's top sits ~15 px below g.top (cubic apex), so hair needs a high dome and a fringe
  // that reaches the upper forehead (just above the brows) to read as a full head of hair.
  const hairline = EYE_Y - 27; // just above the brows
  const capPath =
    `M ${CX - rx - 3} ${HEAD_CY + 2} C ${CX - rx - 6} ${g.top - 36} ${CX + rx + 6} ${g.top - 36} ${CX + rx + 3} ${HEAD_CY + 2} ` +
    `C ${CX + rx - 4} ${hairline + 14} ${CX + 30} ${hairline - 3} ${CX} ${hairline} C ${CX - 30} ${hairline - 3} ${CX - rx + 4} ${hairline + 14} ${CX - rx - 3} ${HEAD_CY + 2} Z`;
  const sweptCapPath =
    `M ${CX - rx - 3} ${HEAD_CY + 6} C ${CX - rx - 8} ${g.top - 38} ${CX + rx + 8} ${g.top - 38} ${CX + rx + 3} ${HEAD_CY + 6} ` +
    `C ${CX + rx - 1} ${hairline + 12} ${CX + 38} ${hairline - 8} ${CX + 20} ${hairline - 6} C ${CX + 6} ${hairline - 4} ${CX - 2} ${hairline + 8} ${CX - 6} ${hairline + 14} ` +
    `C ${CX - 22} ${hairline - 6} ${CX - 42} ${hairline} ${CX - rx - 3} ${HEAD_CY + 6} Z`;
  const spikyPath = (() => {
    const pts = [`M ${CX - rx - 3} ${HEAD_CY + 2}`];
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = CX - rx - 3 + t * (2 * rx + 6);
      const y = i % 2 === 0 ? g.top - 2 - Math.sin(t * Math.PI) * 8 : g.top - 34 - Math.sin(t * Math.PI) * 12;
      pts.push(`L ${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    pts.push(`L ${CX + rx + 3} ${HEAD_CY + 2} C ${CX + rx - 4} ${hairline + 14} ${CX + 28} ${hairline} ${CX} ${hairline + 2} C ${CX - 28} ${hairline} ${CX - rx + 4} ${hairline + 14} ${CX - rx - 3} ${HEAD_CY + 2} Z`);
    return pts.join(" ");
  })();
  // Back hair: wide enough beside the face to be seen, dome as high as the front cap
  const longBackPath =
    `M ${CX - rx - 12} ${HEAD_CY + 4} C ${CX - rx - 22} 156 ${CX - rx - 18} 186 ${CX - rx - 2} 200 L ${CX - 22} 200 C ${CX - 28} 186 ${CX - 34} 168 ${CX - 34} 148 ` +
    `L ${CX + 34} 148 C ${CX + 34} 168 ${CX + 28} 186 ${CX + 22} 200 L ${CX + rx + 2} 200 C ${CX + rx + 18} 186 ${CX + rx + 22} 156 ${CX + rx + 12} ${HEAD_CY + 4} ` +
    `C ${CX + rx + 8} ${g.top - 32} ${CX - rx - 8} ${g.top - 32} ${CX - rx - 12} ${HEAD_CY + 4} Z`;
  const mediumBackPath =
    `M ${CX - rx - 12} ${HEAD_CY + 4} C ${CX - rx - 22} 138 ${CX - rx - 16} 158 ${CX - rx} 162 L ${CX - 26} 162 L ${CX - 26} 140 L ${CX + 26} 140 L ${CX + 26} 162 L ${CX + rx} 162 ` +
    `C ${CX + rx + 16} 158 ${CX + rx + 22} 138 ${CX + rx + 12} ${HEAD_CY + 4} C ${CX + rx + 8} ${g.top - 32} ${CX - rx - 8} ${g.top - 32} ${CX - rx - 12} ${HEAD_CY + 4} Z`;
  const hijabBackPath =
    `M ${CX - rx - 18} ${HEAD_CY + 8} C ${CX - rx - 32} 176 ${CX - rx - 14} 214 ${CX - rx + 6} 220 L ${CX + rx - 6} 220 C ${CX + rx + 14} 214 ${CX + rx + 32} 176 ${CX + rx + 18} ${HEAD_CY + 8} ` +
    `C ${CX + rx + 12} ${g.top - 44} ${CX - rx - 12} ${g.top - 44} ${CX - rx - 18} ${HEAD_CY + 8} Z`;
  const hijabFramePath =
    `M ${CX - rx - 5} ${HEAD_CY + 6} C ${CX - rx - 12} ${g.top - 40} ${CX + rx + 12} ${g.top - 40} ${CX + rx + 5} ${HEAD_CY + 6} ` +
    `C ${CX + rx + 1} ${hairline + 16} ${CX + 36} ${hairline - 2} ${CX} ${hairline - 2} C ${CX - 36} ${hairline - 2} ${CX - rx - 1} ${hairline + 16} ${CX - rx - 5} ${HEAD_CY + 6} Z`;
  const hijabChinPath =
    `M ${CX - rx - 5} ${HEAD_CY + 14} C ${CX - rx - 10} 164 ${CX - 34} 196 ${CX} 194 C ${CX + 34} 196 ${CX + rx + 10} 164 ${CX + rx + 5} ${HEAD_CY + 14} ` +
    `L ${CX + rx} ${HEAD_CY + 14} C ${CX + rx} ${g.jawY + 6} ${CX + g.jawCtrl} ${g.chin + 5} ${CX} ${g.chin + 5} C ${CX - g.jawCtrl} ${g.chin + 5} ${CX - rx} ${g.jawY + 6} ${CX - rx} ${HEAD_CY + 14} Z`;
  const beardPath =
    `M ${CX - rx} ${HEAD_CY + 16} C ${CX - rx} ${g.jawY + 10} ${CX - g.jawCtrl} ${g.chin + 8} ${CX} ${g.chin + 8} C ${CX + g.jawCtrl} ${g.chin + 8} ${CX + rx} ${g.jawY + 10} ${CX + rx} ${HEAD_CY + 16} ` +
    `L ${CX + rx - 11} ${HEAD_CY + 24} C ${CX + rx - 11} ${g.jawY - 4} ${CX + g.jawCtrl - 4} ${mouthY + 14} ${CX} ${mouthY + 14} C ${CX - g.jawCtrl + 4} ${mouthY + 14} ${CX - rx + 11} ${g.jawY - 4} ${CX - rx + 11} ${HEAD_CY + 24} Z`;
  const stubblePath =
    `M ${CX - rx + 3} ${HEAD_CY + 20} C ${CX - rx + 3} ${g.jawY} ${CX - g.jawCtrl} ${g.chin - 1} ${CX} ${g.chin - 1} C ${CX + g.jawCtrl} ${g.chin - 1} ${CX + rx - 3} ${g.jawY} ${CX + rx - 3} ${HEAD_CY + 20} ` +
    `C ${CX + rx - 12} ${HEAD_CY + 26} ${CX + 20} ${mouthY + 11} ${CX} ${mouthY + 11} C ${CX - 20} ${mouthY + 11} ${CX - rx + 12} ${HEAD_CY + 26} ${CX - rx + 3} ${HEAD_CY + 20} Z`;

  const eye = (ex: number, refs: { g: typeof eyeLRef; iris: typeof irisLRef }) => (
    <g ref={refs.g}>
      {/* eye white with a soft shadow under the upper lid */}
      <ellipse cx={ex} cy={EYE_Y} rx={eyeRx} ry={eyeRy} fill={eyeWhite} />
      <ellipse cx={ex} cy={EYE_Y} rx={eyeRx} ry={eyeRy} fill={`url(#${id("eyeshade")})`} />
      <g ref={refs.iris}>
        <circle cx={ex} cy={EYE_Y + 0.5} r="6.6" fill={`url(#${id("iris")})`} />
        <circle cx={ex} cy={EYE_Y + 0.5} r="3.1" fill="#120a08" />
        <circle cx={ex + 2.4} cy={EYE_Y - 2.4} r="1.9" fill="#ffffff" opacity="0.95" />
        <circle cx={ex - 1.6} cy={EYE_Y + 2.6} r="0.9" fill="#ffffff" opacity="0.6" />
      </g>
      {/* upper lid line; thicker with visible lashes/eye make-up, straighter on an angular face */}
      <path d={`M ${ex - eyeRx} ${EYE_Y - 1} Q ${ex} ${EYE_Y - 1 - eyeRy - (angular ? 1 : 2)} ${ex + eyeRx} ${EYE_Y - 1}`} stroke={hairDark} strokeWidth={p.lashes ? 3 : 1.7} strokeLinecap="round" fill="none" opacity={p.lashes ? 1 : 0.85} />
      {p.lashes && <path d={`M ${ex + 9} ${EYE_Y - 7} l 3 -3 M ${ex + 11.5} ${EYE_Y - 3} l 3.5 -1.5`} stroke={hairDark} strokeWidth="1.6" strokeLinecap="round" fill="none" />}
      {angular && <path d={`M ${ex - eyeRx + 1} ${EYE_Y - 2} Q ${ex} ${EYE_Y - eyeRy - 3} ${ex + eyeRx - 1} ${EYE_Y - 2}`} stroke={skinDeep} strokeWidth="2.2" fill="none" opacity="0.35" />}
      <path d={`M ${ex - 9} ${EYE_Y + eyeRy - 2} Q ${ex} ${EYE_Y + eyeRy + 1.5} ${ex + 9} ${EYE_Y + eyeRy - 2}`} stroke={skinDeep} strokeWidth="1" fill="none" opacity="0.35" />
    </g>
  );

  return (
    <div className={wrapperClass}>
      <svg viewBox="0 0 240 240" className="h-full w-full" role="img" aria-label="AI interviewer" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id={id("glow")} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={p.accent} stopOpacity="0.5" />
            <stop offset="60%" stopColor={p.accent} stopOpacity="0.1" />
            <stop offset="100%" stopColor={p.accent} stopOpacity="0" />
          </radialGradient>
          {/* key light from the upper left */}
          <radialGradient id={id("face")} cx="40%" cy="32%" r="78%">
            <stop offset="0%" stopColor={shade(skin, 22)} />
            <stop offset="55%" stopColor={skin} />
            <stop offset="100%" stopColor={shade(skin, -18)} />
          </radialGradient>
          {/* rim shadow lower right, transparent centre */}
          <radialGradient id={id("rim")} cx="42%" cy="40%" r="62%">
            <stop offset="72%" stopColor={skinDeep} stopOpacity="0" />
            <stop offset="100%" stopColor={skinDeep} stopOpacity="0.55" />
          </radialGradient>
          <radialGradient id={id("iris")} cx="50%" cy="65%" r="60%">
            <stop offset="0%" stopColor={shade(p.eyes, 55)} />
            <stop offset="70%" stopColor={p.eyes} />
            <stop offset="100%" stopColor={shade(p.eyes, -30)} />
          </radialGradient>
          <linearGradient id={id("eyeshade")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#000" stopOpacity="0.22" />
            <stop offset="35%" stopColor="#000" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={id("hair")} x1="0.2" y1="0" x2="0.6" y2="1">
            <stop offset="0%" stopColor={hairLight} />
            <stop offset="45%" stopColor={hair} />
            <stop offset="100%" stopColor={hairDark} />
          </linearGradient>
          <linearGradient id={id("hairback")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={hairDark} />
            <stop offset="100%" stopColor={shade(hair, -45)} />
          </linearGradient>
          <linearGradient id={id("hijab")} x1="0.2" y1="0" x2="0.7" y2="1">
            <stop offset="0%" stopColor={shade(p.hijab_color, 34)} />
            <stop offset="50%" stopColor={p.hijab_color} />
            <stop offset="100%" stopColor={shade(p.hijab_color, -30)} />
          </linearGradient>
          <linearGradient id={id("cloth")} x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0%" stopColor={shade(p.clothing, 30)} />
            <stop offset="100%" stopColor={shade(p.clothing, -14)} />
          </linearGradient>
          <linearGradient id={id("lipU")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={shade(lips, -22)} />
            <stop offset="100%" stopColor={lips} />
          </linearGradient>
          <linearGradient id={id("lipL")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={shade(lips, 18)} />
            <stop offset="100%" stopColor={shade(lips, -12)} />
          </linearGradient>
          <linearGradient id={id("lens")} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.32" />
            <stop offset="45%" stopColor="#ffffff" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.18" />
          </linearGradient>
          <clipPath id={id("clip")}>
            <path ref={mouthClipRef} d={mouthPath(mouthY, 0, 0.4)} />
          </clipPath>
        </defs>

        <circle ref={glowRef} cx={CX} cy={HEAD_CY + 16} r="112" fill={`url(#${id("glow")})`} style={{ opacity: 0.2 }} />

        {/* Body: rounded shoulders (wider on an angular build), shirt, lanyard + badge */}
        <path
          d={`M ${40 - shoulder} 240 C ${42 - shoulder} 206 ${72 - shoulder / 2} 192 100 186 L 120 206 L 140 186 C ${168 + shoulder / 2} 192 ${198 + shoulder} 206 ${200 + shoulder} 240 Z`}
          fill={`url(#${id("cloth")})`}
        />
        <path d="M 100 186 L 120 210 L 140 186 L 132 183 L 120 198 L 108 183 Z" fill="#f4efe6" />
        <path d="M 106 184 L 116 224 M 134 184 L 124 224" stroke={p.accent} strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <rect x="111" y="221" width="18" height="19" rx="2.5" fill={p.accent} />
        <rect x="114" y="226" width="12" height="2" rx="1" fill={shade(p.clothing, -10)} opacity="0.5" />
        <rect x="114" y="231" width="8" height="2" rx="1" fill={shade(p.clothing, -10)} opacity="0.35" />

        {/* Neck (broader on an angular build) with a shadow under the chin */}
        <rect x={CX - neckW / 2} y={g.chin - 18} width={neckW} height={206 - g.chin} rx="10" fill={skinDark} />
        {angular && <path d={`M ${CX - 3} ${g.chin + 14} q 3 4 6 0`} stroke={skinDeep} strokeWidth="1.5" fill="none" opacity="0.4" />}
        <ellipse ref={shadowRef} cx={CX} cy={g.chin - 6} rx={neckW * 0.8} ry="7" fill={skinDeep} opacity="0.35" />

        <g ref={headRef}>
          {/* Behind the head: hijab drape or long/medium hair, sliding opposite to the turn */}
          <g ref={backHairRef}>
            {p.hijab && <path d={hijabBackPath} fill={`url(#${id("hijab")})`} />}
            {showHair && longHair && <path d={longBackPath} fill={`url(#${id("hairback")})`} />}
            {showHair && mediumHair && <path d={mediumBackPath} fill={`url(#${id("hairback")})`} />}
            {showHair && p.hair_style === "tied" && (
              <path d={`M ${CX + rx - 6} ${HEAD_CY - 20} C ${CX + rx + 26} ${HEAD_CY - 6} ${CX + rx + 30} 158 ${CX + rx + 10} 184 C ${CX + rx} 162 ${CX + rx - 10} 130 ${CX + rx - 6} ${HEAD_CY - 20} Z`} fill={`url(#${id("hairback")})`} />
            )}
          </g>

          {/* Ears (hidden by a hijab), a little larger on an angular build */}
          {!p.hijab && (
            <>
              <ellipse cx={CX - rx + 1} cy={HEAD_CY + 8} rx={angular ? 10 : 9} ry={angular ? 12.5 : 11} fill={skin} />
              <ellipse cx={CX + rx - 1} cy={HEAD_CY + 8} rx={angular ? 10 : 9} ry={angular ? 12.5 : 11} fill={skin} />
              <ellipse cx={CX - rx + 2} cy={HEAD_CY + 9} rx="4.5" ry="6.5" fill={skinDark} opacity="0.55" />
              <ellipse cx={CX + rx - 2} cy={HEAD_CY + 9} rx="4.5" ry="6.5" fill={skinDark} opacity="0.55" />
              {p.earrings && (
                <>
                  <circle cx={CX - rx + 1} cy={HEAD_CY + 21} r="3" fill={p.accent} />
                  <circle cx={CX + rx - 1} cy={HEAD_CY + 21} r="3" fill={p.accent} />
                  <circle cx={CX - rx} cy={HEAD_CY + 20} r="1" fill="#fff" opacity="0.8" />
                  <circle cx={CX + rx - 2} cy={HEAD_CY + 20} r="1" fill="#fff" opacity="0.8" />
                </>
              )}
            </>
          )}

          {/* Face: base, rim shadow, forehead highlight */}
          <path d={facePath(g)} fill={`url(#${id("face")})`} />
          <path d={facePath(g)} fill={`url(#${id("rim")})`} />
          <ellipse cx={CX - 14} cy={g.top + 30} rx="22" ry="10" fill="#ffffff" opacity="0.14" />
          {p.hijab && <path d={hijabChinPath} fill={`url(#${id("hijab")})`} />}

          {/* Features slide with the head turn (parallax) */}
          <g ref={featuresRef}>
            {/* Facial hair */}
            {p.facial_hair === "beard" && <path d={beardPath} fill={`url(#${id("hair")})`} opacity="0.96" />}
            {p.facial_hair === "stubble" && <path d={stubblePath} fill={hair} opacity="0.2" />}
            {p.facial_hair === "goatee" && <ellipse cx={CX} cy={g.chin - 11} rx="11" ry="8" fill={hair} opacity="0.92" />}
            {(p.facial_hair === "mustache" || p.facial_hair === "goatee") && (
              <path d={`M ${CX - 18} ${mouthY - 6} Q ${CX} ${mouthY - 17} ${CX + 18} ${mouthY - 6} Q ${CX} ${mouthY - 1} ${CX - 18} ${mouthY - 6} Z`} fill={hair} opacity="0.94" />
            )}

            {/* Cheeks: faint warmth by default, real blush only with make-up; angular = cheekbone shadow */}
            {angular ? (
              <>
                <path d={`M ${CX - rx + 6} ${HEAD_CY + 18} Q ${CX - 30} ${HEAD_CY + 34} ${CX - 22} ${HEAD_CY + 44}`} stroke={skinDeep} strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.16" />
                <path d={`M ${CX + rx - 6} ${HEAD_CY + 18} Q ${CX + 30} ${HEAD_CY + 34} ${CX + 22} ${HEAD_CY + 44}`} stroke={skinDeep} strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.16" />
              </>
            ) : (
              <>
                <ellipse cx={CX - 30} cy={HEAD_CY + 22} rx="9" ry="6" fill="#f0a08a" opacity={p.blush ? 0.34 : 0.1} />
                <ellipse cx={CX + 30} cy={HEAD_CY + 22} rx="9" ry="6" fill="#f0a08a" opacity={p.blush ? 0.34 : 0.1} />
              </>
            )}
            {p.blush && angular && (
              <>
                <ellipse cx={CX - 30} cy={HEAD_CY + 22} rx="9" ry="6" fill="#f0a08a" opacity="0.3" />
                <ellipse cx={CX + 30} cy={HEAD_CY + 22} rx="9" ry="6" fill="#f0a08a" opacity="0.3" />
              </>
            )}

            {/* Age lines: forehead and nasolabial folds, faint */}
            {p.age_lines && (
              <g stroke={skinDeep} strokeWidth="1.3" fill="none" opacity="0.32" strokeLinecap="round">
                <path d={`M ${CX - 22} ${browY - 14} Q ${CX} ${browY - 19} ${CX + 22} ${browY - 14}`} />
                <path d={`M ${CX - 16} ${browY - 8} Q ${CX} ${browY - 12} ${CX + 16} ${browY - 8}`} />
                <path d={`M ${CX - 9} ${noseY + 16} Q ${CX - 18} ${mouthY - 2} ${CX - 17} ${mouthY + 10}`} />
                <path d={`M ${CX + 9} ${noseY + 16} Q ${CX + 18} ${mouthY - 2} ${CX + 17} ${mouthY + 10}`} />
                <path d={`M ${CX - EYE_DX - 10} ${EYE_Y + eyeRy + 3} q 6 3 12 1 M ${CX + EYE_DX - 2} ${EYE_Y + eyeRy + 4} q 6 2 12 -1`} opacity="0.8" />
              </g>
            )}

            {/* Brows: thickness from the photo; heavier and lower on an angular face, arched when thin */}
            <g ref={browsRef}>
              <path d={`M ${CX - 34} ${browY + 6} Q ${CX - 21} ${browY - (p.brow_thickness === "thin" ? 4 : angular ? 0 : 1)} ${CX - 8} ${browY + 4}`} stroke={hair} strokeWidth={browWidth + (angular ? 1 : 0)} strokeLinecap="round" fill="none" />
              <path d={`M ${CX + 8} ${browY + 4} Q ${CX + 21} ${browY - (p.brow_thickness === "thin" ? 4 : angular ? 0 : 1)} ${CX + 34} ${browY + 6}`} stroke={hair} strokeWidth={browWidth + (angular ? 1 : 0)} strokeLinecap="round" fill="none" />
            </g>

            {eye(CX - EYE_DX, { g: eyeLRef, iris: irisLRef })}
            {eye(CX + EYE_DX, { g: eyeRRef, iris: irisRRef })}

            {/* Glasses with a reflective lens */}
            {p.glasses && (
              <g stroke={p.glasses_color} strokeWidth="2.6">
                <rect x={CX - EYE_DX - 16} y={EYE_Y - 13} width="32" height="25" rx="9" fill={`url(#${id("lens")})`} />
                <rect x={CX + EYE_DX - 16} y={EYE_Y - 13} width="32" height="25" rx="9" fill={`url(#${id("lens")})`} />
                <path d={`M ${CX - EYE_DX + 16} ${EYE_Y - 3} Q ${CX} ${EYE_Y - 8} ${CX + EYE_DX - 16} ${EYE_Y - 3}`} fill="none" />
                <path d={`M ${CX - EYE_DX - 16} ${EYE_Y - 4} L ${CX - rx + 4} ${EYE_Y - 6} M ${CX + EYE_DX + 16} ${EYE_Y - 4} L ${CX + rx - 4} ${EYE_Y - 6}`} fill="none" />
              </g>
            )}

            {/* Nose with a shaded side; larger with a visible bridge on an angular face */}
            {angular ? (
              <>
                <path d={`M ${CX - 2} ${noseY - 6} C ${CX + 6} ${noseY + 6} ${CX + 11} ${noseY + 16} ${CX + 5} ${noseY + 21} C ${CX + 1} ${noseY + 24} ${CX - 6} ${noseY + 23} ${CX - 9} ${noseY + 18}`} stroke={skinDark} strokeWidth="2.6" strokeLinecap="round" fill="none" opacity="0.9" />
                <ellipse cx={CX + 1} cy={noseY + 10} rx="6.5" ry="9" fill={shade(skin, 12)} opacity="0.45" />
                <ellipse cx={CX - 6} cy={noseY + 20} rx="3" ry="2" fill={skinDeep} opacity="0.35" />
                <ellipse cx={CX + 7} cy={noseY + 20} rx="3" ry="2" fill={skinDeep} opacity="0.35" />
              </>
            ) : (
              <>
                <path d={`M ${CX + 1} ${noseY} C ${CX + 6} ${noseY + 8} ${CX + 8} ${noseY + 14} ${CX + 3} ${noseY + 18} C ${CX} ${noseY + 20} ${CX - 4} ${noseY + 19} ${CX - 6} ${noseY + 16}`} stroke={skinDark} strokeWidth="2.4" strokeLinecap="round" fill="none" opacity="0.9" />
                <ellipse cx={CX + 1} cy={noseY + 10} rx="5" ry="7" fill={shade(skin, 12)} opacity="0.45" />
              </>
            )}

            {/* Mouth at rest: two lips with volume (thinner, wider and flatter on an angular face) */}
            <g ref={restMouthRef}>
              {angular ? (
                <>
                  <path d={`M ${CX - 17} ${mouthY} Q ${CX} ${mouthY - 2.5} ${CX + 17} ${mouthY} Q ${CX} ${mouthY + 1.2} ${CX - 17} ${mouthY} Z`} fill={`url(#${id("lipU")})`} />
                  <path d={`M ${CX - 17} ${mouthY} Q ${CX} ${mouthY + 6} ${CX + 17} ${mouthY} Q ${CX} ${mouthY + 1.5} ${CX - 17} ${mouthY} Z`} fill={`url(#${id("lipL")})`} />
                  <path d={`M ${CX - 17} ${mouthY} Q ${CX} ${mouthY + 1.5} ${CX + 17} ${mouthY}`} stroke={shade(lips, -50)} strokeWidth="1.4" fill="none" opacity="0.75" />
                  <path d={`M ${CX - 8} ${mouthY + 16} Q ${CX} ${mouthY + 19} ${CX + 8} ${mouthY + 16}`} stroke={skinDeep} strokeWidth="1.2" fill="none" opacity="0.28" />
                </>
              ) : (
                <>
                  <path d={`M ${CX - 14} ${mouthY} Q ${CX} ${mouthY - 5} ${CX + 14} ${mouthY} Q ${CX} ${mouthY + 2} ${CX - 14} ${mouthY} Z`} fill={`url(#${id("lipU")})`} />
                  <path d={`M ${CX - 14} ${mouthY} Q ${CX} ${mouthY + 10} ${CX + 14} ${mouthY} Q ${CX} ${mouthY + 2.5} ${CX - 14} ${mouthY} Z`} fill={`url(#${id("lipL")})`} />
                  <path d={`M ${CX - 14} ${mouthY} Q ${CX} ${mouthY + 2.5} ${CX + 14} ${mouthY}`} stroke={shade(lips, -50)} strokeWidth="1.2" fill="none" opacity="0.7" />
                  <ellipse cx={CX} cy={mouthY + 12} rx="9" ry="2.2" fill={skinDeep} opacity="0.2" />
                </>
              )}
            </g>
            {/* Mouth speaking: cavity, teeth band, tongue, lip rims */}
            <path ref={mouthRef} d={mouthPath(mouthY, 0, 0.4)} fill={shade(lips, -75)} stroke={shade(lips, -20)} strokeWidth="3" strokeLinejoin="round" style={{ opacity: 0 }} />
            <g clipPath={`url(#${id("clip")})`}>
              <path ref={teethRef} d="M 0 0" fill="#f1ece3" style={{ opacity: 0 }} />
              <ellipse ref={tongueRef} cx={CX} cy={mouthY + 6} rx="7" ry="3" fill={shade(lips, 14)} style={{ opacity: 0 }} />
            </g>
          </g>

          {/* Hair front / hijab frame: slides a little with the turn */}
          <g ref={frontHairRef}>
            {showHair && p.hair_style === "spiky" && <path d={spikyPath} fill={`url(#${id("hair")})`} />}
            {showHair && (longHair || mediumHair) && <path d={sweptCapPath} fill={`url(#${id("hair")})`} />}
            {showHair && (p.hair_style === "short" || p.hair_style === "bun" || p.hair_style === "tied") && <path d={capPath} fill={`url(#${id("hair")})`} />}
            {showHair && p.hair_style === "curly" && (
              <>
                <path d={capPath} fill={`url(#${id("hair")})`} />
                {Array.from({ length: 11 }, (_, i) => {
                  const t = i / 10;
                  const ang = Math.PI * (1 + t);
                  const x = CX + Math.cos(ang) * (rx + 2);
                  const y = HEAD_CY + 2 + Math.sin(ang) * (HEAD_CY - g.top + 4);
                  return <circle key={i} cx={x} cy={y} r="13" fill={i % 2 ? hair : shade(hair, 16)} />;
                })}
              </>
            )}
            {showHair && p.hair_style === "bun" && (
              <>
                <circle cx={CX} cy={g.top - 26} r="17" fill={`url(#${id("hair")})`} />
                <path d={`M ${CX - 10} ${g.top - 32} Q ${CX} ${g.top - 42} ${CX + 10} ${g.top - 32}`} stroke={hairLight} strokeWidth="2" fill="none" opacity="0.6" />
              </>
            )}
            {/* highlight streak on the cap gives the hair its volume */}
            {showHair && p.hair_style !== "curly" && p.hair_style !== "spiky" && (
              <path d={`M ${CX - rx + 12} ${g.top + 6} Q ${CX - 24} ${g.top - 16} ${CX + 4} ${g.top - 12}`} stroke={hairLight} strokeWidth="6" strokeLinecap="round" fill="none" opacity="0.4" />
            )}
            {showHair && p.hair_style === "wavy" && (
              <path d={`M ${CX - rx - 8} 160 q 7 10 14 0 t 14 0 M ${CX + rx - 20} 160 q 7 10 14 0 t 14 0`} stroke={hairLight} strokeWidth="3" fill="none" opacity="0.35" />
            )}
            {p.hair_style === "bald" && !p.hijab && <ellipse cx={CX - 16} cy={g.top + 22} rx="16" ry="7" fill="#ffffff" opacity="0.22" />}
            {p.hijab && (
              <>
                <path d={hijabFramePath} fill={`url(#${id("hijab")})`} />
                <path d={`M ${CX - rx + 8} ${g.top - 8} Q ${CX} ${g.top - 26} ${CX + rx - 8} ${g.top - 8}`} stroke={shade(p.hijab_color, 50)} strokeWidth="3" fill="none" opacity="0.35" />
                <path d={`M ${CX - rx - 2} ${HEAD_CY + 30} Q ${CX - rx + 6} ${HEAD_CY + 70} ${CX - 20} 190`} stroke={shade(p.hijab_color, -40)} strokeWidth="2" fill="none" opacity="0.35" />
              </>
            )}
          </g>
        </g>
      </svg>
      {state === "thinking" && (
        <div className="absolute right-[16%] top-[12%] flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1.5 shadow-md" aria-label="Menyusun pertanyaan">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-700" style={{ animationDelay: `${i * 0.15}s`, animationDuration: "1s" }} />
          ))}
        </div>
      )}
    </div>
  );
};

export default EmojiAvatar;
