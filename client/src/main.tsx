import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initializeFirebase } from "./lib/firebase";

initializeFirebase();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(<App />);
