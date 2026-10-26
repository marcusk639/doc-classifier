// doc-classifier project checks (pr-review-kit extension point). They run in
// the facts step from the base checkout and return hints for the model to
// confirm, never verdicts. Node built-ins only.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const TS = /\.(?:ts|mts|cts)$/;
const RELATIVE_SPEC = /(?:\bfrom\s*|\bimport\s*\(\s*|^\s*import\s+)["'](\.{1,2}\/[^"']*)["']/g;
const ENV_READ = /\bprocess\.env\.([A-Z][A-Z0-9_]*)/g;
const SCHEMA_KEY = /^\s*[A-Za-z_]\w*\s*:\s*(?:z\.|DocumentClassSchema\b)/;
const SHA_RE = /^[0-9a-f]{40}$/;

const TRANSPORTS = ['src/server.ts', 'src/mcp/server.ts'];
const CONFIG_FILES = ['config/test.json', 'config/example.json.example'];
const SCHEMA_FILE = 'src/config/product-config.ts';
const EXTERNAL_SHA = '.review-external/rag-system.sha';

const textFiles = (files) => files.filter((f) => !f.binary);

function readOr(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

// P1: relative imports must carry .js under NodeNext; Vitest hides a miss.
function nodenextExt({ files }) {
  const facts = [];
  for (const f of textFiles(files).filter((x) => TS.test(x.file) && x.status !== 'D')) {
    for (const a of f.added) {
      for (const m of a.text.matchAll(RELATIVE_SPEC)) {
        if (!/\.(?:js|mjs|cjs|json)$/.test(m[1])) facts.push({ file: f.file, line: a.line, note: `relative import "${m[1]}" has no .js extension (NodeNext; tests still pass, tsc and node fail)` });
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

// P3: env vars read or dropped in the diff, against the README.
function envVarDocs({ files, repoRoot }) {
  const added = new Map();
  const removed = new Map();
  for (const f of textFiles(files)) {
    for (const a of f.added) for (const m of a.text.matchAll(ENV_READ)) if (!added.has(m[1])) added.set(m[1], { file: f.file, line: a.line });
    for (const r of f.removed) for (const m of r.text.matchAll(ENV_READ)) if (!removed.has(m[1])) removed.set(m[1], { file: f.oldFile ?? f.file });
  }
  const readme = readOr(join(repoRoot, 'README.md')) ?? '';
  const facts = [];
  for (const [name, at] of added) facts.push({ ...at, note: `reads ${name}: ${new RegExp(`\\b${name}\\b`).test(readme) ? 'documented in README.md' : 'not in README.md'}` });
  for (const [name, at] of removed) if (!added.has(name)) facts.push({ file: at.file, note: `${name} no longer read here; check its other readers and README.md` });
  return facts;
}

// P4: a schema key changed while no committed config did.
function configSchema({ files }) {
  const schema = files.find((f) => f.file === SCHEMA_FILE && !f.binary);
  if (!schema) return [];
  const keyLines = [...schema.added, ...schema.removed].filter((l) => SCHEMA_KEY.test(l.text));
  if (!keyLines.length) return [];
  if (files.some((f) => CONFIG_FILES.includes(f.file))) return [];
  const line = schema.added.find((l) => SCHEMA_KEY.test(l.text))?.line;
  return [{ file: SCHEMA_FILE, ...(line ? { line } : {}), note: `config schema keys changed but ${CONFIG_FILES.join(' and ')} did not; check them and the inline configs in tests` }];
}

// P5: which rag-system commit the external counterparts come from.
function externalCounterpart({ repoRoot }) {
  const sha = (readOr(join(repoRoot, EXTERNAL_SHA)) ?? '').trim();
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
