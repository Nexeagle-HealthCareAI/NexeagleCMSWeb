// After a deploy, the code files of the previous build are gone. A tab opened before the deploy
// still asks for them when it first needs a lazily loaded part (the Word preview, a page), and
// gets 404. Vite reports that as "vite:preloadError": reload once to pick up the new build.
// The time guard stops a reload loop if the file is missing for some other reason.

const KEY = 'cms.staleBuildReloadAt';
const WINDOW_MS = 60_000;

export function shouldReloadForStaleBuild(now: number, lastReloadAt: number | null): boolean {
  return lastReloadAt == null || now - lastReloadAt > WINDOW_MS;
}

export function installStaleBuildReload(win: Window = window): void {
  win.addEventListener('vite:preloadError', (event) => {
    let last: number | null = null;
    try { const v = win.sessionStorage.getItem(KEY); last = v ? Number(v) : null; } catch { /* storage off */ }
    const now = Date.now();
    if (!shouldReloadForStaleBuild(now, last)) return;
    try { win.sessionStorage.setItem(KEY, String(now)); } catch { /* storage off */ }
    event.preventDefault();
    win.location.reload();
  });
}
