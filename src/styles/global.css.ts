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
  overflowX: "hidden",
  overflowY: "auto",
  scrollBehavior: "smooth",
  background: "#090a0a",
  "@media": {
    "(prefers-reduced-motion: reduce)": { scrollBehavior: "auto" },
  },
});

globalStyle("body", {
  minHeight: "100vh",
  margin: 0,
  overflowX: "hidden",
  background: "#090a0a",
  color: "#f2f0e9",
});

globalStyle("::selection", { background: "#f4d400", color: "#090a0a" });

export const appBar = style({
  position: "fixed",
  top: 0,
  right: 0,
  left: 0,
  zIndex: 20,
  borderBottom: "1px solid rgba(242, 240, 233, 0.12)",
  background: "rgba(9, 10, 10, 0.92)",
  backdropFilter: "blur(12px)",
  opacity: 0,
  pointerEvents: "none",
  transform: "translateY(-100%)",
  visibility: "hidden",
  transition: "transform 280ms ease, opacity 220ms ease",
  selectors: {
    '&[data-visible="true"]': {
      opacity: 1,
      pointerEvents: "auto",
      transform: "translateY(0)",
      visibility: "visible",
    },
  },
  "@media": {
    "(prefers-reduced-motion: reduce)": { transition: "none" },
  },
});

export const appBarInner = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1rem 1.5rem",
  width: "min(100%, 76rem)",
  minHeight: "3.5rem",
  margin: "0 auto",
  padding: "0.7rem clamp(1rem, 4vw, 3rem)",
  "@media": {
    "screen and (max-width: 38rem)": {
      flexWrap: "wrap",
      gap: "0.35rem 1rem",
      minHeight: "auto",
      paddingTop: "0.55rem",
      paddingBottom: "0.55rem",
    },
  },
});

const navigationRow = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
} as const;

export const sectionNav = style({
  ...navigationRow,
  gap: "1.25rem",
});

export const appBarSocials = style({
  ...navigationRow,
  justifyContent: "flex-end",
  gap: "1rem",
  "@media": {
    "screen and (max-width: 38rem)": { gap: "0.75rem" },
  },
});

export const socialIconLink = style({
  display: "grid",
  width: "2rem",
  height: "2rem",
  padding: 0,
  placeItems: "center",
});

export const socialIcon = style({
  display: "block",
  width: "1rem",
  height: "1rem",
  flexShrink: 0,
  backgroundColor: "currentColor",
  maskImage: "var(--social-icon)",
  maskPosition: "center",
  maskRepeat: "no-repeat",
  maskSize: "contain",
});

export const appBarLink = style({
  color: "#a8a49b",
  fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  fontSize: "0.72rem",
  fontWeight: 700,
  letterSpacing: "0.08em",
  lineHeight: 1.1,
  textDecoration: "none",
  textTransform: "uppercase",
  transition: "color 160ms ease",
  selectors: {
    "&:hover": { color: "#f4d400" },
    "&:focus-visible": { color: "#f2f0e9", outline: "2px solid #f4d400", outlineOffset: "0.25rem" },
  },
  "@media": {
    "screen and (max-width: 38rem)": { fontSize: "0.65rem" },
    "(prefers-reduced-motion: reduce)": { transition: "none" },
  },
});

/**
 * Page texture, in two fixed layers behind the type.
 *
 * `::before` is film grain: an feTurbulence tile inlined as a data URI, so it
 * costs no request and tiles at 180px. Kept very faint — enough to break the
 * flat fill into something that reads as stock, not enough to buzz.
 *
 * `::after` is a vignette plus a soft warm lift low and left, where the fire
 * sits, so the field feels lit by the splash rather than evenly painted.
 */
globalStyle("body::before", {
  content: '""',
  position: "fixed",
  inset: 0,
  zIndex: 0,
  pointerEvents: "none",
  opacity: 0.05,
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)'/%3E%3C/svg%3E\")",
  backgroundRepeat: "repeat",
  backgroundSize: "180px 180px",
});

globalStyle("body::after", {
  content: '""',
  position: "fixed",
  inset: 0,
  zIndex: 0,
  pointerEvents: "none",
  backgroundImage:
    "radial-gradient(58% 42% at 26% 78%, rgba(255, 138, 0, 0.05) 0%, rgba(255, 138, 0, 0) 68%), radial-gradient(110% 85% at 50% 42%, rgba(0, 0, 0, 0) 42%, rgba(0, 0, 0, 0.5) 100%)",
});

