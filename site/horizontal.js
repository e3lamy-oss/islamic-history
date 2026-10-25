(function () {
  "use strict";
  const D = window.HISTORY_DATA;
  const Y0 = 41, Y1 = 300, PAD = 14, TAIL = 180;
  const RULER_LANE_H = matchMedia("(max-width: 720px)").matches ? 48 : 54, EV_ROW = 30, SC_ROW = 34, LANE_PAD = 8, EV_MAX = 5, SC_MAX = 12;
  const MIN_Z = 1, MAX_Z = 40;
  const CAT = {
    battle: { label: "المعارك الفاصلة والفتوحات", icon: "⚔️", color: "--c-battle" },
    city: { label: "تأسيس المدن والعواصم", icon: "🏰", color: "--c-city" },
    reform: { label: "الإصلاحات الإدارية والعلمية", icon: "📜", color: "--c-reform" },
    calamity: { label: "النكبات والتحولات", icon: "⚠️", color: "--c-calamity" }
  };
  const CRIT = { foundational: "المعيار التأسيسي", encyclopedic: "المعيار التأثيري الموسوعي", empirical: "معيار الريادة العلمية التجريبية" };

  const inSlice = x => x.h[1] >= Y0 && x.h[0] <= Y1;
  const rulers = D.rulers.filter(r => inSlice(r) && r.h[1] > Y0);
  const events = D.events.filter(inSlice).sort((a, b) => a.h[0] - b.h[0]);
  const scholars = D.scholars.filter(inSlice).sort((a, b) => a.h[0] - b.h[0]);
  const dyns = D.DYNASTIES.filter(d => rulers.some(r => r.dyn === d.id));
  const dynById = Object.fromEntries(D.DYNASTIES.map(d => [d.id, d]));
  const all = [...rulers, ...events, ...scholars];
  const keyOf = x => x.kind + ":" + x.id;
  const byId = new Map(all.map(x => [keyOf(x), x]));

  const $ = s => document.querySelector(s);
  const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const h2g = h => Math.round(h * 0.970229 + 621.5643);
  const yrs = (x, approx) => {
    const a = approx ? "~" : "";
    if (x.h[0] === x.h[1]) return `${a}${x.h[0]} هـ / ${a}${x.g[0]} م`;
    return `${a}${x.h[0]}–${x.h[1]} هـ / ${a}${x.g[0]}–${x.g[1]} م`;
  };

  const hs = $("#hs"), hc = $("#hc"), rulerEl = $("#ruler"), lanesEl = $("#lanes"), nowEl = $("#now"), cursor = $("#cursor");
  const labW = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--lab-w")) || 70;
  let z = 8;
  const X = h => labW() + PAD + (Math.max(Y0, h) - Y0) * z; // distance from the right edge of the content

  // RTL scroll offsets differ between engines; work in "distance scrolled from the start (right) edge".
  let rtlModel = "negative";
  function detectModel() {
    const s = hs.scrollLeft;
    rtlModel = s > 0 ? "reverse" : "negative";
  }
  const getStart = () => rtlModel === "negative" ? -hs.scrollLeft : hs.scrollWidth - hs.clientWidth - hs.scrollLeft;
  const setStart = v => {
    v = Math.max(0, Math.min(v, hs.scrollWidth - hs.clientWidth));
    hs.scrollLeft = rtlModel === "negative" ? -v : hs.scrollWidth - hs.clientWidth - v;
  };

  // ---------- build lanes and items once ----------
  const grid = el("div", "gridlines"); hc.prepend(grid);
  const nodes = new Map(), laneEls = {};
  function addLane(id, name, sub, color, cls) {
    const lane = el("div", "lane" + (cls ? " " + cls : ""));
    const lab = el("div", "lab", `<strong>${esc(name)}</strong>${sub ? `<small>${esc(sub)}</small>` : ""}`);
    if (color) lane.style.setProperty("--c", `var(${color})`);
    lane.appendChild(lab); lanesEl.appendChild(lane); laneEls[id] = lane;
    return lane;
  }
  for (const d of dyns) {
    const rs = rulers.filter(r => r.dyn === d.id);
    d.sh = [Math.min(...rs.map(r => r.h[0])), Math.max(...rs.map(r => r.h[1]))];
    const lane = addLane(d.id, d.short, `${Math.max(Y0, d.sh[0])}–${d.sh[1]}`, d.color);
    lane.style.height = RULER_LANE_H + "px";
    const band = el("div", "lane-band"); lane.appendChild(band); d.band = band;
    for (const r of rs) {
      const n = el("button", "hitem rb", `<span class="n">${esc(r.name)}</span><span class="y">${r.h[0]}–${r.h[1]}</span>`);
      n.setAttribute("aria-label", `${r.name}، ${d.short}، ${yrs(r)}`);
      lane.appendChild(n); nodes.set(keyOf(r), n);
    }
  }
  const evLane = addLane("events", "الأحداث", "⚔️ 🏰 📜 ⚠️", "--c-battle", "group");
  for (const e of events) {
    const c = CAT[e.cat];
    const n = el("button", "hitem ev", `<span class="dot">${c.icon}</span><span class="t">${esc(e.name)}<em>${e.approx ? "~" : ""}${e.h[0]}</em></span>`);
    n.style.setProperty("--c", `var(${c.color})`);
    n.setAttribute("aria-label", `${e.name}، ${yrs(e, e.approx)}`);
    evLane.appendChild(n); nodes.set(keyOf(e), n);
  }
  const scLane = addLane("scholars", "العلماء", "الولادة ← الوفاة", "--c-scholar", "group");
  for (const s of scholars) {
    const n = el("button", "hitem sc", `<span class="life${s.approx ? " approx" : ""}"></span><span class="lbl"><b>${esc(s.name)}</b><small>${esc(s.field)}</small></span>`);
    n.setAttribute("aria-label", `${s.name}، ${s.field}، ${yrs(s, s.approx)}`);
    scLane.appendChild(n); nodes.set(keyOf(s), n);
  }
  nodes.forEach((n, k) => n.addEventListener("click", ev => { if (dragMoved) { ev.preventDefault(); return; } select(byId.get(k)); }));

  // label widths do not depend on zoom, so measure them once
  const labelW = new Map();
  function measure() {
    for (const e of events) labelW.set(e, nodes.get(keyOf(e)).offsetWidth);
    for (const s of scholars) labelW.set(s, nodes.get(keyOf(s)).querySelector(".lbl").offsetWidth);
  }

  function pack(items, extent, maxRows) {
    const ends = [], row = new Map();
    for (const it of items) {
      const [a, b] = extent(it);
      let r = ends.findIndex(e => e <= a);
      if (r === -1) { if (ends.length < maxRows) { r = ends.length; ends.push(-Infinity); } else r = ends.indexOf(Math.min(...ends)); }
      ends[r] = Math.max(ends[r], b); row.set(it, r);
    }
    return { rows: Math.max(1, ends.length), row };
  }

  // ---------- layout ----------
  function render() {
    const W = X(Y1) + PAD + TAIL;
    hc.style.width = W + "px";

    // ruler + grid
    const steps = [1, 2, 5, 10, 20, 25, 50];
    const step = steps.find(s => s * z >= 52) || 50;
    rulerEl.querySelectorAll(".tick").forEach(t => t.remove()); grid.innerHTML = "";
    for (let h = Math.ceil(Y0 / step) * step; h <= Y1; h += step) {
      const t = el("div", "tick", `<b>${h}</b><small>${h2g(h)}</small>`);
      t.style.right = X(h) + "px"; rulerEl.appendChild(t);
      const g = el("i", h % (step * 5) === 0 ? "major" : ""); g.style.right = X(h) + "px"; grid.appendChild(g);
    }
    if ((Y0 % step) * z > 30) { const t = el("div", "tick", `<b>${Y0}</b><small>${h2g(Y0)}</small>`); t.style.right = X(Y0) + "px"; rulerEl.appendChild(t); }

    // rulers
    for (const d of dyns) {
      d.band.style.right = (X(d.sh[0]) - 3) + "px"; d.band.style.width = ((Math.min(Y1, d.sh[1]) - Math.max(Y0, d.sh[0])) * z + 6) + "px";
    }
    for (const r of rulers) {
      const n = nodes.get(keyOf(r)), w = Math.max(3, (Math.min(r.h[1], Y1 + 10) - Math.max(r.h[0], Y0)) * z - 1);
      n.style.right = X(r.h[0]) + "px"; n.style.width = w + "px";
      n.classList.toggle("tiny", w < 22); n.classList.toggle("narrow", w >= 22 && w < 64);
    }
    // events: pin at the year, label running toward later years (to the left)
    const evPack = pack(events, e => { const x = X(e.h[0]) - 11; return [x, x + labelW.get(e) + 8]; }, EV_MAX);
    evLane.style.height = (evPack.rows * EV_ROW + LANE_PAD * 2) + "px";
    for (const e of events) {
      const n = nodes.get(keyOf(e));
      n.style.right = (X(e.h[0]) - 11) + "px"; n.style.top = (LANE_PAD + evPack.row.get(e) * EV_ROW) + "px";
    }
    // scholars: a line from birth to death, the name sits above its start
    const scPack = pack(scholars, s => { const x = X(s.h[0]); return [x, Math.max(X(s.h[1]), x + labelW.get(s)) + 10]; }, SC_MAX);
    scLane.style.height = (scPack.rows * SC_ROW + LANE_PAD * 2) + "px";
    for (const s of scholars) {
      const n = nodes.get(keyOf(s));
      n.style.right = X(s.h[0]) + "px"; n.style.width = Math.max(8, (s.h[1] - s.h[0]) * z) + "px";
      n.style.top = (LANE_PAD + scPack.row.get(s) * SC_ROW) + "px";
    }
    updateNow();
  }

  // ---------- "now" readout under the centre line ----------
  const centreX = () => labW() + (hs.clientWidth - labW()) / 2; // from the right edge of the viewport
  const yearAt = viewX => Y0 + (getStart() + viewX - labW() - PAD) / z;
  function updateNow() {
    cursor.style.right = centreX() + "px";
    const y = Math.round(Math.min(Y1, Math.max(Y0, yearAt(centreX()))));
    const who = rulers.filter(r => r.h[0] <= y && y < Math.max(r.h[1], r.h[0] + 1)).map(r => `<b>${esc(r.name)}</b> (${esc(dynById[r.dyn].short)})`);
    nowEl.innerHTML = `سنة <b>${y} هـ</b> / ${h2g(y)} م${who.length ? " · " + who.join("، ") : ""}`;
  }
  let raf = 0;
  hs.addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; updateNow(); }); }, { passive: true });

  // ---------- zoom, keeping the year under the focus point fixed ----------
  function zoomTo(nz, viewX) {
    nz = Math.min(MAX_Z, Math.max(MIN_Z, nz));
    if (nz === z) return;
    viewX = viewX ?? centreX();
    const year = yearAt(viewX);
    z = nz; render();
    setStart(labW() + PAD + (year - Y0) * z - viewX);
    updateNow();
  }
  $("#zin").onclick = () => zoomTo(z * 1.5);
  $("#zout").onclick = () => zoomTo(z / 1.5);

  // pinch with two fingers; one finger stays native scrolling (momentum, vertical lanes)
  let pinch = null;
  const viewXOf = clientX => hs.getBoundingClientRect().right - clientX;
  hs.addEventListener("touchstart", e => {
    if (e.touches.length === 2) {
      const [a, b] = e.touches;
      pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), z };
    }
  }, { passive: true });
  hs.addEventListener("touchmove", e => {
    if (!pinch || e.touches.length !== 2) return;
    e.preventDefault();
    const [a, b] = e.touches;
    const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    zoomTo(pinch.z * d / pinch.d, viewXOf((a.clientX + b.clientX) / 2));
  }, { passive: false });
  hs.addEventListener("touchend", e => { if (e.touches.length < 2) pinch = null; });

  // desktop: ctrl/⌘ + wheel zooms; a plain vertical wheel moves through time when the lanes fit the height
  hs.addEventListener("wheel", e => {
    if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoomTo(z * Math.exp(-e.deltaY * 0.01), viewXOf(e.clientX)); return; }
    if (!e.deltaX && hs.scrollHeight <= hs.clientHeight + 1) { e.preventDefault(); setStart(getStart() + e.deltaY); }
  }, { passive: false });

  // desktop: drag with the mouse
  let drag = null, dragMoved = false;
  hs.addEventListener("pointerdown", e => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, s: getStart(), t: hs.scrollTop }; dragMoved = false;
  });
  hs.addEventListener("pointermove", e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!dragMoved && Math.hypot(dx, dy) > 5) { dragMoved = true; hs.classList.add("grab"); try { hs.setPointerCapture(e.pointerId); } catch (_) {} }
    if (dragMoved) { setStart(drag.s + dx); hs.scrollTop = drag.t - dy; }
  });
  const endDrag = () => { drag = null; hs.classList.remove("grab"); setTimeout(() => { dragMoved = false; }, 0); };
  hs.addEventListener("pointerup", endDrag); hs.addEventListener("pointercancel", endDrag);

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeDrawer();
    else if (e.key === "+" || e.key === "=") zoomTo(z * 1.4);
    else if (e.key === "-") zoomTo(z / 1.4);
  });
  window.addEventListener("resize", () => { const y = yearAt(centreX()); render(); setStart(labW() + PAD + (y - Y0) * z - centreX()); updateNow(); });

  function reveal(item) {
    if (item.kind === "ruler") z = Math.min(MAX_Z, Math.max(z, 70 / Math.max(1, item.h[1] - item.h[0])));
    render();
    setStart(X(item.h[0]) - labW() - (hs.clientWidth - labW()) / 3);
    const lane = laneEls[item.kind === "ruler" ? item.dyn : item.kind === "event" ? "events" : "scholars"];
    const top = lane.offsetTop - rulerEl.offsetHeight, bottom = lane.offsetTop + lane.offsetHeight;
    if (top < hs.scrollTop || bottom > hs.scrollTop + hs.clientHeight) hs.scrollTop = top;
    updateNow();
  }

  // ---------- drawer (same content as the main page) ----------
  const drawer = $("#drawer");
  let sel = null;
  const peerBtn = r => `<button data-k="${keyOf(r)}"><i></i>${esc(r.name)}</button>`;
  const overlap = (a, b) => a.h[0] <= b.h[1] && b.h[0] <= a.h[1];

  function select(item) {
    if (sel) nodes.get(keyOf(sel))?.classList.remove("sel");
    sel = item; nodes.get(keyOf(item)).classList.add("sel");
    let color, kicker, facts = [], blocks = [];
    if (item.kind === "ruler") {
      const d = dynById[item.dyn]; color = d.color; kicker = `${d.name} · الحاكم رقم ${item.order}`;
      facts = [["فترة الحكم", yrs(item)], ["المدة", item.h[1] - item.h[0] < 1 ? "أقل من سنة" : `نحو ${item.h[1] - item.h[0]} سنة هجرية`], ["مقر الحكم", esc(item.cap)]];
      blocks.push(`<div><h3>أبرز الأحداث والإنجازات</h3><ul>${item.ach.map(a => `<li>${esc(a)}</li>`).join("")}</ul></div>`);
      const peers = rulers.filter(r => r.dyn !== item.dyn && overlap(r, item));
      if (peers.length) blocks.push(`<div><h3>المعاصرون في الدول الأخرى</h3><div class="peers">${peers.map(peerBtn).join("")}</div></div>`);
      const sch = scholars.filter(s => overlap(s, item)).slice(0, 10);
      if (sch.length) blocks.push(`<div><h3>علماء عاصروا عهده</h3><div class="peers">${sch.map(peerBtn).join("")}</div></div>`);
    } else if (item.kind === "event") {
      const c = CAT[item.cat]; color = c.color; kicker = `${c.icon} ${c.label}`;
      facts = [["التاريخ", yrs(item, item.approx)], ["المكان", esc(item.place)]];
      blocks.push(`<p>${esc(item.desc)}</p>`);
      const peers = rulers.filter(r => r.h[0] <= item.h[0] && item.h[0] <= r.h[1]);
      if (peers.length) blocks.push(`<div><h3>الحكام وقت الحدث</h3><div class="peers">${peers.map(peerBtn).join("")}</div></div>`);
    } else {
      color = "--c-scholar"; kicker = `${CRIT[item.crit]} · ${esc(item.field)}`;
      facts = [["الولادة والوفاة", yrs(item, item.approx)], ["المركز العلمي", esc(item.city)], ["المجال", esc(item.field)]];
      blocks.push(`<p>${esc(item.work)}</p>`);
      const peers = rulers.filter(r => overlap(r, item));
      if (peers.length) blocks.push(`<div><h3>عاصر من الحكام (${peers.length})</h3><div class="peers">${peers.slice(0, 14).map(peerBtn).join("")}</div></div>`);
    }
    if (item.note) blocks.unshift(`<div class="note">${esc(item.note)}</div>`);
    const srcs = item.src.map(k => D.SOURCES[k]).map(s => `<li>${esc(s.title)} <span>· ${esc(s.author)}</span></li>`).join("");
    blocks.push(`<div><h3>المصادر المرجعية</h3><ul class="srcs">${srcs}</ul></div>`);
    blocks.push(`<div><span class="status">${item.status === "review" ? "تحتاج تدقيقاً إضافياً" : "مسودة بانتظار المراجعة المنهجية"}</span></div>`);

    drawer.style.setProperty("--c", `var(${color})`);
    drawer.innerHTML = `
      <header><div><div class="kicker">${kicker}</div><h2 id="dTitle">${esc(item.name)}</h2>${item.full ? `<div class="full">${esc(item.full)}</div>` : ""}</div>
        <button class="close" id="dClose" aria-label="إغلاق">×</button></header>
      <div class="body"><dl class="facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>${blocks.join("")}</div>
      <footer><a class="btn" href="./">فتح اللوحة الرئيسية للإبلاغ عن خطأ</a></footer>`;
    drawer.classList.add("open"); drawer.setAttribute("aria-hidden", "false");
    $("#dClose").onclick = closeDrawer;
    drawer.querySelectorAll("[data-k]").forEach(b => {
      const it = byId.get(b.dataset.k);
      b.style.setProperty("--c", `var(${it.kind === "ruler" ? dynById[it.dyn].color : "--c-scholar"})`);
      b.onclick = () => { reveal(it); select(it); };
    });
    $("#dClose").focus({ preventScroll: true });
  }
  function closeDrawer() {
    drawer.classList.remove("open"); drawer.setAttribute("aria-hidden", "true");
    if (sel) { const n = nodes.get(keyOf(sel)); n?.classList.remove("sel"); n?.focus({ preventScroll: true }); sel = null; }
  }

  // ---------- start ----------
  measure();
  z = hs.clientWidth < 600 ? 7 : 10;
  render();
  detectModel();
  setStart(0);
  updateNow();
})();
