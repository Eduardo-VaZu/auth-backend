# 04 — Cualquier usuario puede eliminar cuentas ajenas usando el área de admin

**Categoría OWASP:** A01 — Broken Access Control (autorización rota).
**Severidad:** Crítica.
**Estado:** **Documentado — pendiente de corrección.**

## La analogía

Imaginá un banco con dos zonas:

- **Sucursal común**, donde cualquier cliente entra con su credencial.
- **Oficinas internas**, donde solo entra el personal del banco.

Entre las dos zonas hay una puerta con un guardia. El guardia hace dos cosas:

1. **Chequea que tengas credencial válida** (que no sea un desconocido de la calle).
2. **Chequea que tu credencial diga "personal"** (que no sea un cliente cualquiera).

Un día alguien decidió reorganizar los controles y puso **guardias dedicados** delante de cada oficina interna: uno en la de préstamos, uno en la de tarjetas, uno en la de auditoría. La idea era darle a cada oficina un control específico. Pero en la mudanza **se olvidaron un guardia** justo delante de la oficina de "eliminación de cuentas".

El resultado: cualquier cliente común, con su credencial de cliente en la mano, puede cruzar la puerta principal (porque es cliente válido) y **entrar directo a la oficina donde se eliminan cuentas**. Nadie le pide el segundo control.

Eso mismo pasa en nuestro sistema con el endpoint que elimina cuentas. Sigue habiendo un chequeo de "estás logueado", pero se perdió el chequeo de "sos administrador".

## ¿Qué podría pasar?

Un usuario común de la plataforma puede **desactivar la cuenta de cualquier otro usuario** con una sola petición. No necesita conocer contraseñas, ni engañar a nadie, ni encadenar exploits.

Riesgos concretos:

- **Sabotaje entre clientes:** dos empresas competidoras usando la misma plataforma; una desactiva a la otra.
- **Extorsión:** "pagame o desactivo tu cuenta y perdés acceso mañana a las 8am."
- **Interrupción operativa masiva:** un atacante que descubre la falla puede desactivar miles de cuentas en minutos.
- **Reputación:** un incidente de este tipo obliga a comunicar públicamente y afecta la confianza de clientes actuales y futuros.

La acción es "soft delete" (marcar como borrado, no borrar de verdad), pero el efecto de negocio es el mismo: **el usuario pierde acceso** hasta que un administrador restaure la cuenta manualmente.

## Patrón vulnerable presente en el código

En `src/modules/admin/infrastructure/routes/admin.routes.ts`, el guard de admin se aplica **por-ruta** en vez de a nivel del router, y falta en la ruta destructiva:

```ts
router.use(authenticate)   // ← autentica, pero no exige admin

router.get('/roles', requireAdmin, ...)
// ...
router.delete('/users/:userId', ...)   // ← falta requireAdmin
// ...
```

## Cómo se corregiría (propuesta)

Volver a aplicar `requireAdmin` **a nivel del router** — una sola línea, todas las rutas administrativas cubiertas:

```ts
router.use(authenticate, requireAdmin)

router.get('/roles', ...)
router.get('/users', ...)
router.delete('/users/:userId', ...)
// ...
```

Este patrón es **más seguro por diseño** porque:

- El guardia se aplica automáticamente a **todas las rutas administrativas actuales y futuras**.
- Es **imposible olvidarse de ponerlo** en una ruta nueva sin remover activamente el guardia del router — cosa que se ve inmediatamente en revisión de código.

## ¿Cómo comprobamos que la vulnerabilidad existe?

La prueba `tests/owasp/integration/BrokenAccessControlAdmin.test.ts` **simula al atacante**:

1. Registra dos cuentas comunes.
2. Inicia sesión con una de ellas (sin rol admin).
3. Intenta eliminar a la otra vía `DELETE /admin/users/<id>`.
4. Verifica que el servidor responde con **403 (prohibido)**.
5. Verifica en la base de datos que la víctima **no fue marcada como eliminada** y que su estado sigue activo.

- Contra el código actual: la prueba **falla** — el borrado se ejecuta.
- Después de aplicar la corrección: la prueba **pasará** — el servidor deniega la operación y la base queda intacta.
