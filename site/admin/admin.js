(function () {
  "use strict";
  const TYPES = { historical: "خطأ تاريخي", spelling: "خطأ إملائي", add_scholar: "اقتراح عالم", add_event: "اقتراح حدث", other: "أخرى" };
  const list = document.getElementById("list"), tpl = document.getElementById("card");
  let current = "new";

  async function load() {
    list.textContent = "جارٍ التحميل…";
    const r = await fetch("/admin/api/feedback?status=" + current, { credentials: "same-origin" });
    if (!r.ok) { list.textContent = "تعذّر التحميل (" + r.status + ")."; return; }
    const { items } = await r.json();
    list.textContent = items.length ? "" : "لا توجد ملاحظات في هذه الحالة.";
    for (const it of items) {
      const n = tpl.content.cloneNode(true);
      // textContent فقط: لا يُدرج أي نص من المستخدمين كـ HTML
      n.querySelector(".type").textContent = TYPES[it.type] || it.type;
      n.querySelector(".date").textContent = new Date(it.created_at).toLocaleString("ar");
      n.querySelector(".item").textContent = it.item_label || "ملاحظة عامة";
      n.querySelector(".details").textContent = it.details;
      n.querySelector(".source").textContent = it.source ? "المصدر المقترح: " + it.source : "";
      n.querySelector(".email").textContent = it.email ? "للتواصل: " + it.email : "";
      n.querySelector(".note").value = it.review_note || "";
      const art = n.querySelector("article");
      art.querySelectorAll("[data-to]").forEach(b => b.addEventListener("click", async () => {
        b.disabled = true;
        const res = await fetch("/admin/api/feedback", {
          method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: it.id, status: b.dataset.to, note: art.querySelector(".note").value })
        });
        if (res.ok) art.remove(); else { b.disabled = false; alert("تعذّر الحفظ (" + res.status + ")"); }
      }));
      list.appendChild(n);
    }
  }
  document.querySelectorAll("#tabs button").forEach(b => b.addEventListener("click", () => {
    current = b.dataset.s;
    document.querySelectorAll("#tabs button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    load();
  }));
  load();
})();
