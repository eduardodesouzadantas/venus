export async function queryWithTimeout(
  query: PromiseLike<unknown>,
  fallback: unknown,
  timeoutMs = 5000
): Promise<any> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error("timeout"));
      }, timeoutMs);
    });

    return await Promise.race([query, timeout]);
  } catch {
    return fallback;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
