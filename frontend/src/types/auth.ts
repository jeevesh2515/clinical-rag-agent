export interface User {
  id: string
  username: string
  email: string
  roles: UserRole[]
  is_active: boolean
}

export type UserRole = 'clinician' | 'patient' | 'admin' | 'care_coordinator'

export interface Token {
  access_token: string
  token_type: string
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface AuthContext {
  user: User | null
  isAuthenticated: boolean
  token: string | null
  login: (username: string, password: string) => Promise<void>
  register: (username: string, email: string, password: string) => Promise<void>
  logout: () => void
}
