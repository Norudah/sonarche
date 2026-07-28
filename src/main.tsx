import React from "react";
import ReactDOM from "react-dom/client";

import App from "@/app/App";
import { applyStoredTheme } from "@/features/settings/theme";
import "@/app/globals.css";
import "@/app/i18n";

// Before the render, not inside it: the theme is an attribute on <html>, and
// letting React get there first means one frame of the light theme on a dark
// desktop. Reads localStorage synchronously, so there is nothing to wait for.
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
