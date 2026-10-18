export class MnRailsError extends Error {
  readonly hint: string | undefined;

  constructor(message: string, hint?: string) {
    super(message);
    this.name = "MnRailsError";
    this.hint = hint;
  }
}

export function fail(message: string, hint?: string): never {
  throw new MnRailsError(message, hint);
}
