export class MinifiyCssIdentsError extends Error {
  public constructor(message: string, cause?: unknown, capture?: (this: unknown, ...args: any[]) => void) {
    super(MinifiyCssIdentsError.message(message, cause));
    if (capture) {
      Error.captureStackTrace(this, capture);
    }
  }

  public static message(message: string, cause?: unknown) {
    return `${message}\n  ${String(cause).replace(/\n/g, '\n  ')}`;
  }
}
