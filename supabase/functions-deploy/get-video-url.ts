// ============================================================
// I-Land1o1 – get-video-url
// EINFÜGEN in Supabase -> Edge Functions -> get-video-url -> index.ts
// ------------------------------------------------------------
// Diese Datei ist eine Einzeldatei-Fassung: cors.ts und plans.ts
// sind bereits eingebettet, daher gibt es keine _shared-Importe.
// Quelle im Repo: supabase/functions/get-video-url/index.ts
// ============================================================

// ---------- _shared/cors.ts ----------
// Gemeinsame CORS-Helfer fuer alle Edge Functions.
// CORS ist noetig, damit das Dashboard (andere Domain/Port) die Function aufrufen kann.
// Sicherheit entsteht NICHT dadurch, sondern durch die JWT-Pruefung in jeder Function.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Preflight beantworten und null zurueckgeben, wenn es kein OPTIONS ist.
function preflight(req) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
}

// Klare Fehlermeldungen, ohne interne Details nach aussen zu geben.
// `extra` wird mitgeschickt (z. B. { locked: true }).
function fail(message, status = 400, extra = {}) {
  console.error('[edge]', message, extra);
  return json({ error: message, ...extra }, status);
}

// ---------- _shared/plans.ts ----------
// Serverseitige Tarif-Whitelist.
//
// SICHERHEITSKERN: Der Browser darf nur einen PLAN-NAMEN schicken
// (z. B. "level1-monthly"), niemals einen Preis. Die Preis-ID wird
// hier serverseitig aufgeloest. Sonst koennte jeder Besucher im
// Browser seinen Abo-Preis auf 1 Cent stellen.

const PLANS = {
  'level1-monthly': {
    priceEnv: 'STRIPE_PRICE_LEVEL1_MONTHLY',
    label: 'Level 1 – monatlich',
    mode: 'subscription',
  },
  'level1-yearly': {
    priceEnv: 'STRIPE_PRICE_LEVEL1_YEARLY',
    label: 'Level 1 – jährlich',
    mode: 'subscription',
  },
  // Einmalzahlung: dauerhafter Zugang, kein Abo, keine Verlaengerung
  'level1-once': {
    priceEnv: 'STRIPE_PRICE_LEVEL1_ONCE',
    label: 'Level 1 – einmalig (11 Lektionen)',
    mode: 'payment',
  },
};

// Liefert die Preis-ID oder null, wenn der Plan unbekannt bzw.
// die Secret nicht gesetzt ist.
function priceFor(plan) {
  const entry = PLANS[plan];
  if (!entry) return null;
  const id = Deno.env.get(entry.priceEnv);
  // Sicherheitsnetz: eine Preis-ID sieht immer so aus. Verhindert,
  // dass jemand versehentlich den Secret-Key als "Preis" setzt.
  return id && id.startsWith('price_') ? id : null;
}

function labelFor(plan) {
  return PLANS[plan]?.label ?? plan;
}

// 'subscription' = Abo mit Verlaengerung, 'payment' = einmaliger Kauf
function modeFor(plan) {
  return PLANS[plan]?.mode === 'payment' ? 'payment' : 'subscription';
}

function siteUrl() {
  return (Deno.env.get('SITE_URL') || 'https://i-land1o1.com').replace(/\/$/, '');
}

// Holt den angemeldeten User aus dem JWT. Ohne gueltige Session: null.
async function requireUser(req, supabase) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;
  const { data, error } = await supabase.auth.getUser(authHeader.replace('Bearer ', '').trim());
  if (error || !data?.user) return null;
  return data.user;
}

// ---------- get-video-url/index.ts ----------
// Liefert eine kurzlebige, signierte Video-URL – NUR mit aktivem Abo.
//
// Ablauf: Login prüfen -> Lektions-ID serverseitig in den Dateipfad
// auflösen -> Bezahlung prüfen (eigenes Abo ODER Abo eines Elternteils)
// -> signierte URL (5 Minuten gültig).
//
// Verify JWT: AN

import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const BUCKET = 'course-videos';
const URL_TTL_SECONDS = 300; // 5 Minuten reichen zum Anschauen

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    if (req.method !== 'POST') return fail('Method not allowed', 405);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceKey) return fail('Server nicht konfiguriert.', 500);

    // 1) Wer ruft an?
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return fail('Bitte zuerst anmelden.', 401);
    const anon = createClient(supabaseUrl, anonKey);
    const { data: userData, error: userError } = await anon.auth.getUser(
      authHeader.replace('Bearer ', '').trim()
    );
    if (userError || !userData?.user) return fail('Bitte zuerst anmelden.', 401);
    const userId = userData.user.id;

    // 2) Welche Lektion? (Pfad kommt NICHT vom Browser)
    let body;
    try {
      body = await req.json();
    } catch {
      return fail('Ungueltige Anfrage.', 400);
    }
    const lessonId = String(body?.lessonId || '');
    if (!lessonId) return fail('Keine Lektion angegeben.', 400);

    const db = createClient(supabaseUrl, serviceKey);

    const { data: lesson } = await db
      .from('lesson_videos')
      .select('storage_path, published')
      .eq('lesson_id', lessonId)
      .maybeSingle();
    if (!lesson || !lesson.published) return fail('Lektion nicht verfuegbar.', 404);

    // 3) Bezahlung prüfen: eigenes Abo oder Abo eines Elternteils
    const { data: links } = await db
      .from('parent_links')
      .select('parent_id')
      .eq('student_id', userId);

    const payerIds = [userId, ...(links || []).map((l) => l.parent_id)];
    // 'paid' = einmaliger Kauf (dauerhaft), 'active'/'trialing' = Abo
    const { data: subs } = await db
      .from('subscriptions')
      .select('user_id, status')
      .in('user_id', payerIds)
      .in('status', ['active', 'trialing', 'paid']);

    if (!subs || subs.length === 0) {
      return fail('Fuer diese Lektion brauchst du ein aktives Abo.', 403, { locked: true });
    }

    // 4) Kurzlebige URL erzeugen und ausliefern
    const { data: signed, error: signError } = await db.storage
      .from(BUCKET)
      .createSignedUrl(lesson.storage_path, URL_TTL_SECONDS);

    if (signError || !signed?.signedUrl) {
      console.error('[video] signUrl fehlgeschlagen', signError);
      return fail('Video konnte nicht geladen werden.', 500);
    }

    console.log('[video] URL ausgeliefert', { userId, lessonId });
    return json(
      { url: signed.signedUrl, expiresIn: URL_TTL_SECONDS },
      200
    );
  } catch (err) {
    console.error('[video] get-video-url', err);
    return fail('Video konnte nicht geladen werden.', 500);
  }
});
