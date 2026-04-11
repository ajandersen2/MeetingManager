import db from '../db.js'
import { authenticate } from '../middleware/auth.js'

export default async function invitationRoutes(fastify) {
  fastify.addHook('preHandler', authenticate)

  // GET /api/invitations (pending invitations for current user)
  fastify.get('/api/invitations', async (request) => {
    const { rows } = await db.query(
      `SELECT gi.*, mg.name AS group_name
       FROM group_invitations gi
       JOIN meeting_groups mg ON mg.id = gi.group_id
       WHERE gi.email = $1 AND gi.status = 'pending'
       ORDER BY gi.created_at DESC`,
      [request.userEmail]
    )
    return rows.map(r => ({
      ...r,
      meeting_groups: { name: r.group_name }
    }))
  })

  // GET /api/groups/:id/invitations
  fastify.get('/api/groups/:id/invitations', async (request) => {
    const { rows } = await db.query(
      `SELECT * FROM group_invitations
       WHERE group_id = $1 AND status = 'pending'
       ORDER BY created_at DESC`,
      [request.params.id]
    )
    return rows
  })

  // POST /api/groups/:id/invite
  fastify.post('/api/groups/:id/invite', async (request, reply) => {
    const { id } = request.params
    const { email } = request.body

    try {
      await db.query(
        'INSERT INTO group_invitations (group_id, email, invited_by) VALUES ($1, $2, $3)',
        [id, email.toLowerCase().trim(), request.userId]
      )

      // Get inviter name for response
      const { rows } = await db.query(
        'SELECT display_name FROM user_profiles WHERE user_id = $1',
        [request.userId]
      )

      return { success: true, inviterName: rows[0]?.display_name }
    } catch (err) {
      if (err.code === '23505') {
        return reply.status(409).send({ message: 'This email has already been invited' })
      }
      throw err
    }
  })

  // POST /api/invitations/:id/accept
  fastify.post('/api/invitations/:id/accept', async (request, reply) => {
    const { id } = request.params

    const inv = await db.query(
      "SELECT * FROM group_invitations WHERE id = $1 AND email = $2 AND status = 'pending'",
      [id, request.userEmail]
    )
    if (inv.rows.length === 0) {
      return reply.status(404).send({ message: 'Invitation not found' })
    }

    const invitation = inv.rows[0]

    await db.query(
      'INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, $3)',
      [invitation.group_id, request.userId, 'member']
    )

    await db.query(
      "UPDATE group_invitations SET status = 'accepted', responded_at = NOW() WHERE id = $1",
      [id]
    )

    return { success: true }
  })

  // POST /api/invitations/:id/decline
  fastify.post('/api/invitations/:id/decline', async (request, reply) => {
    const { rowCount } = await db.query(
      "UPDATE group_invitations SET status = 'declined', responded_at = NOW() WHERE id = $1 AND email = $2",
      [request.params.id, request.userEmail]
    )
    if (rowCount === 0) return reply.status(404).send({ message: 'Invitation not found' })
    return { success: true }
  })

  // DELETE /api/invitations/:id
  fastify.delete('/api/invitations/:id', async (request) => {
    await db.query('DELETE FROM group_invitations WHERE id = $1', [request.params.id])
    return { success: true }
  })
}
