import db from '../db.js'
import { authenticate } from '../middleware/auth.js'

export default async function transcribeRoutes(fastify) {
  fastify.addHook('preHandler', authenticate)

  // POST /api/transcribe
  fastify.post('/api/transcribe', async (request, reply) => {
    // Get user's Deepgram key
    const { rows } = await db.query(
      'SELECT deepgram_api_key FROM user_api_keys WHERE user_id = $1',
      [request.userId]
    )

    const deepgramKey = rows[0]?.deepgram_api_key
    if (!deepgramKey) {
      return reply.status(400).send({ message: 'No Deepgram API key configured' })
    }

    // Get audio data from request
    const data = await request.file()
    if (!data) {
      return reply.status(400).send({ message: 'No audio file provided' })
    }

    const chunks = []
    for await (const chunk of data.file) {
      chunks.push(chunk)
    }
    const audioBuffer = Buffer.concat(chunks)
    const contentType = data.mimetype || 'audio/webm'

    // Call Deepgram API
    const dgResponse = await fetch(
      'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&diarize=true&paragraphs=true',
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${deepgramKey}`,
          'Content-Type': contentType,
        },
        body: audioBuffer,
      }
    )

    if (!dgResponse.ok) {
      const errText = await dgResponse.text()
      request.log.error(`Deepgram error: ${errText}`)
      return reply.status(dgResponse.status).send({ error: 'Transcription failed' })
    }

    const result = await dgResponse.json()
    const channel = result.results?.channels?.[0]?.alternatives?.[0]

    if (!channel) {
      return { transcript: null, speakers: 0 }
    }

    // Build speaker-labeled transcript
    const paragraphs = channel.paragraphs?.paragraphs || []
    let transcript = ''
    let speakerSet = new Set()

    if (paragraphs.length > 0) {
      for (const para of paragraphs) {
        const speaker = para.speaker !== undefined ? para.speaker + 1 : null
        if (speaker) speakerSet.add(speaker)
        const text = para.sentences?.map(s => s.text).join(' ') || ''
        transcript += speaker ? `Speaker ${speaker}: ${text}\n\n` : `${text}\n\n`
      }
    } else {
      transcript = channel.transcript || ''
    }

    return {
      transcript: transcript.trim(),
      speakers: speakerSet.size,
    }
  })
}
