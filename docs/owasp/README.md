# Auditoría de Seguridad — Hallazgos OWASP

**Audiencia:** Jefatura de Producto. Este documento no requiere conocimientos técnicos.

## ¿Qué es esto?

Un ejercicio controlado de seguridad sobre nuestro backend de autenticación. Introdujimos deliberadamente **nueve debilidades reales** en el código del backend y escribimos pruebas automáticas que las detectan, tal como lo haría un atacante externo. **Las vulnerabilidades siguen presentes en la rama** para que puedan verse en vivo — este material sirve para demostrar cada hallazgo y proponer su corrección.

Cada hallazgo tiene su propia ficha con:

- Una **analogía** para entenderlo sin tecnicismos.
- El **impacto** que tendría en el producto y los usuarios si un atacante lo explotara.
- La **propuesta de corrección** que deberíamos aplicar.

## Los nueve hallazgos

| # | Hallazgo | Riesgo | Ficha |
|---|----------|--------|-------|
| 01 | El sistema revela qué correos están registrados | Alto | [01-user-enumeration.md](01-user-enumeration.md) |
| 02 | Un usuario puede darse permisos de administrador al registrarse | Crítico | [02-mass-assignment.md](02-mass-assignment.md) |
| 03 | Un usuario puede cambiar el correo de otra persona | Crítico | [03-idor-change-email.md](03-idor-change-email.md) |
| 04 | Cualquier usuario puede eliminar cuentas ajenas usando el área de admin | Crítico | [04-broken-access-control-admin.md](04-broken-access-control-admin.md) |
| 05 | Cerrar sesión no invalida el token: la sesión sigue viva | Alto | [05-logout-refresh-replay.md](05-logout-refresh-replay.md) |
| 06 | Cualquier sitio web puede robar la sesión desde el navegador de la víctima | Alto | [06-cors-strict-allowlist.md](06-cors-strict-allowlist.md) |
| 07 | El atacante puede "cambiar de IP" mintiendo en un encabezado | Alto | [07-trust-proxy-ip-spoofing.md](07-trust-proxy-ip-spoofing.md) |
| 08 | La bitácora de seguridad pierde la trazabilidad de las acciones | Media | [08-audit-inside-transaction.md](08-audit-inside-transaction.md) |
| 09 | Un texto en el buscador de admin puede ejecutar código en la base | Crítico | [09-sql-injection-admin-search.md](09-sql-injection-admin-search.md) |

## ¿Cómo demostramos cada hallazgo?

Por cada uno hay una prueba automática bajo `tests/owasp/integration/` que **simula el ataque**. La prueba está diseñada para **fallar** contra el código actual — su fallo es la evidencia de que la vulnerabilidad existe.

Cuando la corrección propuesta en la ficha correspondiente se aplique al código, la prueba pasará a estar en verde. Esto quedará documentado en un commit posterior.

## Historia de commits

La rama `owasp-vulnerable-demo` documenta cada hallazgo con tres commits en secuencia:

1. `chore(owasp): weaken <slug>` — introduce la debilidad en el código.
2. `test(owasp): red proof for <slug>` — agrega la prueba que detecta el ataque.
3. `docs(owasp): explain <slug>` — publica la ficha con analogía, impacto y **propuesta** de corrección.

En la punta de la rama, las nueve vulnerabilidades están presentes y las nueve pruebas fallan. Cualquier persona técnica puede recorrer la historia commit por commit y ver cada pieza por separado.
