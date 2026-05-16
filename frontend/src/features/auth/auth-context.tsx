import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { apiRequest } from '../../lib/api'

export type AuthUser = {
  id: string
  firstName: string
  lastName: string
  email: string
  avatar: { url: string; publicId: string; width: number; height: number; format: string; bytes: number } | null
  isAdmin?: boolean
}

type LoginInput = {
  email: string
  password: string
}

type AuthContextValue = {
  isLoading: boolean
  isAuthenticated: boolean
  user: AuthUser | null
  login: (input: LoginInput) => Promise<void>
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshSession = async () => {
    try {
      const response = await apiRequest<{ user: AuthUser }>('/auth/me', {
        method: 'GET',
      })

      setUser(response.user)
    } catch {
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void refreshSession()
  }, [])

  const login = async (input: LoginInput) => {
    const response = await apiRequest<{ user: AuthUser }>('/auth/login', {
      method: 'POST',
      bodyJson: input,
    })

    setUser(response.user)
  }

  const logout = async () => {
    await apiRequest<{ success: boolean }>('/auth/logout', {
      method: 'POST',
    })

    setUser(null)
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading,
      isAuthenticated: user !== null,
      user,
      login,
      logout,
      refreshSession,
    }),
    [isLoading, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return context
}
