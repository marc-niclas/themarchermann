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
- locked Firebase CLI 15.25.1 and Firebase Hosting configuration
- GitHub Actions for verification, preview/production deployment, and releases

Tailwind is intentionally not used.

`nanoid` is exempted from the age gate and pinned to `3.3.17` because that version contains
the fix for GHSA-2v37-7h3g-55p8.

The deploy-only Firebase CLI graph has two additional documented exceptions:

- `hono` is exempted from the age gate and overridden to security-fixed `4.12.34`.
- `@opentelemetry/core@1.30.1` is ignored as Bun advisory `1120821`. The advisory affects
  W3C Baggage propagation, while this package is present only under Firebase CLI's unused
  Pub/Sub tooling; no patched `1.x` release exists. All other advisories remain fatal.

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

Astro writes the static site to `dist/`. The quality job uploads the exact build after its HTTP smoke test, and deployment jobs download that artifact rather than rebuilding it.

Same-repository pull requests receive a seven-day channel in isolated Firebase project `themarchermann-preview`. The preview identity cannot access production. Pushes to `main` release first, then deploy Firebase project `themarchermann-site` through a separately gated production identity and GitHub `production` environment. Both paths use claim-constrained GitHub OIDC and Google Workload Identity Federation; there is no stored service-account key.

`themarchermann.com` and its `www` redirect are registered with Firebase. Registrar DNS remains unchanged pending the controlled cutover.
