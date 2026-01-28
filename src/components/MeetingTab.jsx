import { useState, useEffect, useRef } from 'react'
import { X, MapPin, Calendar, User, UserCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import TimePicker from './TimePicker'

export default function MeetingTab({ formData, updateFormData, groupId }) {
    const [attendeeInput, setAttendeeInput] = useState('')
    const [users, setUsers] = useState([])
    const [filteredUsers, setFilteredUsers] = useState([])
    const [showDropdown, setShowDropdown] = useState(false)
    const [loading, setLoading] = useState(false)
    const inputRef = useRef(null)
    const dropdownRef = useRef(null)

    // Fetch users on mount or when groupId changes
    useEffect(() => {
        fetchUsers()
    }, [groupId])

    // Filter users as user types
    useEffect(() => {
        if (attendeeInput.trim().length > 0) {
            const query = attendeeInput.toLowerCase()
            const filtered = users.filter(u =>
                (u.display_name?.toLowerCase().includes(query)) &&
                !formData.attendees.some(a => a.user_id === u.user_id)
            )
            setFilteredUsers(filtered)
            setShowDropdown(true)
        } else {
            setFilteredUsers([])
            setShowDropdown(false)
        }
    }, [attendeeInput, users, formData.attendees])

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
                inputRef.current && !inputRef.current.contains(e.target)) {
                setShowDropdown(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const fetchUsers = async () => {
        setLoading(true)
        try {
            let data = []

            if (groupId) {
                // Fetch only group members
                const { data: members, error } = await supabase
                    .from('group_members')
                    .select(`
            user_id,
            role,
            user_profiles (display_name)
          `)
                    .eq('group_id', groupId)

                if (!error && members) {
                    data = members.map(m => ({
                        user_id: m.user_id,
                        display_name: m.user_profiles?.display_name || 'Unknown',
                        role: m.role
                    }))
                }
            } else {
                // Fetch all users with profiles
                const { data: profiles, error } = await supabase
                    .from('user_profiles')
                    .select('user_id, display_name, role')

                if (!error && profiles) {
                    data = profiles.filter(p => p.display_name) // Only show users with display names
                }
            }

            setUsers(data)
        } catch (error) {
            console.error('Error fetching users:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleAddAttendee = (e) => {
        if (e.key === 'Enter' && attendeeInput.trim()) {
            e.preventDefault()
            // Check if there's a matching user in filtered results
            if (filteredUsers.length > 0) {
                addUserAttendee(filteredUsers[0])
            } else {
                addCustomAttendee(attendeeInput.trim())
            }
        }
    }

    const addUserAttendee = (user) => {
        const newAttendee = {
            name: user.display_name,
            user_id: user.user_id,
            isUser: true
        }
        if (!formData.attendees.some(a => a.user_id === user.user_id)) {
            updateFormData('attendees', [...formData.attendees, newAttendee])
        }
        setAttendeeInput('')
        setShowDropdown(false)
    }

    const addCustomAttendee = (name) => {
        const newAttendee = {
            name: name,
            user_id: null,
            isUser: false
        }
        if (!formData.attendees.some(a => a.name === name && !a.user_id)) {
            updateFormData('attendees', [...formData.attendees, newAttendee])
        }
        setAttendeeInput('')
        setShowDropdown(false)
    }

    const handleRemoveAttendee = (attendee) => {
        updateFormData('attendees', formData.attendees.filter(a =>
            a.user_id ? a.user_id !== attendee.user_id : a.name !== attendee.name
        ))
    }

    // Normalize attendees to new format if needed
    const normalizedAttendees = formData.attendees.map(a =>
        typeof a === 'string'
            ? { name: a, user_id: null, isUser: false }
            : a
    )

    return (
        <div>
            <div className="form-input-row">
                <div className="form-group">
                    <label className="form-label" htmlFor="meetingDate">
                        <Calendar size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                        Date
                    </label>
                    <input
                        id="meetingDate"
                        type="date"
                        className="form-input"
                        value={formData.date}
                        onChange={(e) => updateFormData('date', e.target.value)}
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">Time</label>
                    <TimePicker
                        value={formData.time}
                        onChange={(time) => updateFormData('time', time)}
                    />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label" htmlFor="meetingLocation">
                        <MapPin size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                        Location
                    </label>
                    <input
                        id="meetingLocation"
                        type="text"
                        className="form-input"
                        placeholder="Enter location"
                        value={formData.location}
                        onChange={(e) => updateFormData('location', e.target.value)}
                    />
                </div>
            </div>

            <div className="form-group">
                <label className="form-label">
                    Attendees
                    {groupId && <span className="form-hint-inline"> (from group members)</span>}
                </label>

                {normalizedAttendees.length > 0 && (
                    <div className="chips-container">
                        {normalizedAttendees.map((attendee, index) => (
                            <span
                                key={attendee.user_id || attendee.name + index}
                                className={`chip ${attendee.isUser ? 'chip-user' : 'chip-custom'}`}
                            >
                                {attendee.isUser ? (
                                    <UserCheck size={12} style={{ marginRight: '4px' }} />
                                ) : (
                                    <User size={12} style={{ marginRight: '4px', opacity: 0.5 }} />
                                )}
                                {attendee.name}
                                <button
                                    type="button"
                                    className="chip-remove"
                                    onClick={() => handleRemoveAttendee(attendee)}
                                >
                                    <X size={12} />
                                </button>
                            </span>
                        ))}
                    </div>
                )}

                <div className="attendee-input-wrapper">
                    <input
                        ref={inputRef}
                        type="text"
                        className="form-input"
                        placeholder={groupId ? "Search group members..." : "Search users or type a name..."}
                        value={attendeeInput}
                        onChange={(e) => setAttendeeInput(e.target.value)}
                        onKeyDown={handleAddAttendee}
                        onFocus={() => attendeeInput.trim() && setShowDropdown(true)}
                    />

                    {showDropdown && (
                        <div ref={dropdownRef} className="attendee-dropdown">
                            {filteredUsers.length > 0 ? (
                                <>
                                    <div className="attendee-dropdown-header">
                                        {groupId ? 'Group Members' : 'Platform Users'}
                                    </div>
                                    {filteredUsers.slice(0, 5).map(user => (
                                        <div
                                            key={user.user_id}
                                            className="attendee-dropdown-item"
                                            onClick={() => addUserAttendee(user)}
                                        >
                                            <UserCheck size={14} />
                                            <span>{user.display_name}</span>
                                            {user.role === 'owner' && <span className="attendee-badge">Owner</span>}
                                        </div>
                                    ))}
                                    <div className="attendee-dropdown-divider" />
                                </>
                            ) : null}
                            <div
                                className="attendee-dropdown-item attendee-dropdown-custom"
                                onClick={() => addCustomAttendee(attendeeInput.trim())}
                            >
                                <User size={14} />
                                <span>Add "{attendeeInput.trim()}" as guest</span>
                            </div>
                        </div>
                    )}
                </div>
                <p className="form-hint">
                    {groupId
                        ? 'Search for group members or type any name and press Enter'
                        : 'Search for users or type any name and press Enter'
                    }
                </p>
            </div>

            <div className="form-group">
                <label className="form-label" htmlFor="meetingObjective">Objective</label>
                <input
                    id="meetingObjective"
                    type="text"
                    className="form-input"
                    placeholder="What is the purpose of this meeting?"
                    value={formData.objective}
                    onChange={(e) => updateFormData('objective', e.target.value)}
                />
            </div>
        </div>
    )
}
