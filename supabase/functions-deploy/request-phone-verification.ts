import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN')
const twilioFromNumber = Deno.env.get('TWILIO_FROM_NUMBER')

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

serve(async (req) => {
  try {
    const { phoneNumber } = await req.json()

    if (!phoneNumber) {
      return new Response(
        JSON.stringify({ error: 'phoneNumber erforderlich' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber) {
      console.error('Twilio Secrets nicht konfiguriert')
      return new Response(
        JSON.stringify({ error: 'SMS-Dienst nicht konfiguriert' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server-Konfiguration fehlt' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

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

    const code = generateCode()

    await supabase
      .from('phone_verification_codes')
      .update({ verified_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('phone_number', phoneNumber)
      .is('verified_at', null)

    const { error: insertError } = await supabase
      .from('phone_verification_codes')
      .insert({
        user_id: user.id,
        phone_number: phoneNumber,
        code: code,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      })

    if (insertError) {
      console.error('Code speichern Fehler:', insertError.message)
      return new Response(
        JSON.stringify({ error: 'Code konnte nicht gespeichert werden' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const messageBody = `Ihr I-Land1o1 Verifizierungscode: ${code}\nGültig für 10 Minuten.`

    const twilioResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `From=${encodeURIComponent(twilioFromNumber)}&To=${encodeURIComponent(phoneNumber)}&Body=${encodeURIComponent(messageBody)}`,
      }
    )

    if (!twilioResponse.ok) {
      const errorText = await twilioResponse.text()
      console.error('Twilio Fehler:', errorText)
      return new Response(
        JSON.stringify({ success: true, message: 'Code generiert, SMS-Versand fehlgeschlagen', code }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Verifizierungscode per SMS versendet' }),
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