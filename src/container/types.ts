export const TYPES = {
  Logger: Symbol.for('Logger'),
  DbPool: Symbol.for('DbPool'),
  RedisClient: Symbol.for('RedisClient'),

  // Repositories
  IUserRepository: Symbol.for('IUserRepository'),
  IUserCredentialRepository: Symbol.for('IUserCredentialRepository'),
  IUserSessionRepository: Symbol.for('IUserSessionRepository'),
  IRefreshTokenRepository: Symbol.for('IRefreshTokenRepository'),

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
  LogoutUseCase: Symbol.for('LogoutUseCase'),
  LogoutAllUseCase: Symbol.for('LogoutAllUseCase'),
  ChangePasswordUseCase: Symbol.for('ChangePasswordUseCase'),

  // Controllers
  HealthController: Symbol.for('HealthController'),
  AuthController: Symbol.for('AuthController'), // Deprecated
  AccessController: Symbol.for('AccessController'),
  IdentityController: Symbol.for('IdentityController'),
  CredentialsController: Symbol.for('CredentialsController'),
} as const
