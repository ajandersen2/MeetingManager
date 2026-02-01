import { useState, useRef, useEffect, useCallback } from 'react'
import { Mic, Square, Loader2, AlertCircle } from 'lucide-react'

export default function AudioRecorder({ onTranscriptUpdate }) {
    const [isRecording, setIsRecording] = useState(false)
    const [isTranscribing, setIsTranscribing] = useState(false)
    const [recordingTime, setRecordingTime] = useState(0)
    const [error, setError] = useState(null)
    const [transcript, setTranscript] = useState('')

    const recognitionRef = useRef(null)
    const timerRef = useRef(null)

    // Check if Web Speech API is supported
    const isSupported = typeof window !== 'undefined' &&
        ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    const startRecording = useCallback(async () => {
        if (!isSupported) {
            setError('Speech recognition is not supported in this browser. Please use Chrome or Edge.')
            return
        }

        setError(null)
        setTranscript('')

        try {
            // Request microphone permission
            await navigator.mediaDevices.getUserMedia({ audio: true })

            // Initialize Speech Recognition
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
            const recognition = new SpeechRecognition()

            recognition.continuous = true
            recognition.interimResults = true
            recognition.lang = 'en-US'

            let finalTranscript = ''

            recognition.onresult = (event) => {
                let interimTranscript = ''

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const result = event.results[i]
                    if (result.isFinal) {
                        finalTranscript += result[0].transcript + ' '
                    } else {
                        interimTranscript += result[0].transcript
                    }
                }

                const fullTranscript = finalTranscript + interimTranscript
                setTranscript(fullTranscript)
            }

            recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error)
                if (event.error === 'not-allowed') {
                    setError('Microphone access denied. Please allow microphone access to record.')
                } else if (event.error === 'no-speech') {
                    // Ignore no-speech errors
                } else {
                    setError(`Recognition error: ${event.error}`)
                }
            }

            recognition.onend = () => {
                // Restart if still recording (browser may stop after silence)
                if (recognitionRef.current) {
                    try {
                        recognition.start()
                    } catch (e) {
                        // Ignore if already started
                    }
                }
            }

            recognition.start()
            recognitionRef.current = recognition
            setIsRecording(true)
            setIsTranscribing(true)

            // Start timer
            setRecordingTime(0)
            timerRef.current = setInterval(() => {
                setRecordingTime(t => t + 1)
            }, 1000)

        } catch (err) {
            console.error('Error starting recording:', err)
            setError('Could not access microphone. Please check permissions.')
        }
    }, [isSupported])

    const stopRecording = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.stop()
            recognitionRef.current = null
        }

        if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
        }

        setIsRecording(false)
        setIsTranscribing(false)
        // User will manually click "Insert into Minutes" to add transcript
    }, [])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop()
            }
            if (timerRef.current) {
                clearInterval(timerRef.current)
            }
        }
    }, [])

    const handleInsertTranscript = () => {
        if (transcript && onTranscriptUpdate) {
            const transcriptToInsert = transcript.trim()
            if (transcriptToInsert) {
                // Call callback first with the transcript value
                onTranscriptUpdate(transcriptToInsert)
                // Then clear the state
                setTranscript('')
                setRecordingTime(0)
            }
        }
    }

    if (!isSupported) {
        return (
            <div className="audio-recorder-unsupported">
                <AlertCircle size={16} />
                <span>Speech recognition is not supported in this browser. Please use Chrome or Edge.</span>
            </div>
        )
    }

    return (
        <div className="audio-recorder">
            <div className="audio-recorder-header">
                <h4 className="audio-recorder-title">
                    <Mic size={16} />
                    Record & Transcribe
                </h4>
                {isRecording && (
                    <span className="recording-indicator">
                        <span className="recording-dot"></span>
                        Recording {formatTime(recordingTime)}
                    </span>
                )}
            </div>

            <div className="audio-recorder-controls">
                {!isRecording ? (
                    <button
                        type="button"
                        className="btn btn-primary audio-record-btn"
                        onClick={startRecording}
                    >
                        <Mic size={18} />
                        Start Recording
                    </button>
                ) : (
                    <button
                        type="button"
                        className="btn btn-danger audio-record-btn"
                        onClick={stopRecording}
                    >
                        <Square size={18} />
                        Stop Recording
                    </button>
                )}
            </div>

            {error && (
                <div className="audio-recorder-error">
                    <AlertCircle size={14} />
                    {error}
                </div>
            )}

            {(isTranscribing || transcript) && (
                <div className="audio-transcript-container">
                    <div className="audio-transcript-header">
                        <span>Live Transcript</span>
                        {isTranscribing && <Loader2 size={14} className="spinning" />}
                    </div>
                    <div className="audio-transcript-content">
                        {transcript || (
                            <span style={{ color: 'var(--color-gray-400)', fontStyle: 'italic' }}>
                                Listening... Start speaking to see transcription here.
                            </span>
                        )}
                    </div>
                    {transcript && !isRecording && (
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handleInsertTranscript}
                            style={{ marginTop: 'var(--spacing-3)' }}
                        >
                            Insert into Minutes
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}
