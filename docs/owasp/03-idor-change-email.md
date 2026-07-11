# 03 — Un usuario puede cambiar el correo de otra persona

**Categoría OWASP:** A01 — Broken Access Control (IDOR: *Insecure Direct Object Reference*).
**Severidad:** Crítica.
**Estado:** **Documentado — pendiente de corrección.**

## La analogía

Imaginá una oficina de correos. Cada cliente tiene una casilla numerada y solo puede pedir cambios sobre **su propia** casilla. Cuando llegás al mostrador, mostrás tu carnet y la persona detrás del vidrio te atiende como cliente correcto.

Ahora imaginá que el sistema interno tiene un formulario que dice **"Cambiar dirección de contacto de la casilla número: ___"**, y la persona del mostrador escribe ese número tal como lo dictás vos. Si le decís tu número, cambia el tuyo. Pero si en vez de tu número le decís **el número de la casilla de tu vecino**, ella igual lo escribe. Nunca cruza tu carnet con el número que dictaste.

Resultado: cualquier cliente puede, con su propio carnet en la mano, ordenar cambios sobre **la casilla de cualquier otro cliente**.

Nuestro sistema está haciendo exactamente eso. El endpoint que cambia el correo de una cuenta verifica que quien llame esté autenticado (muestra su carnet), pero luego confía en un identificador de usuario que **el propio cliente envía** en la petición, en lugar de derivarlo del carnet.

## ¿Qué podría pasar?

Un atacante con **una cuenta legítima** (o incluso una cuenta gratuita cualquiera) puede enviar un pedido de cambio de correo apuntando a **la cuenta de otra persona**. El sistema acepta el cambio y dispara el flujo de re-verificación **al correo elegido por el atacante**.

Con eso el atacante:

1. Redirige el correo de la víctima a una casilla que él controla.
2. Usa el flujo de "olvidé mi contraseña" en la nueva casilla.
3. Recibe el enlace de recuperación y **se apodera de la cuenta**.

En términos simples: **secuestro de cuenta con dos clics**, sin necesitar la contraseña de la víctima y sin ningún truco de ingeniería social.

Para una plataforma que maneja datos personales o dinero, este es uno de los peores desenlaces posibles.

## Patrón vulnerable presente en el código

Dos archivos participan:

- `src/modules/access/infrastructure/routes/auth.schemas.ts` — `changeEmailSchema` exige un campo `userId` en el body.
- `src/modules/credentials/infrastructure/controllers/CredentialsController.ts` — el controller usa ese `userId` del body en lugar del que viene del token autenticado:

```ts
const body = request.body as Pick<ChangeEmailInputDto, 'userId' | 'email'>

const result = await this.changeEmailUseCase.execute({
  userId: body.userId,             // ← elegido por el cliente
  email: body.email,
  // ...
})
```

## Cómo se corregiría (propuesta)

Una regla clara y una barrera adicional:

1. **La identidad la decide el servidor, no el cliente.** El controller debe volver a leer `request.user!.userId` (el id que sale del token autenticado). Aunque el cliente mande otro identificador en el cuerpo, se ignora:

   ```ts
   const body = request.body as Pick<ChangeEmailInputDto, 'email'>
   const result = await this.changeEmailUseCase.execute({
     userId: request.user!.userId,
     email: body.email,
     // ...
   })
   ```

2. **El formulario rechaza campos que no debería aceptar.** El `changeEmailSchema` vuelve a aceptar únicamente `email`, más `.strict()` para rechazar campos desconocidos con `400/422` antes de llegar al controller:

   ```ts
   export const changeEmailSchema = z.object({
     email: z.string().trim().email(),
   }).strict()
   ```

## ¿Cómo comprobamos que la vulnerabilidad existe?

La prueba `tests/owasp/integration/IdorChangeEmail.test.ts` **simula al atacante paso por paso**:

1. Registra dos cuentas, "atacante" y "víctima".
2. Inicia sesión como atacante y obtiene su sesión válida.
3. Averigua el identificador interno de la víctima (simulando que se filtró por otra vía).
4. Envía el pedido de cambio de correo con el id de la víctima y una casilla propia.
5. Consulta la base de datos y verifica que **el correo de la víctima quedó intacto** y que la casilla del atacante no fue asociada a ninguna cuenta.

- Contra el código actual: la prueba **falla** — la víctima queda con el correo del atacante.
- Después de aplicar la corrección: la prueba **pasará** — la petición se rechaza o solo afecta al propio atacante.
