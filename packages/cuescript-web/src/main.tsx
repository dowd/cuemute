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

createRoot(document.getElementById("root")!).render(
  <StrictMode>{id ? query.has("print") ? <PromptBook id={id} /> : <ProductionPage id={id} /> : <Library />}</StrictMode>,
);
