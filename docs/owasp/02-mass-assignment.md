# 02 — Un usuario puede darse permisos de administrador al registrarse

**Categoría OWASP:** A04 — Diseño inseguro / A08 — Fallas de integridad de datos.
**Severidad:** Crítica.
**Estado:** **Documentado — pendiente de corrección.**

## La analogía

Imaginá un formulario en papel para pedir el alta como cliente en un banco. El formulario tiene casilleros para tu nombre y tu correo. Pero además, arriba de todo, hay una casilla que dice **"Tipo de cuenta: cliente / gerente"**, y otra que dice **"Estado: pendiente / aprobada"**.

Un banco serio tiene esas dos casillas ya marcadas por el sistema — el postulante nunca las toca. El personal decide si sos "gerente" y cuándo tu cuenta pasa de "pendiente" a "aprobada".

Nuestro sistema de registro, en cambio, acepta esos dos campos del **formulario que el usuario mismo envía**. Alguien puede marcar la casilla "gerente" y "aprobada" y el sistema lo toma como verdadero. Ese es exactamente el patrón conocido como *mass assignment*: dejar que el cliente le dicte al servidor cosas que solo el servidor debería decidir.

## ¿Qué podría pasar?

Un atacante sin cuenta previa puede, con **una sola petición al registro público**, obtener:

- **Rol de administrador**, con acceso a los paneles internos de gestión de usuarios y roles.
- **Estado activo**, saltándose la verificación de correo — o sea, sin siquiera demostrar que ese buzón es suyo.

Con esa combinación puede:

- Ver la lista completa de usuarios del sistema (fuga masiva de datos personales).
- Eliminar o deshabilitar cuentas legítimas.
- Escalar hacia otros sistemas si compartimos credenciales o roles con ellos.

**No requiere robar contraseñas, ni engañar a nadie, ni encontrar un bug complicado.** Solo enviar dos campos extra en un formulario que está abierto al público.

## Patrón vulnerable presente en el código

Tres archivos participan de la vulnerabilidad:

- `src/modules/access/infrastructure/routes/auth.schemas.ts` — el esquema permite los campos `role` y `status`.
- `src/modules/identity/infrastructure/controllers/IdentityController.ts` — el controller propaga esos campos al use case.
- `src/modules/identity/application/use-cases/RegisterUseCase.ts` — el use case usa lo que llegó del body como valor final:

```ts
const createdUser = await userRepository.create({
  email: email.value,
  role: input.role ?? 'user',                // ← controlado por el cliente
  status: input.status ?? 'pending_verification', // ← controlado por el cliente
})
```

## Cómo se corregiría (propuesta)

Tres capas de defensa que trabajan juntas:

1. **El formulario debe rechazar esos campos.** El esquema `registerSchema` vuelve a incluir sólo `email` y `password`. Además, agregarle `.strict()` a la definición hace que la petición se rechace con `400/422` si el cliente envía cualquier campo extra.
2. **El controller debe reducir el body a los dos campos permitidos** antes de pasarlo al use case (`Pick<RegisterInputDto, 'email' | 'password'>`).
3. **El use case debe fijar los valores del lado del servidor**, sin fallback al input del cliente:

   ```ts
   const createdUser = await userRepository.create({
     email: email.value,
     role: 'user',
     status: 'pending_verification',
   })
   ```

## ¿Cómo comprobamos que la vulnerabilidad existe?

La prueba `tests/owasp/integration/RegisterMassAssignment.test.ts` **simula al atacante**: envía el registro con `role: "admin"` y `status: "active"`, y después revisa directamente la base de datos para confirmar que:

- El estado guardado es `pending_verification`, no `active`.
- No se asignó ningún rol de administrador a esa cuenta.
- Un intento de iniciar sesión inmediatamente después falla.

- Contra el código actual: la prueba **falla** — el atacante quedaría como admin activo.
- Después de aplicar la corrección: la prueba **pasará** — el registro fuerza los valores correctos.
