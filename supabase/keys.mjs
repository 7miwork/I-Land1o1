// ============================================================
// I-Land1o1 – Zentrale Schluessel-Verwaltung
// ------------------------------------------------------------
// Warum? Damit der service_role-Key nur EINMAL eingetragen
// werden muss und nicht bei jedem Script-Aufruf neu gesetzt.
//
// Zwei moegliche Quellen (Reihenfolge):
//   1) supabase/.env.local   (empfohlen, liegt im Projekt, ist git-ignoriert)
//   2) Umgebungsvariable     (z. B. $env:SUPABASE_SERVICE_ROLE_KEY)
//
// Einmalig einrichten:
//   Copy-Item .env.example supabase\.env.local
//   notepad supabase\.env.local
//   -> SUPABASE_SERVICE_ROLE_KEY=... eintragen, speichern
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

function parseEnvFile(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    // Anfuehrungszeichen entfernen
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

// .env.local im Repo-Root und im supabase/-Ordner lesen
const fileEnv = {
  ...parseEnvFile(path.join(here, '..', '.env.local')),
  ...parseEnvFile(path.join(here, '.env.local')),
};

export function getKey(name) {
  return process.env[name] || fileEnv[name] || '';
}

// Alles aus .env.local als Objekt (fuer Scripts, die viele Werte brauchen)
export function getEnv() {
  return { ...fileEnv };
}

// Projekt-URL: aus config.js (steht dort bereits) oder .env.local
export function getProjectUrl() {
  const cfgFile = path.join(here, '..', 'dashboard', 'config.js');
  const fromFile = fs
    .readFileSync(cfgFile, 'utf8')
    .match(/SUPABASE_URL:\s*'([^']+)'/);
  return getKey('SUPABASE_URL') || (fromFile ? fromFile[1] : '');
}

// Anon-Key: aus config.js (oeffentlich, steht dort schon)
export function getAnonKey() {
  const cfgFile = path.join(here, '..', 'dashboard', 'config.js');
  const m = fs.readFileSync(cfgFile, 'utf8').match(/SUPABASE_ANON_KEY:\s*'([^']+)'/);
  return m ? m[1] : '';
}

// Fehlende Schluessel klar benennen statt komisch zu scheitern
export function requireKey(name, hinweis = '') {
  const v = getKey(name);
  if (!v) {
    console.error(`\n❌ Fehlt: ${name}\n`);
    console.error('Einmalig einrichten:');
    console.error('  Copy-Item .env.example supabase\\.env.local');
    console.error('  notepad supabase\\.env.local');
    console.error(`  -> ${name}=... eintragen und speichern`);
    if (hinweis) console.error(`\n  ${hinweis}`);
    process.exit(1);
  }
  return v;
}