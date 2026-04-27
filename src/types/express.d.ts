declare global {
  namespace Express {
    interface AuthenticatedUser {
      userId: string
      role: string
      roles: string[]
      authzVersion: number
      jti: string
      sessionKey: string | null
    }

    interface Request {
      requestId: string
      user?: AuthenticatedUser
    }
  }
}

export {}
