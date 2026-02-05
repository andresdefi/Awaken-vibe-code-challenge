import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchWithRetry, sleep } from "../fetch-with-retry";

describe("sleep", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves after specified milliseconds", async () => {
    const promise = sleep(1000);
    vi.advanceTimersByTime(1000);
    await expect(promise).resolves.toBeUndefined();
  });

  it("rejects when abort signal is triggered", async () => {
    const controller = new AbortController();
    const promise = sleep(1000, controller.signal);

    controller.abort();

    await expect(promise).rejects.toThrow("Aborted");
  });

  it("rejects immediately if signal already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(sleep(1000, controller.signal)).rejects.toThrow("Aborted");
  });
});

describe("fetchWithRetry", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns response on success", async () => {
    const mockResponse = new Response(JSON.stringify({ data: "test" }), { status: 200 });
    mockFetch.mockResolvedValueOnce(mockResponse);

    const response = await fetchWithRetry("/api/test");

    expect(response).toBe(mockResponse);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("retries on network error with exponential backoff", async () => {
    mockFetch
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(new Response("success", { status: 200 }));

    const promise = fetchWithRetry("/api/test", { maxRetries: 3, initialDelayMs: 1000 });

    // First failure - wait 1s
    await vi.advanceTimersByTimeAsync(1000);

    // Second failure - wait 2s
    await vi.advanceTimersByTimeAsync(2000);

    const response = await promise;

    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("throws after max retries on network error", async () => {
    const networkError = new TypeError("fetch failed");
    mockFetch.mockRejectedValue(networkError);

    const promise = fetchWithRetry("/api/test", { maxRetries: 3, initialDelayMs: 1000 });

    // Catch the promise rejection early to prevent unhandled rejection warning
    const errorPromise = promise.catch((e) => e);

    // Wait through all retry delays
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(4000);

    const error = await errorPromise;
    expect(error).toBeInstanceOf(TypeError);
    expect(error.message).toBe("fetch failed");
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("retries 429 with Retry-After header", async () => {
    mockFetch
      .mockResolvedValueOnce(
        new Response(null, {
          status: 429,
          headers: { "Retry-After": "2" },
        })
      )
      .mockResolvedValueOnce(new Response("success", { status: 200 }));

    const promise = fetchWithRetry("/api/test");

    // Wait for Retry-After delay (2 seconds)
    await vi.advanceTimersByTimeAsync(2000);

    const response = await promise;

    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("caps 429 retry delay at maxDelayMs", async () => {
    mockFetch
      .mockResolvedValueOnce(
        new Response(null, {
          status: 429,
          headers: { "Retry-After": "60" }, // 60 seconds
        })
      )
      .mockResolvedValueOnce(new Response("success", { status: 200 }));

    const promise = fetchWithRetry("/api/test", { maxDelayMs: 8000 });

    // Should be capped at 8s, not 60s
    await vi.advanceTimersByTimeAsync(8000);

    const response = await promise;

    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("gives up after max 429 retries", async () => {
    // Always return 429
    mockFetch.mockResolvedValue(new Response(null, { status: 429 }));

    const promise = fetchWithRetry("/api/test", {
      max429Retries: 3,
      initialDelayMs: 100,
      maxDelayMs: 400,
    });

    // Advance through retries
    for (let i = 0; i < 5; i++) {
      await vi.advanceTimersByTimeAsync(500);
    }

    const response = await promise;

    expect(response.status).toBe(429);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("does not retry on 4xx errors (except 429)", async () => {
    mockFetch.mockResolvedValueOnce(new Response("Not found", { status: 404 }));

    const response = await fetchWithRetry("/api/test");

    expect(response.status).toBe(404);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("retries on 5xx server errors", async () => {
    mockFetch
      .mockResolvedValueOnce(new Response("Server error", { status: 500 }))
      .mockResolvedValueOnce(new Response("success", { status: 200 }));

    const promise = fetchWithRetry("/api/test", { maxRetries: 3, initialDelayMs: 1000 });

    // Wait for backoff
    await vi.advanceTimersByTimeAsync(1000);

    const response = await promise;

    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("returns 5xx response after max retries", async () => {
    mockFetch.mockResolvedValue(new Response("Server error", { status: 503 }));

    const promise = fetchWithRetry("/api/test", { maxRetries: 2, initialDelayMs: 100 });

    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(200);

    const response = await promise;

    expect(response.status).toBe(503);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("throws AbortError when signal is aborted", async () => {
    const controller = new AbortController();

    mockFetch.mockImplementation(
      () =>
        new Promise((_, reject) => {
          controller.signal.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        })
    );

    const promise = fetchWithRetry("/api/test", { signal: controller.signal });

    controller.abort();

    await expect(promise).rejects.toThrow("Aborted");
  });

  it("passes through fetch options correctly", async () => {
    mockFetch.mockResolvedValueOnce(new Response("success", { status: 200 }));

    await fetchWithRetry("/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: "test" }),
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: "test" }),
    });
  });
});
