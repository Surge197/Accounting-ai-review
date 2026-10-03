export class HttpError extends Error {
  constructor(readonly status: number) { super(`Backend HTTP ${status}`); }
}
export async function boundedText(response: Response, limit: number): Promise<string> {
  if (!response.body) throw new Error('Empty response');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > limit) throw new Error('Response exceeds limit');
      chunks.push(chunk.value);
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  const bytes = Buffer.concat(chunks);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return bytes.subarray(2).toString('utf16le');
  if (bytes[0] === 0x3c && bytes[1] === 0x00) return bytes.toString('utf16le');
  return bytes.toString('utf8');
}
export class BackendClient {
  constructor(readonly origin: string, readonly credential: string, readonly timeout = 5000) {}
  async post<T>(endpoint: string, body: unknown, signal?: AbortSignal): Promise<T> {
    const response = await fetch(`${this.origin}/api/connector/v1${endpoint}`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${this.credential}` },
      body: JSON.stringify(body), redirect: 'error',
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(this.timeout)]) : AbortSignal.timeout(this.timeout),
    });
    if (!response.ok) { await response.body?.cancel(); throw new HttpError(response.status); }
    return JSON.parse(await boundedText(response, 128 * 1024)) as T;
  }
}
