import { createApp } from "vue";

import App from "./App.vue";
import AppHybrid from "./AppHybrid.vue";
import "./app.css";

const host = document.getElementById("app");
if (!host) {
  throw new Error("index.html 缺少 #app 挂载点");
}

createApp(__MN_NATIVE_BRIDGE__ ? AppHybrid : App).mount(host);
