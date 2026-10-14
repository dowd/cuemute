import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { CueSheet } from "./components/CueSheet.tsx";
import { useSnapshot } from "./useSnapshot.ts";
import "./styles.css";

// ?print is the paper cue sheet: its own page, so Space never fires GO there
function PrintPage() {
  const { snapshot } = useSnapshot();
  return snapshot ? <CueSheet snapshot={snapshot} /> : <div className="loading">Connecting to cuemute…</div>;
}

const printing = new URLSearchParams(location.search).has("print");

createRoot(document.getElementById("root")!).render(
  <StrictMode>{printing ? <PrintPage /> : <App />}</StrictMode>,
);
