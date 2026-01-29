import { useState, useEffect } from 'react'
import { X, Share2, Trash2, Edit3, Calendar, Clock, MapPin, Target, Users, FileText, Mic, Paperclip, UserCheck, User } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import MeetingTab from './MeetingTab'
import AgendaTab from './AgendaTab'
import MinutesTab from './MinutesTab'
import AttachmentsTab from './AttachmentsTab'

const TABS = ['Meeting', 'Agenda', 'Minutes', 'Attachments']

export default function MeetingModal({ meeting, groupId, onClose, onSave, onDelete }) {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('Meeting')
  const [isEditing, setIsEditing] = useState(!meeting)
  const [expandedSection, setExpandedSection] = useState(null)
  const [attachments, setAttachments] = useState([])

  // Check if current user owns this meeting
  const isOwner = !meeting || meeting.user_id === user?.id

  const [formData, setFormData] = useState({
    name: '',
    date: '',
    time: '',
    location: '',
    objective: '',
    attendees: [],
    agenda_content: '',
    minutes_content: ''
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (meeting) {
      setFormData({
        name: meeting.name || '',
        date: meeting.date || '',
        time: meeting.time || '',
        location: meeting.location || '',
        objective: meeting.objective || '',
        // Preserve full attendee objects with user_id for visual distinction
        attendees: meeting.meeting_attendees?.map(a => ({
          name: a.name,
          user_id: a.user_id || null,
          isUser: !!a.user_id
        })) || [],
        agenda_content: meeting.agenda_content || '',
        minutes_content: meeting.minutes_content || ''
      })
      fetchAttachments()
    } else {
      const today = new Date().toISOString().split('T')[0]
      setFormData(prev => ({ ...prev, date: today }))
    }
  }, [meeting])

  const fetchAttachments = async () => {
    if (!meeting?.id) return
    try {
      const { data, error } = await supabase
        .from('meeting_attachments')
        .select('*')
        .eq('meeting_id', meeting.id)
        .order('uploaded_at', { ascending: false })
      if (!error) setAttachments(data || [])
    } catch (error) {
      console.error('Error fetching attachments:', error)
    }
  }

  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Not set'
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  }

  const formatTime = (timeStr) => {
    if (!timeStr) return ''
    const [hours, minutes] = timeStr.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const hour12 = hour % 12 || 12
    return `${hour12}:${minutes} ${ampm}`
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Meeting name is required')
      return
    }
    setSaving(true)
    await onSave(formData)
    setSaving(false)
    if (meeting) {
      setIsEditing(false)
    }
  }

  const handleShare = () => {
    const shareData = {
      title: formData.name,
      text: `Meeting: ${formData.name} on ${formData.date}`,
      url: window.location.href
    }
    if (navigator.share) {
      navigator.share(shareData)
    } else {
      navigator.clipboard.writeText(window.location.href)
      alert('Link copied to clipboard!')
    }
  }

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const handleCancelEdit = () => {
    if (meeting) {
      setFormData({
        name: meeting.name || '',
        date: meeting.date || '',
        time: meeting.time || '',
        location: meeting.location || '',
        objective: meeting.objective || '',
        attendees: meeting.meeting_attendees?.map(a => ({
          name: a.name,
          user_id: a.user_id || null,
          isUser: !!a.user_id
        })) || [],
        agenda_content: meeting.agenda_content || '',
        minutes_content: meeting.minutes_content || ''
      })
      setIsEditing(false)
    } else {
      onClose()
    }
  }

  // Normalize attendees for display (handle both old string format and new object format)
  const normalizeAttendees = (attendees) => {
    if (!attendees || attendees.length === 0) return []
    return attendees.map(a => {
      if (typeof a === 'string') {
        return { name: a, user_id: null, isUser: false }
      }
      return { ...a, isUser: !!a.user_id }
    })
  }

  // View Mode with collapsible sections
  const renderViewMode = () => {
    const attendees = normalizeAttendees(formData.attendees)

    // When minutes is expanded, show only minutes
    if (expandedSection === 'minutes') {
      return (
        <div className="meeting-view-compact">
          <button
            className="btn btn-ghost"
            onClick={() => setExpandedSection(null)}
            style={{ marginBottom: 'var(--spacing-3)' }}
          >
            ← Back to Meeting Details
          </button>
          <MinutesTab
            content={formData.minutes_content}
            onChange={(content) => updateFormData('minutes_content', content)}
            formData={formData}
          />
        </div>
      )
    }

    // Normal view with all sections
    return (
      <div className="meeting-view-compact">
        {/* Top row: Date/Time/Location */}
        <div className="meeting-info-row">
          <div className="meeting-info-item">
            <Calendar size={16} />
            <span>{formatDate(formData.date)}</span>
          </div>
          {formData.time && (
            <div className="meeting-info-item">
              <Clock size={16} />
              <span>{formatTime(formData.time)}</span>
            </div>
          )}
          {formData.location && (
            <div className="meeting-info-item">
              <MapPin size={16} />
              <span>{formData.location}</span>
            </div>
          )}
        </div>

        {/* Two-column layout */}
        <div className="meeting-columns">
          {/* Left column: Details */}
          <div className="meeting-column">
            {formData.objective && (
              <div className="meeting-section-compact">
                <div className="meeting-section-header-compact">
                  <Target size={14} />
                  Objective
                </div>
                <p className="meeting-section-text">{formData.objective}</p>
              </div>
            )}

            {attendees.length > 0 && (
              <div className="meeting-section-compact">
                <div className="meeting-section-header-compact">
                  <Users size={14} />
                  Attendees ({attendees.length})
                </div>
                <div className="meeting-attendees-compact">
                  {attendees.map((att, i) => (
                    <span
                      key={att.user_id || att.name + i}
                      className={`meeting-attendee-tag ${att.isUser ? 'attendee-user' : 'attendee-guest'}`}
                    >
                      {att.isUser ? (
                        <UserCheck size={12} style={{ marginRight: '4px' }} />
                      ) : (
                        <User size={12} style={{ marginRight: '4px', opacity: 0.5 }} />
                      )}
                      {att.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Quick action buttons */}
            <div className="meeting-quick-actions">
              <button
                className="meeting-quick-btn"
                onClick={() => setExpandedSection('minutes')}
              >
                <Mic size={14} />
                Minutes
                {formData.minutes_content && <span className="meeting-quick-badge">✓</span>}
              </button>
              <button
                className={`meeting-quick-btn ${expandedSection === 'attachments' ? 'active' : ''}`}
                onClick={() => setExpandedSection(expandedSection === 'attachments' ? null : 'attachments')}
              >
                <Paperclip size={14} />
                Attachments
                {attachments.length > 0 && (
                  <span className="meeting-quick-count">{attachments.length}</span>
                )}
              </button>
            </div>
          </div>

          {/* Right column: Agenda */}
          <div className="meeting-column meeting-agenda-column">
            <div className="meeting-section-header-compact">
              <FileText size={14} />
              Agenda
            </div>
            {formData.agenda_content ? (
              <div
                className="meeting-agenda-content"
                dangerouslySetInnerHTML={{ __html: formData.agenda_content }}
              />
            ) : (
              <p className="meeting-section-empty">No agenda set</p>
            )}
          </div>
        </div>

        {/* Attachments expanded */}
        {expandedSection === 'attachments' && (
          <div className="meeting-expanded-section">
            <AttachmentsTab meetingId={meeting?.id} />
          </div>
        )}
      </div>
    )
  }

  // Edit mode with tabs
  const renderEditMode = () => (
    <>
      <div className="form-group">
        <label className="form-label required" htmlFor="meetingName">Meeting Name</label>
        <input
          id="meetingName"
          type="text"
          className="form-input"
          value={formData.name}
          onChange={(e) => updateFormData('name', e.target.value)}
          placeholder="Enter meeting name"
        />
      </div>

      <nav className="tabs">
        {TABS.map(tab => (
          <button
            key={tab}
            type="button"
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      {activeTab === 'Meeting' && (
        <MeetingTab formData={formData} updateFormData={updateFormData} groupId={groupId || meeting?.group_id} />
      )}
      {activeTab === 'Agenda' && (
        <AgendaTab
          content={formData.agenda_content}
          onChange={(content) => updateFormData('agenda_content', content)}
          meetingName={formData.name}
          meetingDate={formData.date}
        />
      )}
      {activeTab === 'Minutes' && (
        <MinutesTab
          content={formData.minutes_content}
          onChange={(content) => updateFormData('minutes_content', content)}
          formData={formData}
        />
      )}
      {activeTab === 'Attachments' && (
        <AttachmentsTab meetingId={meeting?.id} />
      )}
    </>
  )

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal">
        <header className="modal-header">
          <h2 className="modal-title">{formData.name || 'New Meeting'}</h2>
          <div className="modal-header-actions">
            {/* Only show Edit button if user owns this meeting */}
            {meeting && !isEditing && isOwner && (
              <button className="btn btn-primary btn-sm" onClick={() => setIsEditing(true)}>
                <Edit3 size={14} />
                Edit
              </button>
            )}
            {meeting && (
              <button className="btn btn-ghost btn-sm" onClick={handleShare}>
                <Share2 size={14} />
              </button>
            )}
            <button className="btn btn-ghost btn-icon" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </header>

        <div className="modal-body">
          {isEditing ? renderEditMode() : renderViewMode()}
        </div>

        <footer className="modal-footer">
          <div>
            {/* Only show Delete button if user owns this meeting */}
            {meeting && isOwner && (
              <button
                className="btn btn-danger btn-icon"
                onClick={() => onDelete(meeting.id)}
                title="Delete meeting"
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
          <div className="modal-footer-actions">
            {isEditing ? (
              <>
                <button className="btn btn-secondary" onClick={handleCancelEdit}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-secondary" onClick={onClose}>
                  Close
                </button>
                {/* Only show Save button for owners */}
                {meeting && isOwner && (
                  <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                )}
              </>
            )}
          </div>
        </footer>
      </div>
    </div>
  )
}
