import { useState, useEffect } from 'react'
import { Zap, X, MapPin, Clock, Users, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function QuickCreateModal({ isOpen, onClose, onCreateMeeting, selectedGroupId }) {
    const { user } = useAuth()
    const [frequentTitles, setFrequentTitles] = useState([])
    const [selectedTitle, setSelectedTitle] = useState('')
    const [customTitle, setCustomTitle] = useState('')
    const [location, setLocation] = useState('')
    const [locationLoading, setLocationLoading] = useState(false)
    const [attendees, setAttendees] = useState([])
    const [loading, setLoading] = useState(true)
    const [creating, setCreating] = useState(false)

    // Load frequent titles when modal opens
    useEffect(() => {
        if (isOpen) {
            loadFrequentTitles()
            detectLocation()
        }
    }, [isOpen])

    // Load attendees when title changes
    useEffect(() => {
        if (selectedTitle) {
            loadAttendeesForTitle(selectedTitle)
        } else {
            setAttendees([])
        }
    }, [selectedTitle])

    const loadFrequentTitles = async () => {
        setLoading(true)
        try {
            // Get all meetings for this user, count by name
            let query = supabase
                .from('meetings')
                .select('name')
                .order('created_at', { ascending: false })

            if (selectedGroupId) {
                query = query.eq('group_id', selectedGroupId)
            }

            const { data, error } = await query

            if (error) throw error

            // Count occurrences and rank
            const titleCounts = {}
            for (const meeting of (data || [])) {
                const name = meeting.name?.trim()
                if (name) {
                    titleCounts[name] = (titleCounts[name] || 0) + 1
                }
            }

            // Sort by frequency, take top 10
            const sorted = Object.entries(titleCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([name, count]) => ({ name, count }))

            setFrequentTitles(sorted)

            // Auto-select most frequent if available
            if (sorted.length > 0) {
                setSelectedTitle(sorted[0].name)
            }
        } catch (err) {
            console.error('Error loading frequent titles:', err)
        } finally {
            setLoading(false)
        }
    }

    const loadAttendeesForTitle = async (title) => {
        try {
            // Get the most recent meeting with this title
            let query = supabase
                .from('meetings')
                .select('id, meeting_attendees(name, user_id)')
                .eq('name', title)
                .order('date', { ascending: false })
                .limit(1)

            if (selectedGroupId) {
                query = query.eq('group_id', selectedGroupId)
            }

            const { data, error } = await query

            if (error) throw error

            if (data?.[0]?.meeting_attendees?.length > 0) {
                setAttendees(data[0].meeting_attendees.map(a => ({
                    name: a.name,
                    user_id: a.user_id || null,
                    isUser: !!a.user_id
                })))
            } else {
                setAttendees([])
            }
        } catch (err) {
            console.error('Error loading attendees:', err)
        }
    }

    const detectLocation = () => {
        if (!navigator.geolocation) return

        setLocationLoading(true)
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    // Reverse geocode using a free API
                    const { latitude, longitude } = position.coords
                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
                        { headers: { 'Accept-Language': 'en' } }
                    )
                    const data = await response.json()
                    
                    if (data?.address) {
                        const parts = []
                        if (data.address.building || data.address.amenity) {
                            parts.push(data.address.building || data.address.amenity)
                        }
                        if (data.address.road) {
                            let road = data.address.road
                            if (data.address.house_number) road = data.address.house_number + ' ' + road
                            parts.push(road)
                        }
                        if (data.address.city || data.address.town || data.address.village) {
                            parts.push(data.address.city || data.address.town || data.address.village)
                        }
                        if (data.address.state) {
                            parts.push(data.address.state)
                        }
                        setLocation(parts.join(', '))
                    } else {
                        setLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`)
                    }
                } catch (err) {
                    console.error('Geocoding error:', err)
                }
                setLocationLoading(false)
            },
            (err) => {
                console.error('Geolocation error:', err)
                setLocationLoading(false)
            },
            { timeout: 5000, enableHighAccuracy: false }
        )
    }

    const handleCreate = async () => {
        const title = selectedTitle || customTitle.trim()
        if (!title) return

        setCreating(true)

        const now = new Date()
        const date = now.toISOString().split('T')[0]
        const hours = now.getHours().toString().padStart(2, '0')
        const minutes = now.getMinutes().toString().padStart(2, '0')
        const time = `${hours}:${minutes}`

        const meetingData = {
            name: title,
            date,
            time,
            location: location || '',
            objective: '',
            attendees,
            agenda_content: '',
            minutes_content: '',
            raw_transcript: '',
            quickCreate: true, // Flag to auto-start recording
        }

        await onCreateMeeting(meetingData)
        setCreating(false)
        onClose()
    }

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose()
        }
    }

    const getCurrentTime = () => {
        const now = new Date()
        return now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    }

    const getCurrentDate = () => {
        const now = new Date()
        return now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    }

    if (!isOpen) return null

    const effectiveTitle = selectedTitle || customTitle.trim()

    return (
        <div className="modal-backdrop" onClick={handleBackdropClick}>
            <div className="modal quick-create-modal" onClick={e => e.stopPropagation()}>
                <header className="modal-header">
                    <h2 className="modal-title">
                        <Zap size={22} style={{ color: 'var(--color-warning)', marginRight: '8px' }} />
                        Quick Meeting
                    </h2>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}>
                        <X size={20} />
                    </button>
                </header>

                <div className="modal-body">
                    {loading ? (
                        <div className="loading-screen" style={{ minHeight: '200px' }}>
                            <div className="loading-spinner"></div>
                        </div>
                    ) : (
                        <>
                            {/* Auto-filled info banner */}
                            <div className="quick-create-info">
                                <div className="quick-create-info-item">
                                    <Clock size={14} />
                                    <span>{getCurrentDate()} at {getCurrentTime()}</span>
                                </div>
                                <div className="quick-create-info-item">
                                    <MapPin size={14} />
                                    {locationLoading ? (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Loader2 size={12} className="spinning" /> Detecting location...
                                        </span>
                                    ) : (
                                        <input
                                            type="text"
                                            className="form-input quick-create-location-input"
                                            value={location}
                                            onChange={(e) => setLocation(e.target.value)}
                                            placeholder="Enter location..."
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Title selection */}
                            <div className="form-group">
                                <label className="form-label">Meeting Title</label>
                                {frequentTitles.length > 0 ? (
                                    <div className="quick-create-titles">
                                        {frequentTitles.map((item) => (
                                            <button
                                                key={item.name}
                                                type="button"
                                                className={`quick-create-title-btn ${selectedTitle === item.name ? 'active' : ''}`}
                                                onClick={() => {
                                                    setSelectedTitle(item.name)
                                                    setCustomTitle('')
                                                }}
                                            >
                                                {item.name}
                                                <span className="quick-create-title-count">{item.count}×</span>
                                            </button>
                                        ))}
                                    </div>
                                ) : null}
                                <input
                                    type="text"
                                    className="form-input"
                                    value={selectedTitle ? '' : customTitle}
                                    onChange={(e) => {
                                        setCustomTitle(e.target.value)
                                        setSelectedTitle('')
                                    }}
                                    placeholder={frequentTitles.length > 0 ? "Or type a new title..." : "Enter meeting title..."}
                                    style={{ marginTop: frequentTitles.length > 0 ? 'var(--spacing-2)' : 0 }}
                                />
                            </div>

                            {/* Auto-populated attendees */}
                            {attendees.length > 0 && (
                                <div className="form-group">
                                    <label className="form-label">
                                        <Users size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                                        Attendees (from last "{selectedTitle}")
                                    </label>
                                    <div className="quick-create-attendees">
                                        {attendees.map((att, i) => (
                                            <span key={att.user_id || att.name + i} className="meeting-attendee-tag attendee-guest">
                                                {att.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* What will happen */}
                            <div className="quick-create-note">
                                <Zap size={14} />
                                <span>Meeting will be created and <strong>recording will start automatically</strong></span>
                            </div>
                        </>
                    )}
                </div>

                <footer className="modal-footer">
                    <div></div>
                    <div className="modal-footer-actions">
                        <button className="btn btn-secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={handleCreate}
                            disabled={creating || !effectiveTitle}
                        >
                            {creating ? (
                                <><Loader2 size={16} className="spinning" /> Creating...</>
                            ) : (
                                <><Zap size={16} /> Start Meeting</>
                            )}
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    )
}
