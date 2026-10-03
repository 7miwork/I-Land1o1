// Gemeinsame CORS-Helfer fuer alle Edge Functions.
// CORS ist noetig, damit das Dashboard (andere Domain/Port) die Function aufrufen kann.
// Sicherheit entsteht NICHT dadurch, sondern durch die JWT-Pruefung in jeder Function.

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Preflight beantworten und null zurueckgeben, wenn es kein OPTIONS ist.
export function preflight(req) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
}

// Klare Fehlermeldungen, ohne interne Details nach aussen zu geben.
export function fail(message, status = 400, extra = {}) {
  console.error('[edge]', message, extra);
  return json({ error: message }, status);
}