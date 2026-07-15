import React from "react";
import ReactDOM from "react-dom/client";

import App from "@/app/App";
import "@/app/globals.css";
import "@/app/i18n";

if (import.meta.env.DEV && new URLSearchParams(window.location.search).has("mockTauri")) {
  const { installMockTauri } = await import("@/shared/lib/mockTauri");
  installMockTauri();
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
