import "./para-ui.css";
import { initParaUI, type ParaUIController } from "./vanilla";

export * from "./vanilla";

declare global {
  interface Window {
    PARA_UI_MANUAL?: boolean;
    paraUI?: ParaUIController;
  }
}

function shouldAutoInit(): boolean {
  if (typeof document === "undefined" || typeof window === "undefined") return false;
  if (window.PARA_UI_MANUAL) return false;
  const scripts = document.querySelectorAll("script[src*='para-ui']");
  for (const s of scripts) {
    if (s.hasAttribute("data-para-manual")) return false;
    if (s.hasAttribute("data-para-auto")) return true;
  }
  // Auto-init if loaded via classic UMD script or if page has [data-para-ui]
  if (document.currentScript && !document.currentScript.hasAttribute("data-para-manual")) return true;
  if (document.querySelector("[data-para-ui], [data-para-auto]")) return true;
  return false;
}

if (typeof document !== "undefined") {
  const boot = () => {
    if (shouldAutoInit() && !window.paraUI) {
      window.paraUI = initParaUI();
    }
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
}
