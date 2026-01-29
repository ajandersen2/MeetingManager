import { useState, useEffect } from 'react'
import { X, Settings, Sparkles, User, Key, Eye, EyeOff } from 'lucide-react'
import { useSettings } from '../context/SettingsContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const AI_MODELS = [
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Recommended)', description: 'Fast, affordable, great quality' },
    { value: 'gpt-4o', label: 'GPT-4o', description: 'Best quality, more expensive' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', description: 'Fastest, most affordable' },
]

export default function SettingsModal({ isOpen, onClose }) {
    const { settings, updateSettings } = useSettings()
    const { user, userProfile, isAdmin } = useAuth()
    const [activeTab, setActiveTab] = useState('profile')
    const [localSettings, setLocalSettings] = useState(settings)
    const [displayName, setDisplayName] = useState('')
    const [saving, setSaving] = useState(false)
    const [savingProfile, setSavingProfile] = useState(false)
    const [error, setError] = useState(null)
    const [profileSuccess, setProfileSuccess] = useState(false)

    // Admin API key state
    const [openaiApiKey, setOpenaiApiKey] = useState('')
    const [showApiKey, setShowApiKey] = useState(false)
    const [savingApiKey, setSavingApiKey] = useState(false)
    const [apiKeySuccess, setApiKeySuccess] = useState(false)
    const [loadingApiKey, setLoadingApiKey] = useState(false)

    useEffect(() => {
        if (userProfile?.display_name) {
            setDisplayName(userProfile.display_name)
        } else if (user?.email) {
            setDisplayName(user.email)
        }
    }, [userProfile, user])

    // Load API key when admin tab is opened
    useEffect(() => {
        if (isOpen && isAdmin && activeTab === 'admin') {
            loadApiKey()
        }
    }, [isOpen, isAdmin, activeTab])

    const loadApiKey = async () => {
        setLoadingApiKey(true)
        try {
            const { data, error } = await supabase
                .from('user_api_keys')
                .select('openai_api_key')
                .eq('user_id', user.id)
                .single()

            if (data?.openai_api_key) {
                setOpenaiApiKey(data.openai_api_key)
            }
        } catch (err) {
            // No key exists yet, that's fine
        }
        setLoadingApiKey(false)
    }

    if (!isOpen) return null

    const handleSave = async () => {
        setSaving(true)
        setError(null)

        const result = await updateSettings(localSettings)

        if (result.success) {
            onClose()
        } else {
            setError('Failed to save settings. Make sure you have admin privileges.')
        }

        setSaving(false)
    }

    const handleSaveProfile = async () => {
        setSavingProfile(true)
        setError(null)
        setProfileSuccess(false)

        try {
            const { error } = await supabase
                .from('user_profiles')
                .update({ display_name: displayName })
                .eq('user_id', user.id)

            if (error) throw error
            setProfileSuccess(true)
            setTimeout(() => setProfileSuccess(false), 2000)
        } catch (err) {
            setError('Failed to update profile.')
        }

        setSavingProfile(false)
    }

    const handleSaveApiKey = async () => {
        setSavingApiKey(true)
        setError(null)
        setApiKeySuccess(false)

        try {
            // Upsert the API key
            const { error } = await supabase
                .from('user_api_keys')
                .upsert({
                    user_id: user.id,
                    openai_api_key: openaiApiKey,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id'
                })

            if (error) throw error
            setApiKeySuccess(true)
            setTimeout(() => setApiKeySuccess(false), 2000)
        } catch (err) {
            console.error('Error saving API key:', err)
            setError('Failed to save API key. Please try again.')
        }

        setSavingApiKey(false)
    }

    const handleModelChange = (e) => {
        setLocalSettings(prev => ({ ...prev, ai_model: e.target.value }))
    }

    const handleTokensChange = (e) => {
        setLocalSettings(prev => ({ ...prev, max_tokens: parseInt(e.target.value) }))
    }

    const handleTemperatureChange = (e) => {
        setLocalSettings(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))
    }

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal settings-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">
                        <Settings size={24} style={{ marginRight: '8px', color: 'var(--color-primary)' }} />
                        Settings
                    </h2>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="tabs" style={{ padding: '0 var(--spacing-4)', borderBottom: '1px solid var(--color-gray-200)' }}>
                    <button
                        className={`tab ${activeTab === 'profile' ? 'active' : ''}`}
                        onClick={() => setActiveTab('profile')}
                    >
                        <User size={16} />
                        Profile
                    </button>
                    {isAdmin && (
                        <button
                            className={`tab ${activeTab === 'admin' ? 'active' : ''}`}
                            onClick={() => setActiveTab('admin')}
                        >
                            <Key size={16} />
                            Admin
                        </button>
                    )}
                </div>

                <div className="modal-body">
                    {/* Profile Tab */}
                    {activeTab === 'profile' && (
                        <div className="settings-section">
                            <h3 className="settings-section-title">
                                <User size={18} />
                                My Profile
                            </h3>

                            <div className="form-group">
                                <label className="form-label">Display Name</label>
                                <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        placeholder="Enter your name"
                                    />
                                    <button
                                        className="btn btn-primary"
                                        onClick={handleSaveProfile}
                                        disabled={savingProfile}
                                    >
                                        {savingProfile ? 'Saving...' : profileSuccess ? '✓ Saved' : 'Save'}
                                    </button>
                                </div>
                                <p className="settings-hint">
                                    This name will appear when you're added as an attendee to meetings.
                                </p>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Email</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={user?.email || ''}
                                    disabled
                                    style={{ opacity: 0.7 }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Admin Tab */}
                    {activeTab === 'admin' && isAdmin && (
                        <>
                            {/* API Keys Section */}
                            <div className="settings-section">
                                <h3 className="settings-section-title">
                                    <Key size={18} />
                                    API Keys
                                </h3>

                                <div className="form-group">
                                    <label className="form-label">OpenAI API Key</label>
                                    <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                                        <div style={{ position: 'relative', flex: 1 }}>
                                            <input
                                                type={showApiKey ? 'text' : 'password'}
                                                className="form-input"
                                                value={openaiApiKey}
                                                onChange={(e) => setOpenaiApiKey(e.target.value)}
                                                placeholder={loadingApiKey ? 'Loading...' : 'sk-...'}
                                                style={{ paddingRight: '40px' }}
                                            />
                                            <button
                                                type="button"
                                                className="btn btn-ghost btn-icon"
                                                onClick={() => setShowApiKey(!showApiKey)}
                                                style={{
                                                    position: 'absolute',
                                                    right: '4px',
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    minWidth: '32px',
                                                    minHeight: '32px'
                                                }}
                                            >
                                                {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                        <button
                                            className="btn btn-primary"
                                            onClick={handleSaveApiKey}
                                            disabled={savingApiKey || !openaiApiKey}
                                        >
                                            {savingApiKey ? 'Saving...' : apiKeySuccess ? '✓ Saved' : 'Save'}
                                        </button>
                                    </div>
                                    <p className="settings-hint">
                                        Your API key is stored securely and never shared. Get one from{' '}
                                        <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">
                                            OpenAI Platform
                                        </a>.
                                    </p>
                                </div>
                            </div>

                            {/* AI Configuration Section */}
                            <div className="settings-section">
                                <h3 className="settings-section-title">
                                    <Sparkles size={18} />
                                    AI Configuration
                                </h3>

                                <div className="form-group">
                                    <label className="form-label">AI Model</label>
                                    <select
                                        className="form-input"
                                        value={localSettings.ai_model}
                                        onChange={handleModelChange}
                                    >
                                        {AI_MODELS.map(model => (
                                            <option key={model.value} value={model.value}>
                                                {model.label}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="settings-hint">
                                        {AI_MODELS.find(m => m.value === localSettings.ai_model)?.description}
                                    </p>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">
                                        Max Tokens: <strong>{localSettings.max_tokens}</strong>
                                    </label>
                                    <input
                                        type="range"
                                        className="settings-slider"
                                        min="500"
                                        max="4000"
                                        step="100"
                                        value={localSettings.max_tokens}
                                        onChange={handleTokensChange}
                                    />
                                    <div className="settings-range-labels">
                                        <span>500</span>
                                        <span>4000</span>
                                    </div>
                                    <p className="settings-hint">
                                        Controls the maximum length of AI-generated content. Higher = longer output.
                                    </p>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">
                                        Temperature: <strong>{localSettings.temperature.toFixed(1)}</strong>
                                    </label>
                                    <input
                                        type="range"
                                        className="settings-slider"
                                        min="0"
                                        max="1"
                                        step="0.1"
                                        value={localSettings.temperature}
                                        onChange={handleTemperatureChange}
                                    />
                                    <div className="settings-range-labels">
                                        <span>0 (Focused)</span>
                                        <span>1 (Creative)</span>
                                    </div>
                                    <p className="settings-hint">
                                        Lower = more consistent and focused. Higher = more creative and varied.
                                    </p>
                                </div>
                            </div>
                        </>
                    )}

                    {error && (
                        <div className="settings-error">
                            {error}
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <div></div>
                    <div className="modal-footer-actions">
                        <button className="btn btn-secondary" onClick={onClose}>
                            {activeTab === 'admin' && isAdmin ? 'Cancel' : 'Close'}
                        </button>
                        {activeTab === 'admin' && isAdmin && (
                            <button
                                className="btn btn-primary"
                                onClick={handleSave}
                                disabled={saving}
                            >
                                {saving ? 'Saving...' : 'Save AI Settings'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
