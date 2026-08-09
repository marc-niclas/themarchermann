import { globalStyle, style } from "@vanilla-extract/css";

globalStyle(":root", {
  colorScheme: "dark",
  fontFamily: 'Arial Black, "Helvetica Neue", Helvetica, Arial, sans-serif',
  fontSynthesis: "none",
  textRendering: "geometricPrecision",
});

globalStyle("*", { boxSizing: "border-box" });

globalStyle("html", {
  minHeight: "100%",
  overflow: "hidden",
  background: "#090a0a",
});

globalStyle("body", {
  minHeight: "100vh",
  margin: 0,
  overflow: "hidden",
  background: "#090a0a",
  color: "#f2f0e9",
});

globalStyle("::selection", { background: "#f4d400", color: "#090a0a" });

export const main = style({
  display: "grid",
  minHeight: "100svh",
  placeItems: "center",
  padding: "clamp(1rem, 4vw, 3rem)",
  isolation: "isolate",
});

export const splash = style({
  position: "relative",
  width: "min(92vw, 76rem)",
});

export const heading = style({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  margin: 0,
  fontSize: "clamp(3.45rem, 12.5vw, 10.5rem)",
  fontWeight: 900,
  letterSpacing: "-0.075em",
  lineHeight: 0.72,
  textAlign: "left",
  textTransform: "uppercase",
});

export const word = style({
  display: "block",
  position: "relative",
  whiteSpace: "nowrap",
});

export const theWord = style({
  zIndex: 0,
  color: "#343635",
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: "0.7em",
  fontStyle: "italic",
  fontWeight: 700,
  letterSpacing: "-0.08em",
  lineHeight: 0.78,
});

const sootTexture = {
  color: "#747570",
  backgroundImage:
    "radial-gradient(ellipse at 12% 26%, rgba(39,41,38,0.9) 0 0.8%, transparent 3.3%), radial-gradient(ellipse at 37% 71%, rgba(49,51,47,0.82) 0 0.7%, transparent 2.7%), radial-gradient(ellipse at 66% 29%, rgba(34,36,34,0.8) 0 0.6%, transparent 2.5%), radial-gradient(ellipse at 88% 69%, rgba(44,46,43,0.85) 0 0.9%, transparent 3.1%), repeating-linear-gradient(103deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 17px), linear-gradient(180deg, #8b8c86 0%, #747570 48%, #60625e 100%)",
  backgroundClip: "text",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  textShadow: "0 1px 0 rgba(255,255,255,0.02), 0 4px 16px rgba(0,0,0,0.42)",
} as const;

export const marcWord = style({
  ...sootTexture,
  zIndex: 2,
  clipPath: "inset(0 100% 0 0)",
  "@media": {
    "(prefers-reduced-motion: reduce)": { clipPath: "inset(0)" },
  },
});

export const hermannWord = style({
  ...sootTexture,
  zIndex: 2,
  fontSize: "0.86em",
  clipPath: "inset(0 0 0 100%)",
  "@media": {
    "(prefers-reduced-motion: reduce)": { clipPath: "inset(0)" },
  },
});

export const projectile = style({
  position: "fixed",
  left: 0,
  zIndex: 3,
  width: "clamp(3.5rem, 9vw, 7rem)",
  height: "clamp(0.28rem, 0.58vw, 0.58rem)",
  background: "#f4d400",
  boxShadow: "0 0 0.35rem rgba(255, 224, 0, 0.72), 0 0 1.1rem rgba(244, 120, 0, 0.28)",
  opacity: 0,
  pointerEvents: "none",
  willChange: "transform",
});

export const particles = style({
  position: "fixed",
  inset: 0,
  zIndex: 4,
  width: "100vw",
  height: "100vh",
  pointerEvents: "none",
});

globalStyle('[data-signature-splash][data-motion="reduced"] [data-projectile]', {
  display: "none",
});

globalStyle('[data-signature-splash][data-motion="reduced"] canvas', { display: "none" });

export const screenReaderText = style({
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
});

export const visualWords = style({ display: "contents" });

export const cornerMark = style({
  position: "fixed",
  right: "clamp(1rem, 2.5vw, 2rem)",
  bottom: "clamp(1rem, 2.5vw, 2rem)",
  margin: 0,
  color: "#555856",
  fontFamily: 'ui-monospace, "SFMono-Regular", Consolas, monospace',
  fontSize: "0.62rem",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
});
