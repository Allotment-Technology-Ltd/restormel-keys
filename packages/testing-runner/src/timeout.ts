export class TimeoutError extends Error {
  readonly code = "TIMEOUT" as const;
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  if (!Number.isFinite(ms) || ms <= 0) {
    return promise;
  }
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => {
      reject(new TimeoutError(`${label} exceeded ${ms}ms`));
    }, ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}
