// ============================================================
// Warum es diese Datei gibt
// ------------------------------------------------------------
// BEI DEMO-KONTEN (nur eltern@, kind@, admin@) blendet Supabase
// auf /login dauerhaft ein:
//
//   "Your phone number has not been verified yet.  Verify now"
//
// Ursache ist eine PROJEKT-Einstellung, nicht das Konto:
//   Supabase -> Authentication -> Providers -> Phone
//     -> "Confirm phone number" ist AN und SMS-Provider ist Twilio.
// Das Konto selbst hat ueberhaupt keine Telefonnummer – aber das
// leere Feld phone ("") gilt Supabase als "vorhanden, unbestaetigt".
//
// LOESUNG: In den Auth-Einstellungen "Confirm phone number"
// ausschalten (bzw. Phone-Provider deaktivieren, wenn SMS ohnehin
// nicht genutzt wird). Die Meldung verschwindet dann fuer alle.
//
// WICHTIG: Das hat mit der E-Mail-Bestaetigung NICHTS zu tun.
// mailer_autoconfirm bleibt bewusst auf false, damit sich echte
// Nutzer weiterhin per E-Mail bestaetigen muessen. Nur die drei
// Demo-Konten sind einzeln bestaetigt (email_confirm: true beim
// Anlegen ueber die Admin-API).
//
// Diese Datei setzt phone auf '' (Leerstring) fuer die drei
// Demo-Konten. Pruefen mit:
//   node supabase/clear-demo-phones.mjs
// ============================================================

const SB_URL = getProjectUrl();
const KEY = getKey('SUPABASE_SERVICE_ROLE_KEY');

const IDS = {
  'admin@i-land1o1.com': '8a502970-e0d8-4434-ba64-530a53b5dcfd',
  'eltern@i-land1o1.com': '02da27ad-b257-4465-85ab-bc9397e87345',
  'kind@i-land1o1.com': 'd86fa45b-91a0-4509-84ca-5948ee7a29f7',
};

const headers = {
  apikey: KEY,
  Authorization: 'Bearer ' + KEY,
  'Content-Type': 'application/json',
};

// Supabase behandelt ein leeres phone-Feld (Leerstring) als
// "vorhanden, aber nicht bestaetigt" -> die Login-Seite zeigt dann
// dauerhaft "phone number has not been verified".
// Deshalb wird phone explizit geleert.
for (const [email, id] of Object.entries(IDS)) {
  const res = await fetch(`${SB_URL}/auth/v1/admin/users/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ phone: '' }),
  });
  const j = await res.json();
  console.log(
    `${email.padEnd(30)} HTTP ${res.status} | phone: ${JSON.stringify(j.phone)} | confirmed: ${JSON.stringify(j.phone_confirmed_at ?? null)}`
  );
}