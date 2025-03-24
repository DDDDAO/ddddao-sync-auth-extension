import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import Popup from "./popup";
import { Toaster } from "sonner";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <div>
      <Toaster position="top-right" duration={2000} richColors />
      <Popup />
    </div>
  </React.StrictMode>
);
