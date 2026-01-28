import { useState, useRef, useEffect } from 'react'
import { Clock } from 'lucide-react'

const HOURS = Array.from({ length: 12 }, (_, i) => (i + 1).toString())
const MINUTES = ['00', '15', '30', '45']

export default function TimePicker({ value, onChange }) {
    const [isOpen, setIsOpen] = useState(false)
    const [selectedHour, setSelectedHour] = useState('9')
    const [selectedMinute, setSelectedMinute] = useState('00')
    const [selectedPeriod, setSelectedPeriod] = useState('AM')
    const containerRef = useRef(null)

    // Parse the incoming value (24-hour format like "14:30")
    useEffect(() => {
        if (value) {
            const [h, m] = value.split(':')
            let hour = parseInt(h, 10)
            const minute = m || '00'

            const period = hour >= 12 ? 'PM' : 'AM'
            if (hour === 0) hour = 12
            else if (hour > 12) hour = hour - 12

            setSelectedHour(hour.toString())
            setSelectedMinute(minute)
            setSelectedPeriod(period)
        }
    }, [value])

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const formatDisplayTime = () => {
        if (!value) return ''
        const [h, m] = value.split(':')
        let hour = parseInt(h, 10)
        const period = hour >= 12 ? 'PM' : 'AM'
        if (hour === 0) hour = 12
        else if (hour > 12) hour = hour - 12
        return `${hour}:${m} ${period}`
    }

    const getPreviewTime = () => {
        return `${selectedHour}:${selectedMinute} ${selectedPeriod}`
    }

    const handleSetTime = () => {
        // Convert to 24-hour format for storage
        let hour = parseInt(selectedHour, 10)
        if (selectedPeriod === 'PM' && hour !== 12) hour += 12
        if (selectedPeriod === 'AM' && hour === 12) hour = 0

        const timeValue = `${hour.toString().padStart(2, '0')}:${selectedMinute}`
        onChange(timeValue)
        setIsOpen(false)
    }

    return (
        <div className="time-picker-container" ref={containerRef}>
            <div
                className="time-picker-input form-input"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className={value ? '' : 'time-picker-placeholder'}>
                    {value ? formatDisplayTime() : 'Select time...'}
                </span>
                <Clock size={16} className="time-picker-icon" />
            </div>

            {isOpen && (
                <div className="time-picker-dropdown">
                    <div className="time-picker-selectors">
                        <select
                            className="time-picker-select"
                            value={selectedHour}
                            onChange={(e) => setSelectedHour(e.target.value)}
                        >
                            {HOURS.map(h => (
                                <option key={h} value={h}>{h}</option>
                            ))}
                        </select>

                        <span className="time-picker-colon">:</span>

                        <select
                            className="time-picker-select"
                            value={selectedMinute}
                            onChange={(e) => setSelectedMinute(e.target.value)}
                        >
                            {MINUTES.map(m => (
                                <option key={m} value={m}>{m}</option>
                            ))}
                        </select>

                        <div className="time-picker-period">
                            <button
                                type="button"
                                className={`time-picker-period-btn ${selectedPeriod === 'AM' ? 'active' : ''}`}
                                onClick={() => setSelectedPeriod('AM')}
                            >
                                AM
                            </button>
                            <button
                                type="button"
                                className={`time-picker-period-btn ${selectedPeriod === 'PM' ? 'active' : ''}`}
                                onClick={() => setSelectedPeriod('PM')}
                            >
                                PM
                            </button>
                        </div>
                    </div>

                    <div className="time-picker-preview">
                        {getPreviewTime()}
                    </div>

                    <button
                        type="button"
                        className="btn btn-primary time-picker-set-btn"
                        onClick={handleSetTime}
                    >
                        Set Time
                    </button>
                </div>
            )}
        </div>
    )
}
