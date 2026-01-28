import { useState, useRef, useEffect } from 'react'
import RichTextEditor from './RichTextEditor'
import AudioRecorder from './AudioRecorder'
import { Printer, Maximize2, Sparkles, X, Mic } from 'lucide-react'
import { useSettings } from '../context/SettingsContext'

export default function MinutesTab({ content, onChange, formData }) {
    const { settings } = useSettings()
    const [mode, setMode] = useState(content ? 'preview' : 'edit')
    const [generating, setGenerating] = useState(false)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [showRecorder, setShowRecorder] = useState(false)

    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape' && isFullscreen) {
                setIsFullscreen(false)
            }
        }
        document.addEventListener('keydown', handleEsc)
        return () => document.removeEventListener('keydown', handleEsc)
    }, [isFullscreen])

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
        const geminiKey = import.meta.env.VITE_GEMINI_API_KEY
        const openaiKey = import.meta.env.VITE_OPENAI_API_KEY

        if ((!geminiKey || geminiKey === 'your_gemini_api_key') &&
            (!openaiKey || openaiKey === 'your_openai_api_key')) {
            generateSmartTemplate()
            return
        }

        setGenerating(true)

        try {
            if (geminiKey && geminiKey !== 'your_gemini_api_key') {
                const result = await generateWithGemini(geminiKey)
                if (result) {
                    onChange(result)
                    return
                }
            }

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
        const prompt = `Generate professional meeting minutes in HTML format for this meeting:

Meeting Name: ${formData.name || 'Board Meeting'}
Date: ${formatDate(formData.date) || 'Not specified'}
Time: ${formatTime(formData.time) || 'Not specified'}
Location: ${formData.location || 'Not specified'}
Objective: ${formData.objective || 'Not specified'}
Attendees: ${formData.attendees?.join(', ') || 'None listed'}
Agenda: ${formData.agenda_content || 'Not provided'}
${content ? `Current Notes/Transcript: ${content.replace(/<[^>]*>/g, ' ').substring(0, 500)}` : ''}

Generate formal meeting minutes with these sections:
- Call to Order
- Attendees Present
- Agenda Items (expand on the agenda if provided)
- Discussion Points (infer from transcript if available)
- Action Items
- Adjournment

Use proper HTML tags (h3, p, ul, li). Make it professional and formal. Do NOT include the header/title.`

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
                        content: 'You are a professional meeting minutes writer. Generate formal meeting minutes in HTML format. Use h3, p, ul, li tags. Do NOT include the header/title - just the content sections.'
                    },
                    {
                        role: 'user',
                        content: `Generate meeting minutes for:
Meeting Name: ${formData.name}
Date: ${formatDate(formData.date)}
Time: ${formatTime(formData.time)}
Location: ${formData.location || 'Not specified'}
Objective: ${formData.objective || 'Not specified'}
Attendees: ${formData.attendees?.join(', ') || 'None listed'}
Agenda: ${formData.agenda_content || 'Not provided'}
${content ? `Current Notes/Transcript: ${content.replace(/<[^>]*>/g, ' ').substring(0, 500)}` : ''}`
                    }
                ]
            })
        })

        const data = await response.json()
        return data.choices?.[0]?.message?.content || null
    }

    const generateSmartTemplate = () => {
        const template = `
<h3>CALL TO ORDER</h3>
<p>The meeting was called to order at ${formatTime(formData.time) || '[TIME]'}.</p>

<h3>ATTENDEES PRESENT</h3>
<ul>
${formData.attendees?.length > 0
                ? formData.attendees.map(a => `  <li>${a}</li>`).join('\n')
                : '  <li>[List attendees]</li>'}
</ul>

<h3>AGENDA ITEMS</h3>
${formData.agenda_content
                ? formData.agenda_content
                : '<p>[Enter agenda items discussed]</p>'}

<h3>DISCUSSION</h3>
<p>[Summarize key discussion points]</p>

<h3>ACTION ITEMS</h3>
<ul>
  <li><strong>[Person]:</strong> [Task] - Due: [Date]</li>
</ul>

<h3>ADJOURNMENT</h3>
<p>The meeting was adjourned at [TIME].</p>

<p><em>Minutes prepared by: [Your Name]</em></p>
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
