import { InvalidTargetUrlError, validateTargetUrl } from './url-validator';

describe('validateTargetUrl', () => {
  it('rejects malformed input', async () => {
    await expect(validateTargetUrl('not a url')).rejects.toBeInstanceOf(InvalidTargetUrlError);
  });

  it('rejects unsupported protocols', async () => {
    await expect(validateTargetUrl('ftp://example.com')).rejects.toThrow(/http/);
  });

  it('rejects unreachable hosts (network error)', async () => {
    await expect(
      validateTargetUrl('http://nonexistent.invalid.test.local', 1000),
    ).rejects.toBeInstanceOf(InvalidTargetUrlError);
  }, 5000);

  it('accepts a real 2xx target', async () => {
    const r = await validateTargetUrl('https://example.com');
    expect(r.status).toBeGreaterThanOrEqual(200);
    expect(r.status).toBeLessThan(400);
  }, 10000);
});
