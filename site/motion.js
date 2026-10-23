(function () {
  "use strict";
  const D = window.HISTORY_DATA;
  const targets = { rulers: D.rulers.length, dynasties: D.DYNASTIES.length, scholars: D.scholars.length, events: D.events.length };
  const about = document.getElementById("about");
  const scroller = about.querySelector(".content");
  const prose = about.querySelector(".prose");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // بدون حركة: أرقام نهائية فوراً، ولا تهيئة لـ GSAP أو Lenis.
  if (reduce || !window.gsap || !window.ScrollTrigger || !window.Lenis) {
    document.querySelectorAll("[data-count]").forEach(el => { el.textContent = targets[el.dataset.count]; });
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  gsap.ticker.lagSmoothing(0);

  // عنوان الموقع: كل كلمة تظهر بتلاشي وضبابية
  const h1 = document.querySelector(".brand h1");
  if (h1) {
    const text = h1.textContent.trim();
    h1.setAttribute("aria-label", text);
    h1.textContent = "";
    const words = text.split(/\s+/).map(w => {
      const s = document.createElement("span");
      s.className = "bw"; s.setAttribute("aria-hidden", "true"); s.textContent = w + " ";
      h1.appendChild(s);
      return s;
    });
    gsap.from(words, { filter: "blur(10px)", opacity: 0, y: 8, duration: 0.8, stagger: 0.08, ease: "power2.out", clearProps: "filter,opacity,transform" });
  }

  // أرقام المشروع: تعد من الصفر عند ظهورها
  document.querySelectorAll("[data-count]").forEach(el => {
    const o = { v: 0 };
    gsap.to(o, {
      v: targets[el.dataset.count], duration: 1.4, ease: "power1.out",
      onUpdate: () => { el.textContent = Math.round(o.v); },
      scrollTrigger: { trigger: el, scroller, start: "top 95%", once: true }
    });
  });

  // ظهور أقسام صفحة "عن المشروع" عند التمرير
  prose.querySelectorAll(":scope > *").forEach(el => {
    gsap.from(el, {
      opacity: 0, y: 18, duration: 0.6, ease: "power2.out",
      scrollTrigger: { trigger: el, scroller, start: "top 92%", once: true }
    });
  });

  // Lenis للتمرير داخل صفحة "عن المشروع" فقط، وهو مربوط بمؤقت GSAP.
  // لا يُفعَّل على اللوحة نفسها لأن اللوحة تتعامل مع عجلة الفأرة بنفسها.
  let lenis = null;
  function startLenis() {
    if (lenis) return;
    lenis = new Lenis({ wrapper: scroller, content: prose, duration: 1.1, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    ScrollTrigger.refresh();
  }
  new MutationObserver(() => { if (!about.hidden) startLenis(); })
    .observe(about, { attributes: true, attributeFilter: ["hidden"] });
})();
