import axios from 'axios';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5';
const ANTHROPIC_VERSION = '2023-06-01';

export async function callAnthropic(
  apiKey: string,
  prompt: string,
  timeoutMs = 30_000,
): Promise<string | null> {
  try {
    const res = await axios.post(
      ANTHROPIC_URL,
      {
        model: MODEL,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      },
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'Content-Type': 'application/json',
        },
        timeout: timeoutMs,
      },
    );
    const blocks = res.data?.content;
    if (!Array.isArray(blocks)) return null;
    const text = blocks
      .map((b: { type?: string; text?: string }) =>
        b?.type === 'text' ? b.text ?? '' : '',
      )
      .join('')
      .trim();
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}
