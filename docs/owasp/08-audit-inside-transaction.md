# 08 — La bitácora de seguridad pierde la trazabilidad de las acciones

**Categoría OWASP:** A09 — Fallas de registro y monitoreo.
**Severidad:** Media.
**Estado:** **Documentado — pendiente de corrección.**

## La analogía

Imaginá una entidad financiera con un cuaderno donde el cajero anota cada movimiento antes de mover la plata: "cuenta X paga a cuenta Y $500". El cuaderno es el registro oficial de lo que pasó.

Ahora imaginá que el cajero anota, pero **omite el número de la cuenta de destino**. Escribe: "cuenta X paga $500". ¿A quién le pagó? No queda registrado. Si mañana el cliente denuncia un problema, el equipo de investigación abre el cuaderno y ve que hubo un movimiento, pero no puede reconstruir a dónde fue el dinero.

Eso es exactamente lo que hace nuestra bitácora ahora mismo: registra que hubo un inicio de sesión exitoso, pero **no anota a qué sesión concreta** del sistema corresponde. Cuando en el futuro pase algo raro con alguna sesión, no vamos a poder cruzarla con el evento de login que la originó.

## ¿Qué podría pasar?

En un incidente de seguridad, el equipo que investiga necesita responder preguntas del tipo "¿quién hizo qué, cuándo y desde dónde?". Si la bitácora está desconectada del estado real del sistema, esa reconstrucción es imposible o engañosa.

Consecuencias reales:

- **Impunidad para el atacante:** una operación crítica queda mencionada en logs pero sin forma de vincularla con la sesión concreta que la generó.
- **Ruido para el equipo de defensa:** eventos "genéricos" sin identificadores útiles no permiten correlacionar. Cuando llega una alerta, cuesta responder "¿esta alerta corresponde a la sesión que ese usuario abrió a las 3am?"
- **Problemas de compliance:** normativas como PCI-DSS o SOC 2 exigen trazabilidad íntegra. Un desfasaje entre estado y auditoría puede convertirse en un hallazgo grave en una auditoría externa.

## Patrón vulnerable presente en el código

En `src/modules/access/application/use-cases/LoginUseCase.ts`, el evento de auditoría del login exitoso ya no lleva el identificador de sesión:

```ts
await authAuditService.recordEvent({
  userId: user.id,
  eventType: 'login_success',
  eventStatus: 'success',
  // ...
  metadata: {
    sessionKey,           // ← solo la sessionKey pública
    // sessionId eliminado ← falta el id interno que ata al user_sessions
  },
})
```

## Cómo se corregiría (propuesta)

Restaurar `sessionId: session.id` en el bloque de metadata del evento, dentro del mismo `authUnitOfWork.run` que crea la sesión:

```ts
metadata: {
  sessionId: session.id,
  sessionKey,
},
```

Con esto, cada evento de `login_success` queda correlacionado 1:1 con la fila real en `user_sessions`. Además, como el evento sigue siendo emitido **dentro del mismo `authUnitOfWork.run`** que ejecuta la creación de sesión, si la operación de negocio se revierte la auditoría se revierte con ella: no existe estado intermedio.

Como principio general para el resto de flujos sensibles (logout, refresh, cambio de email, cambio de contraseña, revocación de sesión), todo evento de auditoría debe emitirse **dentro de la misma transacción** que ejecuta la operación de negocio.

## ¿Cómo comprobamos que la vulnerabilidad existe?

La prueba `tests/owasp/integration/AuditInsideTransaction.test.ts`:

1. Hace un login exitoso.
2. Consulta el último evento `login_success` en `auth_audit_logs` para ese usuario.
3. Extrae el `sessionId` desde la columna `metadata`.
4. Verifica en `user_sessions` que **ese `sessionId` existe** y que su columna `revoked_at` es `NULL`.

- Contra el código actual: la prueba **falla** — la aseveración `expect(metadata.sessionId).toBeDefined()` rompe porque el evento ya no lo lleva.
- Después de aplicar la corrección: la prueba **pasará** — la correlación queda restaurada y auditoría/estado son coherentes.
