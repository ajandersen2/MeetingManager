import { createContext, useContext, useEffect, useState } from 'react'
import { api, setToken, clearToken, getToken } from '../lib/api'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [userProfile, setUserProfile] = useState(null)
    const [loading, setLoading] = useState(true)

    const isAdmin = userProfile?.role === 'admin'

    useEffect(() => {
        // Check for existing token
        const token = getToken()
        if (!token) {
            setLoading(false)
            return
        }

        // Validate token
        api.get('/api/auth/me')
            .then((data) => {
                setUser(data.user)
                setUserProfile(data.profile)
            })
            .catch(() => {
                clearToken()
            })
            .finally(() => {
                setLoading(false)
            })
    }, [])

    const signUp = async (email, password, displayName) => {
        try {
            const data = await api.post('/api/auth/signup', { email, password, displayName })
            setToken(data.token)
            setUser(data.user)
            // Fetch profile
            const me = await api.get('/api/auth/me')
            setUserProfile(me.profile)
            return { data, error: null }
        } catch (err) {
            return { data: null, error: { message: err.message } }
        }
    }

    const signIn = async (email, password) => {
        try {
            const data = await api.post('/api/auth/login', { email, password })
            setToken(data.token)
            setUser(data.user)
            // Fetch profile
            const me = await api.get('/api/auth/me')
            setUserProfile(me.profile)
            return { data, error: null }
        } catch (err) {
            return { data: null, error: { message: err.message } }
        }
    }

    const signOut = async () => {
        clearToken()
        setUser(null)
        setUserProfile(null)
        return { error: null }
    }

    const value = {
        user,
        userProfile,
        isAdmin,
        loading,
        signUp,
        signIn,
        signOut,
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}
