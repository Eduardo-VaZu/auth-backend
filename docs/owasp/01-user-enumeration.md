# 01 — El sistema revela qué correos están registrados

**Categoría OWASP:** A07 — Fallas de identificación y autenticación.
**Severidad:** Alta.
**Estado:** **Documentado — pendiente de corrección.**

## La analogía

Imaginá un edificio con un portero. Cuando alguien golpea la puerta y dice un nombre, el portero puede responder de dos maneras:

- **Portero correcto:** "No puedo dejarte pasar." (siempre lo mismo, sin importar si esa persona vive ahí o no).
- **Portero indiscreto:** "Acá no vive nadie con ese nombre." O bien: "Sí vive, pero la clave que me diste está mal."

El portero indiscreto está **filtrando información sin darse cuenta**. Un desconocido puede ir probando nombres y armarse una lista de quién sí vive en el edificio.

Nuestro sistema está haciendo exactamente eso: cuando alguien intenta iniciar sesión, el mensaje de error deja entrever si el correo está registrado.

## ¿Qué podría pasar?

Un atacante puede armar una lista de correos válidos de nuestra plataforma probando uno por uno. Con esa lista puede:

- **Enviar phishing dirigido:** correos que se ven legítimos porque el atacante sabe que la persona sí es cliente nuestro.
- **Preparar un ataque de contraseñas:** probar contraseñas comunes (`123456`, `Password!`, la temporada + año…) solo contra cuentas reales, sin gastar intentos en correos que no existen.
- **Vender o publicar la lista:** en foros donde ese dato tiene valor para otros atacantes.

El daño no es inmediato ni ruidoso: la fuga de información alimenta ataques posteriores más efectivos.

## Patrón vulnerable presente en el código

En `src/modules/access/application/use-cases/LoginUseCase.ts`, las ramas de "usuario inexistente" y "contraseña incorrecta" emiten mensajes distintos:

```ts
if (user === null) {
  throw new UnauthorizedError('User does not exist')   // ← delata que el email no existe
}
// ...
if (!isPasswordValid) {
  throw new UnauthorizedError('Invalid password')       // ← delata que el email sí existe
}
```

## Cómo se corregiría (propuesta)

Uniformar la respuesta del sistema. Ante cualquier intento fallido de inicio de sesión, el usuario recibe **exactamente el mismo mensaje** ("Credenciales inválidas"), sin importar si el correo existe o no. Un atacante que pruebe correos ya no puede distinguirlos.

En términos de código, ambas ramas deben usar la constante `INVALID_CREDENTIALS_MESSAGE` que ya existe en el archivo:

```ts
if (user === null || !user.canAuthenticate()) {
  throw new UnauthorizedError(INVALID_CREDENTIALS_MESSAGE)
}
// ...
if (!isPasswordValid) {
  throw new UnauthorizedError(INVALID_CREDENTIALS_MESSAGE)
}
```

## ¿Cómo comprobamos que la vulnerabilidad existe?

La prueba `tests/owasp/integration/LoginUserEnumeration.test.ts` **simula al atacante**: envía dos intentos de inicio de sesión, uno con un correo real y otro con uno inventado, y verifica que las respuestas sean idénticas.

- Contra el código actual: la prueba **falla** (evidencia de la vulnerabilidad).
- Después de aplicar la corrección: la prueba **pasará** (evidencia de que ya no se puede enumerar).
