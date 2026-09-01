"use client";

import { useEffect } from "react";

export function LiveMobileViewportAnchor() {
  useEffect(() => {
    const viewport = window.visualViewport;
    const shell = document.querySelector<HTMLElement>("[data-live-mobile-viewport]");
    if (!viewport || !shell) return;

    const syncVisualViewport = () => {
      shell.style.top = `${Math.round(viewport.offsetTop)}px`;
      shell.style.height = `${Math.round(viewport.height)}px`;
      shell.style.bottom = "auto";
    };

    syncVisualViewport();
    viewport.addEventListener("resize", syncVisualViewport);
    viewport.addEventListener("scroll", syncVisualViewport);

    return () => {
      viewport.removeEventListener("resize", syncVisualViewport);
      viewport.removeEventListener("scroll", syncVisualViewport);
      shell.style.removeProperty("top");
      shell.style.removeProperty("height");
      shell.style.removeProperty("bottom");
    };
  }, []);

  return null;
}
