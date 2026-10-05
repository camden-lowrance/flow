import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const runtimeDir = resolve(import.meta.dirname);

function resolveFlowRoot(): string {
  let cursor = runtimeDir;
  for (let depth = 0; depth < 8; depth += 1) {
    const candidate = resolve(cursor);
    if (existsSync(join(candidate, "package.json")) && existsSync(join(candidate, "src")) && existsSync(join(candidate, "bin"))) {
      return candidate;
    }
    cursor = resolve(cursor, "..");
  }
  return resolve(runtimeDir, "../..");
}

/**
 * Resolve the canonical project root, unwrapping git worktrees.
 * When running from a linked worktree (`.worktrees/feature-...`), `--git-common-dir` points
 * to the shared `.git` directory of the primary checkout. The parent of that directory is the
 * main repo root, so new worktrees are not nested under the current one.
 */
function resolveCanonicalProjectRoot(): string {
  const start = resolve(process.env.FLOW_ROOT || process.cwd());
  try {
    const commonDir = execFileSync("git", ["-C", start, "rev-parse", "--git-common-dir"], {
      encoding: "utf8",
      timeout: 5_000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    if (!commonDir) return start;

    // --git-common-dir is relative to the worktree root when inside a linked worktree.
    const resolvedCommon = resolve(start, commonDir);
    // The .git directory sits one level below the repo root.
    const candidate = resolve(resolvedCommon, "..");
    if (existsSync(join(candidate, ".git"))) return candidate;
  } catch {
    // Not inside a git repository or git unavailable — fall through to the plain path.
  }
  return start;
}

export const flowRoot = resolveFlowRoot();
export const repoRoot = resolveCanonicalProjectRoot();
