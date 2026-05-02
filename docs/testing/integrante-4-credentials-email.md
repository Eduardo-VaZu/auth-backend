# Integrante 4 - Credentials + Email Delivery

## Alcance

- Password/OneTimeToken/UserCredential
- Parse de token one-time
- Forgot/reset/verify/resend/change password/email
- Servicio de email (preview + brevo)
- Flujo HTTP de credenciales

## Archivos Fuente

- `src/modules/credentials/domain/value-objects/Password.ts`
- `src/modules/credentials/domain/entities/OneTimeToken.ts`
- `src/modules/credentials/domain/entities/UserCredential.ts`
- `src/modules/credentials/application/utils/parseOneTimeToken.ts`
- `src/modules/credentials/application/use-cases/ChangePasswordUseCase.ts`
- `src/modules/credentials/application/use-cases/ForgotPasswordUseCase.ts`
- `src/modules/credentials/application/use-cases/ResetPasswordUseCase.ts`
- `src/modules/credentials/application/use-cases/VerifyEmailUseCase.ts`
- `src/modules/credentials/application/use-cases/ResendVerificationUseCase.ts`
- `src/modules/credentials/application/use-cases/ChangeEmailUseCase.ts`
- `src/modules/credentials/domain/services/IAuthEmailService.ts`
- `src/modules/credentials/infrastructure/services/AuthEmailService.ts`
- `src/modules/credentials/infrastructure/controllers/CredentialsController.ts`
- `src/modules/credentials/infrastructure/routes/credentials.routes.ts`

## Suites objetivo

- `tests/modules/credentials/domain/unit/CredentialsDomain.test.ts`
- `tests/modules/credentials/application/unit/ParseOneTimeToken.test.ts`
- `tests/modules/credentials/application/unit/CredentialsUseCases.test.ts`
- `tests/modules/credentials/infrastructure/unit/AuthEmailService.test.ts`
- `tests/modules/credentials/integration/CredentialsFlow.test.ts`

## Casos completos unitarios

### Dominio y parser

- Password valida/rechaza longitud.
- OneTimeToken/UserCredential construccion y mapeo.
- parseOneTimeToken:
  - acepta `uuid.secret`
  - rechaza formatos invalidos.

### Use cases

- ForgotPassword:
  - existente: invalida previos, crea nuevo, audita, envia.
  - no existente: neutro sin enumeracion.
  - preview token solo en modo preview.
- ResetPassword:
  - token valido: cambia password, marca usado, revoca sesiones/tokens.
  - token invalido/usado/expirado: rechazo.
- VerifyEmail:
  - token valido: verifica email/estado.
  - token invalido/usado/expirado: rechazo.
- ResendVerification:
  - no verificado: invalida previo + crea + envia.
  - verificado/no existente: neutro.
- ChangePassword:
  - valida password actual
  - actualiza y revoca sesiones/tokens
  - limpia/blacklist de access actual.
- ChangeEmail:
  - email nuevo -> `pending_verification`, `emailVerifiedAt=null`, revoca sesiones/tokens, emite token.
  - email en uso -> conflicto.

### AuthEmailService

- Modo `preview`: devuelve `previewToken`.
- Modo `brevo`: request correcto a API.
- Fallo de Brevo -> error de aplicacion.
- Sin exposicion de token en produccion.

## Casos completos integracion

### CredentialsFlow

- `POST /auth/forgot-password`:
  - `200` siempre
  - preview token en dev/test.
- `POST /auth/reset-password`:
  - valido `200`
  - invalido/usado/expirado `401`.
- `POST /auth/verify-email`:
  - valido `200`
  - invalido `401`.
- `POST /auth/resend-verification`:
  - por email
  - sin auth obligatoria
  - respuesta neutra.
- `POST /auth/change-password` autenticado:
  - `200`, cookies limpiadas.
- `PATCH /auth/me/email` autenticado:
  - `200`, cookies limpiadas, estado pendiente de verificacion.

## Mocks/Fakes/Testcontainers

- Unit: mock de email provider, repositorios, token service.
- Integration: supertest + entorno de integracion segun flujo.

## Comandos

```bash
npm run test:unit
npm run test:integration
```

## Checklist de entrega

- [ ] Unit domain credentials
- [ ] Unit ParseOneTimeToken
- [ ] Unit CredentialsUseCases
- [ ] Unit AuthEmailService
- [ ] Integration CredentialsFlow
- [ ] Evidencia de comandos

## Criterio de Done

- Sin fuga de informacion sensible.
- Tokens one-time consumibles y con expiracion real.
