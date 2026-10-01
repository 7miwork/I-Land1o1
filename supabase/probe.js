// Temporaere Diagnose: Existieren die Supabase-Tabellen schon? (nur anon key)
const fs = require('fs'), https = require('https');
const key = fs.readFileSync('Z:/I-Land1o1/Webseite/dashboard/config.js', 'utf8')
  .match(/SUPABASE_ANON_KEY:\s*'([^']+)'/)[1];

function probe(t) {
  return new Promise((resolve) => {
    https.get({
      hostname: 'lmlbjtazgcylsrtzzisr.supabase.co',
      path: '/rest/v1/' + t + '?select=*&limit=1',
      headers: { apikey: key, Authorization: 'Bearer ' + key },
    }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => resolve(t + ' -> HTTP ' + res.statusCode + ' ' + d.slice(0, 120)));
    }).on('error', (e) => resolve(t + ' -> FEHLER ' + e.message));
  });
}

(async () => {
  for (const t of ['profiles', 'parent_links', 'lesson_progress']) {
    console.log(await probe(t));
  }
  process.exit(0);
})();
