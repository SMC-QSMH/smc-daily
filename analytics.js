/* =====================================================================
   analytics.js — ข้อมูลรายเดือน + ตัวกรอง + การสรุป (ใช้ร่วม หน้ารายงาน และ แดชบอร์ด)
   หลักการ: โหลดข้อมูลรายเดือนแบบย่อครั้งเดียว (เดือนที่จบแล้วเก็บไว้ในเครื่อง) แล้วกรอง/สรุปในเบราว์เซอร์
            → เปลี่ยนตัวกรองได้ทันทีโดยไม่ต้องรอเซิร์ฟเวอร์
   ===================================================================== */
'use strict';

/* ---------- ข้อมูลรายเดือน ---------- */
var AN = { months: {}, at: {}, docs: {} };
function nextYm(ym) { var y = +ym.slice(0, 4), m = +ym.slice(5, 7) + 1; if (m > 12) { m = 1; y++; } return y + '-' + ('0' + m).slice(-2); }
function ymList(a, b) { var out = [], d = a.slice(0, 7), e = b.slice(0, 7); while (d <= e && out.length < 200) { out.push(d); d = nextYm(d); } return out; }
function anKeep(mp) { AN.months[mp.ym] = mp; AN.at[mp.ym] = Date.now(); Object.keys(mp.docs || {}).forEach(function (k) { AN.docs[k] = mp.docs[k]; }); }
/** ให้มีข้อมูลครบช่วง from–to (โหลดเฉพาะเดือนที่ยังไม่มี/ยังไม่ปิด) */
function anLoad(from, to) {
  var today = S.boot.today, need = [];
  if (from < S.boot.firstDate) from = S.boot.firstDate;
  if (to > today) to = today;
  if (from > to) return Promise.resolve();
  ymList(from, to).forEach(function (ym) {
    var have = AN.months[ym];
    if (have && (have.final || Date.now() - AN.at[ym] < 5 * 60000)) return;
    if (!have) { var pc = pcGet('mp|' + ym); if (pc && pc.final) { anKeep(pc); return; } }
    need.push(ym);
  });
  if (!need.length) return Promise.resolve();
  var chunks = []; for (var i = 0; i < need.length; i += 12) chunks.push(need.slice(i, i + 12));
  return Promise.all(chunks.map(function (c) {
    return api('getMonths', { yms: c }).then(function (r) { r.months.forEach(function (mp) { anKeep(mp); if (mp.final) pcSet('mp|' + mp.ym, mp); }); });
  }));
}
function anDay(iso) { var m = AN.months[iso.slice(0, 7)]; return m ? m.days[iso] : null; }
function docName(code) { return AN.docs[code] || ('แพทย์ ' + code); }

/* ---------- กลุ่มคลินิก ---------- */
function groupsList() { return (S.boot.groups || []).slice().sort(function (a, b) { return a.order - b.order; }); }
function groupOf(code) { var c = clinicMap()[code]; return (c && c.groupId) || ''; }
function groupById(id) { return groupsList().filter(function (g) { return g.id === id; })[0] || null; }
function groupName(id) { var g = groupById(id); return g ? g.name : 'ยังไม่จัดกลุ่ม'; }
function groupColor(id) { var g = groupById(id); return g ? palOf(g.color) : 'var(--idle)'; }

/* ---------- ตัวกรอง (จำแยกตามผู้ใช้ ใช้ร่วมกันทั้งรายงานและแดชบอร์ด) ---------- */
var FILT = null;
var DT_TH = { all: 'ทุกวัน', W: 'วันทำการ', S: 'เสาร์–อาทิตย์', H: 'วันหยุดนักขัตฤกษ์', off: 'วันหยุดทั้งหมด' };
var BY_TH = { group: 'กลุ่มคลินิก', clinic: 'คลินิก', doc: 'แพทย์' };
function filt() {
  if (!FILT) {
    var o = store('filt:' + S.me.user) || {};
    FILT = { groups: o.groups || [], clinics: o.clinics || [], docs: o.docs || [], dt: o.dt || 'all', by: o.by || (groupsList().length ? 'group' : 'clinic') };
  }
  var gids = {}; groupsList().forEach(function (g) { gids[g.id] = 1; }); gids[''] = 1;
  FILT.groups = FILT.groups.filter(function (g) { return gids[g]; });
  if (FILT.by === 'group' && !groupsList().length) FILT.by = 'clinic';
  return FILT;
}
function saveFilt() { store('filt:' + S.me.user, FILT); }
function filtActive(f) { f = f || filt(); return f.groups.length + f.clinics.length + f.docs.length > 0; }
function filtDesc(f) {
  f = f || filt(); var p = [];
  if (f.dt !== 'all') p.push(DT_TH[f.dt]);
  if (f.groups.length) p.push('กลุ่ม: ' + f.groups.map(groupName).join(', '));
  if (f.clinics.length) p.push('คลินิก: ' + (f.clinics.length > 4 ? f.clinics.length + ' คลินิก' : f.clinics.join(', ')));
  if (f.docs.length) p.push('แพทย์: ' + (f.docs.length > 3 ? f.docs.length + ' ท่าน' : f.docs.map(docName).join(', ')));
  return p.join(' · ');
}
function toSet(a) { var o = {}; a.forEach(function (x) { o[x] = 1; }); return o; }
function dtMatch(dt, t) { return dt === 'all' || (dt === 'off' ? (t === 'S' || t === 'H') : t === dt); }

