import { useEffect, useState } from "react";

import { createBridge } from "./bridge";
import { getCurrentTopic, listCards, type Card } from "./topic";

const bridge = createBridge();

export function App() {
  const [topic, setTopic] = useState<string | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [message, setMessage] = useState("");
  const [bridgeResult, setBridgeResult] = useState("");

  useEffect(() => {
    let active = true;
    getCurrentTopic()
      .then(async (topicid) => {
        if (!active) return;
        setTopic(topicid);
        if (!topicid) {
          setMessage("当前没有打开的学习集");
          return;
        }
        const items = await listCards(topicid);
        if (!active) return;
        setCards(items);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setMessage(error instanceof Error ? error.message : String(error));
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="panel">
      <header className="header">
        <h1>__PROJECT_TITLE__</h1>
        <button type="button" onClick={() => mn.fit()}>
          适配高度
        </button>
      </header>

      {message ? <p role="alert">{message}</p> : null}
      {topic ? <p className="topic">学习集：{topic}</p> : null}
      {__MN_NATIVE_BRIDGE__ ? (
        <section className="bridge">
          <button
            type="button"
            onClick={() => {
              bridge
                .ping({ from: "panel" })
                .then((result) => setBridgeResult(JSON.stringify(result)))
                .catch((error: unknown) =>
                  setBridgeResult(error instanceof Error ? error.message : String(error)),
                );
            }}
          >
            测试原生通道
          </button>
          {bridgeResult ? <output>{bridgeResult}</output> : null}
        </section>
      ) : null}

      <ul className="cards">
        {cards.map((card) => (
          <li key={card.noteid}>
            <span>{card.docPage === null ? "无页码" : `第 ${card.docPage} 页`}</span>
            <strong>{card.title}</strong>
          </li>
        ))}
      </ul>
    </main>
  );
}
