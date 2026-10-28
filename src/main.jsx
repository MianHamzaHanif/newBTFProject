import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import TestnetPortal from "./TestnetPortal.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode><TestnetPortal /></StrictMode>,
);
