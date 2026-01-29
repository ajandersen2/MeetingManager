import { useState, useRef, useEffect } from 'react'
import RichTextEditor from './RichTextEditor'
import AudioRecorder from './AudioRecorder'
import { Printer, Maximize2, Sparkles, X, Mic } from 'lucide-react'
import { useSettings } from '../context/SettingsContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function MinutesTab({ content, onChange, formData }) {
    const { settings } = useSettings()
    const { user } = useAuth()
    const [mode, setMode] = useState(content ? 'preview' : 'edit')
    const [generating, setGenerating] = useState(false)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [showRecorder, setShowRecorder] = useState(false)
    const [storedApiKey, setStoredApiKey] = useState(null)

    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape' && isFullscreen) {
                setIsFullscreen(false)
            }
        }
        document.addEventListener('keydown', handleEsc)
        return () => document.removeEventListener('keydown', handleEsc)
    }, [isFullscreen])

    // Fetch stored API key from Supabase
    useEffect(() => {
        const fetchApiKey = async () => {
            if (!user) return
            try {
                const { data } = await supabase
                    .from('user_api_keys')
                    .select('openai_api_key')
                    .eq('user_id', user.id)
                    .single()
                if (data?.openai_api_key) {
                    setStoredApiKey(data.openai_api_key)
                }
            } catch (err) {
                // No key stored yet
            }
        }
        fetchApiKey()
    }, [user])

    const formatDate = (dateStr) => {
        if (!dateStr) return ''
        const date = new Date(dateStr + 'T00:00:00')
        return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    }

    const formatTime = (timeStr) => {
        if (!timeStr) return ''
        const [hours, minutes] = timeStr.split(':')
        const hour = parseInt(hours)
        const ampm = hour >= 12 ? 'PM' : 'AM'
        const hour12 = hour % 12 || 12
        return `${hour12}:${minutes} ${ampm}`
    }

    const handlePrint = () => {
        const printContent = `
      <html>
        <head>
          <title>${formData.name} - Minutes</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
            h1 { text-align: center; border-bottom: 2px solid #0f766e; padding-bottom: 16px; color: #0f766e; }
            .header { text-align: center; margin-bottom: 24px; }
            .date { color: #666; margin-bottom: 8px; }
            .subtitle { font-weight: 600; margin-bottom: 8px; }
            .location { color: #666; font-size: 0.875rem; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${formData.name || 'Meeting'} Minutes</h1>
            <p class="date">${formatDate(formData.date)} ${formData.time ? '• ' + formatTime(formData.time) : ''}</p>
            <p class="subtitle">Official Meeting Minutes</p>
            ${formData.location ? `<p class="location">📍 ${formData.location}</p>` : ''}
          </div>
          <hr />
          ${content}
        </body>
      </html>
    `
        const printWindow = window.open('', '_blank')
        printWindow.document.write(printContent)
        printWindow.document.close()
        printWindow.print()
    }

    const handleTranscriptUpdate = (transcript) => {
        const formattedTranscript = `<h3>Recording Transcript</h3><p>${transcript}</p>`
        const newContent = content
            ? content + '\n' + formattedTranscript
            : formattedTranscript
        onChange(newContent)
    }

    const handleGenerateWithAI = async () => {
        // Prefer stored API key, fallback to env var
        const openaiKey = storedApiKey || import.meta.env.VITE_OPENAI_API_KEY
        const geminiKey = import.meta.env.VITE_GEMINI_API_KEY

        if ((!geminiKey || geminiKey === 'your_gemini_api_key') &&
            (!openaiKey || openaiKey === 'your_openai_api_key')) {
            alert('No API key found. Please add your OpenAI API key in Settings > Admin.')
            generateSmartTemplate()
            return
        }

        setGenerating(true)

        try {
            // Try Gemini first if available
            if (geminiKey && geminiKey !== 'your_gemini_api_key') {
                const result = await generateWithGemini(geminiKey)
                if (result) {
                    onChange(result)
                    return
                }
            }

            // Try OpenAI
            if (openaiKey && openaiKey !== 'your_openai_api_key') {
                const result = await generateWithOpenAI(openaiKey)
                if (result) {
                    onChange(result)
                    return
                }
            }

            generateSmartTemplate()
        } catch (error) {
            console.error('Error generating minutes:', error)
            alert('Failed to generate minutes with AI. Using template instead.')
            generateSmartTemplate()
        } finally {
            setGenerating(false)
        }
    }

    const generateWithGemini = async (apiKey) => {
        const attendeeNames = formData.attendees?.map(a => typeof a === 'object' ? a.name : a).join(', ') || 'None listed'

        const prompt = `You are a professional corporate secretary generating comprehensive, detailed meeting minutes. The header information (meeting name, date, time, location, attendees) is already displayed in the UI - focus ONLY on the substantive content.

MEETING CONTEXT (for your understanding, DO NOT repeat in output):
- Meeting Name: ${formData.name || 'Board Meeting'}
- Date: ${formatDate(formData.date) || 'Not specified'}
- Time: ${formatTime(formData.time) || 'Not specified'}
- Location: ${formData.location || 'Not specified'}
- Objective: ${formData.objective || 'Not specified'}
- Attendees: ${attendeeNames}
- Agenda: ${formData.agenda_content || 'Not provided'}
${content ? `- Notes/Transcript: ${content.replace(/<[^>]*>/g, ' ').substring(0, 2000)}` : ''}

INSTRUCTIONS:
1. Use attendee names to attribute statements and identify who said what
2. Be COMPREHENSIVE and DETAILED - this is official documentation
3. Include specific quotes or paraphrases when relevant
4. Capture nuance, concerns raised, and differing viewpoints

Generate the following sections in HTML format (h3 for headings, p for paragraphs, ul/li for lists):

<h3>DISCUSSION SUMMARY</h3>
- Provide a detailed narrative of key topics discussed
- Attribute statements to specific attendees when identifiable (e.g., "[Name] raised concerns about...")
- Include multiple paragraphs covering each major topic
- Note any debates, questions raised, or concerns expressed

<h3>KEY DECISIONS</h3>
- List each decision made with context
- Note who proposed and who approved (if identifiable)
- Include any vote counts or unanimous agreements
- Explain the rationale behind decisions

<h3>ACTION ITEMS</h3>
For each action item, include:
- <strong>[Assignee Name]:</strong> Specific task description
- Due date if mentioned
- Any dependencies or blockers noted
- Create AT LEAST 3-5 action items based on the discussion

<h3>FOLLOW-UP ITEMS</h3>
- Topics deferred to next meeting
- Items requiring further research or information
- Pending decisions awaiting additional input

<h3>NEXT STEPS</h3>
- Immediate priorities before next meeting
- Suggested agenda items for follow-up
- Any scheduled check-ins or deadlines

Be thorough and professional. These minutes serve as official record.`

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: settings.temperature,
                        maxOutputTokens: settings.max_tokens,
                    }
                })
            }
        )

        const data = await response.json()

        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
            let text = data.candidates[0].content.parts[0].text
            text = text.replace(/```html\n?/g, '').replace(/```\n?/g, '')
            return text
        }

        return null
    }

    const generateWithOpenAI = async (apiKey) => {
        const attendeeNames = formData.attendees?.map(a => typeof a === 'object' ? a.name : a).join(', ') || 'None listed'

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: settings.ai_model,
                max_tokens: settings.max_tokens,
                temperature: settings.temperature,
                messages: [
                    {
                        role: 'system',
                        content: `You are a professional corporate secretary generating comprehensive, detailed meeting minutes. Use HTML format (h3 for headings, p for paragraphs, ul/li for lists).

The header info (meeting name, date, time, location, attendees) is already shown in the UI - DO NOT repeat it.

Generate these sections with THOROUGH DETAIL:

<h3>DISCUSSION SUMMARY</h3>
- Detailed narrative of key topics discussed
- Attribute statements to specific attendees (e.g., "[Name] raised concerns about...")
- Multiple paragraphs covering each major topic
- Note debates, questions, and concerns

<h3>KEY DECISIONS</h3>
- Each decision with full context
- Who proposed/approved (if identifiable)
- Vote counts or unanimous agreements
- Rationale behind decisions

<h3>ACTION ITEMS</h3>
- <strong>[Assignee]:</strong> Specific task with due date
- Include AT LEAST 3-5 action items
- Note dependencies or blockers

<h3>FOLLOW-UP ITEMS</h3>
- Deferred topics
- Items needing research
- Pending decisions

<h3>NEXT STEPS</h3>
- Priorities before next meeting
- Suggested follow-up agenda items

Be COMPREHENSIVE and DETAILED - these are official records.`
                    },
                    {
                        role: 'user',
                        content: `MEETING CONTEXT (do not repeat in output):
Meeting: ${formData.name}
Date: ${formatDate(formData.date)} at ${formatTime(formData.time)}
Location: ${formData.location || 'Not specified'}
Objective: ${formData.objective || 'Not specified'}
Attendees: ${attendeeNames}
Agenda: ${formData.agenda_content || 'Not provided'}
${content ? `Notes/Transcript: ${content.replace(/<[^>]*>/g, ' ').substring(0, 3000)}` : ''}

Generate comprehensive meeting minutes. Attribute statements to attendees when possible. Be thorough and detailed.`
                    }
                ]
            })
        })

        const data = await response.json()
        return data.choices?.[0]?.message?.content || null
    }

    const generateSmartTemplate = () => {
        const template = `
<h3>DISCUSSION</h3>
<p>[Summarize key discussion points and who contributed]</p>

${formData.agenda_content ? `<h3>AGENDA ITEMS</h3>
${formData.agenda_content}` : ''}

<h3>DECISIONS MADE</h3>
<ul>
  <li>[Decision 1]</li>
  <li>[Decision 2]</li>
</ul>

<h3>ACTION ITEMS</h3>
<ul>
${formData.attendees?.length > 0
                ? formData.attendees.slice(0, 3).map(a => {
                    const name = typeof a === 'object' ? a.name : a
                    return `  <li><strong>${name}:</strong> [Task] - Due: [Date]</li>`
                }).join('\n')
                : '  <li><strong>[Person]:</strong> [Task] - Due: [Date]</li>'}
</ul>

<h3>NEXT STEPS</h3>
<p>[Outline follow-up actions and next meeting topics]</p>
`
        onChange(template.trim())
    }

    // Render the editor/preview content
    const renderContent = () => (
        mode === 'edit' ? (
            <RichTextEditor
                content={content}
                onChange={onChange}
                placeholder="Enter meeting minutes..."
            />
        ) : (
            <div className="editor-preview">
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <h1 style={{ borderBottom: '2px solid var(--color-primary)', paddingBottom: '16px', color: 'var(--color-primary)' }}>
                        {formData.name || 'Meeting Minutes'}
                    </h1>
                    <p style={{ color: 'var(--color-gray-500)', marginBottom: '8px' }}>
                        {formatDate(formData.date)} {formData.time && `• ${formatTime(formData.time)}`}
                    </p>
                    <p style={{ fontWeight: 600 }}>Official Meeting Minutes</p>
                    {formData.location && (
                        <p style={{ color: 'var(--color-gray-500)', fontSize: '0.875rem' }}>
                            📍 {formData.location}
                        </p>
                    )}
                    {formData.attendees?.length > 0 && (
                        <p style={{ color: 'var(--color-gray-500)', fontSize: '0.875rem', marginTop: '8px' }}>
                            👥 {formData.attendees.map(a => typeof a === 'object' ? a.name : a).join(', ')}
                        </p>
                    )}
                </div>
                <hr style={{ marginBottom: '24px', border: 'none', borderTop: '1px solid var(--color-gray-200)' }} />
                <div dangerouslySetInnerHTML={{ __html: content || '<p style="color: var(--color-gray-400)">No minutes content yet.</p>' }} />
            </div>
        )
    )

    // Render toolbar buttons
    const renderToolbar = (showClose = false) => (
        <div style={{ display: 'flex', gap: 'var(--spacing-2)', alignItems: 'center' }}>
            <button
                className={`btn btn-ghost btn-icon ${showRecorder ? 'active' : ''}`}
                onClick={() => setShowRecorder(!showRecorder)}
                title="Record & Transcribe"
            >
                <Mic size={18} />
            </button>
            <button
                className="btn btn-ghost btn-icon"
                onClick={handleGenerateWithAI}
                disabled={generating}
                title="Generate minutes with AI"
            >
                <Sparkles size={18} className={generating ? 'spinning' : ''} />
            </button>
            <button
                className="btn btn-secondary"
                onClick={handlePrint}
                style={{ padding: 'var(--spacing-2) var(--spacing-3)' }}
            >
                <Printer size={14} />
                Print
            </button>
            <div className="editor-mode-toggle">
                <button
                    type="button"
                    className={`editor-mode-btn ${mode === 'edit' ? 'active' : ''}`}
                    onClick={() => setMode('edit')}
                >
                    Edit
                </button>
                <button
                    type="button"
                    className={`editor-mode-btn ${mode === 'preview' ? 'active' : ''}`}
                    onClick={() => setMode('preview')}
                >
                    Preview
                </button>
            </div>
            <button
                className="btn btn-ghost btn-icon"
                onClick={() => setIsFullscreen(!isFullscreen)}
                title={showClose ? "Exit Fullscreen" : "Fullscreen"}
            >
                {showClose ? <X size={20} /> : <Maximize2 size={16} />}
            </button>
        </div>
    )

    return (
        <div>
            {/* Fullscreen overlay */}
            {isFullscreen && (
                <div className="minutes-fullscreen-overlay">
                    <div className="minutes-fullscreen-container">
                        <div className="minutes-fullscreen-header">
                            <h2>{formData.name || 'Meeting Minutes'}</h2>
                            {renderToolbar(true)}
                        </div>
                        {showRecorder && (
                            <div className="minutes-recorder-panel">
                                <AudioRecorder onTranscriptUpdate={handleTranscriptUpdate} />
                            </div>
                        )}
                        <div className="minutes-fullscreen-content">
                            {renderContent()}
                        </div>
                    </div>
                </div>
            )}

            {/* Normal inline view */}
            <div className="editor-header">
                <span className="editor-header-label">Meeting Minutes</span>
                {renderToolbar(false)}
            </div>

            {showRecorder && !isFullscreen && (
                <div className="minutes-recorder-panel">
                    <AudioRecorder onTranscriptUpdate={handleTranscriptUpdate} />
                </div>
            )}

            {renderContent()}
        </div>
    )
}
