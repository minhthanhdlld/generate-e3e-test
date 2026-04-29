import axios from 'axios';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';

export async function callOpenAi(
  apiKey: string,
  prompt: string,
  timeoutMs = 30_000,
): Promise<string | null> {
  try {
    const res = await axios.post(
      OPENAI_URL,
      {
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: timeoutMs,
      },
    );
    const content = res.data?.choices?.[0]?.message?.content;
    return typeof content === 'string' && content.trim().length > 0
      ? content
      : null;
  } catch {
    return null;
  }
}
