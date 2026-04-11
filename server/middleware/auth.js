import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'

export function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  )
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET)
}

export async function authenticate(request, reply) {
  const authHeader = request.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ message: 'Missing or invalid authorization header' })
  }

  try {
    const token = authHeader.slice(7)
    const decoded = verifyToken(token)
    request.userId = decoded.id
    request.userEmail = decoded.email
  } catch (err) {
    return reply.status(401).send({ message: 'Invalid or expired token' })
  }
}
