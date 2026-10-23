// نقطة الدخول على Cloudflare Workers.
// الملفات الثابتة في site/ تُخدَم مباشرة. هذا الكود لا يعمل إلا على /api/* و/admin/*
// (انظر run_worker_first في wrangler.toml)، ويعيد استخدام معالجات functions/ كما هي.

import * as feedback from "../functions/api/feedback.js";
import * as adminMiddleware from "../functions/admin/_middleware.js";
import * as adminFeedback from "../functions/admin/api/feedback.js";

const SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Cross-Origin-Opener-Policy": "same-origin"
};

function withHeaders(res, extra) {
  const r = new Response(res.body, res);
  for (const [k, v] of Object.entries({ ...SECURITY_HEADERS, ...extra })) r.headers.set(k, v);
  return r;
}

const byMethod = (mod, method) => mod["onRequest" + method[0] + method.slice(1).toLowerCase()] || mod.onRequest;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const ctx = { request, env, data: {} };

    if (url.pathname === "/api/feedback") {
      const h = byMethod(feedback, request.method);
      return withHeaders(await h(ctx));
    }

    if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) {
      ctx.next = async () => {
        if (url.pathname === "/admin/api/feedback") {
          const h = byMethod(adminFeedback, request.method);
          return h ? h(ctx) : new Response("Method Not Allowed", { status: 405 });
        }
        return env.ASSETS.fetch(request);
      };
      const res = await adminMiddleware.onRequest(ctx);
      return withHeaders(res, { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" });
    }

    return env.ASSETS.fetch(request);
  }
};
