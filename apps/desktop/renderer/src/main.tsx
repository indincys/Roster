import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { useAppStore } from "./stores/app-store";
import "./styles.css";

if (import.meta.env.DEV || new URLSearchParams(window.location.search).get("e2e") === "1") {
  window.__ROSTER_STORE__ = useAppStore;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
