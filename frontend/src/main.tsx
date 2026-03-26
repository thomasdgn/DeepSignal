import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { DeepSignalPrivyProvider } from "./privy";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DeepSignalPrivyProvider>
      <App />
    </DeepSignalPrivyProvider>
  </React.StrictMode>,
);
