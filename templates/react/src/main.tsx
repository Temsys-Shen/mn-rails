import { createRoot } from "react-dom/client";

import { App } from "./App";
import "./app.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("index.html 缺少 #root 挂载点");
}

createRoot(root).render(<App />);
