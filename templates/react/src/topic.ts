export interface Card {
  noteid: string;
  title: string;
  docPage: number | null;
}

interface UiState {
  state?: {
    topicid?: string;
  };
}

interface TopicTree {
  nodes?: Array<{
    noteid?: string;
    title?: string;
    docPage?: number | null;
  }>;
}

export async function getCurrentTopic(): Promise<string | null> {
  const state = await mn.api<UiState>("/ui-state");
  if (state.error) {
    throw new Error(`${state.error.code}：${state.error.message}`);
  }
  return state.state?.topicid ?? null;
}

export async function listCards(topicid: string): Promise<Card[]> {
  const tree = await mn.api<TopicTree>(
    `/study-sets/${encodeURIComponent(topicid)}/tree?sort=document`,
  );
  if (tree.error) {
    throw new Error(`${tree.error.code}：${tree.error.message}`);
  }

  return (tree.nodes ?? []).flatMap((node) => {
    if (typeof node.noteid !== "string") return [];
    return [
      {
        noteid: node.noteid,
        title: node.title ?? "无标题",
        docPage: node.docPage ?? null,
      },
    ];
  });
}
