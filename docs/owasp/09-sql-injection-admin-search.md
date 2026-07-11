# 09 — Un texto en el buscador de admin puede ejecutar código en la base

**Categoría OWASP:** A03 — Inyección (SQL).
**Severidad:** Crítica.
**Estado:** **Documentado — pendiente de corrección.**

## La analogía

Imaginá una recepcionista con un fichero de clientes. Cuando alguien golpea la ventanilla y pide *"buscame los clientes cuyo apellido empieza con **López**"*, ella entiende:

- **Apellido**: es el campo por el cual busca.
- **López**: es el valor que compara.

El valor se busca **literalmente** en el fichero. Si nadie se apellida "López", devuelve una lista vacía. Nada más.

Ahora imaginá que alguien pide *"buscame los clientes cuyo apellido empieza con **López y de paso quema todo el fichero**"*.

La recepcionista bien entrenada busca literalmente "López y de paso quema todo el fichero" — no encuentra nada y devuelve una lista vacía. Sabe que todo lo que le dijeron después del nombre del campo es texto que forma parte del apellido buscado, no una nueva orden.

Una recepcionista mal entrenada, en cambio, hace las dos cosas: busca "López" y también cumple la orden de quemar el fichero.

En bases de datos, ese salto de "texto a comando" se llama **inyección SQL**. El atacante manda un texto normal seguido de un cierre de comilla, un punto y coma, y otra sentencia SQL:

```
%'); DROP TABLE users; --
```

Si el código construye la consulta pegando ese texto en la sentencia, el motor termina ejecutando las dos: la búsqueda y el `DROP TABLE`. Nuestra recepcionista está siendo la mal entrenada.

## ¿Qué podría pasar?

Con inyección SQL en un endpoint accesible, un atacante puede:

- **Leer datos que no debería:** volcar la tabla de usuarios, extraer hashes de contraseñas, extraer tokens.
- **Modificar datos:** cambiar contraseñas, cambiar roles, activar cuentas suspendidas.
- **Borrar o corromper datos:** `DROP TABLE`, `UPDATE users SET status='disabled'` masivo, dejar la aplicación inservible.
- **Escalar el ataque hacia el servidor:** en configuraciones débiles, algunos motores permiten ejecutar comandos del sistema operativo a través del propio SQL.

Es una de las categorías de vulnerabilidad **más antiguas y mejor conocidas** en seguridad web, pero sigue apareciendo cada vez que alguien construye SQL con concatenación de strings en lugar de usar parámetros.

## Patrón vulnerable presente en el código

En `src/modules/identity/infrastructure/repositories/UserRepository.ts`, la búsqueda por email construye el fragmento SQL pegando el término tal cual:

```ts
if (params.search !== undefined) {
  filters.push(
    sql.raw(`email ILIKE '%${params.search}%'`) as unknown as SQL<unknown>,
  )
}
```

Con `params.search = "%'); DROP TABLE users; --"`, la consulta enviada al motor termina siendo dos comandos: el `SELECT` original y el `DROP TABLE`.

## Cómo se corregiría (propuesta)

Reemplazar la construcción cruda por el helper `ilike()` de Drizzle, que **parametriza** el valor. El motor recibe la consulta con placeholders y el valor por separado; el motor lo trata como un dato, nunca como código:

```ts
if (params.search !== undefined) {
  filters.push(ilike(schema.users.email, `%${params.search}%`))
}
```

Aunque el usuario envíe una comilla, un punto y coma, o una sentencia SQL entera, esos caracteres viajan como parte del texto a comparar, y no cambian la estructura de la consulta.

Como regla general para el resto del código: **nunca usar `sql.raw` con datos que vengan del cliente**. Cuando se necesita SQL personalizado, usar el tag `sql\`...\`` de Drizzle (que parametriza las interpolaciones) o los helpers específicos (`eq`, `ilike`, `and`, `or`).

## ¿Cómo comprobamos que la vulnerabilidad existe?

La prueba `tests/owasp/integration/SqlInjectionAdminSearch.test.ts`:

1. Registra tres usuarios legítimos y toma un snapshot del total de filas en `users`.
2. Llama al mismo método que consume el endpoint de búsqueda de admin (`UserRepository.listPaginated`) con el payload de inyección:
   ```
   %'); DROP TABLE users; --
   ```
3. Verifica tres cosas después del intento:
   - **La consulta no lanzó excepción.**
   - **La tabla `users` sigue existiendo** y conserva la misma cantidad de filas.
   - **El resultado tiene 0 usuarios**: el payload fue interpretado literalmente y no matcheó ningún email.

- Contra el código actual: la prueba **falla** — o bien el motor arroja error por la sintaxis inyectada, o bien la tabla `users` desaparece, o bien la búsqueda entrega resultados anómalos.
- Después de aplicar la corrección: la prueba **pasará** — el payload viaja como dato y la tabla queda intacta.
