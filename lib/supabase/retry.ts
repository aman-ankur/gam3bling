type SupabaseError = {
  message: string;
};

type SupabaseResult<T> = {
  data: T | null;
  error: SupabaseError | null;
};

type RetryOptions = {
  attempts?: number;
  delayMs?: number;
  label?: string;
};

const TRANSIENT_ERROR_PATTERNS = [
  "fetch failed",
  "econnreset",
  "etimedout",
  "eai_again",
  "networkerror",
  "socket hang up"
];

export async function withSupabaseRetry<T>(
  operation: () => PromiseLike<SupabaseResult<T>>,
  options: RetryOptions = {}
): Promise<SupabaseResult<T>> {
  const attempts = options.attempts ?? 4;
  const delayMs = options.delayMs ?? 250;
  let lastResult: SupabaseResult<T> | null = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = await operation();

    if (!result.error || !isTransientSupabaseError(result.error) || attempt === attempts) {
      return result;
    }

    lastResult = result;
    console.warn("[supabase.retry]", {
      attempt,
      attempts,
      label: options.label ?? "supabase",
      message: result.error.message
    });
    await sleep(delayMs * attempt);
  }

  return lastResult as SupabaseResult<T>;
}

export function isTransientSupabaseError(error: SupabaseError | null | undefined): boolean {
  const message = error?.message.toLowerCase() ?? "";

  return TRANSIENT_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

function sleep(delayMs: number): Promise<void> {
  if (delayMs <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}
