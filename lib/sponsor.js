// تحقق مشترك لبيانات بنر الرعاية، يستخدمه /api/sponsor و /admin/api/sponsor (خارج functions/ حتى لا يصبح مساراً).

export const LIMITS = { badge: 40, name: 80, tagline: 200, cta: 30, url: 500 };
export const MAX_LOGO = 150 * 1024; // طول نص data: URL
const LOGO_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;

export const clean = (v, max) =>
  typeof v === "string" ? v.replace(/[\u0000-\u001F\u007F‪-‮⁦-⁩]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";

// https فقط، بلا اسم مستخدم أو كلمة مرور داخل الرابط
export function safeUrl(v) {
  if (typeof v !== "string" || v.length > LIMITS.url) return null;
  let u;
  try { u = new URL(v.trim()); } catch { return null; }
  if (u.protocol !== "https:" || u.username || u.password || !u.hostname.includes(".")) return null;
  return u.href;
}

// الشعار صورة مضمّنة (PNG أو JPEG أو WebP) لأن سياسة CSP تسمح بـ data: للصور ولا تسمح بمصادر خارجية
export const safeLogo = v => (typeof v === "string" && v.length <= MAX_LOGO && LOGO_RE.test(v) ? v : null);

export const json = (status, body, cache = "no-store") =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": cache } });
