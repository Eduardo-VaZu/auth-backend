export type UserRole = 'user' | 'admin'
export type UserStatus =
  | 'active'
  | 'disabled'
  | 'locked'
  | 'pending_verification'

export interface UserProps {
  id: string
  email: string
  roles: UserRole[]
  status: UserStatus
  authzVersion: number
  emailVerifiedAt: Date | null
  lastLoginAt: Date | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export class User {
  public readonly id: string

  public readonly email: string

  public readonly roles: UserRole[]

  public readonly status: UserStatus

  public readonly authzVersion: number

  public readonly emailVerifiedAt: Date | null

  public readonly lastLoginAt: Date | null

  public readonly createdAt: Date

  public readonly updatedAt: Date

  public readonly deletedAt: Date | null

  public constructor(props: UserProps) {
    this.id = props.id
    this.email = props.email
    this.roles = props.roles
    this.status = props.status
    this.authzVersion = props.authzVersion
    this.emailVerifiedAt = props.emailVerifiedAt
    this.lastLoginAt = props.lastLoginAt
    this.createdAt = props.createdAt
    this.updatedAt = props.updatedAt
    this.deletedAt = props.deletedAt
  }

  public canAuthenticate(): boolean {
    return this.status === 'active' && this.deletedAt === null
  }

  public primaryRole(): UserRole {
    return this.roles.includes('admin') ? 'admin' : this.roles[0] ?? 'user'
  }
}
