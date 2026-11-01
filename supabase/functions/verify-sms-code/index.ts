import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const { phoneNumber, code } = await req.json()

    if (!phoneNumber || !code) {
      return new Response(
        JSON.stringify({ error: 'phoneNumber und code erforderlich' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Supabase Client mit Service Role (für direkte DB-Zugriffe)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server-Konfiguration fehlt' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Aktuellen User aus JWT holen
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Nicht authentifiziert' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Ungültige Session' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Gültigen, nicht verifizierten Code suchen
    const { data: codes, error: queryError } = await supabase
      .from('phone_verification_codes')
      .select('*')
      .eq('user_id', user.id)
      .eq('phone_number', phoneNumber)
      .is('verified_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)

    if (queryError || !codes || codes.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Kein gültiger Verifizierungscode gefunden' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const validCode = codes[0]

    // Code prüfen
    if (validCode.code !== code) {
      return new Response(
        JSON.stringify({ error: 'Falscher Verifizierungscode' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Code als verifiziert markieren
    const { error: updateError } = await supabase
      .from('phone_verification_codes')
      .update({ verified_at: new Date().toISOString() })
      .eq('id', validCode.id)

    if (updateError) {
      return new Response(
        JSON.stringify({ error: 'Code konnte nicht gespeichert werden' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Profil als telefon-verifiziert markieren + Nummer speichern
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ phone_verified: true, phone_number: phoneNumber })
      .eq('id', user.id)

    if (profileError) {
      console.error('Profile-Update Fehler:', profileError.message)
      // Nicht kritisch - Code war bereits verifiziert
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Telefonnummer erfolgreich verifiziert',
        phoneNumber,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Unerwarteter Fehler:', err.message)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})