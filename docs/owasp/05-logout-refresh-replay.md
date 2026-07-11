# 05 — Cerrar sesión no invalida el token: la sesión sigue viva

**Categoría OWASP:** A02 — Fallas criptográficas / Gestión de sesiones.
**Severidad:** Alta.
**Estado:** **Documentado — pendiente de corrección.**

## La analogía

Imaginá un hotel donde te dan una tarjeta llave para tu habitación. Cuando hacés el check-out, la recepción te pide devolver la tarjeta. Pero además — y esto es lo importante — **el sistema del hotel invalida esa tarjeta en la base de datos** para que aunque alguien la copie después, ya no abra la puerta.

Un hotel mal administrado se limita a **guardar tu tarjeta en un cajón** sin desactivarla en el sistema. Si horas después alguien recupera esa tarjeta (o simplemente hizo una copia mientras la tenía), la puerta se abre igual. El check-out fue un gesto simbólico, no una revocación real.

Nuestro sistema está haciendo exactamente eso. Cuando el usuario hace "cerrar sesión", el servidor limpia la cookie del navegador pero **no invalida el token** en su propia base de datos ni en su cache rápida. Cualquiera que haya visto o copiado esa cookie antes puede seguir usándola para reactivar la sesión, incluso días después.

## ¿Qué podría pasar?

Un atacante que consiguió la cookie de refresh de una víctima (a través de un XSS, un dispositivo compartido, una sesión olvidada en un cyber, un backup) **mantiene acceso a la cuenta incluso después de que la víctima crea haberla cerrado**.

Consecuencias:

- **Falsa sensación de seguridad:** la víctima cree que "cerré sesión, ya está" y baja la guardia.
- **Persistencia del atacante:** puede generar tokens nuevos cada 7 días hasta que expire el refresh original, sin necesidad de re-autenticar.
- **Ventaja frente a incidentes:** si detectamos un compromiso y "forzamos logout" del usuario, no logramos lo que queremos.

## Patrón vulnerable presente en el código

En `src/modules/access/application/use-cases/LogoutUseCase.ts`, el método `execute` sólo blacklistea el access token y escribe un evento de auditoría — todo lo demás está ausente:

```ts
// No hay refreshTokenRepository.revokeByJti(...)
// No hay userSessionRepository.revokeBySessionKey(...)
// No hay sessionStore.deleteRefreshToken(...)
await this.authUnitOfWork.run(async ({ authAuditService }) => {
  await authAuditService.recordEvent({ ... })
})
```

## Cómo se corregiría (propuesta)

`LogoutUseCase.execute` debe invalidar la sesión en **tres capas** dentro de una única transacción:

1. **Base de datos — refresh token:** marcar la fila en `refresh_tokens` con `revoked_at = NOW()` y `revoked_reason = 'logout'`.
2. **Base de datos — sesión:** marcar la fila en `user_sessions` correspondiente con la misma marca temporal.
3. **Cache Redis:** borrar la entrada del refresh token con `sessionStore.deleteRefreshToken(userId, jti)`.

De forma complementaria, `RefreshTokenUseCase` ya está preparado para chequear las tres capas antes de emitir tokens nuevos, y si detecta un refresh revocado dispara **detección de reuso** que revoca **todas las sesiones del usuario**. Ese comportamiento sigue en su lugar y refuerza la corrección propuesta.

## ¿Cómo comprobamos que la vulnerabilidad existe?

La prueba `tests/owasp/integration/LogoutRefreshReplay.test.ts` **simula al atacante**:

1. El usuario inicia sesión y "el atacante" captura las cookies emitidas.
2. El usuario legítimo hace `POST /auth/logout`.
3. El atacante envía `POST /auth/refresh` con las cookies capturadas.
4. La prueba verifica que la respuesta sea **401** y que en la tabla `refresh_tokens` el token quedó marcado con `revoked_at` distinto de `NULL`.

- Contra el código actual: la prueba **falla** — el refresh sigue vivo en la DB y el replay obtiene tokens nuevos.
- Después de aplicar la corrección: la prueba **pasará** — la invalidación en tres capas cierra el vector.
