import { startAppBar } from "./app-bar";

const bar = document.querySelector<HTMLElement>("[data-app-bar]");
const splash = document.querySelector<HTMLElement>("[data-splash-page]");

if (bar && splash) startAppBar(bar, splash);