/** สรุปช่วงวันที่ตามตัวกรอง
 *  หัตถการ/Consult/Night OPD/Admit คีย์เป็นยอดรวมทั้งวัน → ไม่แยกตามคลินิก/แพทย์ (กรองได้เฉพาะช่วงวันและประเภทวัน) */
function anAgg(from, to, f) {
  var today = S.boot.today; if (to > today) to = today;
  var hidden = {}, gmap = {};
  (S.boot.clinics || []).forEach(function (c) { if (!c.show) hidden[c.code] = 1; gmap[c.code] = c.groupId || ''; });
  var gsel = f.groups.length ? toSet(f.groups) : null, csel = f.clinics.length ? toSet(f.clinics) : null, dsel = f.docs.length ? toSet(f.docs) : null;
  var r = { from: from, to: to, total: 0, openDays: 0, days: 0, wd: { n: 0, vn: 0 }, off: { n: 0, vn: 0 }, nodata: 0, keyed: 0, missing: 0, procTotal: 0, procs: {},
    other: { consult: 0, nightOpd: 0, admit: 0 }, daily: [], by: { group: {}, clinic: {}, doc: {} }, docClin: {} };
  if (from > to) return r;
  var add = function (m, k, n, seen) { var o = m[k] || (m[k] = [0, 0]); o[0] += n; if (!seen[k]) { seen[k] = 1; o[1]++; } };
  for (var d = from; d <= to; d = addDays(d, 1)) {
    var t = dayTypeOf(d);
    if (!dtMatch(f.dt, t)) continue;
    r.days++;
    var rec = anDay(d);
    if (!rec || !rec[0]) { r.nodata++; r.daily.push([d, null, t]); continue; }
    var tot = 0, all = 0, sc = {}, sg = {}, sd = {};
    if (rec[1]) rec[1].split(',').forEach(function (x) {
      var p = x.split('.'), c = p[0], doc = p[1], n = +p[2] || 0;
      if (hidden[c]) return; all += n;
      var g = gmap[c] || '';
      if ((gsel && !gsel[g]) || (csel && !csel[c]) || (dsel && !dsel[doc])) return;
      tot += n; add(r.by.clinic, c, n, sc); add(r.by.group, g, n, sg); add(r.by.doc, doc, n, sd);
      (r.docClin[doc] || (r.docClin[doc] = {}))[c] = 1;
    });
    r.daily.push([d, tot, t]);
    if (tot > 0) { r.openDays++; r.total += tot; if (t === 'W') { r.wd.n++; r.wd.vn += tot; } else { r.off.n++; r.off.vn += tot; } }
    if (all > 0) {
      var pr = rec[2] || {}, keyed = rec[6] || Object.keys(pr).length > 0;
      if (keyed) r.keyed++; else if (d !== today) r.missing++;
      Object.keys(pr).forEach(function (k) { r.procs[k] = (r.procs[k] || 0) + pr[k]; r.procTotal += pr[k]; });
      r.other.consult += rec[3]; r.other.nightOpd += rec[4]; r.other.admit += rec[5];
    }
  }
  return r;
}
/** แถวตามมิติ (กลุ่ม/คลินิก/แพทย์) เรียงมาก→น้อย */
function anRows(r, by) {
  var m = r.by[by] || {};
  return Object.keys(m).map(function (k) {
    var v = m[k][0], days = m[k][1], o = { id: k, v: v, days: days, pick: by + ':' + k };
    if (by === 'group') { o.name = esc(groupName(k)); o.title = groupName(k); o.color = groupColor(k); }
    else if (by === 'clinic') { o.name = '<span class="code">' + esc(k) + '</span> ' + esc(clinicShort(k)); o.title = k + ' ' + clinicShort(k); o.color = groupColor(groupOf(k)); o.sub = groupsList().length ? groupName(groupOf(k)) : ''; }
    else { o.name = esc(docName(k)); o.title = docName(k); o.sub = Object.keys(r.docClin[k] || {}).join(', '); o.color = 'var(--c1)'; }
    return o;
  }).sort(function (a, b) { return b.v - a.v; });
}
/** โดนัท: กลุ่ม = สีประจำกลุ่ม · คลินิก/แพทย์ = 7 อันดับแรก + อื่น ๆ */
function anDonut(rows, by) {
  if (by === 'group') return rows.map(function (x) { return { name: x.name, title: x.title, v: x.v, color: x.color, key: x.pick, tip: '<b>' + esc(x.title) + '</b><br>' + fmt(x.v, 0) + ' ราย' }; });
  var top = rows.slice(0, 7).map(function (x, i) { return { name: x.name, title: x.title, v: x.v, color: PAL[i], key: x.pick, tip: '<b>' + esc(x.title) + '</b><br>' + fmt(x.v, 0) + ' ราย' }; });
  var rest = rows.slice(7).reduce(function (s, x) { return s + x.v; }, 0);
  if (rest) top.push({ name: 'อื่น ๆ (' + (rows.length - 7) + ')', v: rest, color: 'var(--idle)', tip: 'อื่น ๆ ' + fmt(rest, 0) + ' ราย' });
  return top;
}

