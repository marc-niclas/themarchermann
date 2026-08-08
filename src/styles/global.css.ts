import { globalStyle, keyframes, style } from "@vanilla-extract/css";

globalStyle(":root", {
  colorScheme: "dark",
  fontFamily: 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontSynthesis: "none",
  textRendering: "optimizeLegibility",
});

globalStyle("*", {
  boxSizing: "border-box",
});

globalStyle("html", {
  minHeight: "100%",
  background: "#08090c",
});

globalStyle("body", {
  minHeight: "100vh",
  margin: 0,
  background:
    "radial-gradient(circle at 20% 15%, rgba(100, 126, 255, 0.16), transparent 32rem), #08090c",
  color: "#f5f7ff",
});

globalStyle("::selection", {
  background: "#f5f7ff",
  color: "#08090c",
});

export const main = style({
  display: "grid",
  minHeight: "100vh",
  placeItems: "center",
  padding: "clamp(1.5rem, 5vw, 4rem)",
});

export const content = style({
  width: "min(100%, 64rem)",
});

export const domain = style({
  margin: "0 0 1.25rem",
  color: "#9299ad",
  fontSize: "0.75rem",
  fontWeight: 600,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
});

export const heading = style({
  maxWidth: "12ch",
  margin: 0,
  fontSize: "clamp(3.5rem, 13vw, 10rem)",
  fontWeight: 650,
  letterSpacing: "-0.065em",
  lineHeight: 0.88,
});

const constructionPulse = keyframes({
  from: {
    opacity: 0.45,
    transform: "scaleX(0.55)",
    transformOrigin: "left",
  },
  to: {
    opacity: 1,
    transform: "scaleX(1)",
    transformOrigin: "left",
  },
});

export const accent = style({
  display: "block",
  width: "clamp(4rem, 10vw, 8rem)",
  height: "0.3rem",
  marginTop: "2.5rem",
  borderRadius: "999px",
  background: "linear-gradient(90deg, #657dff, #a3ffdf)",
  "@media": {
    "(prefers-reduced-motion: no-preference)": {
      animation: `${constructionPulse} 3s ease-in-out infinite alternate`,
    },
  },
});
