// POST /api/feedback — يستقبل ملاحظات القراء.
// الحماية: تحقق من المصدر (CSRF)، حد للحجم، حقل فخ للبوتات، Cloudflare Turnstile،
// تحديد معدل لكل عنوان IP (مخزّن كبصمة مملّحة لا كعنوان صريح)، واستعلامات مُعدّة مسبقاً فقط.

const TYPES = new Set(["historical", "spelling", "add_scholar", "add_event", "other"]);
const LIMITS = { item_key: 80, item_label: 200, details: 3000, source: 500, email: 200 };
const MAX_PER_HOUR = 5;
const MAX_BODY = 8 * 1024;

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

const clean = (v, max) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max) : "");

export async function onRequestPost({ request, env }) {
  // 1) نفس المصدر فقط
  const origin = request.headers.get("Origin");
  if (!origin || origin !== new URL(request.url).origin) return json(403, { error: "forbidden" });
  if (!(request.headers.get("Content-Type") || "").startsWith("application/json")) return json(415, { error: "unsupported" });

  // 2) حد الحجم
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json(413, { error: "too_large" });
  let data;
  try { data = JSON.parse(raw); } catch { return json(400, { error: "bad_json" }); }

  // 3) حقل الفخ: البوت يملؤه، فنقبل بصمت ولا نحفظ
  if (data.website) return json(200, { ok: true });

  // 4) التحقق من الحقول
  const type = clean(data.type, 20);
  const details = clean(data.details, LIMITS.details);
  if (!TYPES.has(type) || details.length < 10) return json(400, { error: "invalid" });
  const email = clean(data.email, LIMITS.email);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { error: "invalid_email" });

  // 5) Turnstile
  const ip = request.headers.get("CF-Connecting-IP") || "";
  const token = clean(data["cf-turnstile-response"], 4096);
  const ts = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token, remoteip: ip })
  }).then(r => r.json()).catch(() => ({ success: false }));
  if (!ts.success) return json(400, { error: "captcha" });

  // 6) تحديد المعدل
  const ipHash = await sha256(env.IP_SALT + "|" + ip);
  const { n } = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM feedback WHERE ip_hash = ?1 AND created_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 hour')"
  ).bind(ipHash).first();
  if (n >= MAX_PER_HOUR) return json(429, { error: "rate_limited" });

  // 7) الحفظ (استعلام مُعدّ، لا دمج للنصوص في SQL)
  await env.DB.prepare(
    "INSERT INTO feedback (type, item_key, item_label, details, source, email, ip_hash) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"
  ).bind(type, clean(data.item_key, LIMITS.item_key) || null, clean(data.item_label, LIMITS.item_label) || null,
    details, clean(data.source, LIMITS.source) || null, email || null, ipHash).run();

  return json(201, { ok: true });
}

export const onRequest = () => json(405, { error: "method_not_allowed" });
