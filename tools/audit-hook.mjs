/**
 * audit-hook.mjs — Claude Code PostToolUse hook for content audit
 * ================================================================
 * Invoked automatically by Claude Code after every Edit or Write tool call.
 * Reads the tool payload from stdin, checks whether a shared/json/*.json file
 * was modified, and if so runs audit.mjs on that file in fast (--quick) mode.
 *
 * Output goes to stdout so Claude Code displays any issues as inline feedback.
 * Exit code does not block the tool call — this is informational only.
 *
 * This file is NOT meant to be run directly. It is registered in
 * .claude/settings.json as a PostToolUse hook command.
 */

import { execSync } from 'child_process';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname + '/..';

// Read full stdin (Claude Code sends JSON payload)
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const raw = chunks.join('');

let payload;
try { payload = JSON.parse(raw); } catch { process.exit(0); }

const filePath = payload?.tool_input?.file_path ?? '';

// Only run when a shared content JSON file was modified
if (!filePath.includes('shared/json') || !filePath.endsWith('.json')) process.exit(0);

// Run the audit for this specific file in quick mode
try {
  const output = execSync(
    `node tools/audit.mjs --quick --file "${filePath}"`,
    { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
  );
  if (output.trim()) process.stdout.write(output);
} catch (e) {
  // Non-zero exit = issues found — print them
  if (e.stdout) process.stdout.write(e.stdout);
  if (e.stderr) process.stdout.write(e.stderr);
}
