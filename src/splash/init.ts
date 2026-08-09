import { startSignatureSplash } from "./controller";
import { resolveTimeScale } from "./debug";

const timeScale = import.meta.env.DEV ? resolveTimeScale(window.location.search) : 1;

if (import.meta.env.DEV && timeScale !== 1) {
  console.info(`[splash] slow motion: ${(1 / timeScale).toFixed(2)}x slower`);
}

const splash = document.querySelector<HTMLElement>("[data-signature-splash]");
if (splash) startSignatureSplash(splash, { timeScale });
