/** Safely parse an API response body as JSON, with a clear error when Vercel returns an empty/HTML failure. */
export async function readApiJson<T = unknown>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) {
    throw new Error(
      res.ok
        ? "The server returned an empty response."
        : `Server error (${res.status}). On Vercel, check that the function can write to /tmp and that native modules built correctly.`,
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `Server returned a non-JSON response (${res.status}). ${text.slice(0, 160).replace(/\s+/g, " ")}`,
    );
  }
}
