import { buildTestCasePrompt } from './prompt-builder';

describe('buildTestCasePrompt', () => {
  it('embeds project name + url + targetUsername', () => {
    const out = buildTestCasePrompt({
      name: 'Acme staging',
      url: 'https://staging.acme.test',
      description: 'Pre-prod env',
      targetUsername: 'qa@acme.test',
    });
    expect(out).toContain('Name: Acme staging');
    expect(out).toContain('URL: https://staging.acme.test');
    expect(out).toContain('Description: Pre-prod env');
    expect(out).toContain('Authenticated user: qa@acme.test');
    expect(out).toContain('Playwright + TypeScript');
  });

  it('falls back to "(none)" when description is empty / null', () => {
    expect(buildTestCasePrompt({
      name: 'X',
      url: 'http://x.test',
      description: null,
      targetUsername: 'u',
    })).toContain('Description: (none)');
    expect(buildTestCasePrompt({
      name: 'X',
      url: 'http://x.test',
      description: '   ',
      targetUsername: 'u',
    })).toContain('Description: (none)');
  });
});
