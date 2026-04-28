import type { Request, Response } from 'express'
import { inject, injectable } from 'inversify'

import { TYPES } from '../../../../container/types.js'
import {
  ACCESS_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
} from '../../../access/application/constants/auth.constants.js'
import {
  getClearedAccessTokenCookieOptions,
  getClearedRefreshTokenCookieOptions,
} from '../../../access/infrastructure/controllers/cookieOptions.js'
import type {
  AssignUserRoleInputDto,
  RevokeUserRoleInputDto,
  SoftDeleteUserInputDto,
  UpdateUserStatusInputDto,
} from '../../application/dtos/AdminDtos.js'
import { AssignUserRoleUseCase } from '../../application/use-cases/AssignUserRoleUseCase.js'
import { GetUserProfileUseCase } from '../../application/use-cases/GetUserProfileUseCase.js'
import { ListRolesUseCase } from '../../application/use-cases/ListRolesUseCase.js'
import { ListUserRolesUseCase } from '../../application/use-cases/ListUserRolesUseCase.js'
import { ListUsersUseCase } from '../../application/use-cases/ListUsersUseCase.js'
import { RevokeUserRoleUseCase } from '../../application/use-cases/RevokeUserRoleUseCase.js'
import { SoftDeleteUserUseCase } from '../../application/use-cases/SoftDeleteUserUseCase.js'
import { UpdateUserStatusUseCase } from '../../application/use-cases/UpdateUserStatusUseCase.js'
import {
  UnauthorizedError,
  ValidationError,
} from '../../../../shared/errors/HttpErrors.js'
import {
  listUsersQuerySchema,
  userIdParamSchema,
} from '../routes/admin.schemas.js'

const getSignedAccessToken = (request: Request): string | null => {
  const cookieValue = (request.signedCookies as Record<string, unknown>)[
    ACCESS_TOKEN_COOKIE_NAME
  ]

  return typeof cookieValue === 'string' ? cookieValue : null
}

const getRequestUserAgent = (request: Request): string | null =>
  request.get('user-agent') ?? null

const getRouteParam = (request: Request, paramName: string): string | null => {
  const value = request.params[paramName]

  return typeof value === 'string' ? value : null
}

const clearAuthCookies = (response: Response): void => {
  response.clearCookie(
    ACCESS_TOKEN_COOKIE_NAME,
    getClearedAccessTokenCookieOptions(),
  )
  response.clearCookie(
    REFRESH_TOKEN_COOKIE_NAME,
    getClearedRefreshTokenCookieOptions(),
  )
}

const mapValidationIssues = (
  issues: Array<{ path: Array<string | number>; message: string }>,
) =>
  issues.map((issue) => ({
    field: issue.path.join('.') || 'request',
    message: issue.message,
  }))

@injectable()
export class AdminController {
  public constructor(
    @inject(TYPES.ListRolesUseCase)
    private readonly listRolesUseCase: ListRolesUseCase,
    @inject(TYPES.ListUserRolesUseCase)
    private readonly listUserRolesUseCase: ListUserRolesUseCase,
    @inject(TYPES.AssignUserRoleUseCase)
    private readonly assignUserRoleUseCase: AssignUserRoleUseCase,
    @inject(TYPES.RevokeUserRoleUseCase)
    private readonly revokeUserRoleUseCase: RevokeUserRoleUseCase,
    @inject(TYPES.ListUsersUseCase)
    private readonly listUsersUseCase: ListUsersUseCase,
    @inject(TYPES.GetUserProfileUseCase)
    private readonly getUserProfileUseCase: GetUserProfileUseCase,
    @inject(TYPES.UpdateUserStatusUseCase)
    private readonly updateUserStatusUseCase: UpdateUserStatusUseCase,
    @inject(TYPES.SoftDeleteUserUseCase)
    private readonly softDeleteUserUseCase: SoftDeleteUserUseCase,
  ) {}

  public async listRoles(_request: Request, response: Response): Promise<void> {
    const result = await this.listRolesUseCase.execute()

    response.status(200).json(result)
  }

  public async listUsers(request: Request, response: Response): Promise<void> {
    const query = listUsersQuerySchema.safeParse(request.query)

    if (!query.success) {
      throw new ValidationError(mapValidationIssues(query.error.issues))
    }

    const result = await this.listUsersUseCase.execute({
      page: query.data.page,
      limit: query.data.limit,
      ...(query.data.status !== undefined ? { status: query.data.status } : {}),
      ...(query.data.q !== undefined ? { search: query.data.q } : {}),
    })

    response.status(200).json(result)
  }

