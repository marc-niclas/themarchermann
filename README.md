# The Marc Hermann

Source for [themarchermann.com](https://themarchermann.com), Marc Hermann's personal portfolio website.

The first slice is deliberately small: a static Astro page that says the site is under construction. The repository foundation is not small: Bun, Biome, strict TypeScript, Vitest, vanilla-extract, semantic-release, Firebase Hosting configuration, and GitHub Actions are wired from the first commit.

## Toolchain

- Astro, statically generated
- Bun 1.3.12 with a seven-day dependency minimum age
- strict TypeScript
- Biome for formatting and linting
- Vitest for tests
- vanilla-extract for build-time CSS
- semantic-release with Conventional Commits
- Firebase Hosting configuration
- GitHub Actions for verification and releases

Tailwind is intentionally not used.

`nanoid` is exempted from the age gate and pinned to `3.3.17` because that version contains
the fix for GHSA-2v37-7h3g-55p8.

## Commands

```bash
bun install
bun run dev
bun run check
bun run typecheck
bun run audit
bun run test
bun run build
bun run verify
```

`bun run verify` is the local equivalent of the CI quality gate.

## Releases

Commits follow [Conventional Commits](https://www.conventionalcommits.org/). Pushes to `main` run the quality gate and then semantic-release. This site is private as an npm package; semantic-release creates GitHub tags and releases only.

## Deployment

Astro writes the static site to `dist/`. `firebase.json` is ready for Firebase Hosting, but the Firebase project alias and deployment workflow remain intentionally unconfigured until the production Firebase project is selected.
