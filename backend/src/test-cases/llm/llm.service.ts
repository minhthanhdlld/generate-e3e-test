import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { callOpenAi } from './openai.client';
import { callAnthropic } from './anthropic.client';

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(private readonly config: ConfigService) {}

  async tryGenerate(prompt: string): Promise<string | null> {
    const openai = this.config.get<string>('OPENAI_API_KEY');
    if (openai && openai.trim().length > 0) {
      const out = await callOpenAi(openai, prompt);
      if (out) return out;
      this.logger.warn('OpenAI returned no content; not falling back');
      return null;
    }
    const anthropic = this.config.get<string>('ANTHROPIC_API_KEY');
    if (anthropic && anthropic.trim().length > 0) {
      const out = await callAnthropic(anthropic, prompt);
      if (out) return out;
      this.logger.warn('Anthropic returned no content');
      return null;
    }
    return null;
  }
}
