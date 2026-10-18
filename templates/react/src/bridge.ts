export interface PanelCommand {
  ping(payload?: unknown): Promise<{ ok: true; payload: unknown }>;
}

export function createBridge(): PanelCommand {
  return {
    ping(payload) {
      return mn.call("ping", payload);
    },
  };
}
