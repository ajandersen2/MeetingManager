import db from '../db.js'
import { authenticate } from '../middleware/auth.js'

export default async function meetingRoutes(fastify) {
  // All routes require auth
  fastify.addHook('preHandler', authenticate)

  // GET /api/meetings?group_id=xxx
  fastify.get('/api/meetings', async (request) => {
    const { group_id } = request.query
    let query, params

    if (group_id) {
      // Meetings in a specific group (user must be a group member)
      query = `
        SELECT m.*,
          json_agg(DISTINCT jsonb_build_object('id', ma.id, 'name', ma.name, 'user_id', ma.user_id))
            FILTER (WHERE ma.id IS NOT NULL) AS meeting_attendees,
          jsonb_build_object('display_name', p.display_name) AS creator
        FROM meetings m
        LEFT JOIN meeting_attendees ma ON ma.meeting_id = m.id
        LEFT JOIN user_profiles p ON p.user_id = m.user_id
        WHERE m.group_id = $1
          AND EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = $1 AND gm.user_id = $2)
        GROUP BY m.id, p.display_name
        ORDER BY m.date DESC NULLS LAST`
      params = [group_id, request.userId]
    } else {
      // All meetings user can see: own meetings + meetings in their groups
      query = `
        SELECT m.*,
          json_agg(DISTINCT jsonb_build_object('id', ma.id, 'name', ma.name, 'user_id', ma.user_id))
            FILTER (WHERE ma.id IS NOT NULL) AS meeting_attendees,
          jsonb_build_object('display_name', p.display_name) AS creator
        FROM meetings m
        LEFT JOIN meeting_attendees ma ON ma.meeting_id = m.id
        LEFT JOIN user_profiles p ON p.user_id = m.user_id
        WHERE m.user_id = $1
          OR EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = m.group_id AND gm.user_id = $1)
        GROUP BY m.id, p.display_name
        ORDER BY m.date DESC NULLS LAST`
      params = [request.userId]
    }

    const { rows } = await db.query(query, params)
    return rows
  })

  // POST /api/meetings
  fastify.post('/api/meetings', async (request) => {
    const { name, date, time, location, objective, agenda_content, minutes_content, raw_transcript, group_id, attendees } = request.body

    const { rows } = await db.query(
      `INSERT INTO meetings (user_id, name, date, time, location, objective, agenda_content, minutes_content, raw_transcript, group_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [request.userId, name, date || null, time || null, location || null, objective || null,
       agenda_content || null, minutes_content || null, raw_transcript || null, group_id || null]
    )
    const meeting = rows[0]

    // Insert attendees
    if (attendees?.length > 0) {
      const values = attendees.map((att, i) => {
        const n = typeof att === 'string' ? att : att.name
        const uid = typeof att === 'string' ? null : (att.user_id || null)
        return `($1, $${i * 2 + 2}, $${i * 2 + 3})`
      }).join(', ')

      const attParams = [meeting.id]
      attendees.forEach(att => {
        attParams.push(typeof att === 'string' ? att : att.name)
        attParams.push(typeof att === 'string' ? null : (att.user_id || null))
      })

      // Use a simpler approach
      for (const att of attendees) {
        const n = typeof att === 'string' ? att : att.name
        const uid = typeof att === 'string' ? null : (att.user_id || null)
        await db.query(
          'INSERT INTO meeting_attendees (meeting_id, name, user_id) VALUES ($1, $2, $3)',
          [meeting.id, n, uid]
        )
      }
    }

    // Re-fetch with attendees and creator
    const { rows: full } = await db.query(
      `SELECT m.*,
        json_agg(DISTINCT jsonb_build_object('id', ma.id, 'name', ma.name, 'user_id', ma.user_id))
          FILTER (WHERE ma.id IS NOT NULL) AS meeting_attendees,
        jsonb_build_object('display_name', p.display_name) AS creator
       FROM meetings m
       LEFT JOIN meeting_attendees ma ON ma.meeting_id = m.id
       LEFT JOIN user_profiles p ON p.user_id = m.user_id
       WHERE m.id = $1
       GROUP BY m.id, p.display_name`,
      [meeting.id]
    )
    return full[0]
  })

  // PUT /api/meetings/:id
  fastify.put('/api/meetings/:id', async (request, reply) => {
    const { id } = request.params
    const { name, date, time, location, objective, agenda_content, minutes_content, raw_transcript, group_id, attendees } = request.body

    // Verify ownership or group membership
    const check = await db.query(
      `SELECT id FROM meetings WHERE id = $1 AND (user_id = $2
        OR EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = meetings.group_id AND gm.user_id = $2))`,
      [id, request.userId]
    )
    if (check.rows.length === 0) {
      return reply.status(404).send({ message: 'Meeting not found' })
    }

    await db.query(
      `UPDATE meetings SET name=$1, date=$2, time=$3, location=$4, objective=$5,
       agenda_content=$6, minutes_content=$7, raw_transcript=$8, group_id=$9, updated_at=NOW()
       WHERE id=$10`,
      [name, date || null, time || null, location || null, objective || null,
       agenda_content || null, minutes_content || null, raw_transcript || null,
       group_id || null, id]
    )

    // Replace attendees
    if (attendees !== undefined) {
      await db.query('DELETE FROM meeting_attendees WHERE meeting_id = $1', [id])
      if (attendees?.length > 0) {
        for (const att of attendees) {
          const n = typeof att === 'string' ? att : att.name
          const uid = typeof att === 'string' ? null : (att.user_id || null)
          await db.query(
            'INSERT INTO meeting_attendees (meeting_id, name, user_id) VALUES ($1, $2, $3)',
            [id, n, uid]
          )
        }
      }
    }

    return { success: true }
  })

  // DELETE /api/meetings/:id
  fastify.delete('/api/meetings/:id', async (request, reply) => {
    const { id } = request.params
    const { rowCount } = await db.query(
      'DELETE FROM meetings WHERE id = $1 AND user_id = $2',
      [id, request.userId]
    )
    if (rowCount === 0) {
      return reply.status(404).send({ message: 'Meeting not found' })
    }
    return { success: true }
  })
}
