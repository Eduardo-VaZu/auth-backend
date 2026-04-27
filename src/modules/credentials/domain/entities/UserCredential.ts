export interface UserCredentialProps {
  id: string
  userId: string
  passwordHash: string
  passwordChangedAt: Date
  passwordVersion: number
  mustChangePassword: boolean
  createdAt: Date
  updatedAt: Date
}

export class UserCredential {
  public readonly id: string

  public readonly userId: string

  public readonly passwordHash: string

  public readonly passwordChangedAt: Date

  public readonly passwordVersion: number

  public readonly mustChangePassword: boolean

  public readonly createdAt: Date

  public readonly updatedAt: Date

  public constructor(props: UserCredentialProps) {
    this.id = props.id
    this.userId = props.userId
    this.passwordHash = props.passwordHash
    this.passwordChangedAt = props.passwordChangedAt
    this.passwordVersion = props.passwordVersion
    this.mustChangePassword = props.mustChangePassword
    this.createdAt = props.createdAt
    this.updatedAt = props.updatedAt
  }
}
