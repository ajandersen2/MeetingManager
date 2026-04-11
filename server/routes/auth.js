import bcrypt from 'bcryptjs'
import db from '../db.js'
import { generateToken, authenticate } from '../middleware/auth.js'

export default async function authRoutes(fastify) {
  // POST /api/auth/signup
  fastify.post('/api/auth/signup', async (request, reply) => {
    const { email, password, displayName } = request.body
    if (!email || !password) {
      return reply.status(400).send({ message: 'Email and password are required' })
    }

    try {
      // Check if user exists
      const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()])
      if (existing.rows.length > 0) {
        return reply.status(409).send({ message: 'User already exists' })
      }

      const passwordHash = await bcrypt.hash(password, 12)
      const { rows } = await db.query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
        [email.toLowerCase(), passwordHash]
      )
      const user = rows[0]

      // Create user profile
      await db.query(
        'INSERT INTO user_profiles (user_id, display_name, role) VALUES ($1, $2, $3)',
        [user.id, displayName || email.split('@')[0], 'user']
      )

      const token = generateToken(user)
      return { token, user: { id: user.id, email: user.email } }
    } catch (err) {
      request.log.error(err)
      return reply.status(500).send({ message: 'Failed to create account' })
    }
  })

  // POST /api/auth/login
  fastify.post('/api/auth/login', async (request, reply) => {
    const { email, password } = request.body
    if (!email || !password) {
      return reply.status(400).send({ message: 'Email and password are required' })
    }

    try {
      const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()])
      if (rows.length === 0) {
        return reply.status(401).send({ message: 'Invalid credentials' })
      }

      const user = rows[0]
      const valid = await bcrypt.compare(password, user.password_hash)
      if (!valid) {
        return reply.status(401).send({ message: 'Invalid credentials' })
      }

      const token = generateToken(user)
      return { token, user: { id: user.id, email: user.email } }
    } catch (err) {
      request.log.error(err)
      return reply.status(500).send({ message: 'Login failed' })
    }
  })

  // GET /api/auth/me
  fastify.get('/api/auth/me', { preHandler: authenticate }, async (request) => {
    const { rows } = await db.query(
      `SELECT u.id, u.email, u.created_at,
              p.display_name, p.role
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      [request.userId]
    )
    if (rows.length === 0) return { user: null }
    const r = rows[0]
    return {
      user: {
        id: r.id,
        email: r.email,
        created_at: r.created_at,
      },
      profile: {
        display_name: r.display_name,
        role: r.role,
      }
    }
  })
}
