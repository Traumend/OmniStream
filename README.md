# OmniStream

Herramienta personal para programar y publicar contenido en Facebook, Instagram, YouTube y TikTok, con un Smart Canvas para adaptar cada pieza, jerarquía Padre/Hijo entre videos largos y fragmentos, estadísticas cruzadas y una suite de IA con llaves propias (Anthropic y OpenAI).

- Especificación: [docs/superpowers/specs/2026-10-07-omnistream-design.md](docs/superpowers/specs/2026-10-07-omnistream-design.md)
- Plan de la fase 1: [docs/superpowers/plans/2026-10-07-fase-1-fundacion.md](docs/superpowers/plans/2026-10-07-fase-1-fundacion.md)
- Plan de la fase 2A: [docs/superpowers/plans/2026-10-07-fase-2a-publicacion-asistida.md](docs/superpowers/plans/2026-10-07-fase-2a-publicacion-asistida.md)
- Configuración y ejecución local: [docs/configuracion.md](docs/configuracion.md)

## Estructura

| Carpeta | Contenido |
|---|---|
| `apps/web` | Aplicación Next.js (publicada en Vercel) |
| `functions` | Cloud Functions: acceso, procesamiento de archivos y publicación |
| `packages/core` | Reglas de dominio compartidas |
| `pruebas/integracion` | Pruebas contra los emuladores de Firebase |

## Comandos

```bash
pnpm install
pnpm test              # pruebas unitarias
pnpm test:integracion  # reglas y funciones contra los emuladores
pnpm test:e2e          # flujos completos en el navegador
pnpm lint && pnpm typecheck
```
