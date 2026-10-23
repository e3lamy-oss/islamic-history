// GET /admin/api/sponsor   بيانات البنر الحالية
// PUT /admin/api/sponsor   { enabled, badge, name, tagline, url, cta, logo }   حفظ البنر
// المصادقة يفرضها ../_middleware.js (Cloudflare Access + تحقق ثنائي).

import { LIMITS, MAX_LOGO, clean, safeUrl, safeLogo, json } from "../../../lib/sponsor.js";

export async function onRequestGet({ env }) {
  const row = await env.DB.prepare("SELECT enabled, badge, name, tagline, url, cta, logo, updated_at, updated_by FROM sponsor WHERE id = 1").first();
  return json(200, { item: row || null });
}

export async function onRequestPut({ request, env, data }) {
  if (request.headers.get("Origin") !== new URL(request.url).origin) return json(403, { error: "forbidden" });
  const raw = await request.text();
  if (raw.length > MAX_LOGO + 4096) return json(413, { error: "too_large" });
  let body;
  try { body = JSON.parse(raw); } catch { return json(400, { error: "bad_json" }); }

  const enabled = body.enabled === true ? 1 : 0;
  const badge = clean(body.badge, LIMITS.badge) || "برعاية رسمية";
  const name = clean(body.name, LIMITS.name);
  const tagline = clean(body.tagline, LIMITS.tagline);
  const cta = clean(body.cta, LIMITS.cta) || "اكتشف المزيد";
  const url = safeUrl(body.url);
  if (!name) return json(400, { error: "name_required" });
  if (!url) return json(400, { error: "url_https_required" });
  let logo = null;
  if (body.logo) { logo = safeLogo(body.logo); if (!logo) return json(400, { error: "bad_logo" }); }

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO sponsor (id, enabled, badge, name, tagline, url, cta, logo, updated_at, updated_by)
       VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6, ?7, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), ?8)
       ON CONFLICT (id) DO UPDATE SET enabled = ?1, badge = ?2, name = ?3, tagline = ?4, url = ?5, cta = ?6, logo = ?7,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), updated_by = ?8`
    ).bind(enabled, badge, name, tagline, url, cta, logo, data.admin),
    env.DB.prepare("INSERT INTO audit_log (actor, action, detail) VALUES (?1, ?2, ?3)")
      .bind(data.admin, "sponsor_update", JSON.stringify({ enabled, name, url, logo: !!logo }))
  ]);
  return json(200, { ok: true });
}
