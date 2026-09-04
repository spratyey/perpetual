import ReactDOM from "react-dom/client";
import PerpetualApp from "./components/editor/perpetual-app";
import { Toaster } from "./components/ui/toaster";
import "./globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <>
    <PerpetualApp />
    <Toaster />
  </>
);
