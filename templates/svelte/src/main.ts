import { mount } from "svelte";

import App from "./App.svelte";
import "./app.css";

const host = document.getElementById("app");
if (!host) {
  throw new Error("index.html 缺少 #app 挂载点");
}

mount(App, { target: host });
