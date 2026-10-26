// Tests for the doc-classifier project checks. Run: node --test '.pr-review/checks/test/*.test.mjs'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import checks from '../doc-classifier.mjs';

const byName = Object.fromEntries(checks.map((c) => [c.name, c]));
const SHA = 'a'.repeat(40);
const HEAD = 'b'.repeat(40);

function entry(file, { added = [], removed = [], status = 'M', binary = false } = {}) {
  return {
    file,
    oldFile: file,
    status,
    binary,
    added: added.map((text, i) => ({ line: i + 1, text })),
    removed: removed.map((text, i) => ({ line: i + 1, text })),
  };
}

function root(files = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'dc-checks-'));
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(join(dir, rel, '..'), { recursive: true });
    writeFileSync(join(dir, rel), text);
  }
  return dir;
}

// Stands in for the engine's git(args): `show <head>:<path>` returns the PR-head file or throws.
const gitWith = (headFiles = {}) => (args) => {
  const [cmd, spec] = args;
  const [sha, path] = String(spec).split(':');
  if (cmd !== 'show' || sha !== HEAD || !(path in headFiles)) throw new Error('fatal: path not in head');
  return headFiles[path];
};

const run = (name, files, { repoRoot = root(), headFiles = {} } = {}) => byName[name].run({ files, repoRoot, headSha: HEAD, git: gitWith(headFiles) });

test('exports the five checks with valid names', () => {
  assert.deepEqual(Object.keys(byName).sort(), ['config-schema', 'env-var-docs', 'external-counterpart', 'nodenext-ext', 'transport-pair']);
});

test('nodenext-ext: flags relative imports without .js in a .ts file', () => {
  const facts = run('nodenext-ext', [entry('src/a.ts', { added: ['import { x } from "./b";', "export * from '../c';", 'import "./side-effect";', 'export type { T } from "./t";', 'import { y } from "..";'] })]);
  assert.equal(facts.length, 5);
  assert.equal(facts[0].file, 'src/a.ts');
  assert.equal(facts[0].line, 1);
  assert.match(facts[0].note, /"\.\/b"/);
});

test('nodenext-ext: ignores .js imports, package imports, comments and non-ts files', () => {
  const facts = run('nodenext-ext', [
    entry('src/a.ts', { added: ['import { x } from "./b.js";', 'import { z } from "zod";', 'import type { T } from "../types.js";', '// import { old } from "./old";', ' * from "./doc"', 'import data from "./d.json";'] }),
    entry('README.md', { added: ['import { x } from "./b";'] }),
  ]);
  assert.deepEqual(facts, []);
});

test('nodenext-ext: covers dynamic import of a relative path, skips deleted files', () => {
  assert.equal(run('nodenext-ext', [entry('eval/run.ts', { added: ['const m = await import("./mod");'] })]).length, 1);
  assert.deepEqual(run('nodenext-ext', [entry('src/gone.ts', { status: 'D', added: ['import "./x";'] })]), []);
});

test('transport-pair: one transport changed', () => {
  const facts = run('transport-pair', [entry('src/mcp/server.ts', { added: ['x'] })]);
  assert.equal(facts.length, 1);
  assert.equal(facts[0].file, 'src/mcp/server.ts');
  assert.match(facts[0].note, /src\/server\.ts/);
});

test('transport-pair: both or neither changed, or only a test', () => {
  assert.deepEqual(run('transport-pair', [entry('src/server.ts'), entry('src/mcp/server.ts')]), []);
  assert.deepEqual(run('transport-pair', [entry('src/types.ts')]), []);
  assert.deepEqual(run('transport-pair', [entry('src/server.test.ts')]), []);
});

test('env-var-docs: undocumented, documented and removed reads, against the PR-head README', () => {
  const facts = run(
    'env-var-docs',
    [entry('src/x.ts', { added: ['const a = process.env.NEW_VAR;', 'const b = process.env.RAG_API_TOKEN;'], removed: ['const c = process.env.OLD_VAR;'] })],
    { headFiles: { 'README.md': 'Set RAG_API_TOKEN=<token>.\n' } },
  );
  const note = (v) => facts.find((f) => f.note.includes(v))?.note ?? '';
  assert.match(note('NEW_VAR'), /not in README\.md/);
  assert.match(note('RAG_API_TOKEN'), /documented/);
  assert.match(note('OLD_VAR'), /no longer read/);
});

