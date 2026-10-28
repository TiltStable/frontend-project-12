import ReactDOM from "react-dom/client";
import { io } from "socket.io-client";

import initMonitoring, { reportError } from "./monitoring.js";
import init from "./init.jsx";

initMonitoring();

const app = async () => {
  const root = ReactDOM.createRoot(document.querySelector("#chat"));
  const socket = io();
  root.render(await init(socket));
};

app().catch((error) => {
  reportError(error);
  console.error("Failed to start the app:", error);
  const rootEl = document.querySelector("#chat");
  if (rootEl) {
    rootEl.textContent = "App failed to start. See browser console for details.";
  }
});