export const main = style({
  position: "relative",
  zIndex: 1,
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
  fontSize: "clamp(3.8rem, 13.5vw, 11.25rem)",
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
    "radial-gradient(ellipse at 24% 48%, rgba(25,27,25,0.82) 0 2.2%, rgba(35,37,34,0.58) 3.8%, transparent 7.2%), radial-gradient(ellipse at 73% 63%, rgba(29,31,28,0.78) 0 1.8%, rgba(42,44,40,0.48) 3.4%, transparent 6.5%), radial-gradient(ellipse at 12% 26%, rgba(39,41,38,0.9) 0 0.8%, transparent 3.3%), radial-gradient(ellipse at 37% 71%, rgba(49,51,47,0.82) 0 0.7%, transparent 2.7%), radial-gradient(ellipse at 66% 29%, rgba(34,36,34,0.8) 0 0.6%, transparent 2.5%), radial-gradient(ellipse at 88% 69%, rgba(44,46,43,0.85) 0 0.9%, transparent 3.1%), repeating-linear-gradient(103deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 17px), linear-gradient(180deg, #8b8c86 0%, #747570 48%, #60625e 100%)",
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
  width: "clamp(1.75rem, 4.5vw, 3.5rem)",
  height: "clamp(0.28rem, 0.58vw, 0.58rem)",
  borderRadius: "9999px",
  /**
   * drop-shadow follows the alpha of the gradient below, so the glow dies away
   * with the tail. box-shadow would ring the whole capsule and undo the fade.
   */
  filter:
    "drop-shadow(0 0 0.26rem rgba(255, 224, 0, 0.62)) drop-shadow(0 0 0.8rem rgba(244, 120, 0, 0.3))",
  opacity: 0,
  pointerEvents: "none",
  willChange: "transform",
});

/**
 * Solid at the nose, dissolving down the length like a beam of light. The two
 * dashes fly in opposite directions, so each has to fade away from its own nose.
 */
globalStyle('[data-projectile="marc-dash"]', {
  backgroundImage:
    "linear-gradient(to right, rgba(244,212,0,0) 0%, rgba(244,212,0,0.28) 52%, rgba(255,236,120,1) 100%)",
});

globalStyle('[data-projectile="hermann-dash"]', {
  backgroundImage:
    "linear-gradient(to left, rgba(244,212,0,0) 0%, rgba(244,212,0,0.28) 52%, rgba(255,236,120,1) 100%)",
});

export const particles = style({
  position: "fixed",
  inset: 0,
  zIndex: 6,
  width: "100vw",
  height: "100vh",
  pointerEvents: "none",
});

globalStyle('[data-signature-splash][data-motion="reduced"] [data-projectile]', {
  display: "none",
});

globalStyle('[data-signature-splash][data-motion="reduced"] canvas', { display: "none" });

/**
 * Sits unlit — dark grey against the near-black field, present but not legible —
 * until the embers dripping off the H set it alight and `data-lit` flips.
 *
 * Because that leaves it below any sane contrast ratio while unlit, three
 * escape hatches keep it reachable: hover and keyboard focus both light it, and
 * reduced-motion users get it legible immediately, since for them no ember is
 * ever going to arrive.
 */
export const aboutButton = style({
  display: "inline-flex",
  position: "relative",
  alignItems: "center",
  gap: "0.3em",
  marginTop: "clamp(1.75rem, 5vw, 3.5rem)",
  padding: "0.72em 0.75em",
  borderRadius: "1rem",
  color: "#171918",
  fontSize: "clamp(0.7rem, 1.4vw, 0.95rem)",
  fontWeight: 700,
  letterSpacing: "0.3em",
  lineHeight: 1.1,
  textDecoration: "none",
  textTransform: "uppercase",
  transition: "color 900ms ease, text-shadow 900ms ease",
  selectors: {
    "&:hover": { color: "#70736f" },
    "&:focus-visible": {
      color: "#f2f0e9",
      outline: "2px solid #f4d400",
      outlineOffset: "0.4rem",
    },
    '&[data-lit="true"]': {
      color: "#ffcf8a",
      textShadow: "0 0 0.55rem rgba(255, 138, 0, 0.5), 0 0 1.5rem rgba(255, 61, 0, 0.3)",
    },
  },
  "@media": {
    "(prefers-reduced-motion: reduce)": { color: "#a8a49b", transition: "none" },
  },
});