test('env-var-docs: index access and destructuring count; NODE_ENV does not', () => {
  const facts = run('env-var-docs', [entry('src/x.ts', { added: ['const t = process.env["IDX_VAR"];', 'const { DS_ONE, DS_TWO: two = "x" } = process.env;', 'if (process.env.NODE_ENV) {}'] })]);
  const names = facts.map((f) => /reads (\w+)/.exec(f.note)?.[1]).sort();
  assert.deepEqual(names, ['DS_ONE', 'DS_TWO', 'IDX_VAR']);
});

test('env-var-docs: a variable still read in the diff is not "no longer read"; no env change, no fact', () => {
  const facts = run('env-var-docs', [entry('src/x.ts', { added: ['process.env.SAME'], removed: ['process.env.SAME'] })], { headFiles: { 'README.md': 'SAME\n' } });
  assert.ok(!facts.some((f) => /no longer read/.test(f.note)));
  assert.deepEqual(run('env-var-docs', [entry('src/x.ts', { added: ['const a = 1;'] })]), []);
});

test('env-var-docs: README missing at head is reported, not thrown, and the workspace copy is never read', () => {
  const repoRoot = root({ 'README.md': 'X_Y\n' });
  const facts = run('env-var-docs', [entry('src/x.ts', { added: ['process.env.X_Y'] })], { repoRoot });
  assert.match(facts[0].note, /not in README\.md/);
});

test('config-schema: schema key changed without committed configs', () => {
  for (const line of ['  maxTokens: z.number(),', '  tier: DocumentClassSchema,', '  rules: HandlingRulesSchema.optional(),']) {
    const facts = run('config-schema', [entry('src/config/product-config.ts', { added: [line] })]);
    assert.equal(facts.length, 1, line);
    assert.match(facts[0].note, /config\/test\.json/);
  }
  assert.equal(run('config-schema', [entry('src/config/product-config.ts', { removed: ['  model: z.string(),'] })]).length, 1);
});

test('config-schema: no fact when a committed config also changed, or no key line changed, or another file', () => {
  assert.deepEqual(run('config-schema', [entry('src/config/product-config.ts', { added: ['  maxTokens: z.number(),'] }), entry('config/test.json')]), []);
  assert.deepEqual(run('config-schema', [entry('src/config/product-config.ts', { added: ['// a comment', '  const raw = readFileSync(p);'] })]), []);
  assert.deepEqual(run('config-schema', [entry('src/types.ts', { added: ['  maxTokens: z.number(),'] })]), []);
});

test('external-counterpart: reports the recorded SHA', () => {
  const facts = run('external-counterpart', [], { repoRoot: root({ '.review-external/rag-system.sha': `${SHA}\n` }) });
  assert.equal(facts.length, 1);
  assert.match(facts[0].note, new RegExp(SHA));
});

test('external-counterpart: missing, malformed, oversized or symlinked SHA file means unavailable', () => {
  assert.match(run('external-counterpart', [])[0].note, /unavailable/);
  assert.match(run('external-counterpart', [], { repoRoot: root({ '.review-external/rag-system.sha': 'not-a-sha' }) })[0].note, /unavailable/);
  assert.match(run('external-counterpart', [], { repoRoot: root({ '.review-external/rag-system.sha': `${SHA}\n${' '.repeat(400)}` }) })[0].note, /unavailable/);
  const linked = root({ 'target.txt': `${SHA}\n` });
  mkdirSync(join(linked, '.review-external'));
  symlinkSync(join(linked, 'target.txt'), join(linked, '.review-external/rag-system.sha'));
  assert.match(run('external-counterpart', [], { repoRoot: linked })[0].note, /unavailable/);
});

test('every check tolerates deleted and binary entries and a missing git helper', () => {
  const files = [entry('src/server.ts', { status: 'D', removed: ['import x from "./y";', 'process.env.GONE'] }), entry('docs/a.png', { binary: true })];
  for (const c of checks) {
    assert.doesNotThrow(() => c.run({ files, repoRoot: root(), headSha: HEAD, git: gitWith() }), c.name);
    assert.doesNotThrow(() => c.run({ files, repoRoot: root() }), `${c.name} without git`);
  }
});
