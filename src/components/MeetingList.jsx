import { Search, Download } from 'lucide-react'

export default function MeetingList({
    meetings,
    loading,
    searchQuery,
    onSearchChange,
    onMeetingClick
}) {
    const formatDate = (dateStr) => {
        if (!dateStr) return '-'
        const date = new Date(dateStr + 'T00:00:00')
        return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })
    }

    const formatTime = (timeStr) => {
        if (!timeStr) return '-'
        const [hours, minutes] = timeStr.split(':')
        const hour = parseInt(hours)
        const ampm = hour >= 12 ? 'PM' : 'AM'
        const hour12 = hour % 12 || 12
        return `${hour12}:${minutes} ${ampm}`
    }

    const handleExport = () => {
        const headers = ['Meeting Name', 'Date', 'Time', 'Location', 'Attendees']
        const rows = meetings.map(m => [
            m.name,
            formatDate(m.date),
            formatTime(m.time),
            m.location || '',
            m.meeting_attendees?.length || 0
        ])

        const csv = [
            headers.join(','),
            ...rows.map(r => r.map(c => `"${c}"`).join(','))
        ].join('\n')

        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'meetings.csv'
        a.click()
        URL.revokeObjectURL(url)
    }

    if (loading) {
        return (
            <div className="card-body">
                <div className="loading-screen" style={{ minHeight: '200px' }}>
                    <div className="loading-spinner"></div>
                </div>
            </div>
        )
    }

    return (
        <>
            <div className="table-toolbar">
                <div className="search-input">
                    <Search size={16} />
                    <input
                        type="text"
                        className="form-input"
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                </div>
                <button
                    className="btn btn-ghost btn-icon"
                    onClick={handleExport}
                    title="Export to CSV"
                >
                    <Download size={18} />
                </button>
            </div>

            <div className="table-container">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Meeting Name</th>
                            <th>Date</th>
                            <th>Time</th>
                            <th>Location</th>
                            <th>Created By</th>
                            <th>Attendees</th>
                        </tr>
                    </thead>
                    <tbody>
                        {meetings.length === 0 ? (
                            <tr>
                                <td colSpan="6" style={{ textAlign: 'center', color: 'var(--color-gray-400)', padding: 'var(--spacing-8)' }}>
                                    No meetings yet. Click "New Meeting" to create one.
                                </td>
                            </tr>
                        ) : (
                            meetings.map(meeting => (
                                <tr key={meeting.id} onClick={() => onMeetingClick(meeting)}>
                                    <td style={{ fontWeight: 500, color: 'var(--color-gray-800)' }}>
                                        {meeting.name}
                                    </td>
                                    <td>{formatDate(meeting.date)}</td>
                                    <td>{formatTime(meeting.time)}</td>
                                    <td>{meeting.location || '-'}</td>
                                    <td style={{ color: 'var(--color-gray-500)', fontSize: 'var(--font-size-sm)' }}>
                                        {meeting.creator?.display_name || 'Unknown'}
                                    </td>
                                    <td className="attendees-badge">
                                        {meeting.meeting_attendees?.length || 0} attendee{meeting.meeting_attendees?.length !== 1 ? 's' : ''}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </>
    )
}
