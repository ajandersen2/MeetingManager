import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Calendar, User } from 'lucide-react'

export default function Login() {
    const [isSignUp, setIsSignUp] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [displayName, setDisplayName] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const { signIn, signUp } = useAuth()
    const navigate = useNavigate()

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')

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
                const { error } = await signUp(email, password, displayName.trim())
                if (error) throw error
                navigate('/')
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
                    <div className="login-tabs">
                        <button
                            type="button"
                            className={`login-tab ${!isSignUp ? 'active' : ''}`}
                            onClick={() => { setIsSignUp(false); setError('') }}
                        >
                            Sign In
                        </button>
                        <button
                            type="button"
                            className={`login-tab ${isSignUp ? 'active' : ''}`}
                            onClick={() => { setIsSignUp(true); setError('') }}
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

                        <button
                            type="submit"
                            className="btn btn-primary login-btn"
                            disabled={loading}
                        >
                            {loading ? 'Please wait...' : (isSignUp ? 'Create Account' : 'Sign In')}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}
