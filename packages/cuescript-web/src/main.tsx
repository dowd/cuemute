import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Library } from "./components/Library.tsx";
import { ProductionPage } from "./components/ProductionPage.tsx";
import "./styles.css";

// ?p=<id> opens a production; without it, the library lists them all
const id = new URLSearchParams(location.search).get("p");

createRoot(document.getElementById("root")!).render(
  <StrictMode>{id ? <ProductionPage id={id} /> : <Library />}</StrictMode>,
);
