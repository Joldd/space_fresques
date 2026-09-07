// components/theme-toggle.tsx
"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";

const noopSubscribe = () => () => {};

/** true une fois hydraté côté client — évite tout mismatch SSR/CSR sans passer par un effet */
function useIsClient() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isClient = useIsClient();
  const buttonClass =
    "flex h-9 w-9 items-center justify-center rounded-full text-lg hover:bg-sand-dark/60 transition-colors";

  if (!isClient) {
    return (
      <button aria-label="Changer de thème" className={buttonClass} style={{ visibility: "hidden" }}>
        🌙
      </button>
    );
  }

  return (
    <button
      aria-label="Changer de thème"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className={buttonClass}
    >
      {resolvedTheme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
