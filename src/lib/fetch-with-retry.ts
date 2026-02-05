/**
 * Fetch wrapper with exponential backoff retry logic
 */

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_429_MAX_RETRIES = 10;
const DEFAULT_INITIAL_DELAY_MS = 1000;
const DEFAULT_MAX_DELAY_MS = 8000;

interface FetchWithRetryOptions extends RequestInit {
  maxRetries?: number;
  max429Retries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
}

/**
 * Sleep for a given number of milliseconds, respecting abort signal
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const timeout = setTimeout(resolve, ms);

    signal?.addEventListener("abort", () => {
      clearTimeout(timeout);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

/**
 * Calculate exponential backoff delay
 */
function getBackoffDelay(attempt: number, initialDelay: number, maxDelay: number): number {
  const delay = initialDelay * Math.pow(2, attempt);
  return Math.min(delay, maxDelay);
}

/**
 * Parse Retry-After header value
 * Returns delay in milliseconds, or null if invalid/not present
 */
function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;

  // Try parsing as seconds (integer)
  const seconds = parseInt(header, 10);
  if (!isNaN(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  // Try parsing as HTTP date
  const date = new Date(header);
  if (!isNaN(date.getTime())) {
    const delay = date.getTime() - Date.now();
    return delay > 0 ? delay : 0;
  }

  return null;
}

/**
 * Check if error is a network error (fetch failed to connect)
 */
function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError && error.message.includes("fetch");
}

/**
 * Check if response status should trigger a retry
 */
function shouldRetry(status: number): boolean {
  // Retry on 5xx server errors
  return status >= 500 && status < 600;
}

/**
 * Fetch with exponential backoff retry logic
 *
 * - Max 3 retries for server errors with exponential backoff (1s, 2s, 4s)
 * - 429 handling: separate counter (up to 10), respects Retry-After header, cap delay at 8s
 * - Don't retry 4xx (except 429) — return response as-is
 * - Retry 5xx and network errors (TypeError from fetch)
 * - AbortSignal passthrough for cancellation
 */
export async function fetchWithRetry(
  url: string | URL,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const {
    maxRetries = DEFAULT_MAX_RETRIES,
    max429Retries = DEFAULT_429_MAX_RETRIES,
    initialDelayMs = DEFAULT_INITIAL_DELAY_MS,
    maxDelayMs = DEFAULT_MAX_DELAY_MS,
    ...fetchOptions
  } = options;

  let attempts = 0;
  let rateLimitAttempts = 0;

  while (true) {
    try {
      const response = await fetch(url, fetchOptions);

      // Handle 429 Too Many Requests
      if (response.status === 429) {
        rateLimitAttempts++;

        if (rateLimitAttempts >= max429Retries) {
          return response;
        }

        // Check for Retry-After header
        const retryAfter = parseRetryAfter(response.headers.get("Retry-After"));
        const delay = retryAfter !== null
          ? Math.min(retryAfter, maxDelayMs)
          : getBackoffDelay(rateLimitAttempts - 1, initialDelayMs, maxDelayMs);

        await sleep(delay, fetchOptions.signal ?? undefined);
        continue;
      }

      // Don't retry 4xx errors (except 429 which is handled above)
      if (response.status >= 400 && response.status < 500) {
        return response;
      }

      // Retry 5xx errors
      if (shouldRetry(response.status)) {
        attempts++;

        if (attempts >= maxRetries) {
          return response;
        }

        const delay = getBackoffDelay(attempts - 1, initialDelayMs, maxDelayMs);
        await sleep(delay, fetchOptions.signal ?? undefined);
        continue;
      }

      // Success (2xx or 3xx)
      return response;
    } catch (error) {
      // Re-throw abort errors
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }

      // Retry network errors
      if (isNetworkError(error)) {
        attempts++;

        if (attempts >= maxRetries) {
          throw error;
        }

        const delay = getBackoffDelay(attempts - 1, initialDelayMs, maxDelayMs);
        await sleep(delay, fetchOptions.signal ?? undefined);
        continue;
      }

      // Re-throw unknown errors
      throw error;
    }
  }
}
