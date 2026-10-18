interface MnError {
  code: string;
  message: string;
  retryable?: boolean;
}

type MnResponse<T> = T & {
  error?: MnError;
};

interface Mn {
  readonly version: number;
  readonly currentMode: "workspace" | "mini";
  readonly lang: string;
  readonly locale: string;
  readonly theme: "light" | "dark";
  api<T>(path: string, options?: RequestInit): Promise<MnResponse<T>>;
  ai(noteid: string, taskId: string, params: unknown): Promise<unknown>;
  call<T>(name: string, data?: unknown): Promise<T>;
  on(event: string, callback: (data: unknown) => void): void;
  fit(): void;
  height(height: number): void;
  size(width: number, height: number): void;
  mode(mode: "workspace" | "mini"): void;
  close(): void;
  reload(): void;
  log(...args: unknown[]): void;
}

declare const mn: Mn;

interface Window {
  mn: Mn;
}

declare const __MN_NATIVE_BRIDGE__: boolean;
