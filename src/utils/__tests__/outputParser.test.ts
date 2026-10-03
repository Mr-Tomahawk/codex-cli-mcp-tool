import { describe, expect, it } from 'vitest';
import { parseCodexOutput } from '../outputParser.js';

describe('parseCodexOutput', () => {
  it.each([
    'ok',
    ' \r\nok\r\n ',
    'Created branch docs/codex-mcp-model-tiers.',
    'codex',
    'thinking',
    'tokens used: 123',
    'First paragraph.\n\nStill thinking about codex.\n  Indented text.',
    'Text with -------- inside a line.',
    'The OpenAI Codex CLI returned the answer.',
    '',
    ' \t\r\n ',
  ])('preserves plain output %j as the trimmed response', (rawOutput) => {
    expect(parseCodexOutput(rawOutput)).toEqual({
      metadata: {},
      userInstructions: '',
      thinking: undefined,
      response: rawOutput.trim(),
      tokensUsed: undefined,
      timestamps: [],
      rawOutput,
    });
  });

  it('parses legacy metadata, instructions, thinking, response and tokens', () => {
    const rawOutput = [
      'OpenAI Codex v0.20.0 (research preview)',
      '--------',
      'workdir: /workspace',
      'model: gpt-5',
      'sandbox: read-only',
      '--------',
      'User instructions:',
      'Reply with the word ok.',
      'thinking',
      'I am thinking about the codex request.',
      'codex',
      'ok',
      'tokens used: 42',
    ].join('\n');

    expect(parseCodexOutput(rawOutput)).toEqual({
      metadata: { workdir: '/workspace', model: 'gpt-5', sandbox: 'read-only' },
      userInstructions: 'Reply with the word ok.',
      thinking: 'I am thinking about the codex request.',
      response: 'ok',
      tokensUsed: 42,
      timestamps: [],
      rawOutput,
    });
  });

  it('recognizes timestamp-prefixed legacy headers with surrounding whitespace', () => {
    const rawOutput = [
      'OpenAI Codex v0.20.0',
      '  --------  ',
      'model: gpt-5',
      '--------',
      '  [2025-08-19T04:49:47] thinking  ',
      'Consider the request.',
      '  [2025-08-19T04:49:48] codex  ',
      'Created branch docs/codex-mcp-model-tiers.',
    ].join('\r\n');

    const output = parseCodexOutput(rawOutput);
    expect(output.metadata).toEqual({ model: 'gpt-5' });
    expect(output.thinking).toBe('Consider the request.');
    expect(output.response).toBe('Created branch docs/codex-mcp-model-tiers.');
    expect(output.timestamps).toEqual(['2025-08-19T04:49:47', '2025-08-19T04:49:48']);
  });

  it.each(['OpenAI Codex v0.20.0', '--------'])(
    'uses legacy parsing when only the %j structure marker is present', (marker) => {
      expect(parseCodexOutput(`${marker}\ncodex\nok`).response).toBe('ok');
    },
  );

  it('preserves marker substrings inside legacy response content', () => {
    const response = [
      'Created branch docs/codex-mcp-model-tiers.',
      'I am thinking about codex.',
      'The OpenAI Codex CLI returned the answer.',
      'A line mentioning User instructions: stays in the response.',
      'The report says tokens used: 42 for this request.',
      '-------- appears here as content.',
      '[2025-08-19T04:49:48] codex appears here as content.',
    ].join('\n');

    const output = parseCodexOutput(`OpenAI Codex v0.20.0\n--------\n--------\ncodex\n${response}`);
    expect(output.response).toBe(response);
    expect(output.thinking).toBeUndefined();
    expect(output.tokensUsed).toBeUndefined();
  });
});
