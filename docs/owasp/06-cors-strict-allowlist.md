# 06 — Cualquier sitio web puede robar la sesión desde el navegador de la víctima

**Categoría OWASP:** A05 — Configuración incorrecta de seguridad (CORS).
**Severidad:** Alta.
**Estado:** **Documentado — pendiente de corrección.**

## La analogía

Imaginá una sucursal bancaria donde los clientes se identifican con una pulsera magnética. Cada vez que un cliente golpea la puerta de una oficina, el guardia le pregunta: **"¿de qué sucursal venís?"**

- Un banco serio: si la sucursal está autorizada, el guardia lo hace pasar; si no, le niega la entrada.
- Un banco irresponsable: el guardia le abre a **cualquiera que diga que viene de algún lado**, sin verificar la lista. Y peor: cuando le entrega los papeles, le agrega la nota *"esta información viene con tu pulsera de cliente adjunta"*. Ese papel sale del banco con el sello de un cliente real, y a partir de ese momento la persona ajena puede usarlo para operar como si fuera él.

En la web, la "puerta" es la política CORS y la "pulsera" es la cookie de sesión. Nuestro servidor está configurado como el banco irresponsable: acepta cualquier `Origin` y responde con "y con credenciales adjuntas". Cualquier página maliciosa puede, **desde el navegador de un usuario logueado**, hacerle pedidos a nuestra API y leer las respuestas como si fuera el propio usuario.

## ¿Qué podría pasar?

El escenario típico:

1. Una persona usuaria abre pestañas nuestras y queda con sesión iniciada.
2. Por curiosidad, cae en un enlace a un sitio malicioso (`evil.tld`).
3. `evil.tld` corre un script que hace peticiones a nuestra API con las cookies de la víctima.
4. Como nuestro CORS es permisivo, el navegador **le entrega la respuesta** al script del atacante.
5. En cuestión de segundos, el atacante puede leer perfil, historial, permisos, o hacer acciones en nombre del usuario.

Es un ataque **desde el navegador de la víctima**, sin necesidad de robar contraseñas ni cookies directamente. Aprovecha que la víctima ya está autenticada.

## Patrón vulnerable presente en el código

En `src/app.ts`, el callback de `cors` refleja cualquier origen:

```ts
app.use(
  cors({
    origin: (_origin, callback) => {
      callback(null, true)   // ← acepta cualquier Origin
    },
    credentials: true,       // ← y adjunta las cookies
  }),
)
```

## Cómo se corregiría (propuesta)

Reemplazar el callback por una **allowlist estricta** cargada desde la variable de entorno `CORS_ORIGIN`:

```ts
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || env.CORS_ORIGIN.includes(origin)) {
        callback(null, true)
      } else {
        callback(new ForbiddenError('Origin is not allowed by CORS policy'))
      }
    },
    credentials: true,
  }),
)
```

Comportamiento resultante:

- Si el `Origin` viene vacío (herramientas server-to-server, curl, healthchecks), se permite.
- Si el `Origin` está en la lista autorizada, se permite.
- **En cualquier otro caso**, se dispara `ForbiddenError` y la petición se detiene con `403` antes de tocar controladores.

## ¿Cómo comprobamos que la vulnerabilidad existe?

La prueba `tests/owasp/integration/CorsOriginAllowlist.test.ts` cubre los dos lados de la política:

1. **Caso hostil:** hace un POST desde `https://evil.tld`. Verifica que la respuesta sea **403** y que el header `Access-Control-Allow-Origin` **no** refleje `evil.tld`.
2. **Caso legítimo:** hace la misma petición desde `http://localhost:5173` (autorizado). Verifica que el pedido pase el chequeo CORS y que el header refleje **exactamente** ese origen.

- Contra el código actual: la prueba **falla** en el caso hostil — el servidor está reflejando `evil.tld`.
- Después de aplicar la corrección: la prueba **pasará** en ambos casos.
