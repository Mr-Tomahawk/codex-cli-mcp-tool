import { spawn } from "child_process";
import { Logger } from "./logger.js";

/**
 * Detects if a string contains structured output markers from Codex.
 *
 * Structured output markers include:
 * - `--------` (section divider)
 * - `thinking` (reasoning section)
 * - `codex` (output identifier)
 *
 * @param text - The text to check for structured output markers
 * @returns true if any structured marker is found, false otherwise
 */
export function hasStructuredMarkers(text: string): boolean {
  return text.includes('--------') ||
         text.includes('thinking') ||
         text.includes('codex');
}

export async function executeCommand(
  command: string,
  args: string[],
  onProgress?: (newOutput: string) => void,
  timeout?: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    Logger.commandExecution(command, args, startTime);

    const childProcess = spawn(command, args, {
      env: process.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    // stderr accumulates error output as a string buffer, verified in T-003
    let stderr: string = "";
    let isResolved = false;
    let lastReportedLength = 0;
    let lastReportedLengthStderr = 0;
    
    // Set up timeout if specified
    // T-014: Timeout mechanism verified compatible with T-007/T-011 stream selection changes
    // - Timeout sets isResolved=true BEFORE killing process (line 49)
    // - Stream selection occurs in close handler which checks isResolved first (line 114)
    // - Once timeout fires, close handler's stream selection logic never executes
    // - Process termination (kill) happens before any resolution path is reached
    // - Timeout operates at higher level than stream selection, ensuring proper precedence
    let timeoutHandle: NodeJS.Timeout | undefined;
    if (timeout) {
      timeoutHandle = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          childProcess.kill('SIGTERM');
          Logger.error(`Command timed out after ${timeout}ms`);
          reject(new Error(`Command timed out after ${timeout}ms`));
        }
      }, timeout);
    }

    childProcess.stdout.on("data", (data) => {
      // Keep accumulating stdout buffer - needed for fallback logic in T-007
      stdout += data.toString();

      // DISABLED: stdout progress reporting (T-005)
      // Structured output comes through stderr in non-TTY mode.
      // Stdout progress reporting is disabled to prevent duplicate/incorrect reporting.
      // The stdout buffer is still accumulated for use in final resolution logic (T-007).
      /*
      if (onProgress && stdout.length > lastReportedLength) {
        const newContent = stdout.substring(lastReportedLength);
        lastReportedLength = stdout.length;
        onProgress(newContent);
      }
      */
    });

    childProcess.stderr.on("data", (data) => {
      // Accumulate stderr chunks as string (verified in T-003)
      stderr += data.toString();

      // Report stderr progress when structured markers detected
      if (onProgress && hasStructuredMarkers(stderr) && stderr.length > lastReportedLengthStderr) {
        const newContent = stderr.substring(lastReportedLengthStderr);
        lastReportedLengthStderr = stderr.length;
        onProgress(newContent);
      }

      // Check for common Codex/OpenAI errors
      if (stderr.includes("UNAUTHENTICATED") || stderr.includes("authentication failed")) {
        Logger.authenticationStatus(false, "API key or login");
      }

      if (stderr.includes("RESOURCE_EXHAUSTED") || stderr.includes("rate limit")) {
        Logger.error("Rate limit or quota exceeded");
      }

      if (stderr.includes("PERMISSION_DENIED") || stderr.includes("sandbox")) {
        Logger.error("Sandbox permission denied");
      }
    });

    childProcess.on("error", (error) => {
      if (!isResolved) {
        isResolved = true;
        if (timeoutHandle) clearTimeout(timeoutHandle);
        Logger.error(`Process error:`, error);
        
        if (error.message.includes("ENOENT")) {
          reject(new Error("Codex CLI not found. Please install with: npm install -g @openai/codex"));
        } else {
          reject(new Error(`Failed to spawn command: ${error.message}`));
        }
      }
    });

    childProcess.on("close", (code) => {
      if (!isResolved) {
        isResolved = true;
        if (timeoutHandle) clearTimeout(timeoutHandle);

        if (code === 0) {
          /*
           * Stream Selection Logic (US-001):
           *
           * Unix Convention:
           * - stdout: Clean output intended for piping/processing
           * - stderr: Diagnostic output, structured data, progress information
           *
           * Non-TTY Behavior:
           * In non-TTY mode (MCP server context), Codex CLI writes structured output
           * (headers, thinking, codex sections, tokens) to stderr, while stdout remains minimal.
           * This is standard Unix practice - structured diagnostic/progress information goes to stderr
           * so stdout remains clean for downstream processing.
           *
           * Selection Flow:
           * 1. Detect structured markers (--------/thinking/codex) in stderr
           * 2. If detected AND stderr non-empty after trimming → use stderr
           * 3. Otherwise → fallback to stdout (backward compatibility)
           *
           * Rationale:
           * - When Codex CLI runs in MCP context (non-TTY), it intentionally outputs
           *   structured data to stderr following Unix conventions
           * - We detect this structured output by looking for known markers
           * - Empty check prevents returning empty strings when markers exist but no content
           * - Stdout fallback ensures compatibility with commands that don't use structured output
           *
           * See docs/fixplan.md for detailed technical design (Option 1 approach)
           */

          // T-006: Detect if stderr contains structured output markers
          // T-007: Resolve with stderr when structured markers detected, fallback to stdout otherwise
          // In non-TTY mode, Codex CLI writes structured output (headers, thinking, codex, tokens) to stderr
          const hasStructuredOutput = hasStructuredMarkers(stderr);

          // T-009: Debug logging for stream selection
          Logger.debug(`Stream selection: structured markers detected=${hasStructuredOutput}`);
          Logger.debug(`Selecting ${hasStructuredOutput ? 'stderr' : 'stdout'} for resolution`);

          // T-008: Capture selected output to report correct length in metrics
          // T-010: Fallback behavior explanation:
          // - When structured markers are detected (--------/thinking/codex), use stderr
          //   because Codex CLI writes structured output to stderr in non-TTY mode
          // - When no structured markers are detected, fallback to stdout
          //   for backward compatibility with commands that don't produce structured output
          // T-011: Handle edge case where stderr has markers but is empty after trimming
          // If stderr is empty, fallback to stdout to ensure non-empty output when possible
          const trimmedStderr = stderr.trim();
          const output = (hasStructuredOutput && trimmedStderr) ? trimmedStderr : stdout.trim();
          Logger.commandComplete(startTime, code, output.length);
          resolve(output);
        } else {
          // T-012: Error path verification - confirmed unchanged after T-007 and T-011 success path modifications
          // This error path correctly:
          // - Uses stderr.trim() for error messages with fallback to "Unknown error"
          // - Logs completion with exit code and error message
          // - Rejects promise with exit code and stderr-based error message
          Logger.commandComplete(startTime, code ?? undefined);
          Logger.error(`Failed with exit code ${code}`);
          const errorMessage = stderr.trim() || "Unknown error";
          reject(new Error(`Command failed with exit code ${code}: ${errorMessage}`));
        }
      }
    });

    // Handle process termination
    // T-015: Signal handler compatibility verified with T-007 stream selection changes
    // - Signal handlers operate independently at process termination level (lines 189-199)
    // - Stream selection logic is in close handler (lines 119-186) - no interaction
    // - Handlers check isResolved flag to prevent duplicate cleanup (consistent with timeout/error handlers)
    // - Compatible with T-007 stderr preference: handlers don't touch stdout/stderr buffers
    // - Note: Signal handlers follow simplified pattern (check flag + kill) vs timeout handler
    //   (set flag + kill + log + reject). Close handler will still execute after signal.
    process.on('SIGINT', () => {
      if (!isResolved) {
        childProcess.kill('SIGTERM');
      }
    });

    process.on('SIGTERM', () => {
      if (!isResolved) {
        childProcess.kill('SIGTERM');
      }
    });
  });
}