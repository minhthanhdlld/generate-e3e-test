import axios from 'axios';

export class InvalidTargetUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTargetUrlError';
  }
}

export interface UrlValidationResult {
  finalUrl: string;
  status: number;
}

const DEFAULT_TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 5;

export async function validateTargetUrl(
  raw: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<UrlValidationResult> {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new InvalidTargetUrlError('URL is malformed');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new InvalidTargetUrlError('URL must use http:// or https://');
  }

  try {
    const res = await axios.head(parsed.toString(), {
      maxRedirects: MAX_REDIRECTS,
      timeout: timeoutMs,
      validateStatus: () => true,
    });
    if (res.status >= 200 && res.status < 400) {
      return { finalUrl: res.request?.res?.responseUrl ?? parsed.toString(), status: res.status };
    }
    throw new InvalidTargetUrlError(`Target responded with HTTP ${res.status}`);
  } catch (err) {
    if (err instanceof InvalidTargetUrlError) throw err;
    const msg = err instanceof Error ? err.message : 'unknown error';
    throw new InvalidTargetUrlError(`Could not reach URL: ${msg}`);
  }
}
