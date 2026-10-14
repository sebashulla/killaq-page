// Synthetic Auth and social providers only: no recovery messages or passwords sent remotely.
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import ts from "typescript";
await mkdir("artifacts/account-tests", { recursive: true });
for (const name of [
  "auth-recovery",
  "social-core",
  "social-server",
  "demo-product",
]) {
  let source = await readFile(`src/lib/${name}.ts`, "utf8");
  const code = ts
    .transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    })
    .outputText.replace(/import ["']server-only["'];?/g, "")
    .replaceAll('"./social-core"', '"./social-core.mjs"');
  await writeFile(`artifacts/account-tests/${name}.mjs`, code);
}
const recovery = await import("../artifacts/account-tests/auth-recovery.mjs"),
  social = await import("../artifacts/account-tests/social-core.mjs"),
  demo = await import("../artifacts/account-tests/demo-product.mjs");
const checks = [];
function check(name, fn) {
  fn();
  checks.push({ name, passed: true });
}
check(
  "Recovery destination uses the site origin and never a caller-supplied next URL",
  () => {
    assert.equal(
      recovery.recoveryRedirect("https://killaq-page.vercel.app"),
      "https://killaq-page.vercel.app/actualizar-contrasena",
    );
    assert.equal(
      recovery.recoveryRedirect("http://localhost:3000"),
      "http://localhost:3000/actualizar-contrasena",
    );
    assert.throws(() => recovery.recoveryRedirect("http://example.test"));
    assert.throws(() => recovery.recoveryRedirect("javascript:alert(1)"));
  },
);
check(
  "Password validation rejects short, mismatched and overlong values",
  () => {
    assert.ok(recovery.passwordProblem("short", "short"));
    assert.ok(recovery.passwordProblem("Fixture-password!", "different"));
    assert.ok(recovery.passwordProblem("x".repeat(129), "x".repeat(129)));
    assert.equal(
      recovery.passwordProblem("Fixture-password!", "Fixture-password!"),
      "",
    );
    assert.match(recovery.recoveryProblem({ status: 429 }), /límite/);
    assert.match(
      recovery.recoveryProblem({ code: "email_address_not_authorized" }),
      /configuración/,
    );
  },
);
check(
  "Social links strip tracking, enforce HTTPS/hosts/brand TikTok and reject arbitrary content",
  () => {
    assert.equal(
      social.canonicalSocialUrl(
        "https://www.instagram.com/p/Synthetic01/?tracking=private",
        "instagram",
      ),
      "https://www.instagram.com/p/Synthetic01/",
    );
    assert.equal(
      social.canonicalSocialUrl(
        "https://www.tiktok.com/@killaq_joyas/video/123?x=private",
        "tiktok",
      ),
      "https://www.tiktok.com/@killaq_joyas/video/123",
    );
    for (const url of [
      "javascript:alert(1)",
      "https://instagram.com.evil.test/p/ABC",
      "https://evil.test/instagram.com/p/ABC",
      "https://www.instagram.com/accounts/login/",
      "https://user:password@www.instagram.com/p/ABC/",
    ])
      assert.equal(social.canonicalSocialUrl(url, "instagram"), "");
    assert.equal(
      social.canonicalSocialUrl(
        "https://www.tiktok.com/@other/video/123",
        "tiktok",
      ),
      "",
    );
  },
);
check(
  "One occurrence per publication, at most three per channel, safe bounded titles",
  () => {
    const posts = [1, 1, 2, 3, 4].map((id) => ({
      id: String(id),
      platform: "instagram",
      title: "Fixture",
      url: "https://www.instagram.com/p/Fake" + id + "/",
    }));
    assert.deepEqual(
      social.uniqueSocialPosts(posts).map((p) => p.id),
      ["1", "2", "3"],
    );
    assert.equal(
      social.cleanSocialTitle("x".repeat(180), "fallback").length,
      150,
    );
    assert.equal(social.cleanSocialTitle("\u0000  \n", "fallback"), "fallback");
  },
);
check("Reserved digital sample identity leaves real SKUs unaffected", () => {
  assert.equal(demo.isDemoProduct("KILLAQ-DEMO-QA"), true);
  for (const value of [null, undefined, "RING-01", "KILLAQ-DEMONSTRACION"])
    assert.equal(demo.isDemoProduct(value), false);
});
const originalFetch = globalThis.fetch,
  originalEnv = { ...process.env };
try {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://social-fixture.example.test";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "fixture-public";
  process.env.TIKTOK_DISPLAY_ACCESS_TOKEN = "private-fixture-token";
  process.env.INSTAGRAM_ACCESS_TOKEN = "private-fixture-token";
  process.env.INSTAGRAM_USER_ID = "123";
  process.env.INSTAGRAM_API_VERSION = "v25.0";
  const calls = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.includes("/v2/video/list"))
      return Response.json({
        data: {
          videos: [
            {
              id: "2",
              title: "Fixture video",
              create_time: 1700000000,
              share_url: "https://www.tiktok.com/@killaq_joyas/video/2",
            },
            { id: "1", share_url: "https://www.tiktok.com/@another/video/1" },
          ],
        },
        error: { code: "ok" },
      });
    if (url.includes("/media?"))
      return Response.json({
        data: [
          {
            id: "1",
            permalink: "https://www.instagram.com/p/FakeOld/",
            timestamp: "2026-01-01T00:00:00Z",
          },
          {
            id: "2",
            permalink: "https://www.instagram.com/p/FakeNew/",
            timestamp: "2026-02-01T00:00:00Z",
          },
          {
            id: "3",
            permalink: "https://evil.test/",
            timestamp: "2026-03-01T00:00:00Z",
          },
        ],
      });
    if (url.includes("graph.instagram.com"))
      return Response.json({ username: "joyeria_killaq" });
    throw Error("All unexpected transport blocked");
  };
  const server = await import("../artifacts/account-tests/social-server.mjs");
  const [a, b] = await Promise.all([
    server.getSocialFeed(),
    server.getSocialFeed(),
  ]);
  assert.deepEqual(a, b);
  assert.equal(a.tiktok.posts.length, 1);
  assert.equal(a.instagram.posts[0].id, "2");
  assert.equal(calls.length, 3);
  assert.ok(calls.every((call) => !call.url.includes("private-fixture-token")));
  assert.ok(!JSON.stringify(a).includes("private-fixture-token"));
  checks.push({
    name: "Official API adapters: fixed hosts, account/URLs checked, sorting, dedup, cache and private tokens",
    passed: true,
  });
  globalThis.fetch = async (input) => {
    if (String(input).includes("social-fixture.example.test"))
      return Response.json([
        {
          id: 1,
          title: "Manual fixture",
          video_url: "https://www.instagram.com/p/Manual01/",
        },
        { id: 2, title: "Bad fixture", video_url: "javascript:alert(1)" },
      ]);
    throw Error("Provider unavailable");
  };
  const fallback =
    await import("../artifacts/account-tests/social-server.mjs?fallback");
  const failed = await fallback.getSocialFeed();
  assert.equal(failed.instagram.source, "manual");
  assert.equal(failed.instagram.posts.length, 1);
  assert.equal(failed.tiktok.posts.length, 0);
  checks.push({
    name: "Provider failure preserves manual selection without invented posts or secret errors",
    passed: true,
  });
} finally {
  globalThis.fetch = originalFetch;
  process.env = originalEnv;
}
await writeFile(
  "artifacts/account-tests/results.json",
  JSON.stringify(checks, null, 2),
);
console.log(
  `${checks.length} account/social checks passed; all provider transport isolated.`,
);
