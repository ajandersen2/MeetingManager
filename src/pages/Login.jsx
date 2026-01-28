import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Calendar, AlertTriangle, User } from 'lucide-react'

export default function Login() {
    const [isSignUp, setIsSignUp] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [displayName, setDisplayName] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState('')

    const { signIn, signUp, configError } = useAuth()
    const navigate = useNavigate()

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setMessage('')

        if (isSignUp && password !== confirmPassword) {
            setError('Passwords do not match')
            return
        }

        if (isSignUp && !displayName.trim()) {
            setError('Please enter your name')
            return
        }

        setLoading(true)

        try {
            if (isSignUp) {
                const { data, error } = await signUp(email, password)
                if (error) throw error

                // If signup succeeded and we have a user, update their profile with display_name
                // Note: Profile will be created by trigger, we just need to update display_name
                if (data?.user) {
                    // Wait a moment for the trigger to create the profile
                    setTimeout(async () => {
                        await supabase
                            .from('user_profiles')
                            .update({ display_name: displayName.trim() })
                            .eq('user_id', data.user.id)
                    }, 1000)
                }

                setMessage('Check your email for the confirmation link!')
            } else {
                const { error } = await signIn(email, password)
                if (error) throw error
                navigate('/')
            }
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="login-page">
            <div className="login-container">
                <div className="login-header">
                    <div className="login-logo">
                        <Calendar size={48} style={{ marginBottom: '8px' }} />
                        <div>Meeting Manager</div>
                    </div>
                    <p className="login-tagline">Track and manage your meetings with ease</p>
                </div>

                <div className="login-card">
                    {configError && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 'var(--spacing-3)',
                            padding: 'var(--spacing-4)',
                            background: 'var(--color-danger-bg)',
                            borderRadius: 'var(--radius-md)',
                            marginBottom: 'var(--spacing-6)',
                            border: '1px solid #fecaca'
                        }}>
                            <AlertTriangle size={20} style={{ color: 'var(--color-danger)', flexShrink: 0, marginTop: '2px' }} />
                            <div>
                                <strong style={{ color: 'var(--color-danger)', display: 'block', marginBottom: '4px' }}>
                                    Supabase Not Configured
                                </strong>
                                <p style={{ color: 'var(--color-gray-600)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
                                    Create a <code style={{ background: 'var(--color-gray-100)', padding: '2px 4px', borderRadius: '4px' }}>.env</code> file with your Supabase credentials:
                                </p>
                                <pre style={{
                                    background: 'var(--color-gray-100)',
                                    padding: 'var(--spacing-3)',
                                    borderRadius: 'var(--radius-sm)',
                                    marginTop: 'var(--spacing-2)',
                                    fontSize: 'var(--font-size-xs)',
                                    overflow: 'auto'
                                }}>
                                    {`VITE_SUPABASE_URL=your_url
VITE_SUPABASE_ANON_KEY=your_key`}
                                </pre>
                            </div>
                        </div>
                    )}

                    <div className="login-tabs">
                        <button
                            type="button"
                            className={`login-tab ${!isSignUp ? 'active' : ''}`}
                            onClick={() => { setIsSignUp(false); setError(''); setMessage('') }}
                        >
                            Sign In
                        </button>
                        <button
                            type="button"
                            className={`login-tab ${isSignUp ? 'active' : ''}`}
                            onClick={() => { setIsSignUp(true); setError(''); setMessage('') }}
                        >
                            Sign Up
                        </button>
                    </div>

                    <form onSubmit={handleSubmit}>
                        {isSignUp && (
                            <div className="form-group">
                                <label className="form-label" htmlFor="displayName">
                                    <User size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                                    Your Name
                                </label>
                                <input
                                    id="displayName"
                                    type="text"
                                    className="form-input"
                                    placeholder="John Smith"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    required
                                />
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label" htmlFor="email">Email</label>
                            <input
                                id="email"
                                type="email"
                                className="form-input"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="password">Password</label>
                            <input
                                id="password"
                                type="password"
                                className="form-input"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={6}
                            />
                        </div>

                        {isSignUp && (
                            <div className="form-group">
                                <label className="form-label" htmlFor="confirmPassword">Confirm Password</label>
                                <input
                                    id="confirmPassword"
                                    type="password"
                                    className="form-input"
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    minLength={6}
                                />
                            </div>
                        )}

                        {error && <p className="form-error">{error}</p>}
                        {message && <p style={{ color: 'var(--color-primary)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--spacing-2)' }}>{message}</p>}

                        <button
                            type="submit"
                            className="btn btn-primary login-btn"
                            disabled={loading || configError}
                        >
                            {loading ? 'Please wait...' : (isSignUp ? 'Create Account' : 'Sign In')}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}
