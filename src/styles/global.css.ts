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
  alignItems: "center",
  margin: 0,
  fontSize: "clamp(3.45rem, 12.5vw, 10.5rem)",
  fontWeight: 900,
  letterSpacing: "-0.075em",
  lineHeight: 0.72,
  textAlign: "center",
  textTransform: "uppercase",
});

export const word = style({
  display: "block",
  position: "relative",
  whiteSpace: "nowrap",
});

export const theWord = style({
  zIndex: 0,
  marginRight: "0.12em",
  color: "#343635",
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: "0.7em",
  fontStyle: "italic",
  fontWeight: 700,
  letterSpacing: "-0.08em",
  lineHeight: 0.78,
});

export const marcWord = style({
  zIndex: 2,
  clipPath: "inset(0 100% 0 0)",
  "@media": {
    "(prefers-reduced-motion: reduce)": { clipPath: "inset(0)" },
  },
});

export const hermannWord = style({
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
  width: "clamp(8.5rem, 28vw, 22rem)",
  height: "clamp(0.38rem, 0.8vw, 0.75rem)",
  background: "#f4d400",
  boxShadow: "0 0 1.2rem rgba(244, 212, 0, 0.15)",
  opacity: 0,
  pointerEvents: "none",
  willChange: "transform",
});

export const marcDash = style({ top: "calc(50% - clamp(0.2rem, 0.6vw, 0.5rem))" });
export const hermannDash = style({ top: "calc(50% + clamp(3.2rem, 8vw, 7rem))" });

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
