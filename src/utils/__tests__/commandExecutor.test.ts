import { describe, it, expect } from 'vitest';
import { hasStructuredMarkers, executeCommand } from '../commandExecutor.js';

describe('hasStructuredMarkers', () => {
  describe('individual marker detection', () => {
    it('should detect -------- divider marker', () => {
      expect(hasStructuredMarkers('some text -------- more text')).toBe(true);
    });

    it('should detect thinking marker', () => {
      expect(hasStructuredMarkers('thinking: some analysis')).toBe(true);
    });

    it('should detect codex marker', () => {
      expect(hasStructuredMarkers('codex output here')).toBe(true);
    });
  });

  describe('marker position variations', () => {
    it('should detect marker at the start of text', () => {
      expect(hasStructuredMarkers('-------- content')).toBe(true);
      expect(hasStructuredMarkers('thinking analysis')).toBe(true);
      expect(hasStructuredMarkers('codex result')).toBe(true);
    });

    it('should detect marker at the end of text', () => {
      expect(hasStructuredMarkers('content --------')).toBe(true);
      expect(hasStructuredMarkers('analysis thinking')).toBe(true);
      expect(hasStructuredMarkers('result codex')).toBe(true);
    });

    it('should detect marker in the middle of text', () => {
      expect(hasStructuredMarkers('before -------- after')).toBe(true);
      expect(hasStructuredMarkers('before thinking after')).toBe(true);
      expect(hasStructuredMarkers('before codex after')).toBe(true);
    });
  });

  describe('multiple markers', () => {
    it('should detect when multiple markers are present', () => {
      expect(hasStructuredMarkers('-------- thinking codex')).toBe(true);
      expect(hasStructuredMarkers('thinking -------- output')).toBe(true);
      expect(hasStructuredMarkers('codex -------- thinking')).toBe(true);
    });

    it('should detect when all three markers are present', () => {
      expect(hasStructuredMarkers('-------- thinking: analysis codex: result')).toBe(true);
    });

    it('should detect when the same marker appears multiple times', () => {
      expect(hasStructuredMarkers('-------- section -------- another --------')).toBe(true);
      expect(hasStructuredMarkers('thinking one thinking two thinking three')).toBe(true);
      expect(hasStructuredMarkers('codex start codex middle codex end')).toBe(true);
    });
  });

  describe('negative cases', () => {
    it('should return false for text without any markers', () => {
      expect(hasStructuredMarkers('plain text without markers')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(hasStructuredMarkers('')).toBe(false);
    });

    it('should return false for whitespace-only text', () => {
      expect(hasStructuredMarkers('   ')).toBe(false);
      expect(hasStructuredMarkers('\t\n')).toBe(false);
    });

    it('should return false for words that do not contain markers', () => {
      expect(hasStructuredMarkers('codec information')).toBe(false);
      expect(hasStructuredMarkers('------')).toBe(false); // only 6 dashes
    });

    it('should return false for partial marker matches', () => {
      expect(hasStructuredMarkers('think')).toBe(false);
      expect(hasStructuredMarkers('code')).toBe(false);
      expect(hasStructuredMarkers('---')).toBe(false);
    });
  });

  describe('real-world examples', () => {
    it('should detect markers in typical Codex CLI output format', () => {
      const typicalOutput = `--------
thinking: Analyzing the request...
codex: Here is the response`;
      expect(hasStructuredMarkers(typicalOutput)).toBe(true);
    });

    it('should detect markers in multiline structured output', () => {
      const multilineOutput = `
Header section
--------
thinking: Processing the query
performing analysis
--------
codex: Final output
`;
      expect(hasStructuredMarkers(multilineOutput)).toBe(true);
    });

    it('should detect thinking section in reasoning output', () => {
      const reasoningOutput = 'thinking: Let me break this down step by step...';
      expect(hasStructuredMarkers(reasoningOutput)).toBe(true);
    });

    it('should detect codex identifier in final output', () => {
      const codexOutput = 'codex: The answer is 42';
      expect(hasStructuredMarkers(codexOutput)).toBe(true);
    });

    it('should handle output with only dividers', () => {
      const dividerOutput = '--------\nSection 1\n--------\nSection 2\n--------';
      expect(hasStructuredMarkers(dividerOutput)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle markers with surrounding whitespace', () => {
      expect(hasStructuredMarkers('  --------  ')).toBe(true);
      expect(hasStructuredMarkers('  thinking  ')).toBe(true);
      expect(hasStructuredMarkers('  codex  ')).toBe(true);
    });

    it('should handle markers within larger words (substring match)', () => {
      // Note: The function uses .includes(), so it will match substrings
      expect(hasStructuredMarkers('rethinking the approach')).toBe(true);
      expect(hasStructuredMarkers('unthinking')).toBe(true);
      expect(hasStructuredMarkers('codexample')).toBe(true);
    });

    it('should handle markers in mixed case text', () => {
      // Note: The function is case-sensitive, so these should NOT match
      expect(hasStructuredMarkers('THINKING')).toBe(false);
      expect(hasStructuredMarkers('CODEX')).toBe(false);
      expect(hasStructuredMarkers('Thinking')).toBe(false);
      expect(hasStructuredMarkers('Codex')).toBe(false);
    });

    it('should handle very long strings with markers', () => {
      const longString = 'a'.repeat(10000) + 'thinking' + 'b'.repeat(10000);
      expect(hasStructuredMarkers(longString)).toBe(true);
    });

    it('should handle newlines and special characters', () => {
      expect(hasStructuredMarkers('\n--------\n')).toBe(true);
      expect(hasStructuredMarkers('\tthinking\t')).toBe(true);
      expect(hasStructuredMarkers('codex\r\n')).toBe(true);
    });

    it('should handle Unicode and special characters in text', () => {
      expect(hasStructuredMarkers('Hello 🌍 -------- world')).toBe(true);
      expect(hasStructuredMarkers('思考 thinking 分析')).toBe(true);
      expect(hasStructuredMarkers('résultat codex données')).toBe(true);
    });
  });

  describe('performance and boundary conditions', () => {
    it('should handle extremely short strings', () => {
      expect(hasStructuredMarkers('c')).toBe(false);
      expect(hasStructuredMarkers('co')).toBe(false);
      expect(hasStructuredMarkers('cod')).toBe(false);
      expect(hasStructuredMarkers('code')).toBe(false);
      expect(hasStructuredMarkers('codex')).toBe(true);
    });

    it('should handle strings with only the marker', () => {
      expect(hasStructuredMarkers('--------')).toBe(true);
      expect(hasStructuredMarkers('thinking')).toBe(true);
      expect(hasStructuredMarkers('codex')).toBe(true);
    });

    it('should handle concatenated markers without spaces', () => {
      expect(hasStructuredMarkers('--------thinkingcodex')).toBe(true);
      expect(hasStructuredMarkers('thinkingcodex--------')).toBe(true);
      expect(hasStructuredMarkers('codex--------thinking')).toBe(true);
    });
  });
});

describe('executeCommand integration tests', () => {
  describe('stderr-first resolution with structured markers', () => {
    it('should resolve with stderr when structured markers present', async () => {
      // Use shell to write structured output to stderr
      const result = await executeCommand(
        'sh',
        ['-c', 'echo "--------\nthinking: test analysis\ncodex: result" >&2'],
        undefined,
        5000
      );

      expect(result).toContain('--------');
      expect(result).toContain('thinking: test analysis');
      expect(result).toContain('codex: result');
    });

    it('should resolve with stderr when only divider marker present', async () => {
      const result = await executeCommand(
        'sh',
        ['-c', 'echo "--------\nSection 1\n--------\nSection 2" >&2'],
        undefined,
        5000
      );

      expect(result).toContain('--------');
      expect(result).toContain('Section 1');
      expect(result).toContain('Section 2');
    });

    it('should resolve with stderr when only thinking marker present', async () => {
      const result = await executeCommand(
        'sh',
        ['-c', 'echo "thinking: analyzing the request" >&2'],
        undefined,
        5000
      );

      expect(result).toContain('thinking: analyzing the request');
    });

    it('should resolve with stderr when only codex marker present', async () => {
      const result = await executeCommand(
        'sh',
        ['-c', 'echo "codex: final output" >&2'],
        undefined,
        5000
      );

      expect(result).toContain('codex: final output');
    });
  });

  describe('stdout fallback when no markers present', () => {
    it('should fallback to stdout when no markers in output', async () => {
      const result = await executeCommand(
        'echo',
        ['plain output without markers'],
        undefined,
        5000
      );

      expect(result).toBe('plain output without markers');
    });

    it('should fallback to stdout when stderr has no markers', async () => {
      // Write to both stdout and stderr, but only stdout has content without markers
      const result = await executeCommand(
        'sh',
        ['-c', 'echo "stdout content"; echo "stderr without markers" >&2'],
        undefined,
        5000
      );

      expect(result).toBe('stdout content');
    });

    it('should handle command with only stdout output', async () => {
      const result = await executeCommand(
        'sh',
        ['-c', 'echo "only stdout"'],
        undefined,
        5000
      );

      expect(result).toBe('only stdout');
    });
  });

  describe('empty stderr edge case', () => {
    it('should fallback to stdout when stderr is empty after trimming', async () => {
      // Command writes to stdout but stderr is empty/whitespace
      const result = await executeCommand(
        'echo',
        ['fallback to this'],
        undefined,
        5000
      );

      expect(result).toBe('fallback to this');
    });

    it('should fallback to stdout when stderr has only whitespace despite markers', async () => {
      // This tests the T-011 edge case: stderr has markers but is empty after trimming
      // We write structured markers but only whitespace to stderr, and content to stdout
      const result = await executeCommand(
        'sh',
        ['-c', 'echo "stdout content"; echo "   " >&2'],
        undefined,
        5000
      );

      expect(result).toBe('stdout content');
    });

    it('should handle both streams empty', async () => {
      const result = await executeCommand(
        'sh',
        ['-c', 'true'],
        undefined,
        5000
      );

      expect(result).toBe('');
    });
  });

  describe('mixed output scenarios', () => {
    it('should prefer stderr with markers over stdout without markers', async () => {
      const result = await executeCommand(
        'sh',
        ['-c', 'echo "stdout plain"; echo "--------\ncodex: stderr structured" >&2'],
        undefined,
        5000
      );

      expect(result).toContain('--------');
      expect(result).toContain('codex: stderr structured');
      expect(result).not.toContain('stdout plain');
    });

    it('should handle multiline structured output in stderr', async () => {
      const command = `echo "--------
thinking: First step
thinking: Second step
--------
codex: Final result" >&2`;

      const result = await executeCommand(
        'sh',
        ['-c', command],
        undefined,
        5000
      );

      expect(result).toContain('--------');
      expect(result).toContain('thinking: First step');
      expect(result).toContain('thinking: Second step');
      expect(result).toContain('codex: Final result');
    });

    it('should handle real-world Codex CLI output format', async () => {
      const codexLikeOutput = `--------
thinking: Analyzing the request...
thinking: Processing query components...
--------
codex: Here is the response
tokens: 150`;

      const result = await executeCommand(
        'sh',
        ['-c', `echo "${codexLikeOutput}" >&2`],
        undefined,
        5000
      );

      expect(result).toContain('--------');
      expect(result).toContain('thinking: Analyzing the request');
      expect(result).toContain('codex: Here is the response');
      expect(result).toContain('tokens: 150');
    });
  });

  describe('error handling', () => {
    it('should reject on non-zero exit code with stderr message', async () => {
      await expect(
        executeCommand(
          'sh',
          ['-c', 'echo "error message" >&2; exit 1'],
          undefined,
          5000
        )
      ).rejects.toThrow('Command failed with exit code 1: error message');
    });

    it('should reject with "Unknown error" when stderr is empty on failure', async () => {
      await expect(
        executeCommand(
          'sh',
          ['-c', 'exit 42'],
          undefined,
          5000
        )
      ).rejects.toThrow('Command failed with exit code 42: Unknown error');
    });

    it('should reject on command not found', async () => {
      await expect(
        executeCommand(
          'nonexistent-command-xyz',
          [],
          undefined,
          5000
        )
      ).rejects.toThrow('Codex CLI not found');
    });
  });

  describe('progress callback integration', () => {
    it('should call onProgress with stderr content when markers detected', async () => {
      const progressUpdates: string[] = [];
      const onProgress = (newOutput: string) => {
        progressUpdates.push(newOutput);
      };

      await executeCommand(
        'sh',
        ['-c', 'echo "thinking: step 1" >&2; sleep 0.1; echo "codex: result" >&2'],
        onProgress,
        5000
      );

      // Progress callback should have been called with stderr content
      expect(progressUpdates.length).toBeGreaterThan(0);
      const allProgress = progressUpdates.join('');
      expect(allProgress).toContain('thinking');
    });

    it('should not call onProgress for stdout when no markers present', async () => {
      const progressUpdates: string[] = [];
      const onProgress = (newOutput: string) => {
        progressUpdates.push(newOutput);
      };

      await executeCommand(
        'sh',
        ['-c', 'echo "plain output"'],
        onProgress,
        5000
      );

      // Progress callback should not be called for plain stdout (T-005 requirement)
      expect(progressUpdates.length).toBe(0);
    });
  });
});
