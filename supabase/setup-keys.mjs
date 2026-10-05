// ============================================================
// I-Land1o1 – Einmalige Key-Einrichtung
// ------------------------------------------------------------
// Legt supabase/.env.local an und sagt, was reinkopiert
// werden muss. Danach muessen die Keys NIE wieder eingetragen
// werden – alle Scripts lesen sie automatisch von dort.
//
// Verwendung:
//   node supabase/setup-keys.mjs
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(here, '.env.local');

// Projekt-URL aus config.js holen, damit sie nicht doppelt gepflegt
// werden muss (die steht dort bereits korrekt drin).
function detectProjectUrl() {
  try {
    const cfg = fs.readFileSync(path.join(here, '..', 'dashboard', 'config.js'), 'utf8');
    const m = cfg.match(/SUPABASE_URL:\s*'([^']+)'/);
    return m ? m[1] : '';
  } catch {
    return '';
  }
}

const projectUrl = detectProjectUrl();

const TEMPLATE = `# ============================================================
# I-Land1o1 – lokale Schluessel (BLEIBT AUF DEINEM REICHNER)
# Diese Datei steht in .gitignore und wird nie hochgeladen.
# ============================================================

# Projekt-URL (steht auch in dashboard/config.js)
SUPABASE_URL=${projectUrl}

# Project Settings -> API -> service_role (Reveal klicken)
SUPABASE_SERVICE_ROLE_KEY=

# Stripe Developers -> API keys (nur noetig fuer lokale Skripte)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
`;

if (fs.existsSync(target)) {
  console.log('supabase/.env.local existiert bereits – nichts zu tun.');
  console.log('Datei: ' + target);
} else {
  fs.writeFileSync(target, TEMPLATE, 'utf8');
  console.log('Angelegt: ' + target);
  console.log('\nJetzt mit Notepad oeffnen und eintragen:\n');
  console.log('  SUPABASE_SERVICE_ROLE_KEY  <- Project Settings -> API -> service_role');
  console.log('  SUPABASE_URL               <- steht auch in dashboard/config.js');
  console.log('\nDanach ist der Key dauerhaft gespeichert und alle');
  console.log('Scripts nutzen ihn automatisch.');
}

console.log('\nSicherheits-Hinweis:');
console.log('Die Datei ist in .gitignore. Trotzdem: service_role umgeht');
console.log('ALLE Sicherheitsregeln von Supabase. Nicht weitergeben,');
console.log('nicht ins Git, nicht auf einen Webserver hochladen.');