/* ---------- แถบตัวกรอง ---------- */
var FB = { onChange: null, from: null, to: null };
function filterBar(from, to, onChange) {
  FB.onChange = onChange; FB.from = from; FB.to = to;
  var f = filt(), gl = groupsList();
  var lbl = function (k, all) { var n = f[k].length; if (!n) return all; if (k === 'groups') return n === 1 ? groupName(f.groups[0]) : n + ' กลุ่ม'; if (k === 'clinics') return n === 1 ? f.clinics[0] + ' ' + clinicShort(f.clinics[0]) : n + ' คลินิก'; return n === 1 ? docName(f.docs[0]) : n + ' ท่าน'; };
  var ms = function (k, title, all, dis) { return '<button type="button" class="msel' + (f[k].length ? ' on' : '') + '" data-ms="' + k + '"' + (dis ? ' disabled title="' + esc(dis) + '"' : '') + '><span class="t">' + title + '</span><b>' + esc(lbl(k, all)) + '</b><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg></button>'; };
  return '<div class="fbar rise d1" id="fbar"><span class="fic">' + IC.filter + '</span>' +
    '<label class="fsel' + (f.dt !== 'all' ? ' on' : '') + '"><span class="t">ประเภทวัน</span><select id="fdt">' + Object.keys(DT_TH).map(function (k) { return '<option value="' + k + '"' + (f.dt === k ? ' selected' : '') + '>' + DT_TH[k] + '</option>'; }).join('') + '</select></label>' +
    ms('groups', 'กลุ่มคลินิก', 'ทุกกลุ่ม', gl.length ? '' : 'ยังไม่ได้จัดกลุ่มคลินิก (แอดมิน: ตั้งค่า › กลุ่มคลินิก)') + ms('clinics', 'คลินิก', 'ทุกคลินิก') + ms('docs', 'แพทย์', 'ทุกท่าน') +
    '<label class="fsel"><span class="t">ดูตาม</span><select id="fby">' + Object.keys(BY_TH).map(function (k) { return '<option value="' + k + '"' + (f.by === k ? ' selected' : '') + (k === 'group' && !gl.length ? ' disabled' : '') + '>' + BY_TH[k] + '</option>'; }).join('') + '</select></label>' +
    (filtActive() || f.dt !== 'all' ? '<button type="button" class="btn btn-sm btn-ghost" id="freset">' + IC.x + 'ล้างตัวกรอง</button>' : '') + '</div>';
}
function bindFilterBar() {
  var f = filt();
  var fdt = $('#fdt'); if (fdt) fdt.onchange = function () { f.dt = fdt.value; saveFilt(); FB.onChange(); };
  var fby = $('#fby'); if (fby) fby.onchange = function () { f.by = fby.value; saveFilt(); FB.onChange(); };
  var fr = $('#freset'); if (fr) fr.onclick = function () { f.groups = []; f.clinics = []; f.docs = []; f.dt = 'all'; saveFilt(); closeMsel(); FB.onChange(); };
  $$('[data-ms]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); openMsel(b.getAttribute('data-ms'), b); }; });
}
/** กดแถว/แท่ง/ชิ้นกราฟ → กรองต่อ (กดซ้ำ = เอาออก) */
function bindPicks(root) {
  $$('[data-pick]', root).forEach(function (el) {
    el.addEventListener('click', function () {
      var p = el.getAttribute('data-pick').split(':'), k = { group: 'groups', clinic: 'clinics', doc: 'docs' }[p[0]], id = p.slice(1).join(':'), f = filt();
      if (!k) return;
      var i = f[k].indexOf(id); if (i >= 0) f[k].splice(i, 1); else f[k].push(id);
      if (k === 'groups' && f.by === 'group') f.by = 'clinic'; else if (k === 'clinics' && f.by === 'clinic' && f[k].length === 1) f.by = 'doc';
      saveFilt(); tip.hide(); FB.onChange();
      toast(i >= 0 ? 'เอาตัวกรองออกแล้ว' : 'กรองเฉพาะ ' + (k === 'groups' ? groupName(id) : k === 'clinics' ? id + ' ' + clinicShort(id) : docName(id)));
    });
  });
}
/** ตัวเลือกของแต่ละตัวกรอง (คำนวณจากข้อมูลในช่วงเวลา) */
function mselOptions(kind) {
  var f = filt(), base = { groups: [], clinics: [], docs: [], dt: f.dt };
  if (kind === 'groups') {
    var a = anAgg(FB.from, FB.to, base), out = groupsList().map(function (g) { var x = a.by.group[g.id]; return { v: g.id, label: g.name, n: x ? x[0] : 0, color: palOf(g.color) }; });
    if (a.by.group['']) out.push({ v: '', label: 'ยังไม่จัดกลุ่ม', n: a.by.group[''][0], color: 'var(--idle)' });
    return out;
  }
  if (kind === 'clinics') {
    var b = anAgg(FB.from, FB.to, { groups: f.groups, clinics: [], docs: [], dt: f.dt });
    var seen = toSet(Object.keys(b.by.clinic).concat(f.clinics));
    return Object.keys(seen).map(function (c) { var x = b.by.clinic[c]; return { v: c, label: c + ' ' + clinicShort(c), sub: groupsList().length ? groupName(groupOf(c)) : '', n: x ? x[0] : 0, color: groupColor(groupOf(c)) }; }).sort(function (p, q) { return q.n - p.n; });
  }
  var c2 = anAgg(FB.from, FB.to, { groups: f.groups, clinics: f.clinics, docs: [], dt: f.dt }), sd = toSet(Object.keys(c2.by.doc).concat(f.docs));
  return Object.keys(sd).map(function (d) { var x = c2.by.doc[d]; return { v: d, label: docName(d), sub: Object.keys(c2.docClin[d] || {}).join(', '), n: x ? x[0] : 0 }; }).sort(function (p, q) { return q.n - p.n; });
}
function closeMsel() { $$('.mspop').forEach(function (p) { p.remove(); }); document.removeEventListener('click', mselOutside, true); }
function mselOutside(e) { if (!e.target.closest('.mspop') && !e.target.closest('[data-ms]')) closeMsel(); }
function openMsel(kind, anchor) {
  var had = $('.mspop[data-k="' + kind + '"]'); closeMsel(); if (had) return;
  var f = filt(), opts = mselOptions(kind), title = { groups: 'กลุ่มคลินิก', clinics: 'คลินิก', docs: 'แพทย์' }[kind];
  var pop = document.createElement('div'); pop.className = 'mspop'; pop.setAttribute('data-k', kind); pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'เลือก' + title);
  pop.innerHTML = '<div class="msh"><b>' + title + '</b><button type="button" class="iconbtn" data-msx aria-label="ปิด">' + IC.x + '</button></div>' +
    '<input type="search" class="msq" placeholder="พิมพ์ค้นหา' + title + '…" aria-label="ค้นหา' + title + '">' +
    '<div class="msa"><button type="button" class="btn btn-sm btn-ghost" data-msall>เลือกที่เห็นทั้งหมด</button><button type="button" class="btn btn-sm btn-ghost" data-msnone>ล้าง (ทั้งหมด)</button></div>' +
    '<div class="msl" role="listbox" aria-multiselectable="true"></div><div class="msf"><span class="xs muted" data-mscount></span><button type="button" class="btn btn-sm btn-brand" data-msx>เสร็จ</button></div>';
  document.body.appendChild(pop);
  var list = $('.msl', pop), q = $('.msq', pop), sel = toSet(f[kind]);
  var draw = function () {
    var s = q.value.trim().toLowerCase(), shown = opts.filter(function (o) { return !s || (o.label + ' ' + (o.sub || '') + ' ' + o.v).toLowerCase().indexOf(s) >= 0; });
    list.innerHTML = shown.length ? shown.slice(0, 400).map(function (o) {
      return '<label class="mso' + (sel[o.v] ? ' on' : '') + '"><input type="checkbox" value="' + esc(o.v) + '"' + (sel[o.v] ? ' checked' : '') + '>' + (o.color ? '<i style="background:' + o.color + '"></i>' : '') +
        '<span class="l"><span>' + esc(o.label) + '</span>' + (o.sub ? '<small>' + esc(o.sub) + '</small>' : '') + '</span><span class="n">' + fmt(o.n, 0) + '</span></label>';
    }).join('') : '<div class="empty" style="padding:14px">ไม่พบ</div>';
    $('[data-mscount]', pop).textContent = (f[kind].length ? 'เลือก ' + f[kind].length + ' รายการ' : 'ทั้งหมด') + ' · ' + opts.length + ' ตัวเลือก';
    $$('input', list).forEach(function (c) { c.onchange = function () { if (c.checked) sel[c.value] = 1; else delete sel[c.value]; c.closest('.mso').classList.toggle('on', c.checked); apply(); }; });
  };
  var apply = debounce(function () { f[kind] = Object.keys(sel); saveFilt(); FB.onChange(); $('[data-mscount]', pop).textContent = (f[kind].length ? 'เลือก ' + f[kind].length + ' รายการ' : 'ทั้งหมด') + ' · ' + opts.length + ' ตัวเลือก'; }, 180);
  $('[data-msall]', pop).onclick = function () { $$('input', list).forEach(function (c) { sel[c.value] = 1; }); draw(); apply(); };
  $('[data-msnone]', pop).onclick = function () { sel = {}; draw(); apply(); };
  $$('[data-msx]', pop).forEach(function (b) { b.onclick = closeMsel; });
  q.oninput = draw; draw();
  pop.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMsel(); });
  // ตำแหน่ง: ใต้ปุ่ม (จอใหญ่) · แผ่นล่างจอ (มือถือ)
  if (innerWidth > 640) { var rc = anchor.getBoundingClientRect(); pop.style.top = Math.min(rc.bottom + 6, innerHeight - 420) + 'px'; pop.style.left = Math.max(8, Math.min(rc.left, innerWidth - pop.offsetWidth - 8)) + 'px'; }
  else pop.classList.add('sheet');
  setTimeout(function () { document.addEventListener('click', mselOutside, true); if (innerWidth > 640) q.focus(); }, 0);
}

