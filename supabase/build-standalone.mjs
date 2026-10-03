// ============================================================
// I-Land1o1 – Baut aus den_functions/-Dateien einfache
// Einzel-Dateien fuer den Supabase-Web-Editor.
//
// Warum? Der Browser-Editor kennt keine _shared/-Ordner.
// Deshalb werden cors.ts + plans.ts in jede Function
// eingebettet und die import-Zeilen entfernt.
//
// Verwendung:
//   node supabase/build-standalone.mjs
// Ergebnis:
//   supabase/functions-deploy/<name>.ts   <- das kopierst du
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const fnDir = path.join(here, 'functions');
const outDir = path.join(here, 'functions-deploy');

const TARGETS = [
  'create-checkout-session',
  'create-portal-session',
  'get-video-url',
  'stripe-webhook',
];

function readShared(name) {
  const src = fs.readFileSync(path.join(fnDir, '_shared', name), 'utf8');
  // "export function x" -> "function x", damit es spaeter keine
  // doppelten/dead Exporte im Bundle gibt.
  return src
    .replace(/^export\s+/gm, '')
    .replace(/^import .*$/gm, '')
    .trim();
}

const cors = readShared('cors.ts');
const plans = readShared('plans.ts');

fs.mkdirSync(outDir, { recursive: true });

for (const name of TARGETS) {
  const indexPath = path.join(fnDir, name, 'index.ts');
  if (!fs.existsSync(indexPath)) {
    console.warn('⚠️  fehlt:', indexPath);
    continue;
  }

  const index = fs.readFileSync(indexPath, 'utf8');

  // Alle Zeilen entfernen, die aus _shared importieren
  const cleaned = index
    .split('\n')
    .filter((l) => !/^import .*_shared\//.test(l.trim()))
    .join('\n')
    .trim();

  const header = `// ============================================================
// I-Land1o1 – ${name}
// EINFÜGEN in Supabase -> Edge Functions -> ${name} -> index.ts
// ------------------------------------------------------------
// Diese Datei ist eine Einzeldatei-Fassung: cors.ts und plans.ts
// sind bereits eingebettet, daher gibt es keine _shared-Importe.
// Quelle im Repo: supabase/functions/${name}/index.ts
// ============================================================

// ---------- _shared/cors.ts ----------
${cors}

// ---------- _shared/plans.ts ----------
${plans}

// ---------- ${name}/index.ts ----------
${cleaned}
`;

  const out = path.join(outDir, `${name}.ts`);
  fs.writeFileSync(out, header, 'utf8');

  const lines = header.split('\n').length;
  const hasSharedImport = /^import .*_shared\//m.test(header);
  console.log(
    `${hasSharedImport ? '❌' : '✅'} ${name.padEnd(24)} ${String(lines).padStart(4)} Zeilen -> ${path.relative(here, out)}`
  );
}

console.log('\nFertig. Jede Datei so kopieren:');
console.log('  1. Supabase -> Edge Functions -> <Name> -> Edit function');
console.log('  2. Inhalt von index.ts komplett markieren (Strg+A) und ersetzen (Strg+V)');
console.log('  3. Deploy.  Verify JWT: nur beim stripe-webhook AUS.');