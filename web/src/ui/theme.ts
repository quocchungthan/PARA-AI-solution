import { signal } from "@preact/signals-react";

function readInitialDark(): boolean {
  if (typeof document !== "undefined") {
    const attr = document.documentElement.dataset.theme;
    if (attr === "light") return false;
    if (attr === "dark") return true;
  }
  if (typeof localStorage !== "undefined") {
    try {
      const saved = localStorage.getItem("bridge-theme") ?? localStorage.getItem("para-theme");
      if (saved === "light") return false;
      if (saved === "dark") return true;
    } catch {
      /* ignore storage errors */
    }
  }
  return true;
}

export const dark = signal<boolean>(readInitialDark());
export const skipSplash = signal<boolean>(false);

if (typeof document !== "undefined" && typeof MutationObserver !== "undefined") {
  const syncFromDom = () => {
    const attr = document.documentElement.dataset.theme;
    if (attr === "light" && dark.peek()) dark.value = false;
    else if (attr === "dark" && !dark.peek()) dark.value = true;
  };
  const observer = new MutationObserver(syncFromDom);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}

export function setTheme(mode: "dark" | "light") {
  dark.value = mode === "dark";
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = mode;
  }
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem("bridge-theme", mode);
    } catch {
      /* ignore storage errors */
    }
  }
}

export function toggleParaTheme(): "dark" | "light" {
  const next = dark.value ? "light" : "dark";
  setTheme(next);
  return next;
}
