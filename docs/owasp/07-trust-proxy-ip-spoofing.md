# 07 — El atacante puede "cambiar de IP" mintiendo en un encabezado

**Categoría OWASP:** A07 — Fallas de identificación y autenticación (variante: IP spoofing).
**Severidad:** Alta.
**Estado:** **Documentado — pendiente de corrección.**

## La analogía

Imaginá un local con un guardia que anota en un cuaderno **de qué barrio viene** cada persona que entra, y usa esa información para decidir si te deja pasar rápido o te pide más controles. Si tres personas del mismo barrio ya se comportaron mal ese día, corta el ingreso desde ese barrio por un rato.

Un guardia bien entrenado mira el documento de la persona. Uno mal entrenado le pregunta directamente: **"¿de qué barrio venís?"** y anota lo que le respondan.

Si el guardia hace la pregunta, cualquiera puede decir un barrio distinto cada vez que entra y **evadir todos los cortes** — el guardia siempre cree que es alguien nuevo. Y peor: puede echarle la culpa a un barrio inocente, y ese barrio queda mal en el cuaderno del día.

En nuestro sistema, la "dirección" del cliente es su dirección IP. Hay dos formas de saberla:

- **Confiar en el socket real** (mirar el documento): la IP que ve el sistema es la que realmente conectó.
- **Confiar en el encabezado `X-Forwarded-For`** que el cliente envía (preguntarle): el cliente puede escribir la IP que quiera.

Sólo tiene sentido confiar en el encabezado si delante del servidor hay un **proxy nuestro** (Nginx, un balanceador, Cloudflare) que reescribe ese encabezado con la IP real antes de que llegue. Nuestro sistema está confiando en el encabezado **sin verificar** si hay ese proxy delante.

## ¿Qué podría pasar?

Cuando el servidor confía ciegamente en `X-Forwarded-For`:

- **El límite de intentos de login (rate limit) se evade.** El atacante rota la IP declarada en cada intento y nunca queda bloqueado. Puede probar contraseñas indefinidamente.
- **Los eventos de auditoría culpan a IPs inocentes.** Si un usuario legítimo denuncia actividad sospechosa, los logs muestran IPs que nunca hicieron nada — el atacante ensucia la evidencia y complica investigar el incidente.
- **Las políticas basadas en país u origen se evaden.** Si en algún momento decidimos bloquear ciertas regiones, el atacante declara ser de otra región y pasa.

## Patrón vulnerable presente en el código

En `src/app.ts`, el nivel de confianza está fijo en `true`, sin importar la variable de entorno:

```ts
app.set('trust proxy', true)   // ← siempre confía en XFF
```

`req.ip` toma el valor que el cliente escribió en `X-Forwarded-For`. El rate limiter, la auditoría y todo lo que use `req.ip` puede ser engañado.

## Cómo se corregiría (propuesta)

Volver a leer el nivel de confianza desde la variable de entorno, con valor **por defecto `false`** en desarrollo y test:

```ts
app.set('trust proxy', env.TRUST_PROXY)
```

Ese valor sólo debe activarse (`TRUST_PROXY=true`) cuando el despliegue incluye un proxy nuestro que reescribe el encabezado — por ejemplo, detrás de un ALB o de Nginx en producción. Con este esquema:

- En dev/test/staging sin proxy: `req.ip` es la IP real del socket, no manipulable por el cliente.
- En producción detrás de un ALB confiable: `req.ip` es la IP real reescrita por el ALB.

## ¿Cómo comprobamos que la vulnerabilidad existe?

La prueba `tests/owasp/integration/TrustedProxyIpSpoofing.test.ts`:

1. Fuerza `TRUST_PROXY=false` explícitamente para el test (lo que un servidor correctamente configurado vería en dev/test).
2. Envía dos intentos fallidos de login con `X-Forwarded-For` distintos (`1.2.3.4` y `5.6.7.8`).
3. Consulta la tabla `auth_audit_logs`.
4. Verifica que **ninguno** de los eventos registrados tenga `1.2.3.4` ni `5.6.7.8` como IP.
5. Verifica que las dos IPs registradas sean **la misma** (la IP real del socket), demostrando que rotar el encabezado no cambia la atribución.

- Contra el código actual: la prueba **falla** — el server ignora `TRUST_PROXY=false` y registra las IPs spoofed.
- Después de aplicar la corrección: la prueba **pasará** — el server obedece la variable y `req.ip` cae de nuevo al socket peer.
