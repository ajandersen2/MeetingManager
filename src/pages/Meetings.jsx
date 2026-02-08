import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import MeetingList from '../components/MeetingList'
import MeetingModal from '../components/MeetingModal'
import SettingsModal from '../components/SettingsModal'
import Sidebar from '../components/Sidebar'
import GroupModal from '../components/GroupModal'
import JoinGroupModal from '../components/JoinGroupModal'
import InvitationsDropdown from '../components/InvitationsDropdown'
import QuickCreateModal from '../components/QuickCreateModal'
import { Plus, LogOut, Calendar, Settings, LogIn, User, Menu, Zap } from 'lucide-react'

export default function Meetings() {
    const { user, signOut } = useAuth()
    const [meetings, setMeetings] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedMeeting, setSelectedMeeting] = useState(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')

    // Group state
    const [selectedGroupId, setSelectedGroupId] = useState(null)
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false)
    const [isJoinGroupModalOpen, setIsJoinGroupModalOpen] = useState(false)
    const [editingGroup, setEditingGroup] = useState(null)
    const [sidebarKey, setSidebarKey] = useState(0) // Force sidebar refresh
    const [isSidebarOpen, setIsSidebarOpen] = useState(false) // Mobile sidebar toggle
    const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false)
    const [autoStartRecording, setAutoStartRecording] = useState(false)

    useEffect(() => {
        fetchMeetings()
    }, [selectedGroupId])

    const fetchMeetings = async () => {
        try {
            let query = supabase
                .from('meetings')
                .select(`
          *,
          meeting_attendees (id, name, user_id),
          creator:user_profiles!meetings_user_id_to_profile_fkey (display_name)
        `)
                .order('date', { ascending: false })

            if (selectedGroupId) {
                // Filter by group
                query = query.eq('group_id', selectedGroupId)
            } else {
                // Show user's own meetings OR meetings in their groups
                // For simplicity, we'll just fetch all meetings the user can see
                // The RLS policy will handle access
            }

            const { data, error } = await query

            if (error) throw error
            setMeetings(data || [])
        } catch (error) {
            console.error('Error fetching meetings:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleNewMeeting = () => {
        setAutoStartRecording(false)
        setSelectedMeeting(null)
        setIsModalOpen(true)
    }

    const handleEditMeeting = (meeting) => {
        setSelectedMeeting(meeting)
        setIsModalOpen(true)
    }

    const handleCloseModal = () => {
        setIsModalOpen(false)
        setSelectedMeeting(null)
        setAutoStartRecording(false)
    }

    const handleQuickCreate = async (meetingData) => {
        try {
            // Create the meeting immediately
            const { data: newMeeting, error } = await supabase
                .from('meetings')
                .insert({
                    user_id: user.id,
                    name: meetingData.name,
                    date: emptyToNull(meetingData.date),
                    time: emptyToNull(meetingData.time),
                    location: emptyToNull(meetingData.location),
                    objective: emptyToNull(meetingData.objective),
                    agenda_content: emptyToNull(meetingData.agenda_content),
                    minutes_content: emptyToNull(meetingData.minutes_content),
                    raw_transcript: emptyToNull(meetingData.raw_transcript),
                    group_id: selectedGroupId || null,
                })
                .select(`
                    *,
                    meeting_attendees (id, name, user_id),
                    creator:user_profiles!meetings_user_id_to_profile_fkey (display_name)
                `)
                .single()

            if (error) throw error

            // Add attendees if any
            if (meetingData.attendees?.length > 0) {
                await supabase
                    .from('meeting_attendees')
                    .insert(meetingData.attendees.map(att => ({
                        meeting_id: newMeeting.id,
                        name: typeof att === 'string' ? att : att.name,
                        user_id: typeof att === 'string' ? null : (att.user_id || null)
                    })))

                // Re-fetch the meeting with attendees
                const { data: refreshed } = await supabase
                    .from('meetings')
                    .select(`
                        *,
                        meeting_attendees (id, name, user_id),
                        creator:user_profiles!meetings_user_id_to_profile_fkey (display_name)
                    `)
                    .eq('id', newMeeting.id)
                    .single()

                if (refreshed) {
                    setSelectedMeeting(refreshed)
                } else {
                    setSelectedMeeting(newMeeting)
                }
            } else {
                setSelectedMeeting(newMeeting)
            }

            // Open the meeting modal for recording
            setAutoStartRecording(true)
            setIsModalOpen(true)
            await fetchMeetings()
        } catch (error) {
            console.error('Error creating quick meeting:', error)
            alert('Failed to create meeting. Please try again.')
        }
    }

    // Helper to convert empty strings to null for database
    const emptyToNull = (value) => (value === '' ? null : value)

    const handleSaveMeeting = async (meetingData) => {
        try {
            if (selectedMeeting) {
                // Update existing meeting
                const { error } = await supabase
                    .from('meetings')
                    .update({
                        name: meetingData.name,
                        date: emptyToNull(meetingData.date),
                        time: emptyToNull(meetingData.time),
                        location: emptyToNull(meetingData.location),
                        objective: emptyToNull(meetingData.objective),
                        agenda_content: emptyToNull(meetingData.agenda_content),
                        minutes_content: emptyToNull(meetingData.minutes_content),
                        raw_transcript: emptyToNull(meetingData.raw_transcript),
                        group_id: meetingData.group_id || null,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', selectedMeeting.id)

                if (error) throw error

                // Update attendees
                await supabase
                    .from('meeting_attendees')
                    .delete()
                    .eq('meeting_id', selectedMeeting.id)

                if (meetingData.attendees?.length > 0) {
                    await supabase
                        .from('meeting_attendees')
                        .insert(meetingData.attendees.map(att => ({
                            meeting_id: selectedMeeting.id,
                            name: typeof att === 'string' ? att : att.name,
                            user_id: typeof att === 'string' ? null : att.user_id
                        })))
                }
            } else {
                // Create new meeting
                const { data: newMeeting, error } = await supabase
                    .from('meetings')
                    .insert({
                        user_id: user.id,
                        name: meetingData.name,
                        date: emptyToNull(meetingData.date),
                        time: emptyToNull(meetingData.time),
                        location: emptyToNull(meetingData.location),
                        objective: emptyToNull(meetingData.objective),
                        agenda_content: emptyToNull(meetingData.agenda_content),
                        minutes_content: emptyToNull(meetingData.minutes_content),
                        raw_transcript: emptyToNull(meetingData.raw_transcript),
                        group_id: selectedGroupId || null, // Use currently selected group
                    })
                    .select()
                    .single()

                if (error) throw error

                // Add attendees
                if (meetingData.attendees?.length > 0) {
                    await supabase
                        .from('meeting_attendees')
                        .insert(meetingData.attendees.map(att => ({
                            meeting_id: newMeeting.id,
                            name: typeof att === 'string' ? att : att.name,
                            user_id: typeof att === 'string' ? null : att.user_id
                        })))
                }
            }

            await fetchMeetings()
            handleCloseModal()
        } catch (error) {
            console.error('Error saving meeting:', error)
            alert('Failed to save meeting. Please try again.')
        }
    }

    const handleDeleteMeeting = async (meetingId) => {
        if (!confirm('Are you sure you want to delete this meeting?')) return

        try {
            const { error } = await supabase
                .from('meetings')
                .delete()
                .eq('id', meetingId)

            if (error) throw error

            await fetchMeetings()
            handleCloseModal()
        } catch (error) {
            console.error('Error deleting meeting:', error)
            alert('Failed to delete meeting. Please try again.')
        }
    }

    const handleSignOut = async () => {
        await signOut()
    }

    const handleCreateGroup = () => {
        setEditingGroup(null)
        setIsGroupModalOpen(true)
    }

    const handleManageGroup = (group) => {
        setEditingGroup(group)
        setIsGroupModalOpen(true)
    }

    const handleGroupSaved = () => {
        setSidebarKey(k => k + 1) // Refresh sidebar
        fetchMeetings()
    }

    const handleJoinedGroup = (group) => {
        setSidebarKey(k => k + 1)
        setSelectedGroupId(group.id)
    }

    const filteredMeetings = meetings.filter(meeting =>
        meeting.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        meeting.location?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="page-container">
            <header className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
                    <button
                        className="mobile-menu-toggle btn btn-ghost"
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        aria-label="Toggle menu"
                    >
                        <Menu size={24} />
                    </button>
                    <div>
                        <h1 className="page-title">
                            <Calendar size={32} style={{ marginRight: '12px', verticalAlign: 'middle', color: 'var(--color-primary)' }} />
                            Meetings
                        </h1>
                        <p className="page-subtitle">Track and manage meeting records</p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--spacing-3)', flexWrap: 'wrap' }}>
                    <button className="btn btn-secondary" onClick={() => setIsJoinGroupModalOpen(true)}>
                        <LogIn size={16} />
                        <span className="btn-text-mobile">Join</span>
                    </button>
                    <button className="btn btn-warning" onClick={() => setIsQuickCreateOpen(true)} title="Quick Meeting">
                        <Zap size={18} />
                        <span className="btn-text-mobile">Quick</span>
                    </button>
                    <button className="btn btn-primary" onClick={handleNewMeeting}>
                        <Plus size={18} />
                        <span className="btn-text-mobile">New</span>
                    </button>
                    <button
                        className="btn btn-ghost"
                        onClick={() => setIsSettingsOpen(true)}
                        title="Settings"
                    >
                        <Settings size={18} />
                    </button>
                    <InvitationsDropdown onInvitationAccepted={() => setSidebarKey(k => k + 1)} />
                    <button className="btn btn-ghost" onClick={handleSignOut} title="Sign out">
                        <LogOut size={18} />
                    </button>
                </div>
            </header>

            <div className="page-with-sidebar">
                {/* Mobile sidebar overlay */}
                {isSidebarOpen && (
                    <div
                        className="sidebar-overlay active"
                        onClick={() => setIsSidebarOpen(false)}
                    />
                )}

                <Sidebar
                    key={sidebarKey}
                    selectedGroupId={selectedGroupId}
                    onSelectGroup={(groupId) => {
                        setSelectedGroupId(groupId)
                        setIsSidebarOpen(false) // Close sidebar on mobile after selection
                    }}
                    onCreateGroup={() => {
                        handleCreateGroup()
                        setIsSidebarOpen(false)
                    }}
                    onManageGroup={(group) => {
                        handleManageGroup(group)
                        setIsSidebarOpen(false)
                    }}
                    isOpen={isSidebarOpen}
                />

                <div className="main-content">
                    <div className="card">
                        <MeetingList
                            meetings={filteredMeetings}
                            loading={loading}
                            searchQuery={searchQuery}
                            onSearchChange={setSearchQuery}
                            onMeetingClick={handleEditMeeting}
                        />
                    </div>
                </div>
            </div>

            {isModalOpen && (
                <MeetingModal
                    meeting={selectedMeeting}
                    groupId={selectedGroupId}
                    onClose={handleCloseModal}
                    onSave={handleSaveMeeting}
                    onDelete={handleDeleteMeeting}
                    autoStartRecording={autoStartRecording}
                />
            )}

            <QuickCreateModal
                isOpen={isQuickCreateOpen}
                onClose={() => setIsQuickCreateOpen(false)}
                onCreateMeeting={handleQuickCreate}
                selectedGroupId={selectedGroupId}
            />

            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
            />

            <GroupModal
                group={editingGroup}
                isOpen={isGroupModalOpen}
                onClose={() => setIsGroupModalOpen(false)}
                onSave={handleGroupSaved}
            />

            <JoinGroupModal
                isOpen={isJoinGroupModalOpen}
                onClose={() => setIsJoinGroupModalOpen(false)}
                onJoined={handleJoinedGroup}
            />
        </div>
    )
}
