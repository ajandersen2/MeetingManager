import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import path from 'path'
import { fileURLToPath } from 'url'

import authRoutes from './routes/auth.js'
import meetingRoutes from './routes/meetings.js'
import groupRoutes from './routes/groups.js'
import invitationRoutes from './routes/invitations.js'
import settingsRoutes from './routes/settings.js'
import attachmentRoutes from './routes/attachments.js'
import transcribeRoutes from './routes/transcribe.js'
import emailRoutes from './routes/email.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3000
const isProduction = process.env.NODE_ENV === 'production'

const fastify = Fastify({ logger: true })

// CORS
await fastify.register(cors, {
  origin: isProduction
    ? ['https://mm.sharetrack.org']
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
})

// Multipart (file uploads) — 50 MB limit
await fastify.register(multipart, {
  limits: { fileSize: 50 * 1024 * 1024 }
})

// Serve uploaded files
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, 'uploads'))
await fastify.register(fastifyStatic, {
  root: UPLOAD_DIR,
  prefix: '/uploads/',
  decorateReply: false,
})

// In production, serve the Vite build
if (isProduction) {
  const distPath = path.join(__dirname, '..', 'dist')
  await fastify.register(fastifyStatic, {
    root: distPath,
    prefix: '/',
    wildcard: false,
  })

  // SPA fallback
  fastify.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/')) {
      return reply.status(404).send({ message: 'Not found' })
    }
    return reply.sendFile('index.html', distPath)
  })
}

// Register routes
await fastify.register(authRoutes)
await fastify.register(meetingRoutes)
await fastify.register(groupRoutes)
await fastify.register(invitationRoutes)
await fastify.register(settingsRoutes)
await fastify.register(attachmentRoutes)
await fastify.register(transcribeRoutes)
await fastify.register(emailRoutes)

// Start
try {
  await fastify.listen({ port: PORT, host: '0.0.0.0' })
  console.log(`🚀 Meeting Manager API running on port ${PORT}`)
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
