// Tests for the doc-classifier project checks. Run: node --test '.claude/pr-review/checks/test/*.test.mjs'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import checks from '../doc-classifier.mjs';

const byName = Object.fromEntries(checks.map((c) => [c.name, c]));
const SHA = 'a'.repeat(40);

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

const run = (name, files, repoRoot = root()) => byName[name].run({ files, repoRoot });

test('exports the five checks with valid names', () => {
  assert.deepEqual(Object.keys(byName).sort(), ['config-schema', 'env-var-docs', 'external-counterpart', 'nodenext-ext', 'transport-pair']);
});

test('nodenext-ext: flags a relative import without .js in a .ts file', () => {
  const facts = run('nodenext-ext', [entry('src/a.ts', { added: ['import { x } from "./b";', "export * from '../c';"] })]);
  assert.equal(facts.length, 2);
  assert.equal(facts[0].file, 'src/a.ts');
  assert.equal(facts[0].line, 1);
  assert.match(facts[0].note, /\.\/b/);
});

test('nodenext-ext: ignores .js imports, package imports and non-ts files', () => {
  const facts = run('nodenext-ext', [
    entry('src/a.ts', { added: ['import { x } from "./b.js";', 'import { z } from "zod";', 'import type { T } from "../types.js";'] }),
    entry('README.md', { added: ['import { x } from "./b";'] }),
  ]);
  assert.deepEqual(facts, []);
});

test('nodenext-ext: covers dynamic import of a relative path', () => {
  const facts = run('nodenext-ext', [entry('eval/run.ts', { added: ['const m = await import("./mod");'] })]);
  assert.equal(facts.length, 1);
});

test('transport-pair: one transport changed', () => {
  const facts = run('transport-pair', [entry('src/mcp/server.ts', { added: ['x'] })]);
  assert.equal(facts.length, 1);
  assert.equal(facts[0].file, 'src/mcp/server.ts');
  assert.match(facts[0].note, /src\/server\.ts/);
});

test('transport-pair: both or neither changed', () => {
  assert.deepEqual(run('transport-pair', [entry('src/server.ts'), entry('src/mcp/server.ts')]), []);
  assert.deepEqual(run('transport-pair', [entry('src/types.ts')]), []);
});

test('transport-pair: test-only change to one transport does not fire', () => {
  assert.deepEqual(run('transport-pair', [entry('src/server.test.ts')]), []);
});

test('env-var-docs: undocumented, documented and removed reads', () => {
  const repoRoot = root({ 'README.md': 'Set RAG_API_TOKEN=<token>.\n' });
  const facts = run(
    'env-var-docs',
    [entry('src/x.ts', { added: ['const a = process.env.NEW_VAR;', 'const b = process.env.RAG_API_TOKEN;'], removed: ['const c = process.env.OLD_VAR;'] })],
    repoRoot,
  );
  const note = (v) => facts.find((f) => f.note.includes(v))?.note ?? '';
  assert.match(note('NEW_VAR'), /not in README\.md/);
  assert.match(note('RAG_API_TOKEN'), /documented/);
  assert.match(note('OLD_VAR'), /no longer read/);
});

test('env-var-docs: a variable still read elsewhere in the diff is not "no longer read"', () => {
  const facts = run('env-var-docs', [entry('src/x.ts', { added: ['process.env.SAME'], removed: ['process.env.SAME'] })], root({ 'README.md': 'SAME\n' }));
  assert.ok(!facts.some((f) => /no longer read/.test(f.note)));
});

test('env-var-docs: missing README is reported, not thrown', () => {
  const facts = run('env-var-docs', [entry('src/x.ts', { added: ['process.env.X_Y'] })]);
  assert.match(facts[0].note, /not in README\.md/);
});

test('config-schema: schema key changed without committed configs', () => {
  const facts = run('config-schema', [entry('src/config/product-config.ts', { added: ['  maxTokens: z.number(),'] })]);
  assert.equal(facts.length, 1);
  assert.match(facts[0].note, /config\/test\.json/);
});

test('config-schema: no fact when a committed config also changed, or no key line changed', () => {
  assert.deepEqual(run('config-schema', [entry('src/config/product-config.ts', { added: ['  maxTokens: z.number(),'] }), entry('config/test.json')]), []);
  assert.deepEqual(run('config-schema', [entry('src/config/product-config.ts', { added: ['// a comment'] })]), []);
});

test('external-counterpart: reports the recorded SHA', () => {
  const facts = run('external-counterpart', [], root({ '.review-external/rag-system.sha': `${SHA}\n` }));
  assert.equal(facts.length, 1);
  assert.match(facts[0].note, new RegExp(SHA));
});

test('external-counterpart: missing or malformed SHA means unavailable', () => {
  assert.match(run('external-counterpart', [])[0].note, /unavailable/);
  assert.match(run('external-counterpart', [], root({ '.review-external/rag-system.sha': 'not-a-sha' }))[0].note, /unavailable/);
});

test('every check tolerates deleted and binary entries', () => {
  const files = [entry('src/server.ts', { status: 'D', removed: ['import x from "./y";', 'process.env.GONE'] }), entry('docs/a.png', { binary: true })];
  for (const c of checks) assert.doesNotThrow(() => c.run({ files, repoRoot: root() }), c.name);
});