/* ---------- ปฏิทินความหนาแน่น (มีหัวเดือน · ชื่อวัน · ช่วงสี) ---------- */
function heatmapHtml(start, end, valOf) {
  var today = S.boot.today, off = pd(start).getDay(), days = datesIn(start, end), vals = [];
  days.forEach(function (d) { if (d <= today) { var v = valOf(d); if (v != null) vals.push(v); } });
  var bins = heatBins(vals), W = Math.ceil((off + days.length) / 7), cells = '', months = '';
  days.forEach(function (d, i) {
    var k = off + i, col = Math.floor(k / 7) + 2, row = (k % 7) + 2, v = d <= today ? valOf(d) : null, fut = d > today;
    if (+d.slice(8) === 1 || i === 0) { var mc = Math.floor(k / 7) + 2 + (+d.slice(8) === 1 && k % 7 > 3 ? 1 : 0); months += '<span class="hm-m" style="grid-column:' + mc + '/span 4">' + TH_M[+d.slice(5, 7) - 1] + (d.slice(5, 7) === '01' || i === 0 ? ' ' + String(+d.slice(0, 4) + 543).slice(2) : '') + '</span>'; }
    cells += '<i style="grid-column:' + col + ';grid-row:' + row + ';background:' + (fut ? 'var(--surface-2)' : heatColor(v, 0, bins)) + (fut ? ';box-shadow:inset 0 0 0 1px var(--line)' : '') + '" data-tip="' + esc('<b>' + thDate(d, true) + '</b><br>' + (fut ? 'ยังไม่ถึง' : v == null ? 'ไม่มีข้อมูล' : fmt(v, 0) + ' ราย') + ' · ' + typeName(dayTypeOf(d))) + '"></i>';
  });
  var dl = TH_DS.map(function (x, i) { return '<span class="hm-d" style="grid-row:' + (i + 2) + '">' + x + '</span>'; }).join('');
  return '<div class="hm-wrap"><div class="hm" style="grid-template-columns:30px repeat(' + W + ',var(--hc))">' + months + dl + cells + '</div></div>' + heatLegend(bins);
}
