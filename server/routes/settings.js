import db from '../db.js'
import { authenticate } from '../middleware/auth.js'

export default async function settingsRoutes(fastify) {
  fastify.addHook('preHandler', authenticate)

  // GET /api/settings
  fastify.get('/api/settings', async () => {
    const { rows } = await db.query('SELECT * FROM app_settings LIMIT 1')
    return rows[0] || { ai_model: 'gpt-4o-mini', max_tokens: 8192, temperature: 0.7 }
  })

  // PUT /api/settings
  fastify.put('/api/settings', async (request, reply) => {
    // Must be admin
    const profile = await db.query('SELECT role FROM user_profiles WHERE user_id = $1', [request.userId])
    if (profile.rows[0]?.role !== 'admin') {
      return reply.status(403).send({ message: 'Admin access required' })
    }

    const { ai_model, max_tokens, temperature } = request.body
    await db.query(
      `UPDATE app_settings SET ai_model = $1, max_tokens = $2, temperature = $3,
       updated_at = NOW(), updated_by = $4`,
      [ai_model, max_tokens, temperature, request.userId]
    )
    return { success: true }
  })

  // GET /api/profile
  fastify.get('/api/profile', async (request) => {
    const { rows } = await db.query(
      'SELECT * FROM user_profiles WHERE user_id = $1',
      [request.userId]
    )
    return rows[0] || null
  })

  // PUT /api/profile
  fastify.put('/api/profile', async (request) => {
    const { display_name } = request.body
    await db.query(
      'UPDATE user_profiles SET display_name = $1, updated_at = NOW() WHERE user_id = $2',
      [display_name, request.userId]
    )
    return { success: true }
  })

  // GET /api/api-keys
  fastify.get('/api/api-keys', async (request) => {
    const { rows } = await db.query(
      'SELECT openai_api_key, deepgram_api_key FROM user_api_keys WHERE user_id = $1',
      [request.userId]
    )
    return rows[0] || { openai_api_key: null, deepgram_api_key: null }
  })

  // PUT /api/api-keys
  fastify.put('/api/api-keys', async (request) => {
    const { openai_api_key, deepgram_api_key } = request.body

    const updates = {}
    if (openai_api_key !== undefined) updates.openai_api_key = openai_api_key
    if (deepgram_api_key !== undefined) updates.deepgram_api_key = deepgram_api_key

    await db.query(
      `INSERT INTO user_api_keys (user_id, openai_api_key, deepgram_api_key)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET
         openai_api_key = COALESCE($2, user_api_keys.openai_api_key),
         deepgram_api_key = COALESCE($3, user_api_keys.deepgram_api_key),
         updated_at = NOW()`,
      [request.userId, updates.openai_api_key ?? null, updates.deepgram_api_key ?? null]
    )
    return { success: true }
  })
}
