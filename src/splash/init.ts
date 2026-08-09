import { startSignatureSplash } from "./controller";

const splash = document.querySelector<HTMLElement>("[data-signature-splash]");
if (splash) startSignatureSplash(splash);