export const aboutOutline = style({
  position: "absolute",
  inset: 0,
  border: "1px solid transparent",
  borderRadius: "inherit",
  pointerEvents: "none",
});

export const aboutLabel = style({
  position: "relative",
  zIndex: 7,
  display: "inline-block",
});

export const aboutArrow = style({
  display: "block",
  position: "relative",
  zIndex: 7,
  flexShrink: 0,
});

export const prose = style({
  maxWidth: "min(92vw, 42rem)",
  margin: "0 auto",
  padding: "clamp(4rem, 12vh, 9rem) clamp(1rem, 4vw, 3rem)",
  color: "#a8a49b",
  fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  fontSize: "clamp(1rem, 1.8vw, 1.15rem)",
  lineHeight: 1.5,
  scrollMarginTop: "5rem",
});

globalStyle(`${prose} p`, { margin: "0 0 1.4em" });

globalStyle(`${prose} s`, { color: "#5f625e", textDecorationThickness: "1px" });

export const aboutHeader = style({
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: "1.5rem",
  marginBottom: "1.6rem",
});

export const proseTitle = style({
  margin: "0 0 1.6rem",
  color: "#f2f0e9",
  fontFamily: 'Arial Black, "Helvetica Neue", Helvetica, Arial, sans-serif',
  fontSize: "clamp(1.6rem, 4vw, 2.6rem)",
  fontWeight: 900,
  letterSpacing: "-0.03em",
  lineHeight: 1.05,
  textTransform: "uppercase",
});

export const aboutTitle = style({ margin: 0 });

export const portraitFrame = style({
  width: "clamp(5.5rem, 16vw, 7.5rem)",
  aspectRatio: "1",
  overflow: "hidden",
  flexShrink: 0,
  border: "3px solid #f2f0e9",
  borderRadius: "50%",
  background: "#f2f0e9",
});

export const portrait = style({
  display: "block",
  width: "100%",
  height: "100%",
  objectFit: "cover",
  objectPosition: "52% 40%",
  transform: "scale(1.35)",
  transformOrigin: "52% 40%",
});

export const proseLink = style({
  color: "#f4d400",
  textDecorationColor: "rgba(244, 212, 0, 0.4)",
  textUnderlineOffset: "0.2em",
  selectors: {
    "&:hover": { textDecorationColor: "#f4d400" },
    "&:focus-visible": { outline: "2px solid #f4d400", outlineOffset: "0.2rem" },
  },
});

export const aboutSocials = style({
  display: "flex",
  flexWrap: "wrap",
  gap: "0.75rem 1.25rem",
  marginTop: "2.5rem",
  paddingTop: "1.5rem",
  borderTop: "1px solid rgba(242, 240, 233, 0.12)",
});

export const socialLink = style({
  display: "inline-flex",
  alignItems: "center",
  gap: "0.45rem",
  color: "#f2f0e9",
  fontSize: "0.78rem",
  fontWeight: 700,
  letterSpacing: "0.08em",
  lineHeight: 1.1,
  textDecoration: "none",
  textTransform: "uppercase",
  transition: "color 160ms ease",
  selectors: {
    "&:hover": { color: "#f4d400" },
    "&:focus-visible": { color: "#f4d400", outline: "2px solid #f4d400", outlineOffset: "0.25rem" },
  },
  "@media": {
    "(prefers-reduced-motion: reduce)": { transition: "none" },
  },
});

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
  // Absolute, not fixed: the page scrolls now, and a pinned mark would ride
  // down over the About copy.
  position: "absolute",
  right: "clamp(1rem, 2.5vw, 2rem)",
  bottom: "clamp(1rem, 2.5vw, 2rem)",
  margin: 0,
  color: "#555856",
  fontFamily: 'ui-monospace, "SFMono-Regular", Consolas, monospace',
  fontSize: "0.62rem",
  letterSpacing: "0.18em",
  lineHeight: 1.1,
  textTransform: "uppercase",
});
