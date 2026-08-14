export const APP_BAR_REVEAL_OFFSET = 96;

export function shouldShowAppBar(splashBottom: number): boolean {
  return splashBottom <= APP_BAR_REVEAL_OFFSET;
}

export function startAppBar(bar: HTMLElement, splash: HTMLElement): () => void {
  let frame = 0;

  const update = () => {
    frame = 0;
    bar.dataset.visible = String(shouldShowAppBar(splash.getBoundingClientRect().bottom));
  };
  const scheduleUpdate = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(update);
  };

  update();
  window.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("resize", scheduleUpdate, { passive: true });

  return () => {
    if (frame) window.cancelAnimationFrame(frame);
    window.removeEventListener("scroll", scheduleUpdate);
    window.removeEventListener("resize", scheduleUpdate);
  };
}
