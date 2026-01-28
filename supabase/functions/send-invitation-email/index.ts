// Supabase Edge Function to send invitation emails via Brevo
// With JWT authentication
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')
const APP_URL = Deno.env.get('APP_URL') || 'http://localhost:5173'
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'noreply@yourdomain.com'
const FROM_NAME = Deno.env.get('FROM_NAME') || 'Meeting Manager'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface InvitationPayload {
  email: string
  groupName: string
  inviterName: string
  joinCode: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify the user is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with the user's JWT
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    })

    // Verify the JWT is valid by getting the user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const payload: InvitationPayload = await req.json()
    const { email, groupName, inviterName, joinCode } = payload

    if (!email || !groupName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Dev mode - just log if no API key
    if (!BREVO_API_KEY) {
      console.log(`[DEV MODE] Would send email to ${email}:`)
      console.log(`  Group: ${groupName}, Inviter: ${inviterName}, Code: ${joinCode}`)
      return new Response(
        JSON.stringify({ success: true, message: 'Email logged (dev mode)' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .logo { font-size: 24px; font-weight: bold; color: #0d9488; }
            .card { background: #f8fafc; border-radius: 12px; padding: 30px; margin-bottom: 20px; }
            .group-name { font-size: 20px; font-weight: 600; color: #0d9488; margin-bottom: 10px; }
            .code { background: #0d9488; color: white; font-size: 24px; font-weight: bold; letter-spacing: 4px; padding: 15px 25px; border-radius: 8px; display: inline-block; margin: 20px 0; }
            .button { display: inline-block; background: #0d9488; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: 600; }
            .footer { text-align: center; color: #64748b; font-size: 14px; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">📅 Meeting Manager</div>
            </div>
            <div class="card">
              <p>Hi there!</p>
              <p><strong>${inviterName}</strong> has invited you to join a group:</p>
              <div class="group-name">${groupName}</div>
              <p>To join this group:</p>
              <ol>
                <li>Log into Meeting Manager</li>
                <li>Click "Join Group" in the header</li>
                <li>Enter this code:</li>
              </ol>
              <div style="text-align: center;">
                <div class="code">${joinCode}</div>
              </div>
              <p style="text-align: center; margin-top: 20px;">
                <a href="${APP_URL}" class="button">Open Meeting Manager</a>
              </p>
            </div>
            <div class="footer">
              <p>If you didn't expect this invitation, you can safely ignore this email.</p>
            </div>
          </div>
        </body>
      </html>
    `

    // Send via Brevo API
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { email: FROM_EMAIL, name: FROM_NAME },
        to: [{ email: email }],
        subject: `You're invited to join "${groupName}" on Meeting Manager`,
        htmlContent: emailHtml,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('Brevo error:', data)
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: data }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Email sent to ${email} for group ${groupName} by user ${user.email}`)

    return new Response(
      JSON.stringify({ success: true, messageId: data.messageId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
