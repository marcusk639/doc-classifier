// doc-classifier project checks (pr-review-kit extension point). They run in
// the facts step from the base checkout and return hints for the model to
// confirm, never verdicts. Node built-ins only. They never read PR-head files
// through the filesystem: a PR could plant a symlink or a FIFO there. PR-head
// content comes from `git show <head>:<path>`; the external SHA file is
// lstat-checked and size-capped.
import { lstatSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const TS = /\.(?:ts|mts|cts)$/;
const COMMENT = /^\s*(?:\/\/|\/\*|\*)/;
const RELATIVE_SPEC = /(?:\bfrom\s*|\bimport\s*\(\s*|^\s*import\s+)["'](\.{1,2}(?:\/[^"']*)?)["']/g;
const RESOLVED_EXT = /\.(?:js|mjs|cjs|json)$/;
const ENV_DOT = /\bprocess\.env\.([A-Z][A-Z0-9_]*)/g;
const ENV_INDEX = /\bprocess\.env\[\s*["']([A-Z][A-Z0-9_]*)["']\s*\]/g;
const ENV_DESTRUCTURE = /\{([^}]*)\}\s*=\s*process\.env\b/g;
const STANDARD_ENV = new Set(['NODE_ENV']);
const SCHEMA_KEY = /^\s*[A-Za-z_]\w*\s*:\s*(?:z\b|[A-Z]\w*Schema\b)/;
const SHA_RE = /^[0-9a-f]{40}$/;
const MAX_SHA_FILE = 256;

const TRANSPORTS = ['src/server.ts', 'src/mcp/server.ts'];
const CONFIG_FILES = ['config/test.json', 'config/example.json.example'];
const SCHEMA_FILE = 'src/config/product-config.ts';
const EXTERNAL_SHA = '.review-external/rag-system.sha';

const textFiles = (files) => files.filter((f) => !f.binary);

// A regular file no larger than max, or null; never follows a symlink.
function readSmallFile(path, max) {
  try {
    const st = lstatSync(path);
    if (!st.isFile() || st.size > max) return null;
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

function headFile(ctx, path) {
  if (typeof ctx.git !== 'function' || !ctx.headSha) return null;
  try {
    return ctx.git(['show', `${ctx.headSha}:${path}`]);
  } catch {
    return null;
  }
}

// P1: relative imports must carry .js under NodeNext. Single-line forms only;
// a multi-line import( is left to the model.
function nodenextExt({ files }) {
  const facts = [];
  for (const f of textFiles(files).filter((x) => TS.test(x.file) && x.status !== 'D')) {
    for (const a of f.added) {
      if (COMMENT.test(a.text)) continue;
      for (const m of a.text.matchAll(RELATIVE_SPEC)) {
        if (!RESOLVED_EXT.test(m[1])) facts.push({ file: f.file, line: a.line, note: `relative import "${m[1]}" has no .js extension: under NodeNext tsc and Node cannot resolve it, though Vitest can` });
      }
    }
  }
  return facts;
}

// P2: the two transports changed apart.
function transportPair({ files }) {
  const changed = new Set(files.map((f) => f.file));
  const [rest, mcp] = TRANSPORTS;
  if (changed.has(rest) === changed.has(mcp)) return [];
  const [edited, other] = changed.has(rest) ? [rest, mcp] : [mcp, rest];
  return [{ file: edited, note: `only one transport changed; compare validation, error handling and output with ${other}` }];
}

function envNames(text) {
  const names = [...text.matchAll(ENV_DOT), ...text.matchAll(ENV_INDEX)].map((m) => m[1]);
  for (const m of text.matchAll(ENV_DESTRUCTURE)) {
    for (const part of m[1].split(',')) {
      const name = part.split(':')[0].split('=')[0].trim();
      if (/^[A-Z][A-Z0-9_]*$/.test(name)) names.push(name);
    }
  }
  return names.filter((n) => !STANDARD_ENV.has(n));
}

// P3: env vars read or dropped in the diff, against the PR-head README.
function envVarDocs(ctx) {
  const added = new Map();
  const removed = new Map();
  for (const f of textFiles(ctx.files)) {
    for (const a of f.added) for (const n of envNames(a.text)) if (!added.has(n)) added.set(n, { file: f.file, line: a.line });
    for (const r of f.removed) for (const n of envNames(r.text)) if (!removed.has(n)) removed.set(n, { file: f.oldFile ?? f.file });
  }
  if (!added.size && !removed.size) return [];
  const readme = headFile(ctx, 'README.md') ?? '';
  const facts = [];
  for (const [name, at] of added) facts.push({ ...at, note: `reads ${name}: ${new RegExp(`\\b${name}\\b`).test(readme) ? 'documented in README.md' : 'not in README.md'}` });
  for (const [name, at] of removed) if (!added.has(name)) facts.push({ file: at.file, note: `${name} no longer read here; check its other readers and README.md` });
  return facts;
}

// P4: a schema key changed while no committed config did.
function configSchema({ files }) {
  const schema = files.find((f) => f.file === SCHEMA_FILE && !f.binary);
  if (!schema) return [];
  if (![...schema.added, ...schema.removed].some((l) => SCHEMA_KEY.test(l.text))) return [];
  if (files.some((f) => CONFIG_FILES.includes(f.file))) return [];
  const line = schema.added.find((l) => SCHEMA_KEY.test(l.text))?.line;
  return [{ file: SCHEMA_FILE, ...(line ? { line } : {}), note: `config schema keys changed but ${CONFIG_FILES.join(' and ')} did not; check them and the inline configs in tests` }];
}

// P5: which rag-system commit the external counterparts come from.
function externalCounterpart({ repoRoot }) {
  const sha = (readSmallFile(join(repoRoot, EXTERNAL_SHA), MAX_SHA_FILE) ?? '').trim();
  return [
    SHA_RE.test(sha)
      ? { file: EXTERNAL_SHA, note: `rag-system counterparts at .review-external/rag-system, commit ${sha}` }
      : { file: EXTERNAL_SHA, note: 'external counterparts unavailable: report rag-system links as unverified (external)' },
  ];
}

export default [
  { name: 'nodenext-ext', run: nodenextExt },
  { name: 'transport-pair', run: transportPair },
  { name: 'env-var-docs', run: envVarDocs },
  { name: 'config-schema', run: configSchema },
  { name: 'external-counterpart', run: externalCounterpart },
];
