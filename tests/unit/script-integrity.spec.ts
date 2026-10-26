import { test, expect } from '@playwright/test';

// Finding S9 (CWE-353): the archive pages load es5-shim from a CDN over plain
// http:// and without a subresource integrity hash, inside an IE<9 conditional
// comment. The browser parses that comment as text, so the raw HTML is checked.
const pages = Array.from({ length: 14 }, (_, i) => `schachinwuerttemberg_offset_${i}.html`);

for (const page of pages) {
  test(`external scripts are loaded over https with integrity: ${page}`, async ({ request }) => {
    const response = await request.get(`/${page}`);
    expect(response.ok()).toBeTruthy();
    const html = await response.text();

    const scripts = [...html.matchAll(/<script\b[^>]*>/gi)].map((m) => m[0]);
    for (const tag of scripts) {
      const src = /\bsrc\s*=\s*["']?([^"'\s>]+)/i.exec(tag)?.[1];
      if (!src) continue;
      const external = /^(https?:)?\/\//i.test(src);
      if (!external) continue;
      expect(src, `script ${src} must not be loaded over plain http`).not.toMatch(/^http:/i);
      expect(tag, `script ${src} must carry an integrity attribute`).toMatch(/\bintegrity\s*=\s*["']sha(256|384|512)-/i);
    }
  });
}
