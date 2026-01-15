import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import type { User } from '../types'
import { getCurrentUser } from '../services/api'
import { setUnauthorizedHandler } from '../services/api'

interface AuthContextType {
    token: string | null
    user: User | null
    login: (token: string) => Promise<void>
    logout: () => void
    isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [token, setToken] = useState<string | null>(
        localStorage.getItem('token')
    )
    const [user, setUser] = useState<User | null>(null)


    useEffect(() => {
        if (token) {
            getCurrentUser(token)
                .then(setUser)
                .catch(() => {
                    setToken(null)
                    localStorage.removeItem('token')
                })
        }
    }, [token])

    useEffect(() => {
        setUnauthorizedHandler(() => {
            logout()
        })
    }, [])

    const login = async (newToken: string) => {
        localStorage.setItem('token', newToken)
        setToken(newToken)
        const userData = await getCurrentUser(newToken)
        setUser(userData)
    }

    const logout = () => {
        localStorage.removeItem('token')
        setToken(null)
        setUser(null)
    }

    return (
        <AuthContext.Provider
            value={{
                token,
                user,
                login,
                logout,
                isAuthenticated: !!token,
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider')
    }
    return context
}