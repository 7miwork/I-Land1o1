// Liefert eine kurzlebige, signierte Video-URL – NUR mit aktivem Abo.
//
// Ablauf: Login prüfen -> Lektions-ID serverseitig in den Dateipfad
// auflösen -> Bezahlung prüfen (eigenes Abo ODER Abo eines Elternteils)
// -> signierte URL (5 Minuten gültig).
//
// Verify JWT: AN

import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { corsHeaders, json, preflight, fail } from '../_shared/cors.ts';

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
    const { data: subs } = await db
      .from('subscriptions')
      .select('user_id, status')
      .in('user_id', payerIds)
      .in('status', ['active', 'trialing']);

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