export interface DecodedToken {
  sub?: string
  username?: string
  email?: string
  role?: string
  roles?: string[]
}

export function createDemoToken(username: string, email: string = '', role: string = 'patient'): string {
  const cleanUsername = username.trim() || 'user'
  const cleanEmail = email.trim() || `${cleanUsername}@clinical.demo`
  const cleanRole = role || 'patient'
  
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = btoa(JSON.stringify({
    sub: cleanUsername,
    username: cleanUsername,
    email: cleanEmail,
    role: cleanRole,
    roles: [cleanRole],
    exp: Math.floor(Date.now() / 1000) + 86400 * 30
  }))
  return `${header}.${payload}.demo_signature`
}

export function decodeToken(token: string): DecodedToken | null {
  try {
    const parts = token.split('.')
    if (parts.length >= 2) {
      const payloadStr = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
      return JSON.parse(payloadStr)
    }
  } catch {
    // Ignore invalid tokens
  }
  return null
}
