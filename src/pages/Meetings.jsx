import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import MeetingList from '../components/MeetingList'
import MeetingModal from '../components/MeetingModal'
import SettingsModal from '../components/SettingsModal'
import Sidebar from '../components/Sidebar'
import GroupModal from '../components/GroupModal'
import JoinGroupModal from '../components/JoinGroupModal'
import InvitationsDropdown from '../components/InvitationsDropdown'
import QuickCreateModal from '../components/QuickCreateModal'
import { Plus, LogOut, Calendar, Settings, LogIn, Menu, Zap } from 'lucide-react'

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
    const [sidebarKey, setSidebarKey] = useState(0)
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false)
    const [autoStartRecording, setAutoStartRecording] = useState(false)

    useEffect(() => {
        fetchMeetings()
    }, [selectedGroupId])

    const fetchMeetings = async () => {
        try {
            const url = selectedGroupId
                ? `/api/meetings?group_id=${selectedGroupId}`
                : '/api/meetings'
            const data = await api.get(url)
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

    // Helper to convert empty strings to null for database
    const emptyToNull = (value) => (value === '' ? null : value)

    const handleQuickCreate = async (meetingData) => {
        try {
            const newMeeting = await api.post('/api/meetings', {
                name: meetingData.name,
                date: emptyToNull(meetingData.date),
                time: emptyToNull(meetingData.time),
                location: emptyToNull(meetingData.location),
                objective: emptyToNull(meetingData.objective),
                agenda_content: emptyToNull(meetingData.agenda_content),
                minutes_content: emptyToNull(meetingData.minutes_content),
                raw_transcript: emptyToNull(meetingData.raw_transcript),
                group_id: selectedGroupId || null,
                attendees: meetingData.attendees || [],
            })

            setSelectedMeeting(newMeeting)
            setAutoStartRecording(true)
            setIsModalOpen(true)
            await fetchMeetings()
        } catch (error) {
            console.error('Error creating quick meeting:', error)
            alert('Failed to create meeting. Please try again.')
        }
    }

    const handleSaveMeeting = async (meetingData) => {
        try {
            if (selectedMeeting) {
                await api.put(`/api/meetings/${selectedMeeting.id}`, {
                    name: meetingData.name,
                    date: emptyToNull(meetingData.date),
                    time: emptyToNull(meetingData.time),
                    location: emptyToNull(meetingData.location),
                    objective: emptyToNull(meetingData.objective),
                    agenda_content: emptyToNull(meetingData.agenda_content),
                    minutes_content: emptyToNull(meetingData.minutes_content),
                    raw_transcript: emptyToNull(meetingData.raw_transcript),
                    group_id: meetingData.group_id || null,
                    attendees: meetingData.attendees || [],
                })
            } else {
                await api.post('/api/meetings', {
                    name: meetingData.name,
                    date: emptyToNull(meetingData.date),
                    time: emptyToNull(meetingData.time),
                    location: emptyToNull(meetingData.location),
                    objective: emptyToNull(meetingData.objective),
                    agenda_content: emptyToNull(meetingData.agenda_content),
                    minutes_content: emptyToNull(meetingData.minutes_content),
                    raw_transcript: emptyToNull(meetingData.raw_transcript),
                    group_id: selectedGroupId || null,
                    attendees: meetingData.attendees || [],
                })
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
            await api.delete(`/api/meetings/${meetingId}`)
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
        setSidebarKey(k => k + 1)
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
                        setIsSidebarOpen(false)
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
