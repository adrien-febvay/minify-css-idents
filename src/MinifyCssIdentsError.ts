export class MinifyCssIdentsError extends Error {
  public constructor(message: string, cause?: unknown, capture?: (...args: any[]) => void) {
    super(MinifyCssIdentsError.message(message, cause));
    if (capture) {
      Error.captureStackTrace(this, capture);
    }
  }

  public static message(message: string, cause?: unknown) {
    return cause === void 0 ? message : `${message}\n  ${String(cause).replace(/\n/g, '\n  ')}`;
  }
}