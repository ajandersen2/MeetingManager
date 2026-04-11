import fs from 'fs'
import path from 'path'
import db from '../db.js'
import { authenticate } from '../middleware/auth.js'

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './server/uploads')

// Ensure upload dir exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

export default async function attachmentRoutes(fastify) {
  fastify.addHook('preHandler', authenticate)

  // GET /api/meetings/:meetingId/attachments
  fastify.get('/api/meetings/:meetingId/attachments', async (request) => {
    const { rows } = await db.query(
      'SELECT * FROM meeting_attachments WHERE meeting_id = $1 ORDER BY uploaded_at DESC',
      [request.params.meetingId]
    )
    return rows
  })

  // POST /api/meetings/:meetingId/attachments
  fastify.post('/api/meetings/:meetingId/attachments', async (request, reply) => {
    const { meetingId } = request.params

    // Verify meeting ownership
    const check = await db.query(
      `SELECT id FROM meetings WHERE id = $1 AND (user_id = $2
        OR EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = meetings.group_id AND gm.user_id = $2))`,
      [meetingId, request.userId]
    )
    if (check.rows.length === 0) {
      return reply.status(404).send({ message: 'Meeting not found' })
    }

    const data = await request.file()
    if (!data) {
      return reply.status(400).send({ message: 'No file uploaded' })
    }

    const meetingDir = path.join(UPLOAD_DIR, meetingId)
    if (!fs.existsSync(meetingDir)) {
      fs.mkdirSync(meetingDir, { recursive: true })
    }

    const fileName = data.filename
    const storedName = `${Date.now()}_${fileName}`
    const filePath = path.join(meetingDir, storedName)
    const relPath = `${meetingId}/${storedName}`

    // Write file to disk
    const writeStream = fs.createWriteStream(filePath)
    await data.file.pipe(writeStream)
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve)
      writeStream.on('error', reject)
    })

    const stats = fs.statSync(filePath)

    const { rows } = await db.query(
      `INSERT INTO meeting_attachments (meeting_id, file_name, file_path, file_size)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [meetingId, fileName, relPath, stats.size]
    )

    return rows[0]
  })

  // GET /api/attachments/:id/download
  fastify.get('/api/attachments/:id/download', async (request, reply) => {
    const { rows } = await db.query(
      'SELECT * FROM meeting_attachments WHERE id = $1',
      [request.params.id]
    )
    if (rows.length === 0) {
      return reply.status(404).send({ message: 'Attachment not found' })
    }

    const att = rows[0]
    const filePath = path.join(UPLOAD_DIR, att.file_path)

    if (!fs.existsSync(filePath)) {
      return reply.status(404).send({ message: 'File not found on disk' })
    }

    return reply
      .header('Content-Disposition', `attachment; filename="${att.file_name}"`)
      .send(fs.createReadStream(filePath))
  })

  // DELETE /api/attachments/:id
  fastify.delete('/api/attachments/:id', async (request, reply) => {
    const { rows } = await db.query(
      'SELECT * FROM meeting_attachments WHERE id = $1',
      [request.params.id]
    )
    if (rows.length === 0) {
      return reply.status(404).send({ message: 'Attachment not found' })
    }

    const att = rows[0]
    const filePath = path.join(UPLOAD_DIR, att.file_path)

    // Delete from disk
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }

    // Delete from DB
    await db.query('DELETE FROM meeting_attachments WHERE id = $1', [request.params.id])
    return { success: true }
  })
}
