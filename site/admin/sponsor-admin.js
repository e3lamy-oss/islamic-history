(function () {
  "use strict";
  const MAX_LOGO_BYTES = 100 * 1024;
  const ERRORS = { name_required: "اسم الراعي مطلوب.", url_https_required: "الرابط يجب أن يبدأ بـ https:// وأن يكون صالحاً.", bad_logo: "صيغة الشعار غير مقبولة.", too_large: "الشعار كبير جداً.", forbidden: "غير مصرّح." };
  const $ = id => document.getElementById(id);
  const form = $("spForm"), msg = $("spMsg"), img = $("spLogoImg");
  let logo = null;

  const say = (text, cls) => { msg.textContent = text; msg.className = "sp-msg" + (cls ? " " + cls : ""); };
  const showLogo = () => { img.hidden = !logo; if (logo) img.src = logo; else img.removeAttribute("src"); };
  const httpsOk = v => { try { return new URL(v).protocol === "https:"; } catch (e) { return false; } };

  async function load(quiet) {
    if (!quiet) say("جارٍ التحميل…");
    const r = await fetch("/admin/api/sponsor", { credentials: "same-origin" });
    if (!r.ok) { say("تعذّر التحميل (" + r.status + ").", "err"); return; }
    const { item } = await r.json();
    if (!quiet) say("");
    if (!item) return;
    $("spEnabled").checked = !!item.enabled;
    $("spName").value = item.name || "";
    $("spTagline").value = item.tagline || "";
    $("spUrl").value = item.url || "";
    $("spBadge").value = item.badge || "";
    $("spCta").value = item.cta || "";
    logo = item.logo || null; showLogo();
    if (item.updated_at) $("spMeta").textContent = "آخر تعديل: " + new Date(item.updated_at).toLocaleString("ar") + (item.updated_by ? " بواسطة " + item.updated_by : "");
  }

  $("spLogoFile").addEventListener("change", e => {
    const f = e.target.files[0];
    if (!f) return;
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) { say("اختر صورة PNG أو JPEG أو WebP.", "err"); e.target.value = ""; return; }
    if (f.size > MAX_LOGO_BYTES) { say("حجم الشعار أكبر من 100 كيلوبايت.", "err"); e.target.value = ""; return; }
    const rd = new FileReader();
    rd.onload = () => { logo = rd.result; showLogo(); say(""); };
    rd.readAsDataURL(f);
  });
  $("spLogoClear").addEventListener("click", () => { logo = null; $("spLogoFile").value = ""; showLogo(); });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const url = $("spUrl").value.trim();
    if (!$("spName").value.trim()) { say(ERRORS.name_required, "err"); $("spName").focus(); return; }
    if (!httpsOk(url)) { say(ERRORS.url_https_required, "err"); $("spUrl").focus(); return; }
    $("spSave").disabled = true; say("جارٍ الحفظ…");
    const r = await fetch("/admin/api/sponsor", {
      method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: $("spEnabled").checked, name: $("spName").value, tagline: $("spTagline").value, url,
        badge: $("spBadge").value, cta: $("spCta").value, logo
      })
    }).catch(() => null);
    $("spSave").disabled = false;
    if (r && r.ok) { say("تم الحفظ. يظهر التغيير في الموقع خلال دقيقة تقريباً.", "done"); load(true); return; }
    const err = r ? (await r.json().catch(() => ({}))).error : null;
    say(ERRORS[err] || "تعذّر الحفظ" + (r ? " (" + r.status + ")" : "") + ".", "err");
  });

  load();
})();
