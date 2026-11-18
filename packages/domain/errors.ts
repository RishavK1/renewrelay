export class DomainError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fieldErrors?: Record<string, string[]>,
    readonly retryAfter = 60,
  ) {
    super(message);
  }
}

export function notFound(): never {
  throw new DomainError(404, "not_found", "The requested resource was not found.");
}

export function conflict(code: string, message: string): never {
  throw new DomainError(409, code, message);
}
