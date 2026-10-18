<script lang="ts">
  import { onMount } from "svelte";

  import { createBridge } from "./bridge";
  import { getCurrentTopic, listCards, type Card } from "./topic";

  const bridge = createBridge();
  let topic: string | null = null;
  let cards: Card[] = [];
  let message = "";
  let bridgeResult = "";

  onMount(async () => {
    try {
      const topicid = await getCurrentTopic();
      topic = topicid;
      if (!topicid) {
        message = "当前没有打开的学习集";
        return;
      }
      cards = await listCards(topicid);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
  });

  async function testBridge() {
    try {
      bridgeResult = JSON.stringify(await bridge.ping({ from: "panel" }));
    } catch (error) {
      bridgeResult = error instanceof Error ? error.message : String(error);
    }
  }
</script>

<main class="panel">
  <header class="header">
    <h1>__PROJECT_TITLE__</h1>
    <button type="button" onclick={() => mn.fit()}>适配高度</button>
  </header>

  {#if message}
    <p role="alert">{message}</p>
  {/if}
  {#if topic}
    <p class="topic">学习集：{topic}</p>
  {/if}
  {#if __MN_NATIVE_BRIDGE__}
    <section class="bridge">
    <button type="button" onclick={testBridge}>测试原生通道</button>
    {#if bridgeResult}
      <output>{bridgeResult}</output>
    {/if}
    </section>
  {/if}

  <ul class="cards">
    {#each cards as card (card.noteid)}
      <li>
        <span>{card.docPage === null ? "无页码" : `第 ${card.docPage} 页`}</span>
        <strong>{card.title}</strong>
      </li>
    {/each}
  </ul>
</main>
