import React from "react";
import ReactDOM from "react-dom/client";

import App from "@/app/App";
import "@/app/globals.css";
import "@/app/i18n";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
