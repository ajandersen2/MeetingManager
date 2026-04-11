/**
 * Email routes — sends invitation emails via Brevo API
 * Replaces the old Supabase Edge Function (send-invitation-email)
 */
import { authenticate } from '../middleware/auth.js'

const BREVO_API_KEY = process.env.BREVO_API_KEY
const APP_URL = process.env.SERVER_URL || 'http://localhost:5173'
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@sharetrack.org'
const FROM_NAME = process.env.FROM_NAME || 'Meeting Manager'

export default async function emailRoutes(fastify) {
  fastify.addHook('preHandler', authenticate)

  // POST /api/send-invitation-email
  fastify.post('/api/send-invitation-email', async (request, reply) => {
    const { email, groupName, inviterName, joinCode } = request.body

    if (!email || !groupName) {
      return reply.status(400).send({ message: 'Missing required fields (email, groupName)' })
    }

    // Dev mode — log instead of sending when no API key
    if (!BREVO_API_KEY) {
      request.log.info(`[DEV MODE] Would send invitation email to ${email} for group "${groupName}"`)
      return { success: true, message: 'Email logged (dev mode — no BREVO_API_KEY configured)' }
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
              <p><strong>${inviterName || 'Someone'}</strong> has invited you to join a group:</p>
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

    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': BREVO_API_KEY,
        },
        body: JSON.stringify({
          sender: { email: FROM_EMAIL, name: FROM_NAME },
          to: [{ email }],
          subject: `You're invited to join "${groupName}" on Meeting Manager`,
          htmlContent: emailHtml,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        request.log.error({ brevoError: data }, 'Brevo API error')
        return reply.status(500).send({ message: 'Failed to send email', details: data })
      }

      request.log.info(`Invitation email sent to ${email} for group "${groupName}" by user ${request.userEmail}`)
      return { success: true, messageId: data.messageId }

    } catch (err) {
      request.log.error(err, 'Email send error')
      return reply.status(500).send({ message: 'Failed to send email' })
    }
  })
}
