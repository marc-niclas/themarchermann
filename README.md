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
- GitHub Actions for verification, preview/production deployment, and releases

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
bun run smoke
bun run verify
bun run firebase:preview -- <channel-id> --expires 7d
bun run firebase:deploy -- --project themarchermann-site
```

`bun run verify` is the local equivalent of the CI quality gate. It builds and serves the generated site on an ephemeral loopback port, then checks the rendered heading, metadata, reduced-motion CSS, favicon, and 404 behavior over HTTP.

## Releases

Commits follow [Conventional Commits](https://www.conventionalcommits.org/). Pushes to `main` run the quality gate and then semantic-release. This site is private as an npm package; semantic-release creates GitHub tags and releases only.

## Deployment

Astro writes the static site to `dist/`. Firebase project `themarchermann-site` owns the Hosting site of the same name.

Same-repository pull requests receive a seven-day Firebase preview channel after the quality job passes. Pushes to `main` deploy the live Hosting channel after the same gate. Both jobs authenticate through GitHub OIDC and Google Workload Identity Federation; there is no stored service-account key.

The custom domain remains unchanged until the Firebase-hosted default URL passes public verification.
