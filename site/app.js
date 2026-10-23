(function () {
  "use strict";
  const D = window.HISTORY_DATA;
  const AXIS_W = 84, HEAD_H = 52, RULER_W = 156, EV_COL = 178, SC_COL = 158, GAP = 10;
  const MIN_Z = 0.6, MAX_Z = 80;
  const CAT = {
    battle: { label: "المعارك الفاصلة والفتوحات", icon: "⚔️", color: "--c-battle" },
    city: { label: "تأسيس المدن والعواصم", icon: "🏰", color: "--c-city" },
    reform: { label: "الإصلاحات الإدارية والعلمية", icon: "📜", color: "--c-reform" },
    calamity: { label: "النكبات والتحولات", icon: "⚠️", color: "--c-calamity" }
  };
  const CRIT = { foundational: "المعيار التأسيسي", encyclopedic: "المعيار التأثيري الموسوعي", empirical: "معيار الريادة العلمية التجريبية" };
  const dynById = Object.fromEntries(D.DYNASTIES.map(d => [d.id, d]));
  const all = [...D.rulers, ...D.events, ...D.scholars];
  const byId = new Map(all.map(x => [x.kind + ":" + x.id, x]));
  const keyOf = x => x.kind + ":" + x.id;

  const $ = s => document.querySelector(s);
  const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const h2g = h => Math.round(h * 0.970229 + 621.5643);
  const yrs = (x, approx) => {
    const a = approx ? "~" : "";
    if (x.h[0] === x.h[1]) return `${a}${x.h[0]} هـ / ${a}${x.g[0]} م`;
    return `${a}${x.h[0]}–${x.h[1]} هـ / ${a}${x.g[0]}–${x.g[1]} م`;
  };

  const stage = $("#stage"), layer = $("#layer"), axis = $("#axis"), heads = $("#heads");
  const state = {
    z: 2, panX: 0, panY: 0, y0: D.range[0], y1: D.range[1], sel: null,
    show: { ruler: true, scholar: true, battle: true, city: true, reform: true, calamity: true }
  };

  // ---------- build nodes once ----------
  const gridLayer = el("div", "layer"); layer.appendChild(gridLayer);
  const bandLayer = el("div", "layer"); layer.appendChild(bandLayer);
  const itemLayer = el("div", "layer"); layer.appendChild(itemLayer);
  const nodes = new Map();

  const bands = {};
  for (const d of D.DYNASTIES) {
    const rs = D.rulers.filter(r => r.dyn === d.id);
    d.h = [Math.min(...rs.map(r => r.h[0])), Math.max(...rs.map(r => r.h[1]))];
    d.g = [Math.min(...rs.map(r => r.g[0])), Math.max(...rs.map(r => r.g[1]))];
    const b = el("div", "band"); b.style.setProperty("--c", `var(${d.color})`); bandLayer.appendChild(b); bands[d.id] = b;
  }

  for (const r of D.rulers) {
    const d = dynById[r.dyn];
    const n = el("button", "item ruler" + (r.status === "review" ? " review" : ""),
      `<span class="n">${esc(r.name)}</span><span class="y">${r.h[0]}–${r.h[1]} هـ</span><span class="cap">${esc(r.cap)}</span>`);
    n.style.setProperty("--c", `var(${d.color})`);
    n.setAttribute("aria-label", `${r.name}، ${d.short}، ${yrs(r)}`);
    itemLayer.appendChild(n); nodes.set(keyOf(r), n);
  }
  for (const e of D.events) {
    const c = CAT[e.cat];
    const n = el("button", "item event", `<span class="dot">${c.icon}</span><span class="t">${esc(e.name)}<em>${e.approx ? "~" : ""}${e.h[0]}</em></span>`);
    n.style.setProperty("--c", `var(${c.color})`);
    n.setAttribute("aria-label", `${e.name}، ${yrs(e, e.approx)}`);
    itemLayer.appendChild(n); nodes.set(keyOf(e), n);
  }
  for (const s of D.scholars) {
    const n = el("button", "item scholar", `<span class="life${s.approx ? " approx" : ""}"></span><span class="lbl"><b>${esc(s.name)}</b><small>${esc(s.field)} · ${esc(s.city)}</small></span>`);
    n.setAttribute("aria-label", `${s.name}، ${s.field}، ${yrs(s, s.approx)}`);
    itemLayer.appendChild(n); nodes.set(keyOf(s), n);
  }
  nodes.forEach((n, k) => n.addEventListener("click", ev => { if (moved) { ev.preventDefault(); return; } select(byId.get(k)); }));

  // ---------- layout ----------
  const Y = h => HEAD_H + (h - state.y0) * state.z + state.panY;

  function pack(items, extent, maxCols) {
    const ends = [], out = new Map(), crowd = new Set();
    for (const it of items) {
      const [a, b] = extent(it);
      let c = ends.findIndex(e => e <= a);
      if (c === -1) {
        if (ends.length < maxCols) { c = ends.length; ends.push(-Infinity); }
        else { c = ends.indexOf(Math.min(...ends)); crowd.add(it); }
      }
      ends[c] = Math.max(ends[c], b); out.set(it, c);
    }
    return { cols: Math.max(1, ends.length), col: out, crowd };
  }

  let lanes = [];
  function layout() {
    const z = state.z;
    const evs = D.events.filter(e => state.show[e.cat]).sort((a, b) => a.h[0] - b.h[0]);
    const evPack = pack(evs, e => { const y = (e.h[0] - state.y0) * z; return [y - 13, y + 13]; }, 2);
    const scs = state.show.scholar ? D.scholars.slice().sort((a, b) => a.h[0] - b.h[0]) : [];
    const scPack = pack(scs, s => { const y = (s.h[0] - state.y0) * z; return [y, Math.max(y + (s.h[1] - s.h[0]) * z, y + 40) + 6]; }, 5);

    lanes = []; let x = 0;
    for (const d of D.DYNASTIES) {
      const hidden = !state.show.ruler;
      lanes.push({ id: d.id, dyn: d, name: d.short, sub: `${d.h[0]}–${d.h[1]} هـ`, x, w: hidden ? 0 : RULER_W, hidden });
      if (!hidden) x += RULER_W + GAP;
    }
    const evW = evs.length ? evPack.cols * EV_COL : 0;
    lanes.push({ id: "events", name: "الأحداث الفاصلة", sub: "⚔️ 🏰 📜 ⚠️", x, w: evW, hidden: !evs.length }); x += evW + (evs.length ? GAP * 2 : 0);
    const scW = scs.length ? scPack.cols * SC_COL : 0;
    lanes.push({ id: "scholars", name: "العلماء والأعلام", sub: "من الولادة إلى الوفاة", x, w: scW, hidden: !scs.length }); x += scW;
    return { evPack, scPack, evs, scs, totalW: x };
  }

  let L = null;
  function clamp() {
    const H = stage.clientHeight, W = stage.clientWidth - AXIS_W;
    const span = (state.y1 - state.y0) * state.z;
    state.panY = Math.min(40, Math.max(state.panY, -(span) + (H - HEAD_H) - 60));
    state.panX = Math.min(Math.max(0, L.totalW - W + 24), Math.max(0, state.panX));
  }

  function render() {
    L = layout(); clamp();
    const H = stage.clientHeight, z = state.z;
    const laneRight = lane => AXIS_W + 12 + lane.x - state.panX;
    const vis = (a, b) => b > HEAD_H - 40 && a < H + 40;

    // grid + axis
    const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200];
    const step = steps.find(s => s * z >= 46) || 200;
    const first = Math.ceil((state.y0 + (HEAD_H - HEAD_H - state.panY) / z) / step) * step;
    gridLayer.innerHTML = ""; axis.innerHTML = "";
    axis.appendChild(el("div", "axis-cap", "هجري<br>ميلادي ≈"));
    for (let h = Math.max(first, Math.ceil(state.y0 / step) * step); h <= state.y1; h += step) {
      const y = Y(h); if (y > H + 20) break; if (y < HEAD_H - 4) continue;
      const g = el("div", "grid-line" + (h % (step * 5) === 0 ? " major" : "")); g.style.top = y + "px"; gridLayer.appendChild(g);
      const t = el("div", "tick", `<b>${h} هـ</b><small>${h2g(h)} م</small>`); t.style.top = y + "px"; axis.appendChild(t);
    }
    // start marker for 41 AH
    if (Y(state.y0) >= HEAD_H - 4 && (state.y0 % step) * z > 26 && (step - state.y0 % step) * z > 26) { const t = el("div", "tick", `<b>${state.y0} هـ</b><small>661 م</small>`); t.style.top = Y(state.y0) + "px"; axis.appendChild(t); }

    // heads + bands
    heads.innerHTML = "";
    for (const lane of lanes) {
      if (lane.hidden) { if (lane.dyn) bands[lane.id].hidden = true; continue; }
      const hd = el("div", "head", `<strong>${esc(lane.name)}</strong><small>${esc(lane.sub)}</small>`);
      hd.style.right = (laneRight(lane) - AXIS_W) + "px"; hd.style.width = lane.w + "px";
      if (lane.dyn) hd.style.setProperty("--c", `var(${lane.dyn.color})`);
      heads.appendChild(hd);
      if (lane.dyn) {
        const b = bands[lane.id]; b.hidden = false;
        b.style.right = (laneRight(lane) - 6) + "px"; b.style.width = (lane.w + 12) + "px";
        b.style.top = (Y(lane.dyn.h[0]) - 6) + "px"; b.style.height = ((lane.dyn.h[1] - lane.dyn.h[0]) * z + 12) + "px";
      }
    }

    // rulers
    const laneById = Object.fromEntries(lanes.map(l => [l.id, l]));
    for (const r of D.rulers) {
      const n = nodes.get(keyOf(r)), lane = laneById[r.dyn];
      if (lane.hidden) { n.hidden = true; continue; }
      const top = Y(r.h[0]), h = Math.max(3, (r.h[1] - r.h[0]) * z);
      if (!vis(top, top + h)) { n.hidden = true; continue; }
      n.hidden = false;
      n.style.top = top + "px"; n.style.height = (h - (h > 6 ? 1 : 0)) + "px";
      n.style.right = laneRight(lane) + "px"; n.style.width = lane.w + "px";
      n.classList.toggle("thin", h < 17); n.classList.toggle("short", h >= 17 && h < 46);
    }
    // events
    const evLane = laneById.events;
    for (const e of D.events) {
      const n = nodes.get(keyOf(e));
      if (!state.show[e.cat]) { n.hidden = true; continue; }
      const y = Y(e.h[0]);
      if (!vis(y, y)) { n.hidden = true; continue; }
      n.hidden = false;
      n.style.top = y + "px"; n.style.right = (laneRight(evLane) + L.evPack.col.get(e) * EV_COL) + "px";
      n.style.maxWidth = (EV_COL - 8) + "px"; n.classList.toggle("crowd", L.evPack.crowd.has(e));
    }
    // scholars
    const scLane = laneById.scholars;
    for (const s of D.scholars) {
      const n = nodes.get(keyOf(s));
      if (!state.show.scholar) { n.hidden = true; continue; }
      const top = Y(s.h[0]), h = Math.max(10, (s.h[1] - s.h[0]) * z);
      if (!vis(top, top + Math.max(h, 40))) { n.hidden = true; continue; }
      n.hidden = false;
      n.style.top = top + "px"; n.style.right = (laneRight(scLane) + L.scPack.col.get(s) * SC_COL) + "px";
      n.style.width = (SC_COL - 10) + "px"; n.querySelector(".life").style.height = h + "px"; n.classList.toggle("crowd", L.scPack.crowd.has(s));
    }
    $("#zoomLabel").textContent = z >= 10 ? `${Math.round(z)} بكسل/سنة` : `${z.toFixed(1)} بكسل/سنة`;
  }

  let raf = 0;
  const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); };

  function zoomAt(factor, py) {
    py = py ?? (HEAD_H + (stage.clientHeight - HEAD_H) / 2);
    const year = state.y0 + (py - HEAD_H - state.panY) / state.z;
    state.z = Math.min(MAX_Z, Math.max(MIN_Z, state.z * factor));
    state.panY = py - HEAD_H - (year - state.y0) * state.z;
    schedule();
  }

  // ---------- pointer: pan + pinch ----------
  const pts = new Map(); let moved = false, start = null, pinch = null;
  stage.addEventListener("pointerdown", e => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) { moved = false; start = { x: e.clientX, y: e.clientY, px: state.panX, py: state.panY }; }
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: state.z }; }
  });
  stage.addEventListener("pointermove", e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2 && pinch) {
      const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
      const rect = stage.getBoundingClientRect(); const my = (a.y + b.y) / 2 - rect.top;
      zoomAt((pinch.z * d / pinch.d) / state.z, my); moved = true; return;
    }
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (!moved && Math.hypot(dx, dy) > 5) { moved = true; stage.classList.add("dragging"); try { stage.setPointerCapture(e.pointerId); } catch (_) {} }
    if (moved) { state.panX = start.px + dx; state.panY = start.py + dy; schedule(); }
  });
  const up = e => {
    pts.delete(e.pointerId); if (pts.size < 2) pinch = null;
    if (pts.size === 1) { const p = [...pts.values()][0]; start = { x: p.x, y: p.y, px: state.panX, py: state.panY }; }
    if (!pts.size) { stage.classList.remove("dragging"); setTimeout(() => { moved = false; }, 0); }
  };
  stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", up);
  stage.addEventListener("wheel", e => {
    e.preventDefault();
    const rect = stage.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY * 0.01), e.clientY - rect.top);
    else { state.panY -= e.deltaY; state.panX -= e.shiftKey ? e.deltaY : -e.deltaX; schedule(); }
  }, { passive: false });
  $("#zin").onclick = () => zoomAt(1.5); $("#zout").onclick = () => zoomAt(1 / 1.5);
  document.addEventListener("keydown", e => {
    if (e.target.closest("input, textarea, select")) return;
    if (e.key === "Escape") { closeDrawer(); closeModals(); }
    else if (e.key === "+" || e.key === "=") zoomAt(1.4);
    else if (e.key === "-") zoomAt(1 / 1.4);
    else if (e.key === "ArrowDown") { state.panY -= 80; schedule(); }
    else if (e.key === "ArrowUp") { state.panY += 80; schedule(); }
    else if (e.key === "ArrowLeft") { state.panX += 80; schedule(); }
    else if (e.key === "ArrowRight") { state.panX -= 80; schedule(); }
  });
  window.addEventListener("resize", schedule);

  function jumpToYear(h, z) {
    if (z) state.z = z;
    state.panY = (stage.clientHeight - HEAD_H) / 3 - (h - state.y0) * state.z;
    schedule();
  }
  function reveal(item) {
    if (item.kind === "ruler") state.z = Math.max(state.z, 46 / Math.max(1, item.h[1] - item.h[0]));
    state.z = Math.min(state.z, 30);
    jumpToYear(item.h[0]);
    render();
    const n = nodes.get(keyOf(item)); if (n.hidden) return;
    const W = stage.clientWidth, right = parseFloat(n.style.right);
    if (right + 200 > W) { state.panX += right + 220 - W; schedule(); }
  }

  // ---------- filters ----------
  document.querySelectorAll("[data-filter]").forEach(b => b.addEventListener("click", () => {
    const k = b.dataset.filter; state.show[k] = !state.show[k]; b.setAttribute("aria-pressed", state.show[k]); schedule();
  }));

  // ---------- drawer ----------
  const drawer = $("#drawer");
  const peerBtn = r => `<button data-k="${keyOf(r)}"><i></i>${esc(r.name)}</button>`;
  const overlap = (a, b) => a.h[0] <= b.h[1] && b.h[0] <= a.h[1];

  function select(item) {
    if (state.sel) nodes.get(keyOf(state.sel))?.classList.remove("sel");
    state.sel = item; nodes.get(keyOf(item)).classList.add("sel");
    let color, kicker, facts = [], blocks = [];
    if (item.kind === "ruler") {
      const d = dynById[item.dyn]; color = d.color; kicker = `${d.name} · الحاكم رقم ${item.order}`;
      facts = [["فترة الحكم", yrs(item)], ["المدة", item.h[1] - item.h[0] < 1 ? "أقل من سنة" : `نحو ${item.h[1] - item.h[0]} سنة هجرية`], ["مقر الحكم", esc(item.cap)]];
      blocks.push(`<div><h3>أبرز الأحداث والإنجازات</h3><ul>${item.ach.map(a => `<li>${esc(a)}</li>`).join("")}</ul></div>`);
      const peers = D.rulers.filter(r => r.dyn !== item.dyn && overlap(r, item));
      if (peers.length) blocks.push(`<div><h3>المعاصرون في الدول الأخرى</h3><div class="peers">${peers.map(peerBtn).join("")}</div></div>`);
      const sch = D.scholars.filter(s => overlap(s, item)).slice(0, 10);
      if (sch.length) blocks.push(`<div><h3>علماء عاصروا عهده</h3><div class="peers">${sch.map(peerBtn).join("")}</div></div>`);
    } else if (item.kind === "event") {
      const c = CAT[item.cat]; color = c.color; kicker = `${c.icon} ${c.label}`;
      facts = [["التاريخ", yrs(item, item.approx)], ["المكان", esc(item.place)]];
      blocks.push(`<p>${esc(item.desc)}</p>`);
      const peers = D.rulers.filter(r => r.h[0] <= item.h[0] && item.h[0] <= r.h[1]);
      if (peers.length) blocks.push(`<div><h3>الحكام وقت الحدث</h3><div class="peers">${peers.map(peerBtn).join("")}</div></div>`);
    } else {
      color = "--c-scholar"; kicker = `${CRIT[item.crit]} · ${esc(item.field)}`;
      facts = [["الولادة والوفاة", yrs(item, item.approx)], ["المركز العلمي", esc(item.city)], ["المجال", esc(item.field)]];
      blocks.push(`<p>${esc(item.work)}</p>`);
      const peers = D.rulers.filter(r => overlap(r, item));
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
      <footer><button class="btn primary" id="dReport">إبلاغ / تصحيح معلومة</button></footer>`;
    drawer.classList.add("open"); drawer.setAttribute("aria-hidden", "false");
    $("#dClose").onclick = closeDrawer;
    $("#dReport").onclick = () => openFeedback(item);
    drawer.querySelectorAll("[data-k]").forEach(b => {
      const it = byId.get(b.dataset.k);
      b.style.setProperty("--c", `var(${it.kind === "ruler" ? dynById[it.dyn].color : "--c-scholar"})`);
      b.onclick = () => { reveal(it); select(it); };
    });
    $("#dClose").focus({ preventScroll: true });
  }
  function closeDrawer() {
    drawer.classList.remove("open"); drawer.setAttribute("aria-hidden", "true");
    if (state.sel) { const n = nodes.get(keyOf(state.sel)); n?.classList.remove("sel"); n?.focus({ preventScroll: true }); state.sel = null; }
  }

  // ---------- search ----------
  const q = $("#q"), res = $("#results");
  const norm = s => s.replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");
  let hits = [], hi = 0;
  function drawResults() {
    res.innerHTML = ""; res.hidden = !hits.length;
    hits.forEach((x, i) => {
      const b = el("button", i === hi ? "on" : "", `<span>${esc(x.name)}</span><small>${x.kind === "ruler" ? esc(dynById[x.dyn].short) : x.kind === "event" ? CAT[x.cat].icon : "عالم"} · ${x.h[0]} هـ</small>`);
      b.onclick = () => pick(x); res.appendChild(b);
    });
  }
  function pick(x) { res.hidden = true; q.value = ""; reveal(x); select(x); }
  q.addEventListener("input", () => {
    const v = q.value.trim(); hi = 0;
    if (/^\d{1,4}$/.test(v)) { hits = []; drawResults(); return; }
    const n = norm(v); hits = n.length < 2 ? [] : all.filter(x => norm(x.name + " " + (x.full || "") + " " + (x.cap || x.city || x.place || "")).includes(n)).slice(0, 8);
    drawResults();
  });
  q.addEventListener("keydown", e => {
    if (e.key === "ArrowDown") { hi = Math.min(hits.length - 1, hi + 1); drawResults(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { hi = Math.max(0, hi - 1); drawResults(); e.preventDefault(); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const v = q.value.trim();
      if (/^\d{1,4}$/.test(v)) { jumpToYear(Math.min(state.y1, Math.max(state.y0, +v)), Math.max(state.z, 8)); q.blur(); }
      else if (hits[hi]) pick(hits[hi]);
    } else if (e.key === "Escape") { res.hidden = true; q.blur(); }
  });
  document.addEventListener("click", e => { if (!e.target.closest(".search")) res.hidden = true; });

  // ---------- modals ----------
  function openModal(id) { const m = $(id); m.hidden = false; m.querySelector("input, select, textarea, button")?.focus(); }
  function closeModals() { document.querySelectorAll(".modal").forEach(m => m.hidden = true); }
  document.querySelectorAll(".modal").forEach(m => {
    m.addEventListener("click", e => { if (e.target === m || e.target.closest("[data-close]")) m.hidden = true; });
  });
  $("#aboutBtn").onclick = $("#aboutBtn2").onclick = () => openModal("#about");
  $("#reportBtn").onclick = () => openFeedback(null);

  // sources list in about
  $("#srcList").innerHTML = Object.values(D.SOURCES).map(s => `<li><b>${esc(s.title)}</b> · ${esc(s.author)}</li>`).join("");
  $("#statLine").textContent = `${D.rulers.length} حاكماً في ${D.DYNASTIES.length} دول، و${D.scholars.length} عالماً، و${D.events.length} حدثاً فاصلاً`;

  // ---------- feedback ----------
  const form = $("#fbForm"), fbMsg = $("#fbMsg");
  function openFeedback(item) {
    form.reset(); fbMsg.hidden = true;
    $("#fbItem").value = item ? `${item.name} (${item.h[0]} هـ)` : "";
    $("#fbItemKey").value = item ? keyOf(item) : "";
    openModal("#feedback");
  }
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    if ((data.details || "").trim().length < 10) { show("warn", "اكتب تفاصيل الملاحظة في عشرة أحرف على الأقل."); return; }
    const btn = $("#fbSend"); btn.disabled = true; btn.textContent = "جارٍ الإرسال…";
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
      const r = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), signal: ctl.signal, credentials: "same-origin" });
      clearTimeout(t);
      if (r.ok) { show("ok", "وصلت ملاحظتك إلى فريق المراجعة. شكراً لمساهمتك في تدقيق المحتوى."); form.reset(); }
      else if (r.status === 429) show("warn", "أرسلت عدداً كبيراً من الملاحظات خلال وقت قصير. حاول مجدداً بعد ساعة.");
      else if (r.status === 400) show("warn", "تعذّر قبول الملاحظة. تحقق من الحقول وأعد المحاولة.");
      else throw new Error(String(r.status));
    } catch (_) {
      show("warn", "لم تُرسل الملاحظة: هذه نسخة معاينة وخادم الملاحظات غير مفعّل فيها بعد. في الموقع المنشور تصل الملاحظة مباشرة إلى لوحة الإدارة.");
    } finally { btn.disabled = false; btn.textContent = "إرسال الملاحظة"; }
  });
  function show(kind, text) { fbMsg.className = "msg " + kind; fbMsg.textContent = text; fbMsg.hidden = false; }

  // ---------- start ----------
  state.z = Math.max(MIN_Z, (stage.clientHeight - HEAD_H - 40) / 330);
  state.panY = 16;
  render();
})();
