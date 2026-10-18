<script setup lang="ts">
import { onMounted, ref } from "vue";

import { createBridge } from "./bridge";
import { getCurrentTopic, listCards, type Card } from "./topic";

const bridge = createBridge();
const topic = ref<string | null>(null);
const cards = ref<Card[]>([]);
const message = ref("");
const bridgeResult = ref("");

onMounted(async () => {
  try {
    const topicid = await getCurrentTopic();
    topic.value = topicid;
    if (!topicid) {
      message.value = "当前没有打开的学习集";
      return;
    }
    cards.value = await listCards(topicid);
  } catch (error) {
    message.value = error instanceof Error ? error.message : String(error);
  }
});

async function testBridge() {
  try {
    bridgeResult.value = JSON.stringify(await bridge.ping({ from: "panel" }));
  } catch (error) {
    bridgeResult.value = error instanceof Error ? error.message : String(error);
  }
}

function fit() {
  mn.fit();
}
</script>

<template>
  <main class="panel">
    <header class="header">
      <h1>__PROJECT_TITLE__</h1>
      <button type="button" @click="fit">适配高度</button>
    </header>

    <p v-if="message" role="alert">{{ message }}</p>
    <p v-if="topic" class="topic">学习集：{{ topic }}</p>
    <section class="bridge">
      <button type="button" @click="testBridge">测试原生通道</button>
      <output v-if="bridgeResult">{{ bridgeResult }}</output>
    </section>

    <ul class="cards">
      <li v-for="card in cards" :key="card.noteid">
        <span>{{ card.docPage === null ? "无页码" : `第 ${card.docPage} 页` }}</span>
        <strong>{{ card.title }}</strong>
      </li>
    </ul>
  </main>
</template>
