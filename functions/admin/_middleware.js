// كل ما تحت /admin محمي مرتين:
// 1) Cloudflare Access على الحافة (تسجيل دخول + تحقق ثنائي إلزامي، قبل أن يصل الطلب إلى الموقع).
// 2) هذا الوسيط يتحقق بنفسه من توقيع رمز Access (JWT) وجمهوره وصلاحيته، فلا يكفي تجاوز الحافة.

let jwksCache = { at: 0, keys: [] };

const b64url = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), c => c.charCodeAt(0));
const deny = () => new Response("Forbidden", { status: 403, headers: { "Cache-Control": "no-store" } });

async function keys(team) {
  if (Date.now() - jwksCache.at < 10 * 60 * 1000 && jwksCache.keys.length) return jwksCache.keys;
  const r = await fetch(`https://${team}.cloudflareaccess.com/cdn-cgi/access/certs`);
  jwksCache = { at: Date.now(), keys: (await r.json()).keys || [] };
  return jwksCache.keys;
}

async function verify(token, env) {
  const [h, p, s] = token.split(".");
  if (!h || !p || !s) return null;
  const header = JSON.parse(new TextDecoder().decode(b64url(h)));
  if (header.alg !== "RS256") return null;
  const jwk = (await keys(env.ACCESS_TEAM)).find(k => k.kid === header.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64url(s), new TextEncoder().encode(`${h}.${p}`));
  if (!ok) return null;
  const claims = JSON.parse(new TextDecoder().decode(b64url(p)));
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  const now = Math.floor(Date.now() / 1000);
  if (!aud.includes(env.ACCESS_AUD) || claims.exp < now || claims.iss !== `https://${env.ACCESS_TEAM}.cloudflareaccess.com`) return null;
  const allowed = (env.ADMIN_EMAILS || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
  if (!allowed.includes(String(claims.email || "").toLowerCase())) return null;
  return claims;
}

export async function onRequest(ctx) {
  const token = ctx.request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) return deny();
  let claims = null;
  try { claims = await verify(token, ctx.env); } catch { claims = null; }
  if (!claims) return deny();
  ctx.data.admin = claims.email;
  return ctx.next();
}
