export interface RoleProps {
  id: string
  code: string
  name: string
  description: string | null
  isSystem: boolean
  createdAt: Date
  updatedAt: Date
}

export class Role {
  public readonly id: string

  public readonly code: string

  public readonly name: string

  public readonly description: string | null

  public readonly isSystem: boolean

  public readonly createdAt: Date

  public readonly updatedAt: Date

  public constructor(props: RoleProps) {
    this.id = props.id
    this.code = props.code
    this.name = props.name
    this.description = props.description
    this.isSystem = props.isSystem
    this.createdAt = props.createdAt
    this.updatedAt = props.updatedAt
  }
}
