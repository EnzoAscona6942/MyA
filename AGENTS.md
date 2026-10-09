# MyA - Convenciones de código

## Commits
- Conventional Commits, descripción en español.
- Un commit = una unidad de trabajo coherente, no un tipo de archivo.
- Los tests van en el mismo commit que el comportamiento que verifican.

## TypeScript (frontend)
- `strict` + `noUncheckedIndexedAccess` + `noPropertyAccessFromIndexSignature`.
- Prohibido `any`. Prohibido `!` o `as` para silenciar el compilador:
  usá `.at(0)`, `?? fallback`, destructuring con defaults o guards.
- Sin barrels entre páginas. Cada página es un `.tsx` autocontenido con sus
  propias interfaces y su propia paleta `C`.
- Cada `api.get<T>()` lleva genérico explícito.

## JavaScript (backend)
- CommonJS. La lógica de negocio vive en `services/`, nunca en las rutas.
- Validación con zod en el borde (body, params, query).
- El cliente HTTP lanza un objeto `ApiError` plano, NO una `Error`:
  `instanceof Error` nunca matchea para fallos de API.

## Copy
- Texto de cara al usuario en español (neutro/profesional).
- Identificadores, comentarios y artefactos técnicos en inglés.

## General
- Indentación de 2 espacios.
- Nada de atribución de IA en los commits.
