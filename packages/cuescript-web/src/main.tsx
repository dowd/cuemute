import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Library } from "./components/Library.tsx";
import { ProductionPage } from "./components/ProductionPage.tsx";
import { PromptBook } from "./components/PromptBook.tsx";
import "./styles.css";

// ?p=<id> opens a production, and ?p=<id>&print its prompt book to print;
// without them, the library lists every production
const query = new URLSearchParams(location.search);
const id = query.get("p");

// Keeps the app and the productions read on this device, for reading offline.
// Browsers allow it only on HTTPS or localhost; elsewhere it isn't there. Not
// in development, where it would serve old copies of the files being changed.
if (import.meta.env.PROD && "serviceWorker" in navigator && window.isSecureContext) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>{id ? query.has("print") ? <PromptBook id={id} /> : <ProductionPage id={id} /> : <Library />}</StrictMode>,
);
