/* بنر الرعاية السنوية. البيانات تأتي من /api/sponsor وتُدار من لوحة الإدارة (/admin/sponsor.html). */
(function () {
  "use strict";

  const root = document.getElementById("sponsor");
  if (!root) return;

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  };

  function render(s) {
    if (!s || !s.enabled || !s.name) return;
    // https فقط، ونرفض أي مخطط آخر مثل javascript: أو http:
    let href;
    try { href = new URL(s.url); } catch (e) { return; }
    if (href.protocol !== "https:") return;
    const badge = s.badge || "برعاية رسمية", ctaText = s.cta || "اكتشف المزيد";

    const a = el("a", "sponsor-link");
    a.href = href.href;
    a.target = "_blank";
    a.rel = "noopener noreferrer sponsored";
    a.setAttribute("aria-label", badge + ": " + s.name + ". " + ctaText + " (يفتح في نافذة جديدة)");

    a.appendChild(el("span", "sponsor-badge", badge));
    // الشعار صورة مضمّنة فقط (data:image) كما تسمح سياسة CSP
    if (typeof s.logo === "string" && /^data:image\/(png|jpeg|webp);base64,/.test(s.logo)) {
      const img = el("img", "sponsor-logo");
      img.src = s.logo; img.alt = ""; img.decoding = "async";
      a.appendChild(img);
    }
    const text = el("span", "sponsor-text");
    text.appendChild(el("b", "sponsor-name", s.name));
    if (s.tagline) text.appendChild(el("span", "sponsor-tagline", s.tagline));
    a.appendChild(text);

    const cta = el("span", "sponsor-cta", ctaText);
    const arrow = el("span", "sponsor-arrow", "←");
    arrow.setAttribute("aria-hidden", "true");
    cta.appendChild(arrow);
    a.appendChild(cta);

    root.replaceChildren(a);
    root.hidden = false;
    // اللوحة الزمنية تقيس مساحتها عند تغيّر الحجم، فنبلغها بأن الشريط ظهر
    window.dispatchEvent(new Event("resize"));
  }

  fetch("/api/sponsor", { credentials: "omit" })
    .then(r => (r.ok ? r.json() : null))
    .then(render)
    .catch(() => { /* البنر اختياري: عند أي خطأ يبقى مخفياً */ });
})();
