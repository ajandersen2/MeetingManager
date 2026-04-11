import db from '../db.js'
import { authenticate } from '../middleware/auth.js'

export default async function groupRoutes(fastify) {
  fastify.addHook('preHandler', authenticate)

  // GET /api/groups
  fastify.get('/api/groups', async (request) => {
    const { rows } = await db.query(
      `SELECT mg.*, gm.role,
        (SELECT COUNT(*) FROM meetings m WHERE m.group_id = mg.id) AS meeting_count
       FROM group_members gm
       JOIN meeting_groups mg ON mg.id = gm.group_id
       WHERE gm.user_id = $1
       ORDER BY mg.name`,
      [request.userId]
    )
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      join_code: r.join_code,
      created_by: r.created_by,
      role: r.role,
      meetingCount: parseInt(r.meeting_count) || 0
    }))
  })

  // POST /api/groups
  fastify.post('/api/groups', async (request) => {
    const { name } = request.body

    // Generate join code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let joinCode = ''
    for (let i = 0; i < 6; i++) {
      joinCode += chars.charAt(Math.floor(Math.random() * chars.length))
    }

    const { rows } = await db.query(
      'INSERT INTO meeting_groups (name, join_code, created_by) VALUES ($1, $2, $3) RETURNING *',
      [name.trim(), joinCode, request.userId]
    )
    const group = rows[0]

    await db.query(
      'INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, $3)',
      [group.id, request.userId, 'owner']
    )

    return group
  })

  // PUT /api/groups/:id
  fastify.put('/api/groups/:id', async (request, reply) => {
    const { id } = request.params
    const { name } = request.body

    const { rowCount } = await db.query(
      `UPDATE meeting_groups SET name = $1 WHERE id = $2
       AND EXISTS (SELECT 1 FROM group_members WHERE group_id = $2 AND user_id = $3 AND role = 'owner')`,
      [name.trim(), id, request.userId]
    )
    if (rowCount === 0) return reply.status(403).send({ message: 'Not authorized' })
    return { success: true }
  })

  // DELETE /api/groups/:id
  fastify.delete('/api/groups/:id', async (request, reply) => {
    const { rowCount } = await db.query(
      `DELETE FROM meeting_groups WHERE id = $1
       AND EXISTS (SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2 AND role = 'owner')`,
      [request.params.id, request.userId]
    )
    if (rowCount === 0) return reply.status(403).send({ message: 'Not authorized' })
    return { success: true }
  })

  // POST /api/groups/join
  fastify.post('/api/groups/join', async (request, reply) => {
    const { joinCode } = request.body
    const { rows } = await db.query(
      'SELECT id, name FROM meeting_groups WHERE join_code = $1',
      [joinCode.toUpperCase().trim()]
    )
    if (rows.length === 0) {
      return reply.status(404).send({ message: 'Invalid join code' })
    }

    const group = rows[0]

    // Check if already member
    const existing = await db.query(
      'SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2',
      [group.id, request.userId]
    )
    if (existing.rows.length > 0) {
      return reply.status(409).send({ message: 'Already a member of this group' })
    }

    await db.query(
      'INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, $3)',
      [group.id, request.userId, 'member']
    )
    return group
  })

  // GET /api/groups/:id/members
  fastify.get('/api/groups/:id/members', async (request) => {
    const { rows } = await db.query(
      `SELECT gm.id, gm.role, gm.user_id, p.display_name
       FROM group_members gm
       LEFT JOIN user_profiles p ON p.user_id = gm.user_id
       WHERE gm.group_id = $1`,
      [request.params.id]
    )
    return rows.map(m => ({
      ...m,
      display_name: m.display_name || 'Unknown User',
      isCurrentUser: m.user_id === request.userId
    }))
  })

  // DELETE /api/groups/:groupId/members/:memberId
  fastify.delete('/api/groups/:groupId/members/:memberId', async (request, reply) => {
    const { groupId, memberId } = request.params

    // Get the member being removed
    const member = await db.query('SELECT user_id FROM group_members WHERE id = $1', [memberId])
    if (member.rows.length === 0) return reply.status(404).send({ message: 'Member not found' })

    const memberUserId = member.rows[0].user_id
    const isSelf = memberUserId === request.userId

    // Must be owner or removing self
    if (!isSelf) {
      const ownerCheck = await db.query(
        "SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2 AND role = 'owner'",
        [groupId, request.userId]
      )
      if (ownerCheck.rows.length === 0) {
        return reply.status(403).send({ message: 'Not authorized' })
      }
    }

    await db.query('DELETE FROM group_members WHERE id = $1', [memberId])
    return { success: true }
  })
}
