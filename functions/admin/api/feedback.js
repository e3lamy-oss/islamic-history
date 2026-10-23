// GET   /admin/api/feedback?status=new   قائمة الملاحظات
// PATCH /admin/api/feedback               { id, status, note }   تغيير حالة ملاحظة
// المصادقة يفرضها ../_middleware.js (Cloudflare Access + تحقق ثنائي).

const STATUSES = new Set(["new", "reviewing", "accepted", "rejected"]);
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

export async function onRequestGet({ request, env }) {
  const status = new URL(request.url).searchParams.get("status") || "new";
  if (!STATUSES.has(status)) return json(400, { error: "invalid" });
  const { results } = await env.DB.prepare(
    "SELECT id, created_at, type, item_key, item_label, details, source, email, status, reviewer, review_note, reviewed_at FROM feedback WHERE status = ?1 ORDER BY created_at DESC LIMIT 200"
  ).bind(status).all();
  return json(200, { items: results });
}

export async function onRequestPatch({ request, env, data }) {
  if (request.headers.get("Origin") !== new URL(request.url).origin) return json(403, { error: "forbidden" });
  let body;
  try { body = await request.json(); } catch { return json(400, { error: "bad_json" }); }
  const id = Number(body.id);
  const status = String(body.status || "");
  const note = typeof body.note === "string" ? body.note.slice(0, 1000) : null;
  if (!Number.isInteger(id) || !STATUSES.has(status)) return json(400, { error: "invalid" });
  await env.DB.batch([
    env.DB.prepare("UPDATE feedback SET status = ?1, reviewer = ?2, review_note = ?3, reviewed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?4").bind(status, data.admin, note, id),
    env.DB.prepare("INSERT INTO audit_log (actor, action, feedback_id, detail) VALUES (?1, ?2, ?3, ?4)").bind(data.admin, "set_status:" + status, id, note)
  ]);
  return json(200, { ok: true });
}
