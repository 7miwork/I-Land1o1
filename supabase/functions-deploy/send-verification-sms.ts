import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN')
const twilioFromNumber = Deno.env.get('TWILIO_FROM_NUMBER')

serve(async (req) => {
  try {
    const { phoneNumber, code } = await req.json()

    if (!phoneNumber || !code) {
      return new Response(
        JSON.stringify({ error: 'phoneNumber und code erforderlich' }),
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
        JSON.stringify({ error: 'SMS konnte nicht versendet werden' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, message: 'SMS versendet' }),
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