  public async getUserProfile(
    request: Request,
    response: Response,
  ): Promise<void> {
    const params = userIdParamSchema.safeParse(request.params)

    if (!params.success) {
      throw new ValidationError(mapValidationIssues(params.error.issues))
    }

    const result = await this.getUserProfileUseCase.execute(params.data.userId)

    response.status(200).json(result)
  }

  public async listUserRoles(
    request: Request,
    response: Response,
  ): Promise<void> {
    const userId = getRouteParam(request, 'userId')

    if (userId === null) {
      throw new UnauthorizedError('Missing user identifier')
    }

    const result = await this.listUserRolesUseCase.execute(userId)

    response.status(200).json(result)
  }

  public async assignUserRole(
    request: Request,
    response: Response,
  ): Promise<void> {
    if (request.user === undefined) {
      throw new UnauthorizedError('Missing authenticated user')
    }

    const userId = getRouteParam(request, 'userId')

    if (userId === null) {
      throw new UnauthorizedError('Missing user identifier')
    }

    const body = request.body as Pick<AssignUserRoleInputDto, 'roleId'>
    const result = await this.assignUserRoleUseCase.execute({
      actorUserId: request.user.userId,
      targetUserId: userId,
      roleId: body.roleId,
      accessToken: getSignedAccessToken(request),
      requestId: request.requestId ?? null,
      userAgent: getRequestUserAgent(request),
      ipAddress: request.ip ?? null,
    })

    if (result.clearAuthCookies) {
      clearAuthCookies(response)
    }

    response.status(200).json({
      message: 'Role assigned successfully',
    })
  }

  public async revokeUserRole(
    request: Request,
    response: Response,
  ): Promise<void> {
    if (request.user === undefined) {
      throw new UnauthorizedError('Missing authenticated user')
    }

    const userId = getRouteParam(request, 'userId')
    const roleId = getRouteParam(request, 'roleId')

    if (userId === null || roleId === null) {
      throw new UnauthorizedError('Missing route identifiers')
    }

    const result = await this.revokeUserRoleUseCase.execute({
      actorUserId: request.user.userId,
      targetUserId: userId,
      roleId,
      accessToken: getSignedAccessToken(request),
      requestId: request.requestId ?? null,
      userAgent: getRequestUserAgent(request),
      ipAddress: request.ip ?? null,
    } satisfies RevokeUserRoleInputDto)

    if (result.clearAuthCookies) {
      clearAuthCookies(response)
    }

    response.status(200).json({
      message: 'Role revoked successfully',
    })
  }

  public async updateUserStatus(
    request: Request,
    response: Response,
  ): Promise<void> {
    if (request.user === undefined) {
      throw new UnauthorizedError('Missing authenticated user')
    }

    const params = userIdParamSchema.safeParse(request.params)

    if (!params.success) {
      throw new ValidationError(mapValidationIssues(params.error.issues))
    }

    const body = request.body as Pick<UpdateUserStatusInputDto, 'status'>
    const result = await this.updateUserStatusUseCase.execute({
      actorUserId: request.user.userId,
      targetUserId: params.data.userId,
      status: body.status,
      accessToken: getSignedAccessToken(request),
      requestId: request.requestId ?? null,
      userAgent: getRequestUserAgent(request),
      ipAddress: request.ip ?? null,
    })

    if (result.clearAuthCookies) {
      clearAuthCookies(response)
    }

    response.status(200).json({
      message: 'User status updated successfully',
    })
  }

  public async softDeleteUser(
    request: Request,
    response: Response,
  ): Promise<void> {
    if (request.user === undefined) {
      throw new UnauthorizedError('Missing authenticated user')
    }

    const params = userIdParamSchema.safeParse(request.params)

    if (!params.success) {
      throw new ValidationError(mapValidationIssues(params.error.issues))
    }

    const result = await this.softDeleteUserUseCase.execute({
      actorUserId: request.user.userId,
      targetUserId: params.data.userId,
      accessToken: getSignedAccessToken(request),
      requestId: request.requestId ?? null,
      userAgent: getRequestUserAgent(request),
      ipAddress: request.ip ?? null,
    } satisfies SoftDeleteUserInputDto)

    if (result.clearAuthCookies) {
      clearAuthCookies(response)
    }

    response.status(200).json({
      message: 'User deleted successfully',
    })
  }
}
