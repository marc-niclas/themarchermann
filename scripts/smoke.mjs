import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const indexFile = Bun.file(new URL("dist/index.html", root));
const faviconFile = Bun.file(new URL("dist/favicon.svg", root));

assert.equal(await indexFile.exists(), true, "dist/index.html is missing; run the build first");
assert.equal(await faviconFile.exists(), true, "dist/favicon.svg is missing; run the build first");

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch(request) {
    const { pathname } = new URL(request.url);

    if (pathname === "/") {
      return new Response(indexFile, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    if (pathname === "/favicon.svg") {
      return new Response(faviconFile, {
        headers: { "content-type": "image/svg+xml" },
      });
    }

    return new Response("Not found", { status: 404 });
  },
});

try {
  const pageResponse = await fetch(server.url);
  const html = await pageResponse.text();

  assert.equal(pageResponse.status, 200);
  assert.match(pageResponse.headers.get("content-type") ?? "", /^text\/html/);
  assert.match(html, /<title>Marc Hermann — Under Construction<\/title>/);
  assert.match(html, /<h1[^>]*id="signature-title"[^>]*>/);
  assert.match(html, />The Marc Hermann<\/span>/);
  assert.match(html, /data-word="MARC">MARC<\/span>/);
  assert.match(html, /data-word="HERMANN">HERMANN<\/span>/);
  assert.match(html, /data-projectile="marc-dash"/);
  assert.match(html, /data-projectile="hermann-dash"/);
  assert.match(html, /<canvas[^>]*data-particles[^>]*aria-hidden="true"/);
  assert.match(
    html,
    /<noscript><style>\[data-word\]\{clip-path:none!important\}<\/style><\/noscript>/,
  );
  assert.match(html, /data-motion=reduced/);
  assert.match(html, /<link rel="canonical" href="https:\/\/themarchermann\.com">/);
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  assert.doesNotMatch(html, /Astro Starter Kit/i);

  const faviconResponse = await fetch(new URL("/favicon.svg", server.url));
  assert.equal(faviconResponse.status, 200);
  assert.match(faviconResponse.headers.get("content-type") ?? "", /^image\/svg\+xml/);

  const missingResponse = await fetch(new URL("/missing", server.url));
  assert.equal(missingResponse.status, 404);

  console.log(`Smoke passed: ${server.url}`);
} finally {
  server.stop(true);
}
