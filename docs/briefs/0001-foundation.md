# Foundation brief

## Goal

Initialize the public portfolio repository with a deployable but deliberately minimal under-construction page and a serious tooling baseline.

## Locked decisions

- Astro static output
- Bun 1.3.12 and a seven-day dependency minimum age
- strict TypeScript
- Biome
- Vitest
- vanilla-extract/native CSS; no Tailwind
- semantic-release creating GitHub releases only
- Firebase Hosting target, without selecting a project or changing DNS in this slice

## Acceptance gates

- `bun install --frozen-lockfile`
- `bun run check`
- `bun run typecheck`
- `bun run test`
- `bun run build`
- automated HTTP smoke confirms the generated under-construction page, metadata, favicon, and 404 behavior
- GitHub Actions passes on `main`
- semantic-release creates the initial GitHub release

## Non-goals

- final landing-page art direction
- project or about content
- React islands or React Aria controls without an interaction that needs them
- Firebase project creation, deployment, or DNS changes
