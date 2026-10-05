import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
import test from "node:test";

function makeTempDir(prefix: string): string {
  const dir = join(tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function gitExec(cwd: string, ...args: string[]): string {
  return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", timeout: 10_000 }).trim();
}

function initRepo(dir: string): void {
  gitExec(dir, "init");
  gitExec(dir, "config", "user.email", "test@test.local");
  gitExec(dir, "config", "user.name", "Test");
  writeFileSync(join(dir, "README.md"), "# test\n");
  gitExec(dir, "add", ".");
  gitExec(dir, "commit", "-m", "init");
}

function resolveRepoRootFrom(dir: string): string {
  const commonDir = execFileSync("git", ["-C", dir, "rev-parse", "--git-common-dir"], {
    encoding: "utf8",
    timeout: 5_000,
  }).trim();
  if (!commonDir) return resolve(dir);
  const resolvedCommon = resolve(dir, commonDir);
  return resolve(resolvedCommon, "..");
}

test("git --git-common-dir resolves main repo root from a linked worktree", () => {
  const mainRepo = makeTempDir("flow-wt-main");
  try {
    initRepo(mainRepo);

    // Create a linked worktree under the main repo.
    const worktreeDir = join(mainRepo, ".worktrees", "feature-branch");
    mkdirSync(join(mainRepo, ".worktrees"), { recursive: true });
    gitExec(mainRepo, "worktree", "add", worktreeDir, "-b", "feature-branch");

    // Resolving from the worktree should give us the main repo root.
    const resolved = resolveRepoRootFrom(worktreeDir);
    assert.equal(resolved, resolve(mainRepo));
    assert.notEqual(resolved, resolve(worktreeDir));
    assert.ok(existsSync(join(resolved, ".git")));
  } finally {
    rmSync(mainRepo, { recursive: true, force: true });
  }
});

test("git --git-common-dir resolves main repo root from subdirectory inside worktree", () => {
  const mainRepo = makeTempDir("flow-wt-nested");
  try {
    initRepo(mainRepo);

    // Create a linked worktree.
    const worktree1 = join(mainRepo, ".worktrees", "first");
    mkdirSync(join(mainRepo, ".worktrees"), { recursive: true });
    gitExec(mainRepo, "worktree", "add", worktree1, "-b", "first-branch");

    // Even from a subdirectory inside the worktree, we should resolve to the main repo.
    const subdir = join(worktree1, "some-subdir");
    mkdirSync(subdir, { recursive: true });

    const resolved = resolveRepoRootFrom(subdir);
    assert.equal(resolved, resolve(mainRepo));
  } finally {
    rmSync(mainRepo, { recursive: true, force: true });
  }
});

test("git --git-common-dir returns the same directory from primary checkout", () => {
  const mainRepo = makeTempDir("flow-wt-primary");
  try {
    initRepo(mainRepo);

    // From the primary checkout, --git-common-dir returns .git itself.
    const resolved = resolveRepoRootFrom(mainRepo);
    assert.equal(resolved, resolve(mainRepo));
  } finally {
    rmSync(mainRepo, { recursive: true, force: true });
  }
});
