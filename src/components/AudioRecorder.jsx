import { useState, useRef, useEffect, useCallback } from 'react'
import { Mic, Square, Loader2, AlertCircle, Upload, Play, Pause, FileAudio } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function AudioRecorder({ meetingId, onTranscriptReady, onRecordingStateChange }) {
    const [isRecording, setIsRecording] = useState(false)
    const [recordingTime, setRecordingTime] = useState(0)
    const [error, setError] = useState(null)
    const [audioBlob, setAudioBlob] = useState(null)
    const [audioUrl, setAudioUrl] = useState(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [isTranscribing, setIsTranscribing] = useState(false)
    const [saved, setSaved] = useState(false)
    const [deepgramKey, setDeepgramKey] = useState(null)

    const mediaRecorderRef = useRef(null)
    const audioChunksRef = useRef([])
    const timerRef = useRef(null)
    const audioPlayerRef = useRef(null)
    const streamRef = useRef(null)

    // Load Deepgram API key
    useEffect(() => {
        const loadKey = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) return
                const { data } = await supabase
                    .from('user_api_keys')
                    .select('deepgram_api_key')
                    .eq('user_id', user.id)
                    .single()
                if (data?.deepgram_api_key) {
                    setDeepgramKey(data.deepgram_api_key)
                }
            } catch (err) {
                // No key stored yet
            }
        }
        loadKey()
    }, [])

    const formatTime = (seconds) => {
        const hrs = Math.floor(seconds / 3600)
        const mins = Math.floor((seconds % 3600) / 60)
        const secs = seconds % 60
        if (hrs > 0) {
            return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        }
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    const startRecording = useCallback(async () => {
        setError(null)
        setAudioBlob(null)
        setAudioUrl(null)
        setSaved(false)
        audioChunksRef.current = []

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            streamRef.current = stream

            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                    ? 'audio/webm;codecs=opus'
                    : 'audio/webm'
            })

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data)
                }
            }

            mediaRecorder.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
                setAudioBlob(blob)
                const url = URL.createObjectURL(blob)
                setAudioUrl(url)

                // Stop tracks
                stream.getTracks().forEach(track => track.stop())
                streamRef.current = null
            }

            mediaRecorder.onerror = (event) => {
                console.error('MediaRecorder error:', event.error)
                setError('Recording error occurred. Please try again.')
            }

            // Collect chunks every 1 second for reliability
            mediaRecorder.start(1000)
            mediaRecorderRef.current = mediaRecorder
            setIsRecording(true)
            onRecordingStateChange?.(true)

            // Start timer
            setRecordingTime(0)
            timerRef.current = setInterval(() => {
                setRecordingTime(t => t + 1)
            }, 1000)

        } catch (err) {
            console.error('Error starting recording:', err)
            if (err.name === 'NotAllowedError') {
                setError('Microphone access denied. Please allow microphone access in your browser settings.')
            } else {
                setError('Could not access microphone. Please check your device settings.')
            }
        }
    }, [onRecordingStateChange])

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop()
            mediaRecorderRef.current = null
        }

        if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
        }

        setIsRecording(false)
        onRecordingStateChange?.(false)
    }, [onRecordingStateChange])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop()
            }
            if (timerRef.current) {
                clearInterval(timerRef.current)
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop())
            }
            if (audioUrl) {
                URL.revokeObjectURL(audioUrl)
            }
        }
    }, [])

    const togglePlayback = () => {
        if (!audioPlayerRef.current) return
        if (isPlaying) {
            audioPlayerRef.current.pause()
            setIsPlaying(false)
        } else {
            audioPlayerRef.current.play()
            setIsPlaying(true)
        }
    }

    const handleSaveRecording = async () => {
        if (!audioBlob || !meetingId) {
            if (!meetingId) {
                setError('Please save the meeting first before saving recordings.')
            }
            return
        }

        setIsSaving(true)
        setError(null)

        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
            const fileName = `recording-${timestamp}.webm`
            const filePath = `${meetingId}/${Date.now()}_${fileName}`

            // Upload to Supabase storage
            const { error: uploadError } = await supabase.storage
                .from('meeting-attachments')
                .upload(filePath, audioBlob, { contentType: 'audio/webm' })

            if (uploadError) throw uploadError

            // Save to meeting_attachments table
            const { error: dbError } = await supabase
                .from('meeting_attachments')
                .insert({
                    meeting_id: meetingId,
                    file_name: fileName,
                    file_path: filePath,
                    file_size: audioBlob.size
                })

            if (dbError) throw dbError

            setSaved(true)
        } catch (err) {
            console.error('Error saving recording:', err)
            setError('Failed to save recording. Please try again.')
        } finally {
            setIsSaving(false)
        }
    }

    const handleTranscribe = async () => {
        if (!audioBlob) return

        if (!deepgramKey) {
            setError('No Deepgram API key found. Please add it in Settings > Admin.')
            return
        }

        setIsTranscribing(true)
        setError(null)

        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) throw new Error('Not authenticated')

            const projectUrl = import.meta.env.VITE_SUPABASE_URL
            const response = await fetch(`${projectUrl}/functions/v1/deepgram-transcribe`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'audio/webm',
                    'x-deepgram-key': deepgramKey,
                },
                body: audioBlob,
            })

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}))
                throw new Error(errData.error || `Transcription failed (${response.status})`)
            }

            const result = await response.json()

            if (result.transcript) {
                onTranscriptReady?.(result.transcript, result.speakers || 0)
            } else {
                setError('No transcript returned. The audio may be too short or unclear.')
            }
        } catch (err) {
            console.error('Transcription error:', err)
            setError(err.message || 'Transcription failed. Please try again.')
        } finally {
            setIsTranscribing(false)
        }
    }

    const handleNewRecording = () => {
        if (audioUrl) {
            URL.revokeObjectURL(audioUrl)
        }
        setAudioBlob(null)
        setAudioUrl(null)
        setSaved(false)
        setRecordingTime(0)
        setError(null)
    }

    const formatFileSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B'
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    }

    return (
        <div className="audio-recorder">
            <div className="audio-recorder-header">
                <h4 className="audio-recorder-title">
                    <Mic size={16} />
                    Record Meeting
                </h4>
                {isRecording && (
                    <span className="recording-indicator">
                        <span className="recording-dot"></span>
                        Recording {formatTime(recordingTime)}
                    </span>
                )}
            </div>

            {/* Recording controls */}
            {!audioBlob && (
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
                            Stop Recording ({formatTime(recordingTime)})
                        </button>
                    )}
                </div>
            )}

            {/* Audio playback and actions */}
            {audioBlob && (
                <div className="audio-recorder-result">
                    <div className="audio-playback-row">
                        <button
                            type="button"
                            className="btn btn-ghost btn-icon"
                            onClick={togglePlayback}
                        >
                            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                        </button>
                        <audio
                            ref={audioPlayerRef}
                            src={audioUrl}
                            onEnded={() => setIsPlaying(false)}
                            style={{ flex: 1, height: '36px' }}
                            controls
                        />
                        <span className="audio-file-info">
                            <FileAudio size={14} />
                            {formatFileSize(audioBlob.size)} • {formatTime(recordingTime)}
                        </span>
                    </div>

                    <div className="audio-action-buttons">
                        <button
                            type="button"
                            className={`btn ${saved ? 'btn-secondary' : 'btn-primary'}`}
                            onClick={handleSaveRecording}
                            disabled={isSaving || saved || !meetingId}
                            title={!meetingId ? 'Save the meeting first' : ''}
                        >
                            {isSaving ? (
                                <><Loader2 size={16} className="spinning" /> Saving...</>
                            ) : saved ? (
                                <>✓ Saved</>
                            ) : (
                                <><Upload size={16} /> Save Recording</>
                            )}
                        </button>
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handleTranscribe}
                            disabled={isTranscribing || !deepgramKey}
                            title={!deepgramKey ? 'Add Deepgram API key in Settings > Admin' : 'Transcribe with Deepgram AI'}
                        >
                            {isTranscribing ? (
                                <><Loader2 size={16} className="spinning" /> Transcribing...</>
                            ) : (
                                <><FileAudio size={16} /> Transcribe</>
                            )}
                        </button>
                        <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={handleNewRecording}
                        >
                            New Recording
                        </button>
                    </div>

                    {!deepgramKey && (
                        <p className="audio-hint">
                            💡 Add your Deepgram API key in <strong>Settings → Admin</strong> to enable transcription.
                        </p>
                    )}
                </div>
            )}

            {error && (
                <div className="audio-recorder-error">
                    <AlertCircle size={14} />
                    {error}
                </div>
            )}
        </div>
    )
}
