// GET /api/sponsor — بيانات بنر الرعاية للموقع العام (قراءة فقط).

import { json, safeUrl, safeLogo } from "../../lib/sponsor.js";

const CACHE = "public, max-age=60";

export async function onRequestGet({ env }) {
  const row = await env.DB.prepare("SELECT enabled, badge, name, tagline, url, cta, logo FROM sponsor WHERE id = 1").first().catch(() => null);
  const url = row && safeUrl(row.url);
  if (!row || !row.enabled || !row.name || !url) return json(200, { enabled: false }, CACHE);
  return json(200, { enabled: true, badge: row.badge, name: row.name, tagline: row.tagline, url, cta: row.cta, logo: safeLogo(row.logo) }, CACHE);
}

export const onRequest = () => json(405, { error: "method_not_allowed" });
