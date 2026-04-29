export interface PromptInput {
  name: string;
  url: string;
  description?: string | null;
  targetUsername: string;
}

// Pure, unit-testable. The exact text shape is what the spec calls for —
// keep stable so the test-cases tab in the UI can rely on the wording.
export function buildTestCasePrompt(input: PromptInput): string {
  const desc = input.description?.trim() ? input.description.trim() : '(none)';
  return [
    'You are a senior QA automation engineer. Given the following web application:',
    `  - Name: ${input.name}`,
    `  - URL: ${input.url}`,
    `  - Description: ${desc}`,
    `  - Authenticated user: ${input.targetUsername}`,
    'Produce a numbered list of automated end-to-end test cases (Playwright + TypeScript)',
    'covering authentication, primary navigation, form validation, and one negative case',
    'per form. Output as a single string.',
  ].join('\n');
}
