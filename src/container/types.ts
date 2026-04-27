export const TYPES = {
  Logger: Symbol.for('Logger'),
  DbPool: Symbol.for('DbPool'),
  RedisClient: Symbol.for('RedisClient'),

  // Repositories
  IUserRepository: Symbol.for('IUserRepository'),
  IUserCredentialRepository: Symbol.for('IUserCredentialRepository'),
  IOneTimeTokenRepository: Symbol.for('IOneTimeTokenRepository'),
  IUserSessionRepository: Symbol.for('IUserSessionRepository'),
  IRefreshTokenRepository: Symbol.for('IRefreshTokenRepository'),
  IRoleRepository: Symbol.for('IRoleRepository'),
  IUserRoleRepository: Symbol.for('IUserRoleRepository'),

  // Services
  ITokenService: Symbol.for('ITokenService'),
  ISessionStore: Symbol.for('ISessionStore'),
  IAuthAuditService: Symbol.for('IAuthAuditService'),
  IAuthUnitOfWork: Symbol.for('IAuthUnitOfWork'),
  ISecurityThrottleService: Symbol.for('ISecurityThrottleService'),

  // Use Cases
  RegisterUseCase: Symbol.for('RegisterUseCase'),
  LoginUseCase: Symbol.for('LoginUseCase'),
  RefreshTokenUseCase: Symbol.for('RefreshTokenUseCase'),
  ListSessionsUseCase: Symbol.for('ListSessionsUseCase'),
  RevokeSessionUseCase: Symbol.for('RevokeSessionUseCase'),
  ListRolesUseCase: Symbol.for('ListRolesUseCase'),
  ListUserRolesUseCase: Symbol.for('ListUserRolesUseCase'),
  AssignUserRoleUseCase: Symbol.for('AssignUserRoleUseCase'),
  RevokeUserRoleUseCase: Symbol.for('RevokeUserRoleUseCase'),
  LogoutUseCase: Symbol.for('LogoutUseCase'),
  LogoutAllUseCase: Symbol.for('LogoutAllUseCase'),
  ChangePasswordUseCase: Symbol.for('ChangePasswordUseCase'),
  ForgotPasswordUseCase: Symbol.for('ForgotPasswordUseCase'),
  ResetPasswordUseCase: Symbol.for('ResetPasswordUseCase'),
  VerifyEmailUseCase: Symbol.for('VerifyEmailUseCase'),
  ResendVerificationUseCase: Symbol.for('ResendVerificationUseCase'),

  // Controllers
  HealthController: Symbol.for('HealthController'),
  AuthController: Symbol.for('AuthController'), // Deprecated
  AccessController: Symbol.for('AccessController'),
  AdminController: Symbol.for('AdminController'),
  IdentityController: Symbol.for('IdentityController'),
  CredentialsController: Symbol.for('CredentialsController'),
} as const
