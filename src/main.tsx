import * as React from "react";
import { createRoot } from "react-dom/client";
const w = window as any;
fetch("picks.json", { cache: "no-store" })
  .then((r: Response) => (r.ok ? r.json() : null))
  .then((j: any) => { if (j && Array.isArray(j.picks)) w.__PICKS = j; })
  .catch(() => {})
  .then(() => import("./App"))
  .then((m: any) => { const App = m.default; createRoot(document.getElementById("app")!).render(<App />); });
if ("serviceWorker" in navigator) window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
