import React from "react";
import ReactDOM from "react-dom/client";

import App from "@/app/App";
import { applyStoredTheme } from "@/features/settings/theme";
import "@/app/globals.css";
import "@/app/i18n";

// Before the first render, to avoid a frame of the wrong theme.
applyStoredTheme();

if (import.meta.env.DEV && new URLSearchParams(window.location.search).has("mockTauri")) {
  const { installMockTauri } = await import("@/shared/lib/mockTauri");
  installMockTauri();
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
