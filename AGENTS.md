# Repository instructions

## Stack

- Astro with static output and strict TypeScript
- Bun 1.3.12 for package management and scripts
- Biome for formatting and linting
- Vitest for tests
- vanilla-extract and native CSS; do not add Tailwind
- semantic-release with Conventional Commits
- Firebase Hosting through claim-constrained keyless GitHub OIDC; never add a service-account key

## Development

- Install with `bun install`; do not introduce npm, pnpm, or Yarn lockfiles.
- Respect `bunfig.toml`: dependencies must be at least seven days old.
- Keep Firebase CLI exact-pinned in `bun.lock`; deployment must use its installed binary, never runtime `bunx` resolution.
- Keep preview and production in separate Firebase projects and identities. Production must use the protected GitHub environment and a `main`-only WIF provider.
- Deploy the artifact uploaded after the quality job's smoke test; never rebuild in a deployment job.
- Run `bun run verify` before committing or pushing.
- Keep generated output (`dist/`, `.astro/`, coverage) out of source and Biome checks.
- Use test-first development for behavior changes.

When starting the dev server, use background mode:

```bash
astro dev --background
```

Manage it with `astro dev status`, `astro dev logs`, and `astro dev stop`.

## UI

- Prefer semantic Astro/HTML by default.
- Use React Aria Components only when an interaction needs an accessible primitive.
- Use vanilla-extract/native CSS for styling.
- Keep the landing page custom and art-directed; do not import template-effect libraries as a design system.
- Honor `prefers-reduced-motion` for animation.
