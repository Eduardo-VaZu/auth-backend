# Pull Request

## Resumen

-

## Tipo De Cambio

- [ ] Pruebas unitarias
- [ ] Pruebas de integracion
- [ ] CI/CD
- [ ] Correccion de bug
- [ ] Refactor sin cambio funcional

## Area Responsable

- [ ] Integrante 1: health + identity
- [ ] Integrante 2: access login/token
- [ ] Integrante 3: access sesiones/logout
- [ ] Integrante 4: credentials
- [ ] Integrante 5: admin + audit + CI/CD

## Validaciones Ejecutadas

- [ ] `npm run type:check`
- [ ] `npm run lint`
- [ ] `npm run test:unit`
- [ ] `npm run test:integration`
- [ ] `npm run build`

## Notas

- No incluir SonarQube.
- No incluir Postman.
- Las pruebas unitarias no deben depender de PostgreSQL ni Redis reales.
- Las pruebas de integracion deben usar `testcontainers`.
