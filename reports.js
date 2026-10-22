/* =====================================================================
   reports.js — รายงาน · แดชบอร์ด · ตั้งค่า (แอดมิน)
   ===================================================================== */
'use strict';

/* ---------- ช่วงเวลา ---------- */
function periodRange(mode, key) {
  if (mode === 'day') return [key, key];
  if (mode === 'month') { var p = key.split('-').map(Number); return [key + '-01', ds(new Date(p[0], p[1], 0))]; }
  if (mode === 'quarter') { var q = key.split('-').map(Number), y = q[0] - 543, sm = [[y - 1, 10], [y, 1], [y, 4], [y, 7]][q[1] - 1]; return [sm[0] + '-' + ('0' + sm[1]).slice(-2) + '-01', ds(new Date(sm[0], sm[1] + 2, 0))]; }
  if (mode === 'fy') { var fy = (+key) - 543; return [(fy - 1) + '-10-01', fy + '-09-30']; }
  return key.split('|');
}
function periodLabel(mode, key) {
  if (mode === 'day') return thDate(key, true, true);
  if (mode === 'month') return thMonth(key);
  if (mode === 'quarter') { var q = key.split('-'); return 'ไตรมาส ' + q[1] + ' ปีงบประมาณ ' + q[0]; }
  if (mode === 'fy') return 'ปีงบประมาณ ' + key;
  var r = key.split('|'); return thDate(r[0]) + ' – ' + thDate(r[1]);
}
function periodPrev(mode, key) {
  if (mode === 'day') return addDays(key, -1);
  if (mode === 'month') { var p = key.split('-').map(Number), d = new Date(p[0], p[1] - 2, 1); return ds(d).slice(0, 7); }
  if (mode === 'quarter') { var q = key.split('-').map(Number); q[1]--; if (q[1] < 1) { q[1] = 4; q[0]--; } return q[0] + '-' + q[1]; }
  if (mode === 'fy') return String(+key - 1);
  var r = key.split('|'), n = datesIn(r[0], r[1]).length; return addDays(r[0], -n) + '|' + addDays(r[0], -1);
}
var PREV_TH = { day: 'วันก่อน', month: 'เดือนก่อน', quarter: 'ไตรมาสก่อน', fy: 'ปีงบก่อน', custom: 'ช่วงก่อนหน้า' };
function periodOptions(mode) {
  var set = {}, first = S.boot.firstDate, today = S.boot.today;
  for (var d = first.slice(0, 7) + '-01'; d <= today; d = ds(new Date(pd(d).getFullYear(), pd(d).getMonth() + 1, 1))) {
    if (mode === 'month') set[d.slice(0, 7)] = 1; else if (mode === 'quarter') set[fyOf(d) + '-' + qOf(d)] = 1; else if (mode === 'fy') set[String(fyOf(d))] = 1;
  }
  return Object.keys(set).sort().reverse();
}
function defaultKey(mode) {
  var t = S.boot.today;
  if (mode === 'day') return addDays(t, -1);
  if (mode === 'custom') return addDays(t, -30) + '|' + addDays(t, -1);
  if (mode === 'month') return t.slice(0, 7);
  if (mode === 'quarter') return fyOf(t) + '-' + qOf(t);
  return String(fyOf(t));
}
function periodPicker(st, id, noDay) {
  var modes = [['day', 'วัน'], ['month', 'เดือน'], ['quarter', 'ไตรมาส'], ['fy', 'ปีงบ'], ['custom', 'กำหนดเอง']].filter(function (m) { return !noDay || m[0] !== 'day'; });
  var sel;
  if (st.mode === 'day') sel = '<input type="date" id="' + id + 'k" value="' + st.key + '" min="' + S.boot.firstDate + '" max="' + S.boot.today + '" aria-label="วันที่">';
  else if (st.mode === 'custom') { var r = st.key.split('|'); sel = '<input type="date" id="' + id + 'a" value="' + r[0] + '" min="' + S.boot.firstDate + '" max="' + S.boot.today + '" aria-label="ตั้งแต่"><span class="muted">ถึง</span><input type="date" id="' + id + 'b" value="' + r[1] + '" min="' + S.boot.firstDate + '" max="' + S.boot.today + '" aria-label="ถึง">'; }
  else sel = '<select id="' + id + 'k" aria-label="ช่วงเวลา">' + periodOptions(st.mode).map(function (k) { return '<option value="' + k + '"' + (k === st.key ? ' selected' : '') + '>' + esc(periodLabel(st.mode, k)) + '</option>'; }).join('') + '</select>';
  return '<div class="row rise d1"><div class="seg" role="group" aria-label="ประเภทช่วงเวลา">' + modes.map(function (m) { return '<button data-pm="' + m[0] + '" aria-pressed="' + (st.mode === m[0]) + '">' + m[1] + '</button>'; }).join('') + '</div>' + sel + '</div>';
}
function bindPicker(st, id, rerender) {
  $$('[data-pm]').forEach(function (b) { b.onclick = function () { st.mode = b.getAttribute('data-pm'); st.key = defaultKey(st.mode); rerender(); }; });
  var k = $('#' + id + 'k'); if (k) k.onchange = function (e) { if (e.target.value) { st.key = e.target.value; rerender(); } };
  var a = $('#' + id + 'a'), b = $('#' + id + 'b');
  if (a) { var f = function () { if (a.value && b.value && a.value <= b.value) { st.key = a.value + '|' + b.value; rerender(); } }; a.onchange = f; b.onchange = f; }
}
function rangeReq(st) {
  var r = periodRange(st.mode, st.key), pr = periodRange(st.mode, periodPrev(st.mode, st.key));
  var to = r[1] > S.boot.today ? S.boot.today : r[1], partial = to < r[1];
  // ช่วงที่ยังไม่จบ (เช่น เดือนนี้ผ่านไป 8 วัน) → เทียบกับช่วงเดียวกันของรอบก่อน (8 วันแรกของเดือนก่อน)
  var n = datesIn(r[0], to).length, pTo = partial ? addDays(pr[0], n - 1) : pr[1];
  if (pTo > pr[1]) pTo = pr[1];
  return { from: r[0], to: to, prevFrom: pr[0], prevTo: pTo, partial: partial };
}
function deltaHtml(cur, prev, mode, okPrev, partial) {
  if (!okPrev || prev == null || !prev) return '<span class="d muted">ยังไม่มีข้อมูล' + PREV_TH[mode] + '</span>';
  var d = pct(cur, prev); return '<span class="d"><span class="delta ' + (d >= 0 ? 'up' : 'down') + '">' + (d >= 0 ? '▲' : '▼') + ' ' + fmt(Math.abs(d)) + '%</span> <span class="muted">เทียบ' + (partial ? 'ช่วงเดียวกัน' : '') + PREV_TH[mode] + '</span></span>';
}
function itemName(id) { var i = (S.boot.items || []).filter(function (x) { return x.id === id; })[0]; return i ? i.name : id; }

/* =====================================================================
   รายงาน (กรองได้: ประเภทวัน · กลุ่มคลินิก · คลินิก · แพทย์ · ดูตาม)
   ===================================================================== */
var REP = { mode: 'month', key: null, req: null, cur: null, prev: null, cases: null, casesKey: '' };
function procNote() { var f = filt(); return filtActive() ? '<span class="chip idle" title="หัตถการและยอดอื่น ๆ คีย์แยกหน่วยงาน ไม่แยกตามคลินิก/แพทย์/สิทธิ">' + (f.units.length ? 'ยอดของหน่วยงานที่เลือก' : 'ยอดรวมทุกหน่วยงาน') + ' ไม่แยกตามตัวกรองอื่น</span>' : ''; }
/* ---------- นับผู้ป่วยไม่ซ้ำคน (HN) ตามช่วงเวลา + ตัวกรอง (เรียกเซิร์ฟเวอร์เมื่อกด) ---------- */
var PERSONS = {};
function personsReq(c, from, to) {
  var f = filt(), p = { from: from, to: to > S.boot.today ? S.boot.today : to };
  if (f.dt !== 'all') p.dates = c.daily.map(function (x) { return x[0]; });
  if (f.units.length || f.locs.length || f.groups.length || f.clinics.length) p.clinics = Object.keys(c.by.clinic);
  if (f.docs.length) { p.docs = f.docs.filter(function (d) { return d.charAt(0) !== '*'; }); var mc = f.docs.filter(function (d) { return d.charAt(0) === '*'; }).map(function (d) { return d.slice(1); }); if (mc.length) p.clinics = (p.clinics || []).concat(mc); }
  if (f.rgs.length) { p.mains = Object.keys(rtIndex().byId).filter(function (id) { var r = rtIndex().byId[id]; return r.kind === 'pt' && f.rgs.indexOf(r.group) >= 0; }); }
  return p;
}
function bindPersons(c, from, to) {
  var b = $('#bPersons'), box = $('#personsBox'); if (!b) return;
  var req = personsReq(c, from, to), k = JSON.stringify(req);
  var show = function (r) { box.innerHTML = '<b>' + fmt(r.persons, 0) + '</b>&nbsp;คน <span class="muted">· มารับบริการมากกว่า 1 ครั้ง ' + fmt(r.repeat, 0) + ' คน' + (r.missingDays ? ' · ไม่มีข้อมูลรายคน ' + r.missingDays + ' วัน' : '') + '</span>'; };
  if (PERSONS[k]) return show(PERSONS[k]);
  b.onclick = function () { busy(b, api('getPersons', req), 'กำลังนับ…').then(function (r) { PERSONS[k] = r; if ($('#personsBox') === box) show(r); }).catch(function (e) { toast(e.message, true); }); };
}
/* ---------- สิทธิการรักษา (รายงาน/แดชบอร์ด) ---------- */
var RV = { view: 'reg' };
function rightsCardHtml(R, by, rowsDim) {
  if (!R || !R.days) return '<section class="card wide rise d3"><div class="card-h"><h3><span class="ic">' + IC.card + '</span>สิทธิการรักษา</h3></div><div class="card-b"><p class="small muted" style="margin:0">' + (R && R.missing ? 'ช่วงนี้ยังไม่มีข้อมูลสิทธิ (' + R.missing + ' วัน) · ระบบกำลังดึงย้อนหลังให้เอง' : 'ยังไม่มีข้อมูลสิทธิในช่วงนี้') + '</p></div></section>';
  var v = RV.view, s = R.sum, gr = rgRows(v === 'reg' ? s.reg : s.pay), cols = rgRows(s.reg).map(function (x) { return x.id; });
  var dl = gr.map(function (x) { return { name: esc(x.name), title: x.name, v: x.v, color: x.color, key: v === 'reg' && x.id !== 'none' ? 'rg:' + x.id : '', tip: '<b>' + esc(x.name) + '</b><br>' + fmt(x.v, 0) + ' ราย' }; });
  var mrows = rowsDim.slice(0, 20).filter(function (x) { return R.rows[x.id]; });
  return '<section class="card wide rise d3" id="rtCard"><div class="card-h"><h3><span class="ic">' + IC.card + '</span>สิทธิการรักษา</h3><div class="row"><div class="seg" role="group" aria-label="มุมมองสิทธิ"><button data-rvw="reg" aria-pressed="' + (v === 'reg') + '">ตามทะเบียน</button><button data-rvw="pay" aria-pressed="' + (v === 'pay') + '">ที่ชำระจริง</button></div>' + (R.missing ? '<span class="chip warn" title="วันที่ยังไม่มีข้อมูลสิทธิ (ระบบกำลังดึงย้อนหลัง)">ไม่มีข้อมูลสิทธิ ' + R.missing + ' วัน</span>' : '') + '</div></div>' +
    '<div class="card-b"><div class="bdgrid"><div>' + donut(dl, { aria: 'สัดส่วนสิทธิการรักษา' }) + '</div><div>' +
      '<div class="rusage">' + ['single', 'combo', 'cash'].map(function (k) { return '<span class="u-' + k + '"><b>' + fmt(s.usage[k], 0) + '</b>' + USAGE_TH[k] + '</span>'; }).join('') + '</div>' +
      '<p class="xs muted" style="margin:6px 0 10px">รวม ' + fmt(s.total, 0) + ' ราย' + (s.mixed ? ' · ร่วมจ่ายเงินสด ' + fmt(s.mixed, 0) : '') + (s.pay.none ? ' · ยังไม่มีรายการค่าใช้จ่าย ' + fmt(s.pay.none, 0) : '') + ' · ' + (v === 'reg' ? 'ตามทะเบียน = สิทธิหลัก' : 'ที่ชำระจริง = สิทธิในรายการค่าใช้จ่าย') + '</p>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>กลุ่มสิทธิ</th><th class="num">ตามทะเบียน</th><th class="num">ที่ชำระจริง</th><th class="num">ต่าง</th></tr></thead><tbody>' +
        rgRows(Object.assign({}, s.reg, s.pay)).map(function (x) { var a = s.reg[x.id] || 0, b = s.pay[x.id] || 0; return '<tr' + (x.id !== 'none' ? ' class="pickable" data-pick="rg:' + esc(x.id) + '"' : '') + '><td><span class="dot" style="background:' + x.color + '"></span>' + esc(x.name) + '</td><td class="num">' + (x.id === 'none' ? '' : fmt(a, 0)) + '</td><td class="num">' + fmt(b, 0) + '</td><td class="num ' + (b - a > 0 ? 'up' : b - a < 0 ? 'down' : 'muted') + '">' + (x.id === 'none' || a === b ? '' : (b > a ? '+' : '') + fmt(b - a, 0)) + '</td></tr>'; }).join('') +
      '</tbody></table></div></div></div>' +
    (mrows.length ? '<h4 class="subh">สิทธิตามทะเบียน แยกตาม' + BY_TH[by] + '</h4><div class="tbl-wrap" style="max-height:420px;overflow:auto"><table class="tbl xtab"><thead><tr><th>' + BY_TH[by] + '</th>' + cols.map(function (g) { return '<th class="num pickable" data-pick="rg:' + esc(g) + '" title="' + esc(rgName(g)) + '"><span class="dot" style="background:' + rgColor(g) + '"></span>' + esc(rgName(g).length > 12 ? rgName(g).slice(0, 11) + '…' : rgName(g)) + '</th>'; }).join('') + '<th class="num">รวม</th></tr></thead><tbody>' +
      mrows.map(function (x) { var rr = R.rows[x.id]; return '<tr><td class="pickable" data-pick="' + esc(x.pick) + '">' + x.name + '</td>' + cols.map(function (g) { var n = rr.reg[g] || 0; return '<td class="num">' + (n ? fmt(n, 0) + '<span class="xs muted"> ' + fmt(n / rr.total * 100, 0) + '%</span>' : '') + '</td>'; }).join('') + '<td class="num"><b>' + fmt(rr.total, 0) + '</b></td></tr>'; }).join('') + '</tbody></table></div>' : '') +
    '<details class="rdetail"><summary>สิทธิย่อย · สิทธิร่วม · เทียบทะเบียนกับที่ชำระ</summary>' + rightsDetailHtml(s) + '</details></div></section>';
}
function bindRights(redraw) { $$('[data-rvw]').forEach(function (b) { b.onclick = function () { RV.view = b.getAttribute('data-rvw'); redraw(); }; }); }
function statCards(c, p, mode, partial, okPrev) {
  var wdAvg = c.wd.n ? c.wd.vn / c.wd.n : 0, pwd = p && p.wd.n ? p.wd.vn / p.wd.n : null;
  var spark = c.daily.slice(-30).map(function (x) { return x[1]; });
  return '<div class="stats">' +
    '<div class="stat rise d1"><span class="lb">' + IC.users + 'ผู้ป่วยทั้งหมด</span><span class="v"><span data-count="' + c.total + '">0</span><small>ราย</small></span>' + deltaHtml(c.total, p && p.total, mode, okPrev, partial) + '<span class="d persons" id="personsBox"><button class="linkbtn" id="bPersons" title="นับจำนวนคน (HN ไม่ซ้ำ) ตามช่วงเวลาและตัวกรอง">' + IC.users.replace('<svg', '<svg width="13" height="13"') + 'นับผู้ป่วยไม่ซ้ำคน</button></span>' + miniLine(spark) + '</div>' +
    '<div class="stat rise d2"><span class="lb">' + IC.clinic + 'วันที่มีผู้ป่วย</span><span class="v"><span data-count="' + c.openDays + '">0</span><small>วัน</small></span><span class="d muted">วันทำการ ' + c.wd.n + ' · วันหยุด ' + c.off.n + '</span></div>' +
    '<div class="stat rise d3"><span class="lb">' + IC.pulse + 'เฉลี่ยต่อวันทำการ</span><span class="v"><span data-count="' + wdAvg + '" data-dec="1">0</span><small>ราย/วัน</small></span>' + deltaHtml(wdAvg, pwd, mode, okPrev, partial) + '</div>' +
    '<div class="stat rise d4"><span class="lb">' + IC.syringe + 'หัตถการรวม</span><span class="v"><span data-count="' + c.procTotal + '">0</span><small>ครั้ง</small></span><span class="d ' + (c.missing ? 'down' : 'muted') + '">' + (c.missing ? 'ยังไม่คีย์ ' + c.missing + ' วัน' : (filtActive() ? 'ยอดรวมทั้งคลินิกพิเศษ' : 'คีย์ครบทุกวันที่เปิด')) + '</span></div></div>';
}
function trendData(c) {
  var long = c.daily.length > 62;
  if (!long) return { long: false, bars: c.daily.map(function (x) { var d = pd(x[0]); return { label: String(d.getDate()), v: x[1] || 0, color: typeColor(x[2]), tip: '<b>' + esc(thDate(x[0], true)) + '</b><br>' + (x[1] == null ? 'ไม่มีข้อมูล' : fmt(x[1], 0) + ' ราย') + ' · ' + typeName(x[2]) }; }) };
  var mm = {}, ord = []; c.daily.forEach(function (x) { var k = x[0].slice(0, 7); if (!(k in mm)) { mm[k] = 0; ord.push(k); } mm[k] += x[1] || 0; });
  return { long: true, bars: ord.map(function (k) { return { label: TH_M[+k.slice(5) - 1], v: mm[k], color: 'var(--c1)', tip: '<b>' + esc(thMonth(k)) + '</b><br>' + fmt(mm[k], 0) + ' ราย' }; }) };
}
function trendCard(c, id, cls) {
  var t = trendData(c);
  return '<section class="card ' + (cls || '') + ' rise d2"><div class="card-h"><h3><span class="ic">' + IC.dash + '</span>' + (t.long ? 'ผู้ป่วยรายเดือน' : 'ผู้ป่วยรายวัน') + '</h3><div class="row">' +
    (t.long ? '' : '<div class="legend"><span><i style="background:var(--d-w)"></i>วันทำการ</span><span><i style="background:var(--d-s)"></i>เสาร์–อาทิตย์</span><span><i style="background:var(--d-h)"></i>นักขัตฤกษ์</span></div>') + labelsToggle(id) + '</div></div>' +
    '<div class="card-b">' + barChart(t.bars, { h: 250, labels: labelsOn(), aria: 'แนวโน้มผู้ป่วย', maxLabels: t.long ? 24 : 31 }) + '</div></section>';
}
function breakdownCard(c, by) {
  var rows = anRows(c, by), tot = c.total || 1, mx = rows.length ? rows[0].v : 1;
  return '<section class="card rise d2"><div class="card-h"><h3><span class="ic">' + (by === 'doc' ? IC.users : by === 'group' ? IC.tag : IC.clinic) + '</span>ผู้ป่วยตาม' + BY_TH[by] + '</h3><span class="small muted">' + rows.length + ' ' + (by === 'doc' ? 'ท่าน' : by === 'group' ? 'กลุ่ม' : 'คลินิก') + ' · กดแถวเพื่อกรอง</span></div>' +
    '<div class="card-b"><div class="bdgrid"><div>' + donut(anDonut(rows, by), { aria: 'สัดส่วนผู้ป่วยตาม' + BY_TH[by] }) + '</div>' +
    '<div class="tbl-wrap bdtbl"><table class="tbl"><thead><tr><th>' + BY_TH[by] + '</th><th class="num">วัน</th><th class="num">ผู้ป่วย</th><th class="num">เฉลี่ย/วัน</th><th style="width:24%">สัดส่วน</th></tr></thead><tbody>' +
    (rows.map(function (x) { var sh = x.v / tot * 100; return '<tr class="pickable" data-pick="' + esc(x.pick) + '"><td><span class="dot" style="background:' + x.color + '"></span>' + x.name + (x.sub ? '<div class="xs muted">' + esc(x.sub) + '</div>' : '') + '</td><td class="num">' + x.days + '</td><td class="num"><b>' + fmt(x.v, 0) + '</b></td><td class="num">' + fmt(x.v / (x.days || 1)) + '</td><td><div class="sbar"><i style="width:' + Math.max(1.5, x.v / mx * 100).toFixed(1) + '%;background:' + x.color + '"></i></div><span class="xs muted">' + fmt(sh) + '%</span></td></tr>'; }).join('') || '<tr><td colspan="5" class="muted">ไม่มีข้อมูลตามตัวกรอง</td></tr>') +
    '</tbody><tfoot><tr><td>รวม</td><td class="num">' + c.openDays + '</td><td class="num">' + fmt(c.total, 0) + '</td><td class="num">' + (c.openDays ? fmt(c.total / c.openDays) : '–') + '</td><td>100%</td></tr></tfoot></table></div></div></div></section>';
}
function procCard(c) {
  var items = Object.keys(c.procs || {}).map(function (k) { return [k, c.procs[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
  return '<section class="card rise d3"><div class="card-h"><h3><span class="ic">' + IC.syringe + '</span>หัตถการ</h3>' + (procNote() || '<span class="small muted">ต่อผู้ป่วย 100 ราย</span>') + '</div><div class="card-b tbl-wrap"><table class="tbl"><thead><tr><th>รายการ</th><th class="num">ครั้ง</th><th class="num">/100 ราย</th></tr></thead><tbody>' +
    (items.map(function (x) { return '<tr><td>' + esc(itemName(x[0])) + '</td><td class="num"><b>' + fmt(x[1], 0) + '</b></td><td class="num">' + (c.total && !filtActive() ? fmt(x[1] / c.total * 100) : '–') + '</td></tr>'; }).join('') || '<tr><td colspan="3" class="muted">ยังไม่มีการคีย์</td></tr>') +
    '</tbody><tfoot><tr><td>รวม</td><td class="num">' + fmt(c.procTotal, 0) + '</td><td class="num">' + (c.total && !filtActive() ? fmt(c.procTotal / c.total * 100) : '–') + '</td></tr></tfoot></table></div></section>' +
    '<section class="card rise d4"><div class="card-h"><h3><span class="ic">' + IC.ambul + '</span>ยอดอื่น ๆ</h3>' + procNote() + '</div><div class="card-b"><dl class="kvlist"><dt>Consult แผนกอื่น</dt><dd><b>' + fmt(c.other.consult, 0) + '</b> ราย</dd><dt>โอนตรวจต่อ Night OPD ชั้น 4</dt><dd><b>' + fmt(c.other.nightOpd, 0) + '</b> ราย</dd><dt>Admit</dt><dd><b>' + fmt(c.other.admit, 0) + '</b> ราย</dd></dl></div></section>';
}
function pageRep() {
  if (!REP.key) REP.key = defaultKey(REP.mode);
  var req = REP.req = rangeReq(REP);
  $('#main').innerHTML = banners() + '<div class="pagehead rise"><div><div class="eyebrow">รายงาน</div><h1>' + esc(periodLabel(REP.mode, REP.key)) + '</h1><div class="small muted">' + esc(thDate(req.from)) + ' – ' + esc(thDate(req.to)) + '</div></div>' +
    '<div class="row">' + helpBtn() + '<button class="btn" id="rxls">' + IC.xls + 'ส่งออก Excel</button><button class="btn" id="rprint">' + IC.print + 'พิมพ์</button><button class="btn" id="rline">' + IC.line + 'สรุปส่งไลน์</button></div></div>' +
    periodPicker(REP, 'rp') + '<div id="repBody"><div class="stats">' + [1, 2, 3, 4].map(function () { return '<div class="stat skel" style="height:96px"></div>'; }).join('') + '</div></div>';
  bindPicker(REP, 'rp', pageRep); bindHelp($('#main'));
  var key = REP.mode + REP.key;
  anLoad(req.prevFrom < req.from ? req.prevFrom : req.from, req.to).then(function () { if (S.page === 'rep' && REP.mode + REP.key === key) drawRep(); return anLoadRights(req.from, req.to); })
    .then(function () { REP.rightsReady = true; if (S.page === 'rep' && REP.mode + REP.key === key) drawRep(); }).catch(function (e) { toast(e.message, true); });
  $('#rxls').onclick = function () { exportRep(); };
  $('#rprint').onclick = function () { printRep(); };
  $('#rline').onclick = function () { if (!REP.cur) return; var m = modal('สรุปส่งไลน์', '<pre class="linetxt" id="rtx">' + esc(repText()) + '</pre>', '<button class="btn btn-brand" id="rcp">' + IC.copy + 'คัดลอกข้อความ</button>', 'sheet'); $('#rcp', m).onclick = function () { copyText(repText(), $('#rtx', m)); }; };
}
function drawRep() {
  var box = $('#repBody'), req = REP.req; if (!box) return;
  var f = filt(), c = REP.cur = anAgg(req.from, req.to, f), p = REP.prev = anAgg(req.prevFrom, req.prevTo, f), okPrev = p.openDays > 0 && !p.nodata;
  var R = REP.rights = ymList(req.from, req.to).every(function (ym) { return AN.rights[ym]; }) ? anRights(req.from, req.to, f, f.by) : null;
  var sy = scrollY;
  box.innerHTML = filterBar(req.from, req.to, drawRep) + (filtDesc() ? '<div class="fdesc">' + IC.filter + '<span>' + esc(filtDesc()) + '</span></div>' : '') +
    (c.nodata ? '<div class="banner warn">' + IC.warn.replace('<svg', '<svg width="16" height="16"') + ' ยังไม่มียอดจากระบบโรงพยาบาล ' + c.nodata + ' วันในช่วงนี้</div>' : '') +
    statCards(c, p, REP.mode, req.partial, okPrev) +
    (c.daily.length > 1 ? '<div style="margin-top:18px">' + trendCard(c, 'lblR') + '</div>' : '') +
    (c.noRights ? '<div class="banner warn">ตัวกรองสิทธิ: ไม่มีข้อมูลสิทธิ ' + c.noRights + ' วันในช่วงนี้ (ไม่นับวันเหล่านั้น)</div>' : '') +
    '<div class="grid-rep" style="margin-top:18px">' + breakdownCard(c, f.by) + '<div class="col">' + procCard(c) + '</div></div>' +
    '<div style="margin-top:18px">' + (R ? rightsCardHtml(R, f.by, anRows(c, f.by)) : '<section class="card"><div class="card-b"><div class="skel" style="height:120px"></div><p class="xs muted">กำลังโหลดข้อมูลสิทธิการรักษา…</p></div></section>') + '</div>' +
    (f.by !== 'doc' ? docTableCard(c) : '') +
    (c.daily.length > 1 ? '<details class="card rise d5" style="margin-top:18px"><summary class="card-h"><h3><span class="ic">' + IC.cal + '</span>รายวัน (' + c.daily.length + ' วัน)</h3><span class="small muted">กดเพื่อเปิด/ปิด</span></summary><div class="card-b tbl-wrap" style="max-height:420px;overflow:auto"><table class="tbl"><thead><tr><th>วันที่</th><th>ประเภทวัน</th><th class="num">ผู้ป่วย</th></tr></thead><tbody>' +
      c.daily.slice().reverse().map(function (x) { return '<tr><td><a href="#" data-go-day="' + x[0] + '">' + esc(thDate(x[0], true)) + '</a></td><td class="small"><span class="dot" style="background:' + typeColor(x[2]) + '"></span>' + typeName(x[2]) + '</td><td class="num">' + (x[1] == null ? '<span class="muted">ไม่มีข้อมูล</span>' : fmt(x[1], 0)) + '</td></tr>'; }).join('') + '</tbody></table></div></details>' : '') +
    '<section class="card rise d5" id="repCases" style="margin-top:18px"></section>';
  bindFilterBar(); bindPicks(box); countUp(box); bindTips(box); bindRights(drawRep); bindPersons(c, req.from, req.to);
  var lb = $('#lblR'); if (lb) lb.onchange = function () { store('chartLabels', lb.checked); drawRep(); };
  var dq = $('#dq'); if (dq) dq.oninput = function () { var q = dq.value.trim().toLowerCase(); $$('#dbody tr').forEach(function (tr) { tr.hidden = !!q && tr.getAttribute('data-dn').toLowerCase().indexOf(q) < 0; }); };
  $$('[data-go-day]', box).forEach(function (a) { a.onclick = function (e) { e.preventDefault(); S.date = a.getAttribute('data-go-day'); go('today'); }; });
  if (sy) window.scrollTo(0, sy);
  loadRepCases();
}
function docTableCard(c) {
  var rows = anRows(c, 'doc');
  return '<section class="card rise d4" style="margin-top:18px"><div class="card-h"><h3><span class="ic">' + IC.users + '</span>ผู้ป่วยแยกแพทย์</h3><input type="search" id="dq" placeholder="ค้นหาชื่อแพทย์" aria-label="ค้นหาชื่อแพทย์"></div><div class="card-b tbl-wrap" style="max-height:460px;overflow:auto"><table class="tbl"><thead><tr><th>#</th><th>แพทย์</th><th>คลินิก</th><th class="num">วัน</th><th class="num">ผู้ป่วย</th><th class="num">สัดส่วน</th></tr></thead><tbody id="dbody">' +
    rows.map(function (x, i) { return '<tr class="pickable" data-pick="' + esc(x.pick) + '" data-dn="' + esc(x.title) + '"><td class="muted tnum xs">' + (i + 1) + '</td><td>' + x.name + '</td><td class="small muted">' + esc(x.sub) + '</td><td class="num">' + x.days + '</td><td class="num">' + fmt(x.v, 0) + '</td><td class="num">' + (c.total ? fmt(x.v / c.total * 100) : '–') + '%</td></tr>'; }).join('') + '</tbody></table></div></section>';
}
/* ผู้ป่วยส่งต่อในช่วงรายงาน (ไม่แยกตามคลินิก) */
function loadRepCases() {
  var box = $('#repCases'), req = REP.req; if (!box) return;
  var k = req.from + '|' + req.to;
  var draw = function () {
    var rows = REP.cases || [], show = store('repCaseShow') === true;
    var cnt = { admit: 0, consult: 0, nightOpd: 0 }; rows.forEach(function (x) { cnt[x.type]++; });
    box.innerHTML = '<div class="card-h"><h3><span class="ic">' + IC.ambul + '</span>ผู้ป่วยส่งต่อ <span class="chip brand">' + rows.length + ' ราย</span></h3><div class="row"><span class="small muted">Admit ' + cnt.admit + ' · Consult ' + cnt.consult + ' · Night OPD ' + cnt.nightOpd + '</span>' +
      (rows.length ? '<button class="btn btn-sm btn-ghost" id="rcEye">' + (show ? IC.eyeOff + 'ซ่อนชื่อ/HN' : IC.eye + 'แสดงชื่อ/HN') + '</button>' : '') + '</div></div>' +
      '<div class="card-b tbl-wrap" style="max-height:440px;overflow:auto">' + (rows.length ? '<table class="tbl"><thead><tr><th>วันที่</th><th>ประเภท</th><th>ชื่อ-สกุล</th><th>HN</th><th>อายุ</th><th>DX</th><th>Ward/หน่วยงาน</th><th>หมายเหตุ</th></tr></thead><tbody>' +
        rows.map(function (x) { return '<tr><td class="small"><a href="#" data-go-day="' + x.date + '">' + esc(thDate(x.date)) + '</a></td><td><span class="ctype sm t-' + x.type + '">' + esc(CASE_SHORT[x.type]) + '</span></td><td>' + esc(show ? x.name : maskName(x.name)) + '</td><td class="tnum">' + esc(show ? x.hn : maskHn(x.hn)) + '</td><td>' + esc(x.age) + '</td><td>' + esc(x.dx) + '</td><td>' + esc(x.dest) + '</td><td class="small">' + esc(x.note) + '</td></tr>'; }).join('') + '</tbody></table>'
        : '<div class="empty" style="padding:16px">' + IC.ambul + 'ไม่มีผู้ป่วยส่งต่อในช่วงนี้</div>') + '</div>';
    var e = $('#rcEye', box); if (e) e.onclick = function () { store('repCaseShow', !show); draw(); };
    $$('[data-go-day]', box).forEach(function (a) { a.onclick = function (ev) { ev.preventDefault(); S.date = a.getAttribute('data-go-day'); go('today'); }; });
  };
  if (REP.casesKey === k && REP.cases) return draw();
  box.innerHTML = '<div class="card-b"><div class="skel" style="height:60px;margin-top:16px"></div></div>';
  api('getCases', { from: req.from, to: req.to }).then(function (r) { REP.cases = r.rows; REP.casesKey = k; if ($('#repCases')) draw(); }).catch(function (e) { box.innerHTML = '<div class="card-b small muted" style="padding-top:16px">' + esc(e.message) + '</div>'; });
}
function repText() {
  var c = REP.cur, req = REP.req, f = filt(), its = Object.keys(c.procs || {}).sort(function (a, b) { return c.procs[b] - c.procs[a]; }), rows = anRows(c, f.by);
  return '📊 สรุปรายงาน ' + ORG.clinic + '\n' + periodLabel(REP.mode, REP.key) + ' (' + thDate(req.from) + ' – ' + thDate(req.to) + ')' + (filtDesc() ? '\nตัวกรอง: ' + filtDesc() : '') + '\n\n' +
    '👥 ผู้ป่วยทั้งหมด ' + fmt(c.total, 0) + ' ราย · มีผู้ป่วย ' + c.openDays + ' วัน · เฉลี่ยวันทำการ ' + fmt(c.wd.n ? c.wd.vn / c.wd.n : 0) + ' ราย/วัน\n' +
    BY_TH[f.by] + 'สูงสุด: ' + rows.slice(0, 5).map(function (x) { return x.title + ' ' + fmt(x.v, 0); }).join(' · ') + '\n\n' +
    (REP.rights && REP.rights.days ? '💳 สิทธิ (ตามทะเบียน): ' + rgRows(REP.rights.sum.reg).map(function (x) { return x.name + ' ' + fmt(x.v, 0); }).join(' · ') + '\n' : '') +
    '💉 หัตถการ ' + fmt(c.procTotal, 0) + ' ครั้ง' + (filtActive() ? ' (ไม่แยกตามตัวกรอง)' : '') + ': ' + its.slice(0, 8).map(function (k) { return itemName(k) + ' ' + fmt(c.procs[k], 0); }).join(' · ') + '\n' +
    'Consult ' + fmt(c.other.consult, 0) + ' · Night OPD ' + fmt(c.other.nightOpd, 0) + ' · Admit ' + fmt(c.other.admit, 0);
}
function exportRep() {
  if (!REP.cur) return;
  var m = modal('ส่งออก Excel', '<p class="small" style="margin-top:0">ส่งออกตามช่วงเวลาและตัวกรองที่เลือกอยู่' + (filtDesc() ? ' (' + esc(filtDesc()) + ')' : '') + '</p><label class="row small" for="xcase"><input type="checkbox" id="xcase"> รวมรายชื่อผู้ป่วยส่งต่อ (ชื่อ/HN)</label>',
    '<button class="btn" data-close>ยกเลิก</button><button class="btn btn-brand" id="xgo">' + IC.xls + 'ส่งออก</button>', 'sm');
  $('#xgo', m).onclick = function () {
    var withCase = $('#xcase', m).checked, c = REP.cur, req = REP.req, f = filt();
    var job = Promise.all([loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'), withCase ? api('getCases', { from: req.from, to: req.to }) : null]).then(function (res) {
      var X = window.XLSX, wb = X.utils.book_new();
      var sum = [[ORG.system + ' ' + ORG.clinic], [periodLabel(REP.mode, REP.key)], ['ตั้งแต่', req.from, 'ถึง', req.to], ['ตัวกรอง', filtDesc() || 'ทั้งหมด'], [], ['ผู้ป่วยทั้งหมด', c.total], ['วันที่มีผู้ป่วย', c.openDays], ['วันทำการ', c.wd.n, 'ผู้ป่วย', c.wd.vn], ['วันหยุด', c.off.n, 'ผู้ป่วย', c.off.vn], ['หัตถการรวม (ทั้งคลินิกพิเศษ)', c.procTotal], ['Consult แผนกอื่น', c.other.consult], ['โอน Night OPD ชั้น 4', c.other.nightOpd], ['Admit', c.other.admit]];
      X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(sum), 'สรุป');
      if (groupsList().length) X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([['กลุ่มคลินิก', 'วันที่มีผู้ป่วย', 'ผู้ป่วย']].concat(anRows(c, 'group').map(function (x) { return [x.title, x.days, x.v]; }))), 'กลุ่มคลินิก');
      if (unitsList().length > 1) X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([['หน่วยงาน', 'วันที่มีผู้ป่วย', 'ผู้ป่วย']].concat(anRows(c, 'unit').map(function (x) { return [x.title, x.days, x.v]; }))), 'หน่วยงาน');
      X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([['รหัสคลินิก', 'คลินิก', 'หน่วยงาน', 'สถานที่', 'กลุ่ม', 'วันที่มีผู้ป่วย', 'ผู้ป่วย', 'เฉลี่ย/วัน']].concat(anRows(c, 'clinic').map(function (x) { return [x.id, clinicShort(x.id), unitName(clinicUnit(x.id)), clinicLoc(x.id), groupName(groupOf(x.id)), x.days, x.v, Math.round(x.v / (x.days || 1) * 10) / 10]; }))), 'คลินิก');
      var RS = REP.rights;
      if (RS && RS.days) {
        var s2 = RS.sum, gids = rgRows(Object.assign({}, s2.reg, s2.pay));
        X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([['กลุ่มสิทธิ', 'ตามทะเบียน', 'ที่ชำระจริง']].concat(gids.map(function (x) { return [x.name, s2.reg[x.id] || 0, s2.pay[x.id] || 0]; })).concat([[], ['สิทธิเดียว', s2.usage.single], ['สิทธิร่วม', s2.usage.combo], ['เงินสด (ไม่เปิดสิทธิ)', s2.usage.cash], ['ร่วมจ่ายเงินสด', s2.mixed]])), 'สิทธิ (กลุ่ม)');
        X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([['ชนิด', 'สิทธิ', 'กลุ่ม', 'ราย']].concat(Object.keys(s2.pt).map(function (k) { return ['สิทธิหลัก', rtName(k), rgName(rtGroup(k)), s2.pt[k]]; })).concat(Object.keys(s2.dt).map(function (k) { return ['สิทธิย่อย', rtName(k), '', s2.dt[k]]; })).concat(Object.keys(s2.inv).map(function (k) { return ['ที่ชำระ', rtName(k), '', s2.inv[k]]; })).concat(Object.keys(s2.combos).map(function (k) { return ['สิทธิร่วม', k, '', s2.combos[k]]; }))), 'สิทธิ (รายละเอียด)');
        var cg = rgRows(s2.reg).map(function (x) { return x.id; });
        X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([[BY_TH[f.by]].concat(cg.map(rgName)).concat(['รวม'])].concat(anRows(c, f.by).filter(function (x) { return RS.rows[x.id]; }).map(function (x) { var rr = RS.rows[x.id]; return [x.title].concat(cg.map(function (g) { return rr.reg[g] || 0; })).concat([rr.total]); }))), 'สิทธิตาม' + BY_TH[f.by]);
      }
      X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([['แพทย์', 'คลินิก', 'วันที่มีผู้ป่วย', 'ผู้ป่วย']].concat(anRows(c, 'doc').map(function (x) { return [x.title, x.sub, x.days, x.v]; }))), 'แพทย์');
      X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([['หัตถการ', 'ครั้ง']].concat(Object.keys(c.procs || {}).map(function (k) { return [itemName(k), c.procs[k]]; }))), 'หัตถการ');
      X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([['วันที่', 'ประเภทวัน', 'ผู้ป่วย']].concat(c.daily.map(function (x) { return [x[0], typeName(x[2]), x[1]]; }))), 'รายวัน');
      if (withCase && res[1]) X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([['วันที่', 'ประเภท', 'ชื่อ-สกุล', 'HN', 'อายุ', 'DX', 'Ward/หน่วยงาน', 'หมายเหตุ']].concat(res[1].rows.map(function (x) { return [x.date, CASE_T[x.type], x.name, x.hn, x.age, x.dx, x.dest, x.note]; }))), 'ผู้ป่วยส่งต่อ');
      X.writeFile(wb, 'SMC_Daily_' + req.from + '_' + req.to + '.xlsx');
      m.close(); toast('ส่งออก Excel แล้ว');
    });
    busy($('#xgo', m), job, 'กำลังสร้างไฟล์…').catch(function (e) { toast(e.message, true); });
  };
}
function printRep() {
  if (!REP.cur) return; var c = REP.cur, req = REP.req, f = filt(), rows = anRows(c, f.by);
  printHtml('<div class="paper"><h4>รายงาน' + ORG.clinic + ' · ' + esc(periodLabel(REP.mode, REP.key)) + '</h4><div class="dl">' + esc(thDate(req.from, false, true)) + ' – ' + esc(thDate(req.to, false, true)) + (filtDesc() ? '<br><span style="font-size:11px">ตัวกรอง: ' + esc(filtDesc()) + '</span>' : '') + '</div>' +
    '<table><tbody><tr><th>ผู้ป่วยทั้งหมด</th><td class="n">' + fmt(c.total, 0) + '</td><th>วันที่มีผู้ป่วย</th><td class="n">' + c.openDays + '</td><th>หัตถการรวม' + (filtActive() ? '*' : '') + '</th><td class="n">' + fmt(c.procTotal, 0) + '</td></tr>' +
    '<tr><th>Consult' + (filtActive() ? '*' : '') + '</th><td class="n">' + c.other.consult + '</td><th>Night OPD ชั้น 4' + (filtActive() ? '*' : '') + '</th><td class="n">' + c.other.nightOpd + '</td><th>Admit' + (filtActive() ? '*' : '') + '</th><td class="n">' + c.other.admit + '</td></tr></tbody></table><br>' +
    '<table><thead><tr><th>' + BY_TH[f.by] + '</th><th>วันที่มีผู้ป่วย</th><th>ผู้ป่วย</th><th>สัดส่วน</th></tr></thead><tbody>' + rows.slice(0, 40).map(function (x) { return '<tr><td>' + esc(x.title) + '</td><td class="n">' + x.days + '</td><td class="n">' + fmt(x.v, 0) + '</td><td class="n">' + fmt(x.v / (c.total || 1) * 100) + '%</td></tr>'; }).join('') + '</tbody></table><br>' +
    '<table><thead><tr><th>หัตถการ</th><th>ครั้ง</th></tr></thead><tbody>' + Object.keys(c.procs || {}).sort(function (a, b) { return c.procs[b] - c.procs[a]; }).map(function (k) { return '<tr><td>' + esc(itemName(k)) + '</td><td class="n">' + fmt(c.procs[k], 0) + '</td></tr>'; }).join('') + '</tbody></table>' +
    (filtActive() ? '<p style="font-size:10px;margin:4px 0 0">* ยอดรวมทั้งคลินิกพิเศษ ไม่แยกตามตัวกรอง</p>' : '') +
    '<div class="pfoot">' + ORG.system + ' · SMC Daily · พิมพ์ ' + esc(stampTh(nowStamp())) + '</div></div>');
}

/* =====================================================================
   แดชบอร์ด
   ===================================================================== */
var DASH = { mode: 'month', key: null, req: null };
function pageDash() {
  if (!DASH.key || DASH.mode === 'day') { DASH.mode = DASH.mode === 'day' ? 'month' : DASH.mode; DASH.key = defaultKey(DASH.mode); }
  var req = DASH.req = rangeReq(DASH); req.fy = fyOf(req.to);
  $('#main').innerHTML = banners() + '<div class="pagehead rise"><div><div class="eyebrow">แดชบอร์ด</div><h1>' + esc(periodLabel(DASH.mode, DASH.key)) + '</h1><div class="small muted">' + esc(thDate(req.from)) + ' – ' + esc(thDate(req.to)) + '</div></div><div class="row">' + helpBtn() + '</div></div>' +
    periodPicker(DASH, 'dp', true) + '<div id="dashBody"><div class="stats">' + [1, 2, 3, 4].map(function () { return '<div class="stat skel" style="height:104px"></div>'; }).join('') + '</div><div class="card skel" style="height:300px;margin-top:18px"></div></div>';
  bindPicker(DASH, 'dp', pageDash); bindHelp($('#main'));
  var key = DASH.mode + DASH.key, y = req.fy - 543;
  var a = (y - 2) + '-10-01'; if (req.prevFrom < a) a = req.prevFrom;
  anLoad(a, req.to > y + '-09-30' ? req.to : y + '-09-30').then(function () { if (S.page === 'dash' && DASH.mode + DASH.key === key) drawDash(); return anLoadRights(req.from, req.to); })
    .then(function () { if (S.page === 'dash' && DASH.mode + DASH.key === key) drawDash(); }).catch(function (e) { toast(e.message, true); });
}
function drawDash() {
  var box = $('#dashBody'), req = DASH.req; if (!box) return;
  var f = filt(), c = anAgg(req.from, req.to, f), p = anAgg(req.prevFrom, req.prevTo, f), okPrev = p.openDays > 0 && !p.nodata, by = f.by;
  var RR = ymList(req.from, req.to).every(function (ym) { return AN.rights[ym]; }) ? anRights(req.from, req.to, f, by) : null;
  var y = req.fy - 543, fs = (y - 1) + '-10-01', fe = y + '-09-30';
  var fyA = anAgg(fs, fe, f), fyB = anAgg((y - 2) + '-10-01', (y - 1) + '-09-30', f), mA = {}, mB = {};
  fyA.daily.forEach(function (x) { if (x[1] != null) { var k = x[0].slice(5, 7); mA[k] = (mA[k] || 0) + x[1]; } });
  fyB.daily.forEach(function (x) { if (x[1] != null) { var k = x[0].slice(5, 7); mB[k] = (mB[k] || 0) + x[1]; } });
  var fyBars = ['10', '11', '12', '01', '02', '03', '04', '05', '06', '07', '08', '09'].map(function (k) { return { label: TH_M[+k - 1], v: mA[k] || 0, ghost: mB[k] || 0, color: 'var(--c1)', tip: '<b>' + TH_MF[+k - 1] + '</b><br>ปีงบ ' + req.fy + ': ' + (k in mA ? fmt(mA[k], 0) + ' ราย' : 'ยังไม่มีข้อมูล') + (mB[k] ? '<br><span style="opacity:.75">ปีงบ ' + (req.fy - 1) + ': ' + fmt(mB[k], 0) + ' ราย</span>' : '') }; });
  var dmap = {}; fyA.daily.forEach(function (x) { dmap[x[0]] = x[1]; });
  var rows = anRows(c, by), second = by === 'doc' ? 'clinic' : 'doc', rows2 = anRows(c, second);
  var procs = Object.keys(c.procs || {}).map(function (k) { return [esc(itemName(k)), c.procs[k], itemName(k), 'var(--c3)']; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 10);
  var sy = scrollY;
  box.innerHTML = filterBar(req.from, req.to, drawDash) + (filtDesc() ? '<div class="fdesc">' + IC.filter + '<span>' + esc(filtDesc()) + '</span></div>' : '') +
    (c.nodata ? '<div class="banner warn">ยังไม่มียอดจากระบบโรงพยาบาล ' + c.nodata + ' วันในช่วงนี้</div>' : '') +
    statCards(c, p, DASH.mode, req.partial, okPrev) +
    '<div class="dash-grid" style="margin-top:18px">' + trendCard(c, 'lblD', 'wide') +
      '<section class="card rise d3"><div class="card-h"><h3><span class="ic">' + IC.tag + '</span>สัดส่วนผู้ป่วยตาม' + BY_TH[by] + '</h3><span class="small muted">กดชิ้นเพื่อกรอง</span></div><div class="card-b">' + donut(anDonut(rows, by), { aria: 'สัดส่วนตาม' + BY_TH[by] }) + '</div></section>' +
      '<section class="card rise d3"><div class="card-h"><h3><span class="ic">' + (by === 'doc' ? IC.users : IC.clinic) + '</span>Top 10 ' + BY_TH[by] + '</h3><span class="small muted">ผู้ป่วย (ราย)</span></div><div class="card-b">' + hbars(rows.slice(0, 10).map(function (x) { return [x.name, x.v, x.title, by === 'doc' ? 'var(--c1)' : x.color, x.pick]; })) + '</div></section>' +
      '<section class="card rise d4"><div class="card-h"><h3><span class="ic">' + (second === 'doc' ? IC.users : IC.clinic) + '</span>Top 10 ' + BY_TH[second] + '</h3><span class="small muted">ผู้ป่วย (ราย)</span></div><div class="card-b">' + hbars(rows2.slice(0, 10).map(function (x) { return [x.name, x.v, x.title, second === 'doc' ? 'var(--c1)' : x.color, x.pick]; })) + '</div></section>' +
      '<section class="card rise d4"><div class="card-h"><h3><span class="ic">' + IC.syringe + '</span>หัตถการ Top 10</h3>' + (procNote() || '<span class="small muted">ครั้ง</span>') + '</div><div class="card-b">' + hbars(procs) + '</div></section>' +
      (RR ? rightsCardHtml(RR, by, rows) : '') +
      '<section class="card wide rise d4"><div class="card-h"><h3><span class="ic">' + IC.dash + '</span>รายเดือน ปีงบ ' + req.fy + ' เทียบปีงบ ' + (req.fy - 1) + '</h3><div class="row"><div class="legend"><span><i style="background:var(--c1)"></i>ปีงบ ' + req.fy + '</span><span><i style="background:transparent;outline:1.5px dashed var(--muted)"></i>ปีงบ ' + (req.fy - 1) + '</span></div>' + labelsToggle('lblF') + '</div></div><div class="card-b">' + barChart(fyBars, { w: 900, h: 260, labels: labelsOn(), aria: 'ผู้ป่วยรายเดือนในปีงบ', maxLabels: 12 }) +
        '<p class="small muted" style="margin:8px 0 0">รวมปีงบ ' + req.fy + ' <b>' + fmt(fyA.total, 0) + '</b> ราย' + (fyB.total ? ' · ปีงบ ' + (req.fy - 1) + ' ' + fmt(fyB.total, 0) + ' ราย' : '') + (filtDesc() ? ' · ตามตัวกรอง' : '') + '</p></div></section>' +
      '<section class="card wide rise d5"><div class="card-h"><h3><span class="ic">' + IC.cal + '</span>ปฏิทินความหนาแน่น ปีงบ ' + req.fy + '</h3><span class="small muted">1 ช่อง = 1 วัน · ชี้เพื่อดูยอด</span></div><div class="card-b">' + heatmapHtml(fs, fe, function (d) { return d in dmap ? dmap[d] : null; }) + '</div></section>' +
    '</div>';
  bindFilterBar(); bindPicks(box); countUp(box); bindTips(box); bindRights(drawDash); bindPersons(c, req.from, req.to);
  ['lblD', 'lblF'].forEach(function (id) { var lb = $('#' + id); if (lb) lb.onchange = function () { store('chartLabels', lb.checked); drawDash(); }; });
  if (sy) window.scrollTo(0, sy);
}

/* =====================================================================
   ตั้งค่า (แอดมิน)
   ===================================================================== */
var SET = { tab: 'clinics', data: null };
function pageSet() {
  var tabs = [['clinics', 'คลินิก'], ['units', 'หน่วยงาน'], ['groups', 'กลุ่มคลินิก'], ['rights', 'สิทธิการรักษา'], ['items', 'หัตถการ'], ['pos', 'ตำแหน่งเจ้าหน้าที่'], ['users', 'ผู้ใช้และเครื่อง'], ['conn', 'การเชื่อมต่อ'], ['backfill', 'ข้อมูลย้อนหลัง'], ['sv', 'ส่งเวรตรวจการ'], ['recon', 'ทวนสอบรายวัน'], ['audit', 'ประวัติ']];
  $('#main').innerHTML = banners() + '<div class="pagehead rise"><div><div class="eyebrow">ตั้งค่า · แอดมิน</div><h1>' + tabs.filter(function (t) { return t[0] === SET.tab; })[0][1] + '</h1></div><div class="row">' + helpBtn() + '</div></div>' +
    '<div class="tabs" role="tablist">' + tabs.map(function (t) { return '<button role="tab" data-st="' + t[0] + '" aria-selected="' + (SET.tab === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div><section class="card rise d1" style="padding:18px" id="setBody"><div class="skel" style="height:240px"></div></section>';
  $$('[data-st]').forEach(function (b) { b.onclick = function () { SET.tab = b.getAttribute('data-st'); pageSet(); }; });
  bindHelp($('#main'));
  if (SET.tab === 'audit') return drawAudit();
  if (SET.tab === 'recon') return drawRecon();
  var ap = SET.tab === 'rights' || SET.tab === 'sv' ? { tab: 'rights' } : {};
  // ครั้งที่ 5: ข้อมูลจากเซิร์ฟเวอร์มาทีหลังแคช → วาดใหม่เฉพาะเมื่อข้อมูลต่าง และผู้ใช้ยังไม่ได้เริ่มแก้ (กันค่าที่กำลังแก้หาย)
  SET.dirty = false; var tab0 = SET.tab, shown = null;
  if (!SET.dirtyBound) { SET.dirtyBound = true; ['input', 'change'].forEach(function (ev) { document.addEventListener(ev, function (e) { if (S.page === 'set' && e.target && e.target.closest && e.target.closest('#main .card')) SET.dirty = true; }, true); }); }
  api('getAdmin', ap, { onCache: function (d) { SET.data = d; shown = JSON.stringify(d); drawSet(); } }).then(function (d) {
    var fresh = JSON.stringify(d); SET.data = d;
    if (S.page !== 'set' || SET.tab !== tab0 || fresh === shown) return;
    if (!SET.dirty) drawSet(); else toast('มีข้อมูลใหม่จากเซิร์ฟเวอร์ · บันทึกสิ่งที่แก้ก่อน แล้วระบบจะแสดงข้อมูลล่าสุด');
  }).catch(function (e) { toast(e.message, true); });
}
function refreshBoot() { return api('bootstrap', {}).then(function (b) { applyBoot(b); }); }
function saveBtn(id, label) { return '<div class="row" style="justify-content:flex-end;margin-top:14px"><span class="small muted" id="' + id + 'msg"></span><button class="btn btn-brand" id="' + id + '">' + (label || 'บันทึกการเปลี่ยนแปลง') + '</button></div>'; }
function drawSet() {
  var b = $('#setBody'), d = SET.data; if (!b || !d) return;
  var t = SET.tab;
  if (t === 'clinics') {
    var list = d.clinics.slice().sort(function (a, b2) { return (a.order - b2.order) || (b2.vn - a.vn); });
    var uopt = function (cur) { return '<option value="">— ยังไม่ระบุ —</option>' + d.units.map(function (u) { return '<option value="' + esc(u.id) + '"' + (cur === u.id ? ' selected' : '') + '>' + esc(u.name) + '</option>'; }).join(''); };
    var noUnit = list.filter(function (c) { return !c.unitId && c.show; }).length;
    b.innerHTML = '<p class="small muted" style="margin-top:0">คลินิกใหม่ที่ API ส่งมาจะเพิ่มเองและแสดงไว้ก่อน (สถานที่ตั้งจากชื่อกลุ่มของ API เช่น "ศ.บ่อวิน") · <b>ปิด</b> = ไม่แสดงและไม่นับทุกหน้า · <b>รวมแพทย์</b> = แสดงแพทย์ทุกท่านเป็นแถวเดียว (เช่น ห้องปฏิบัติการเจาะเลือดล่วงหน้า) · ลำดับว่าง = เรียงตามจำนวนผู้ป่วย</p>' +
      (noUnit ? '<div class="banner warn">' + IC.warn.replace('<svg', '<svg width="16" height="16"') + ' มี ' + noUnit + ' คลินิกที่ยังไม่ระบุหน่วยงาน (แสดงใน "ยังไม่ระบุหน่วยงาน")</div>' : '') +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>แสดง</th><th>รหัส</th><th>ชื่อย่อบนรายงาน</th><th>หน่วยงาน</th><th>สถานที่</th><th>รวมแพทย์</th><th>ชื่อจาก API</th><th class="num">ลำดับ</th><th class="num">ผู้ป่วยสะสม</th><th>พบล่าสุด</th></tr></thead><tbody>' +
      list.map(function (c) { return '<tr data-code="' + esc(c.code) + '"><td><label class="switch"><input type="checkbox" data-k="show"' + (c.show ? ' checked' : '') + ' aria-label="แสดง ' + esc(c.code) + '"><span></span></label></td><td><span class="code">' + esc(c.code) + '</span></td><td><input type="text" data-k="short" value="' + esc(c.short) + '" maxlength="40" style="width:150px" aria-label="ชื่อย่อ ' + esc(c.code) + '"></td>' +
        '<td><select data-k="unit" aria-label="หน่วยงาน ' + esc(c.code) + '">' + uopt(c.unitId) + '</select></td><td><input type="text" data-k="loc" value="' + esc(c.location) + '" placeholder="' + esc(c.locAuto) + '" maxlength="30" style="width:110px" aria-label="สถานที่ ' + esc(c.code) + '" title="เว้นว่าง = ใช้ค่าจาก API (' + esc(c.locAuto) + ')"></td>' +
        '<td><label class="switch"><input type="checkbox" data-k="merge"' + (c.merge ? ' checked' : '') + ' aria-label="รวมแพทย์ ' + esc(c.code) + '"><span></span></label></td>' +
        '<td class="small muted">' + esc(c.name) + '<br>' + esc(c.group) + '</td><td class="num"><input type="number" data-k="order" value="' + (c.order < 999 ? c.order : '') + '" style="width:64px" aria-label="ลำดับ ' + esc(c.code) + '"></td><td class="num">' + fmt(c.vn, 0) + '</td><td class="small muted">' + (c.last ? esc(thDate(c.last)) : '–') + '</td></tr>'; }).join('') + '</tbody></table></div>' + saveBtn('sv');
    $('#sv').onclick = function () {
      var out = $$('tr[data-code]', b).map(function (tr) { return { code: tr.getAttribute('data-code'), show: $('[data-k=show]', tr).checked, short: $('[data-k=short]', tr).value, order: $('[data-k=order]', tr).value, unitId: $('[data-k=unit]', tr).value, location: $('[data-k=loc]', tr).value, merge: $('[data-k=merge]', tr).checked }; });
      busy($('#sv'), api('saveClinics', { list: out, _rid: rid() }), 'กำลังบันทึก…').then(function (r) { toast('บันทึกแล้ว ' + r.saved + ' คลินิก'); forget('get'); return refreshBoot(); }).catch(function (e) { toast(e.message, true); });
    };
  } else if (t === 'units') {
    drawUnits(b, d);
  } else if (t === 'rights') {
    drawRightsSet(b, d);
  } else if (t === 'sv') {
    drawSvSet(b, d);
  } else if (t === 'groups') {
    drawGroups(b, d);
  } else if (t === 'items') {
    if (!SET.iunit || !d.units.some(function (u) { return u.id === SET.iunit; })) SET.iunit = (d.units[0] || { id: 'U1' }).id;
    var its = d.items.filter(function (i) { return i.unit === SET.iunit; }).sort(function (a, b2) { return a.order - b2.order; });
    var draw = function () {
      b.innerHTML = (d.units.length > 1 ? '<div class="row" style="margin-bottom:10px"><span class="small">รายการหัตถการของหน่วยงาน</span><div class="seg wrap">' + d.units.map(function (u) { return '<button data-iu2="' + esc(u.id) + '" aria-pressed="' + (u.id === SET.iunit) + '">' + esc(u.name) + ' <small>(' + d.items.filter(function (i) { return i.unit === u.id; }).length + ')</small></button>'; }).join('') + '</div></div>' : '') +
        '<p class="small muted" style="margin-top:0">แต่ละหน่วยงานมีรายการหัตถการของตัวเอง (ใช้วิเคราะห์ productivity) · ซ้าย/ขวา = คอลัมน์บนหน้าคีย์ · ปิด = ซ่อนจากหน้าคีย์ (ข้อมูลเก่ายังอยู่) · ใบรายงานแสดงเฉพาะรายการที่มียอด</p><div class="tbl-wrap"><table class="tbl"><thead><tr><th>ใช้งาน</th><th>รายการ</th><th>คอลัมน์</th><th>ลำดับ</th></tr></thead><tbody>' +
        its.map(function (i, ix) { return '<tr><td><label class="switch"><input type="checkbox" data-ia="' + ix + '"' + (i.active ? ' checked' : '') + ' aria-label="ใช้งาน ' + esc(i.name) + '"><span></span></label></td><td><input type="text" data-in="' + ix + '" value="' + esc(i.name) + '" maxlength="60" style="width:220px" aria-label="ชื่อรายการ"> ' + (i.custom ? '<span class="chip idle">เพิ่มเอง' + (i.createdBy ? ' · ' + esc(i.createdBy) : '') + '</span>' : '') + '</td>' +
          '<td><select data-ic="' + ix + '" aria-label="คอลัมน์"><option value="1"' + (i.col === 1 ? ' selected' : '') + '>ซ้าย</option><option value="2"' + (i.col === 2 ? ' selected' : '') + '>ขวา</option></select></td>' +
          '<td class="row"><button class="iconbtn" data-iu="' + ix + '" aria-label="เลื่อนขึ้น"' + (ix === 0 ? ' disabled' : '') + '>' + IC.up + '</button><button class="iconbtn" data-idn="' + ix + '" aria-label="เลื่อนลง"' + (ix === its.length - 1 ? ' disabled' : '') + '>' + IC.down + '</button></td></tr>'; }).join('') +
        '</tbody></table></div><div class="row" style="margin-top:12px"><input type="text" id="niName" placeholder="ชื่อรายการใหม่" maxlength="60" class="grow" aria-label="ชื่อรายการใหม่"><button class="btn" id="niAdd">' + IC.plus + 'เพิ่มรายการ</button></div>' + saveBtn('sv');
      $$('[data-ia]', b).forEach(function (x) { x.onchange = function () { its[+x.getAttribute('data-ia')].active = x.checked; }; });
      $$('[data-in]', b).forEach(function (x) { x.oninput = function () { its[+x.getAttribute('data-in')].name = x.value; }; });
      $$('[data-ic]', b).forEach(function (x) { x.onchange = function () { its[+x.getAttribute('data-ic')].col = +x.value; }; });
      $$('[data-iu]', b).forEach(function (x) { x.onclick = function () { var i = +x.getAttribute('data-iu'); var tmp = its[i]; its[i] = its[i - 1]; its[i - 1] = tmp; draw(); }; });
      $$('[data-idn]', b).forEach(function (x) { x.onclick = function () { var i = +x.getAttribute('data-idn'); var tmp = its[i]; its[i] = its[i + 1]; its[i + 1] = tmp; draw(); }; });
      $('#niAdd').onclick = function () { var nm = $('#niName').value.trim(); if (!nm) return; its.push({ id: '', name: nm, col: 2, active: true, custom: true }); draw(); };
      $$('[data-iu2]', b).forEach(function (x) { x.onclick = function () { SET.iunit = x.getAttribute('data-iu2'); drawSet(); }; });
      $('#sv').onclick = function () { busy($('#sv'), api('saveItems', { list: its, unit: SET.iunit, _rid: rid() }), 'กำลังบันทึก…').then(function (r) { toast('บันทึกแล้ว ' + r.saved + ' รายการ'); forget('getAdmin'); return refreshBoot().then(pageSet); }).catch(function (e) { toast(e.message, true); }); };
    };
    draw();
  } else if (t === 'pos') {
    var ps = d.positions.slice().sort(function (a, b2) { return a.order - b2.order; });
    var drawP = function () {
      b.innerHTML = '<p class="small muted" style="margin-top:0">ตำแหน่งของคลินิกพิเศษเฉพาะทางนอกเวลาจาก SMC Duty (ตำแหน่งใหม่จะเพิ่มเองตอนดึงตารางเวร) · เลือกที่จะแสดงในรายงาน · <b>หน่วยงาน</b> = รายชื่อตำแหน่งนี้ไปอยู่ในการ์ดเจ้าหน้าที่ของหน่วยงานนั้น · "ช่องคลินิก" = ให้ใส่คลินิกที่ประจำต่อท้ายชื่อ</p><div class="tbl-wrap"><table class="tbl"><thead><tr><th>แสดง</th><th>ชื่อย่อบนรายงาน</th><th>ตำแหน่งใน SMC Duty</th>' + (d.units.length > 1 ? '<th>หน่วยงาน</th>' : '') + '<th>ช่องคลินิก</th><th>ลำดับ</th></tr></thead><tbody>' +
        ps.map(function (p, ix) { return '<tr><td><label class="switch"><input type="checkbox" data-ps="' + ix + '"' + (p.show ? ' checked' : '') + ' aria-label="แสดง ' + esc(p.name) + '"><span></span></label></td><td><input type="text" data-pn="' + ix + '" value="' + esc(p.short) + '" maxlength="40" style="width:160px" aria-label="ชื่อย่อ"></td><td>' + esc(p.name) + ' <span class="xs muted">' + esc(p.id) + '</span></td>' + (d.units.length > 1 ? '<td><select data-pu2="' + ix + '" aria-label="หน่วยงานของ ' + esc(p.name) + '">' + d.units.map(function (u) { return '<option value="' + esc(u.id) + '"' + (p.unit === u.id ? ' selected' : '') + '>' + esc(u.name) + '</option>'; }).join('') + '</select></td>' : '') + '<td><label class="switch"><input type="checkbox" data-pc="' + ix + '"' + (p.clinicBox ? ' checked' : '') + ' aria-label="ช่องคลินิก ' + esc(p.name) + '"><span></span></label></td>' +
          '<td class="row"><button class="iconbtn" data-pu="' + ix + '" aria-label="เลื่อนขึ้น"' + (ix === 0 ? ' disabled' : '') + '>' + IC.up + '</button><button class="iconbtn" data-pd="' + ix + '" aria-label="เลื่อนลง"' + (ix === ps.length - 1 ? ' disabled' : '') + '>' + IC.down + '</button></td></tr>'; }).join('') + '</tbody></table></div>' + saveBtn('sv');
      $$('[data-ps]', b).forEach(function (x) { x.onchange = function () { ps[+x.getAttribute('data-ps')].show = x.checked; }; });
      $$('[data-pc]', b).forEach(function (x) { x.onchange = function () { ps[+x.getAttribute('data-pc')].clinicBox = x.checked; }; });
      $$('[data-pu2]', b).forEach(function (x) { x.onchange = function () { ps[+x.getAttribute('data-pu2')].unit = x.value; }; });
      $$('[data-pn]', b).forEach(function (x) { x.oninput = function () { ps[+x.getAttribute('data-pn')].short = x.value; }; });
      $$('[data-pu]', b).forEach(function (x) { x.onclick = function () { var i = +x.getAttribute('data-pu'), tmp = ps[i]; ps[i] = ps[i - 1]; ps[i - 1] = tmp; drawP(); }; });
      $$('[data-pd]', b).forEach(function (x) { x.onclick = function () { var i = +x.getAttribute('data-pd'), tmp = ps[i]; ps[i] = ps[i + 1]; ps[i + 1] = tmp; drawP(); }; });
      $('#sv').onclick = function () { busy($('#sv'), api('savePositions', { list: ps, _rid: rid() }), 'กำลังบันทึก…').then(function (r) { toast('บันทึกแล้ว ' + r.saved + ' ตำแหน่ง'); forget('getAdmin'); return refreshBoot(); }).catch(function (e) { toast(e.message, true); }); };
    };
    drawP();
  } else if (t === 'users') {
    var un = function (ids) { return (ids || []).map(function (id) { var u = d.units.filter(function (x) { return x.id === id; })[0]; return u ? u.name : id; }).join(', '); };
    b.innerHTML = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>ชื่อผู้ใช้</th><th>ชื่อที่แสดง</th><th>บทบาท</th><th>หน่วยงาน</th><th>ชื่อ/ตำแหน่งบนรายงาน</th><th>สถานะ</th><th>เข้าล่าสุด</th><th></th></tr></thead><tbody>' +
      d.users.map(function (u) { return '<tr><td class="tnum"><b>' + esc(u.username) + '</b></td><td>' + esc(u.name) + '</td><td><span class="chip ' + (u.role === 'admin' ? 'brand' : u.role === 'exec' ? 'off' : 'ok') + '">' + ROLE_TH[u.role] + '</span></td><td class="small">' + (u.units.length ? esc(un(u.units)) : '<span class="muted">ทุกหน่วยงาน</span>') + '</td><td class="small">' + esc(u.reportName || u.name) + (u.title ? '<br><span class="muted">' + esc(u.title) + '</span>' : (u.role === 'nurse' ? '<br><span class="chip warn">ยังไม่มีตำแหน่ง</span>' : '')) + '</td><td>' + (u.active ? (u.mustChange ? '<span class="chip warn">รอเปลี่ยนรหัส</span>' : '<span class="chip ok">ใช้งาน</span>') : '<span class="chip idle">ปิด</span>') + '</td><td class="small muted">' + esc(stampTh(u.lastLogin)) + '</td>' +
        '<td class="row"><button class="btn btn-sm" data-ue="' + esc(u.username) + '">แก้ไข</button><button class="btn btn-sm" data-ur="' + esc(u.username) + '">ตั้งรหัสใหม่</button></td></tr>'; }).join('') + '</tbody></table></div>' +
      '<div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn btn-brand" id="uadd">' + IC.plus + 'เพิ่มผู้ใช้</button></div>' +
      '<h4 class="subh">' + IC.shield.replace('<svg', '<svg width="16" height="16" style="vertical-align:-3px;margin-right:4px"') + 'เครื่องที่จำการเข้าสู่ระบบ</h4><p class="small muted" style="margin-top:0">เครื่องที่ติ๊ก "จำเครื่องนี้" (ผู้บริหารจำได้ 90 วัน ผู้ใช้อื่น 30 วัน) · <b>ยกเลิกเครื่อง</b> = ออกจากระบบทันทีและเข้าจากเครื่องนั้นไม่ได้ · ประวัติการเข้าใช้ดูที่แท็บ "ประวัติ"</p><div id="devBox"><div class="skel" style="height:80px"></div></div>';
    var userForm = function (u) {
      var isNew = !u; u = u || { username: '', name: '', role: 'nurse', active: true, units: [], title: '', reportName: '' };
      var m = modal(isNew ? 'เพิ่มผู้ใช้' : 'แก้ไขผู้ใช้ ' + esc(u.username), '<form id="uf" style="display:flex;flex-direction:column;gap:12px">' +
        '<label class="field" for="uu">ชื่อผู้ใช้ (a-z 0-9 . _ -)<input id="uu" type="text" value="' + esc(u.username) + '"' + (isNew ? '' : ' disabled') + ' required pattern="[a-zA-Z0-9._\\-]{3,30}"></label>' +
        '<label class="field" for="un">ชื่อที่แสดง<input id="un" type="text" value="' + esc(u.name) + '" maxlength="80" required></label>' +
        '<label class="field" for="ur">บทบาท<select id="ur"><option value="exec"' + (u.role === 'exec' ? ' selected' : '') + '>ผู้บริหาร — ดูรายงาน/แดชบอร์ด (ชื่อผู้ป่วยปิดบางส่วน)</option><option value="nurse"' + (u.role === 'nurse' ? ' selected' : '') + '>พยาบาล/เจ้าหน้าที่ — คีย์ข้อมูล</option><option value="admin"' + (u.role === 'admin' ? ' selected' : '') + '>แอดมิน — ทุกอย่าง</option></select></label>' +
        (d.units.length > 1 ? '<fieldset class="field"><span>หน่วยงานที่สังกัด (คีย์ได้เฉพาะหน่วยที่เลือก · ไม่เลือก = ทุกหน่วยงาน)</span><div class="row">' + d.units.map(function (x) { return '<label class="row small"><input type="checkbox" data-uu="' + esc(x.id) + '"' + (u.units.indexOf(x.id) >= 0 ? ' checked' : '') + '> ' + esc(x.name) + '</label>'; }).join('') + '</div></fieldset>' : '') +
        '<div class="g2"><label class="field" for="urn">ชื่อบนรายงาน (ผู้รายงาน)<input id="urn" type="text" value="' + esc(u.reportName) + '" maxlength="80" placeholder="เช่น พว.สมใจ ใจดี (เว้นว่าง = ชื่อที่แสดง)"></label>' +
        '<label class="field" for="utt">ตำแหน่ง<input id="utt" type="text" value="' + esc(u.title) + '" maxlength="80" placeholder="เช่น พยาบาลวิชาชีพชำนาญการ"></label></div>' +
        (isNew ? '' : '<label class="row small" for="ua"><input id="ua" type="checkbox"' + (u.active ? ' checked' : '') + '> เปิดใช้งาน</label>') +
        '<button class="btn btn-brand" type="submit" style="align-self:flex-end">บันทึก</button></form>', '', 'sm');
      $('#uf', m).onsubmit = function (e) {
        e.preventDefault();
        var units = $$('[data-uu]', m).filter(function (x) { return x.checked; }).map(function (x) { return x.getAttribute('data-uu'); });
        busy($('#uf button[type=submit]', m), api('saveUser', { username: $('#uu', m).value, name: $('#un', m).value, role: $('#ur', m).value, active: isNew ? true : $('#ua', m).checked, units: units, title: $('#utt', m).value, reportName: $('#urn', m).value, _rid: rid() }), 'กำลังบันทึก…').then(function (r) {
          m.close(); forget('getAdmin'); if (r.tempPassword) showTemp(r.username, r.tempPassword); else toast('บันทึกแล้ว'); pageSet();
        }).catch(function (err) { toast(err.message, true); });
      };
    };
    $('#uadd').onclick = function () { userForm(null); };
    $$('[data-ue]', b).forEach(function (x) { x.onclick = function () { userForm(d.users.filter(function (u) { return u.username === x.getAttribute('data-ue'); })[0]); }; });
    $$('[data-ur]', b).forEach(function (x) { x.onclick = function () {
      var u = x.getAttribute('data-ur'), m = modal('ตั้งรหัสผ่านใหม่', '<p>ตั้งรหัสผ่านชั่วคราวใหม่ให้ <b>' + esc(u) + '</b>? ผู้ใช้จะออกจากระบบทุกเครื่องและต้องเปลี่ยนรหัสตอนเข้าครั้งถัดไป</p>', '<button class="btn" data-close>ยกเลิก</button><button class="btn btn-brand" id="rpok">ตั้งรหัสใหม่</button>', 'sm');
      $('#rpok', m).onclick = function () { busy($('#rpok', m), api('resetPassword', { username: u, _rid: rid() }), 'กำลังตั้ง…').then(function (r) { m.close(); showTemp(r.username, r.tempPassword); }).catch(function (e) { toast(e.message, true); }); };
    }; });
    var drawDev = function () {
      api('getDevices', {}).then(function (r) {
        var box = $('#devBox'); if (!box) return;
        box.innerHTML = r.rows.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>บัญชี</th><th>ชื่อเครื่อง</th><th>อุปกรณ์</th><th class="num">เข้าระบบ</th><th>เห็นล่าสุด</th><th>เริ่มใช้</th><th></th></tr></thead><tbody>' +
          r.rows.map(function (x) { return '<tr' + (x.revoked ? ' class="hid"' : '') + '><td><b>' + esc(x.username) + '</b></td><td>' + (x.label ? esc(x.label) : '<span class="muted">ยังไม่ตั้งชื่อ</span>') + '</td><td class="small">' + esc(x.ua) + '</td><td class="num">' + x.count + '</td><td class="small muted">' + esc(stampTh(x.lastSeen)) + '</td><td class="small muted">' + esc(stampTh(x.createdAt)) + '</td><td>' + (x.revoked ? '<button class="btn btn-sm" data-dvr="' + esc(x.id) + '">คืนสิทธิ์</button>' : '<button class="btn btn-sm" data-dvx="' + esc(x.id) + '">ยกเลิกเครื่อง</button>') + '</td></tr>'; }).join('') + '</tbody></table></div>'
          : '<p class="small muted">ยังไม่มีเครื่องที่จำไว้</p>';
        $$('[data-dvx],[data-dvr]', box).forEach(function (bt) { bt.onclick = function () { var restore = bt.hasAttribute('data-dvr'); busy(bt, api('revokeDevice', { id: bt.getAttribute(restore ? 'data-dvr' : 'data-dvx'), restore: restore, _rid: rid() })).then(function () { toast(restore ? 'คืนสิทธิ์เครื่องแล้ว' : 'ยกเลิกเครื่องแล้ว · ออกจากระบบทันที'); drawDev(); }).catch(function (e) { toast(e.message, true); }); }; });
      }).catch(function (e) { var box = $('#devBox'); if (box) box.innerHTML = '<p class="small muted">' + esc(e.message) + '</p>'; });
    };
    drawDev();
  } else if (t === 'conn') {
    var c = d.conn;
    b.innerHTML = '<div style="display:flex;flex-direction:column;gap:14px;max-width:760px">' +
      '<label class="field" for="capi">ลิงก์ API ยอดผู้ป่วย ({date} = yyyyMMdd)<input id="capi" type="text" value="' + esc(c.apiUrl) + '"></label>' +
      '<label class="field" for="ctk">token ของ API (ไอทีให้) ' + (c.apiTokenSet ? '<span class="chip ok">ตั้งแล้ว</span>' : '<span class="chip idle">ยังไม่ใช้</span>') + '<input id="ctk" type="password" autocomplete="off" placeholder="' + (c.apiTokenSet ? 'เว้นว่าง = ใช้ token เดิม · พิมพ์ - (ขีด) = ลบ token' : 'วาง token เมื่อไอทีเปิดใช้') + '"></label>' +
      '<p class="xs muted" style="margin:-6px 0 0">token เก็บใน Script Properties ของ Apps Script (ไม่อยู่บนหน้าเว็บ/GitHub) · ระบบแนบให้ทุกครั้งที่เรียก API</p>' +
      '<div class="row"><button class="btn" id="tapi">' + IC.refresh + 'ทดสอบ API</button><span class="small" id="tapiR"></span></div><hr style="border:0;border-top:1px solid var(--line);width:100%">' +
      '<label class="field" for="cduty">ลิงก์ /exec ของ SMC Duty<input id="cduty" type="text" value="' + esc(c.smcDutyUrl) + '" placeholder="https://script.google.com/macros/s/…/exec"></label>' +
      '<label class="field" for="ckey">รหัสลับร่วมกับ SMC Duty (DAILY_FEED_KEY) ' + (c.dutyKeySet ? '<span class="chip ok">ตั้งแล้ว</span>' : '<span class="chip warn">ยังไม่ได้ตั้ง</span>') + '<input id="ckey" type="password" autocomplete="off" placeholder="' + (c.dutyKeySet ? 'เว้นว่าง = ใช้รหัสเดิม' : 'วางรหัสลับ') + '"></label>' +
      '<div class="row"><button class="btn btn-sm" id="gkey">' + IC.key + 'สร้างรหัสลับใหม่</button><span class="xs muted">สร้างแล้วนำไปวางในไฟล์ DailyFeed ของ SMC Duty ด้วย</span></div><div id="gkeyBox"></div>' +
      '<div class="row"><button class="btn" id="tduty">' + IC.refresh + 'ทดสอบ SMC Duty</button><button class="btn" id="scal">' + IC.cal + 'ซิงก์วันหยุดตอนนี้</button><span class="small" id="tdutyR"></span></div>' +
      '<dl class="kvlist"><dt>โหมด API</dt><dd>' + (c.apiModeCheckedAt ? (c.apiTodayOnly ? '<span class="chip warn">ส่งเฉพาะยอดวันนี้</span> <span class="xs muted">ระบบเก็บยอดวันนี้ทุก 30 นาที · ดึงย้อนหลังไม่ได้ ขอไอทีให้รับ search_st</span>' : '<span class="chip ok">รับวันที่ ดึงย้อนหลังได้</span>') + ' <span class="xs muted">ตรวจ ' + esc(stampTh(c.apiModeCheckedAt)) + '</span>' : '<span class="muted">ยังไม่ได้ตรวจ (กดทดสอบ API)</span>') + '</dd><dt>ซิงก์วันหยุดล่าสุด</dt><dd>' + esc(stampTh(c.calendarSyncedAt) || '–') + '</dd><dt>งานกลางคืนล่าสุด</dt><dd class="small">' + esc(c.lastNightly || '–') + '</dd><dt>เก็บยอดปิดวันล่าสุด</dt><dd class="small">' + esc(c.lastEvening || '–') + '</dd><dt>หลังบ้าน build</dt><dd>' + esc(d.build) + '</dd></dl><hr style="border:0;border-top:1px solid var(--line);width:100%">' +
      '<div class="g2"><label class="field" for="crd">ตรวจยอดซ้ำทุกคืน ย้อนหลัง (วัน)<input id="crd" type="number" min="1" max="31" value="' + esc(c.recheckDays) + '"></label>' +
      '<label class="field" for="cqf">งดดึงข้อมูลย้อนหลังช่วงหน้างาน<span class="row" style="flex-wrap:nowrap"><input id="cqf" type="number" min="0" max="23" value="' + esc(c.quietFrom) + '" style="width:80px"> : 00 ถึง <input id="cqt" type="number" min="0" max="24" value="' + esc(c.quietTo) + '" style="width:80px"> : 00 น.</span></label></div>' +
      '<p class="xs muted" style="margin:-6px 0 0">VN ที่ถูกยกเลิกย้อนหลัง: ระบบตรวจยอดซ้ำทุกคืนตอนตี 1:30 ตามจำนวนวันที่ตั้ง · ไฟล์ข้อมูลรายครั้งใน Drive ' + (c.vnLogFiles || 0) + ' ไฟล์ (แยกปีงบ ห้ามแชร์)</p><hr style="border:0;border-top:1px solid var(--line);width:100%">' +
      '<label class="field" for="clh">บรรทัดแรกของข้อความรายงาน<input id="clh" type="text" value="' + esc(c.lineHeader) + '" maxlength="120"></label>' +
      '<label class="field" for="crt">หัวกระดาษใบรายงาน<input id="crt" type="text" value="' + esc(c.reportTitle) + '" maxlength="160"></label>' +
      '<label class="field" for="cct">ข้อมูลติดต่อท้ายระบบ<input id="cct" type="text" value="' + esc(c.contactText || '') + '" maxlength="160" placeholder="เช่น เจ้าหน้าที่ประสานงาน โทรภายใน 13507"></label>' +
      '<label class="field" for="cmu">ลิงก์คู่มือการใช้งาน (ปุ่ม ? ในระบบ)<input id="cmu" type="text" value="' + esc(c.manualUrl || '') + '" maxlength="300" placeholder="https://…"></label>' +
      '<dl class="kvlist"><dt>ประวัติการแก้ไขที่เก็บถาวร</dt><dd>' + (c.auditArchived ? fmt(c.auditArchived, 0) + ' แถว · ไฟล์ "SMC Daily — ประวัติการแก้ไข (เก็บถาวร)" ใน Google Drive ของบัญชีคลินิก' : '<span class="muted">ยังไม่มี (ระบบย้ายเองเมื่อเกิน 20,000 แถว)</span>') + '</dd></dl></div>' + saveBtn('sv');
    var res = function (el, r) { $(el).innerHTML = r.ok ? '<span style="color:var(--ok)">✓ ' + r.text + '</span>' : '<span style="color:var(--bad)">✗ ' + esc(r.text) + '</span>'; };
    $('#tapi').onclick = function () { $('#tapiR').innerHTML = '<span class="muted">กำลังถาม API 2 วันที่ (วันนี้ + 7 วันก่อน)…</span>'; busy($('#tapi'), api('testApi', {}), 'กำลังทดสอบ…').then(function (r) { res('#tapiR', r.ok ? { ok: 1, text: 'วันนี้ผู้ป่วย ' + fmt(r.total, 0) + ' ราย · ' + esc(r.format) + (r.vns ? ' ' + fmt(r.vns, 0) + ' VN' : '') + ' (' + (r.ms / 1000).toFixed(1) + ' วิ) · ' + (r.todayOnly ? '⚠ API ส่งเฉพาะยอดวันนี้ ดึงย้อนหลังไม่ได้' : 'API รับวันที่ ดึงย้อนหลังได้') } : { text: r.error }); forget('getAdmin'); }).catch(function (e) { res('#tapiR', { text: e.message }); }); };
    $('#tduty').onclick = function () { $('#tdutyR').innerHTML = ''; busy($('#tduty'), api('testDuty', {}), 'กำลังทดสอบ…').then(function (r) { res('#tdutyR', r.ok ? { ok: 1, text: 'เชื่อมต่อได้ · วันนี้ ' + r.people + ' คนในตารางเวร · ' + r.positions + ' ตำแหน่ง' } : { text: r.error }); }).catch(function (e) { res('#tdutyR', { text: e.message }); }); };
    $('#scal').onclick = function () { busy($('#scal'), api('syncCalendar', {}), 'กำลังซิงก์…').then(function (r) { toast('ซิงก์วันหยุดแล้ว ' + r.days + ' วัน'); refreshBoot(); }).catch(function (e) { toast(e.message, true); }); };
    $('#gkey').onclick = function () { busy($('#gkey'), api('newDutyKey', {})).then(function (r) { $('#ckey').value = r.key; $('#gkeyBox').innerHTML = '<div class="secret">' + esc(r.key) + '</div><p class="xs muted">คัดลอกรหัสนี้ไปวางในไฟล์ DailyFeed ของ SMC Duty (บรรทัด var DAILY_FEED_KEY = \'…\') แล้วกดบันทึกด้านล่าง</p>'; }).catch(function (e) { toast(e.message, true); }); };
    $('#sv').onclick = function () {
      var p = { apiUrl: $('#capi').value, smcDutyUrl: $('#cduty').value, lineHeader: $('#clh').value, reportTitle: $('#crt').value, contactText: $('#cct').value, manualUrl: $('#cmu').value, recheckDays: $('#crd').value, quietFrom: $('#cqf').value, quietTo: $('#cqt').value, _rid: rid() };
      if ($('#ctk').value) p.apiToken = $('#ctk').value;
      if ($('#ckey').value) p.smcDutyKey = $('#ckey').value;
      busy($('#sv'), api('saveConnection', p), 'กำลังบันทึก…').then(function () { toast('บันทึกแล้ว'); forget('getAdmin'); refreshBoot().then(pageSet); }).catch(function (e) { toast(e.message, true); });
    };
  } else if (t === 'backfill') {
    var bf = d.backfill, span = bf.to ? datesIn(bf.from, bf.to).length : datesIn(bf.from, bf.today).length, run = bf.status === 'running' || bf.status === 'retry';
    var doneDays = run || bf.status === 'done' ? (bf.cursor && bf.to ? datesIn(bf.cursor < bf.from ? bf.from : bf.cursor, bf.to).length - (bf.cursor < bf.from ? 0 : 1) : bf.done) : 0, p2 = span ? Math.min(100, doneDays / span * 100) : 0;
    if (bf.status === 'done') p2 = 100;
    var st = bf.status === 'blocked' ? '<span class="chip warn">หยุดไว้: API ส่งเฉพาะยอดวันนี้</span>' : bf.status === 'done' ? '<span class="chip ok">' + IC.check + 'เสร็จแล้ว</span>' : bf.status === 'stopped' ? '<span class="chip idle">หยุดโดยแอดมิน</span>' : run ? '<span class="chip warn">' + IC.spin.replace('<svg', '<svg width="12" height="12"') + (bf.quiet ? ' พักช่วงหน้างาน' : ' กำลังดึง') + '</span>' : '<span class="chip idle">ยังไม่เริ่ม</span>';
    b.innerHTML = '<div style="display:flex;flex-direction:column;gap:14px;max-width:760px"><div class="row" style="justify-content:space-between"><b>' + (bf.mode === 'all' ? 'ดึงยอดใหม่ทั้งหมด (ตัดยอดยกเลิก + เก็บสิทธิการรักษา)' : 'ดึงยอดย้อนหลัง (เฉพาะวันที่ยังไม่มี)') + '</b>' + st + '</div>' +
      '<div class="progress" role="progressbar" aria-valuenow="' + Math.round(p2) + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + p2.toFixed(1) + '%"></i></div>' +
      '<dl class="kvlist"><dt>ช่วงที่สั่ง</dt><dd>' + esc(thDate(bf.from)) + ' – ' + esc(thDate(bf.to || bf.today)) + ' (' + fmt(span, 0) + ' วัน)</dd>' +
      (run ? '<dt>ทำถึงวันที่</dt><dd>' + esc(bf.cursor ? thDate(bf.cursor) : '–') + ' · ประมาณ ' + fmt(p2) + '%</dd>' : '') +
      '<dt>ดึงแล้วรอบนี้</dt><dd>' + fmt(bf.done, 0) + ' วัน · <b>ยอดเปลี่ยนจากเดิม ' + fmt(bf.changed, 0) + ' วัน</b> (เช่น VN ยกเลิก)</dd>' +
      '<dt>มีข้อมูลสิทธิแล้ว</dt><dd>' + fmt(bf.rightsDays, 0) + ' วัน · มียอดผู้ป่วย ' + fmt(bf.daysOk, 0) + ' วัน (เก่าสุด ' + esc(bf.firstDate ? thDate(bf.firstDate) : '–') + ')</dd>' +
      '<dt>ดึงไม่สำเร็จ (จะลองใหม่)</dt><dd>' + bf.errors + ' วัน</dd>' + (bf.startedAt ? '<dt>เริ่ม</dt><dd>' + esc(stampTh(bf.startedAt)) + (bf.doneAt && bf.status === 'done' ? ' · เสร็จ ' + esc(stampTh(bf.doneAt)) : '') + '</dd>' : '') + '</dl>' +
      (bf.status === 'blocked' ? '<div class="banner warn">API ของไอทีตอนนี้ส่งเฉพาะยอดวันนี้ จึงดึงย้อนหลังไม่ได้ · เมื่อไอทีแก้ ระบบตรวจพบเองตอนตี 1:30 แล้วดึงต่ออัตโนมัติ</div>' : '') +
      '<p class="small muted" style="margin:0">ทำเบื้องหลังทุก 10 นาที ครั้งละประมาณ 4 นาที · <b>งดช่วง ' + d.conn.quietFrom + ':00–' + d.conn.quietTo + ':00 น.</b> ไม่ให้หน่วงหน้างาน (ตั้งที่ แท็บการเชื่อมต่อ) · ไม่ต้องเปิดหน้านี้ค้างไว้</p>' +
      '<form class="bfform" id="bff"><label class="field" for="bfd">ตั้งแต่<input type="date" id="bfd" value="' + esc(bf.from) + '" min="2020-07-01" max="' + esc(bf.today) + '"></label><label class="field" for="bft">ถึง<input type="date" id="bft" value="' + esc(addDays(bf.today, -1)) + '" min="2020-07-01" max="' + esc(addDays(bf.today, -1)) + '"></label>' +
        '<label class="field" for="bfm">วิธี<select id="bfm"><option value="all">ดึงใหม่ทุกวัน (ตัดยอดยกเลิก + เก็บสิทธิ)</option><option value="fill">ดึงเฉพาะวันที่ยังไม่มีข้อมูล</option></select></label>' +
        '<button class="btn btn-brand" type="submit">' + IC.refresh + 'เริ่ม</button>' + (run ? '<button class="btn" type="button" id="bfstop">หยุด</button>' : '') + '</form>' +
      '<p class="xs muted" style="margin:0">ข้อมูลใน API เริ่มประมาณ ก.ค. 2563 · ดึงใหม่ทั้งหมดตั้งแต่ ต.ค. 2566 ใช้เวลาประมาณ 1–2 วัน (Apps Script จำกัดเวลาทำงานเบื้องหลังต่อวัน)</p></div>';
    $('#bff').onsubmit = function (e) { e.preventDefault(); busy($('#bff button[type=submit]'), api('startBackfill', { from: $('#bfd').value, to: $('#bft').value, mode: $('#bfm').value }), 'กำลังเริ่ม…').then(function (r) { toast('เริ่มแล้ว ' + fmt(r.days, 0) + ' วัน · ระบบทำต่อเบื้องหลัง'); forget('getAdmin'); pageSet(); }).catch(function (er) { toast(er.message, true); }); };
    var bstop = $('#bfstop'); if (bstop) bstop.onclick = function () { busy(bstop, api('stopBackfill', {})).then(function () { toast('หยุดแล้ว'); forget('getAdmin'); pageSet(); }).catch(function (er) { toast(er.message, true); }); };
  }
}
function showTemp(u, pw) { modal('รหัสผ่านชั่วคราว', '<p>ผู้ใช้ <b>' + esc(u) + '</b></p><div class="secret" style="font-size:1.3rem;text-align:center">' + esc(pw) + '</div><p class="small muted">แจ้งรหัสนี้ให้ผู้ใช้ทางช่องทางส่วนตัว · แสดงครั้งเดียว · ผู้ใช้ต้องเปลี่ยนรหัสตอนเข้าครั้งแรก</p>', '<button class="btn btn-brand" data-close>รับทราบ</button>', 'sm'); }
function drawAudit() {
  var b = $('#setBody'), kind = SET.akind || 'edit';
  b.innerHTML = '<div class="row" style="margin-bottom:12px"><div class="seg" role="group" aria-label="ชนิดประวัติ"><button data-ak="edit" aria-pressed="' + (kind === 'edit') + '">การแก้ไขข้อมูล</button><button data-ak="access" aria-pressed="' + (kind === 'access') + '">การเข้าใช้ (PDPA)</button></div></div><div id="audBox"><div class="skel" style="height:240px"></div></div>';
  $$('[data-ak]', b).forEach(function (x) { x.onclick = function () { SET.akind = x.getAttribute('data-ak'); drawAudit(); }; });
  api('getAudit', { limit: 300, kind: kind }).then(function (r) {
    var A = { CASE_ADD: 'เพิ่มผู้ป่วยส่งต่อ', CASE_EDIT: 'แก้ผู้ป่วยส่งต่อ', CASE_DEL: 'ลบผู้ป่วยส่งต่อ', GROUPS: 'กลุ่มคลินิก', UNITS: 'หน่วยงาน', RIGHTS: 'กลุ่มสิทธิ', PROC: 'หัตถการ', FIELD: 'ยอดอื่น', STAFF: 'เจ้าหน้าที่', ADD_ITEM: 'เพิ่มรายการ', CLINIC: 'คลินิก', ADD_USER: 'เพิ่มผู้ใช้', EDIT_USER: 'แก้ผู้ใช้', RESET_PASSWORD: 'ตั้งรหัสใหม่', CHANGE_PASSWORD: 'เปลี่ยนรหัส', CONNECTION: 'การเชื่อมต่อ', BACKFILL: 'ดึงย้อนหลัง', RECONCILE: 'ทวนสอบ', LOGIN: 'เข้าสู่ระบบ', VIEW: 'เปิดดู', REVEAL: 'เปิดดูชื่อ/HN', DEVICE: 'เครื่อง' };
    var box = $('#audBox'); if (!box || (SET.akind || 'edit') !== kind) return;
    box.innerHTML = r.rows.length ? '<div class="tbl-wrap" style="max-height:600px;overflow:auto"><table class="tbl"><thead><tr><th>เวลา</th><th>ผู้ใช้</th><th>เรื่อง</th><th>วันที่รายงาน</th><th>' + (kind === 'access' ? 'รายการ' : 'ช่อง') + '</th><th class="num">' + (kind === 'access' ? 'เครื่อง' : 'เดิม') + '</th><th class="num">' + (kind === 'access' ? 'รายละเอียด' : 'ใหม่') + '</th></tr></thead><tbody>' +
      r.rows.map(function (x) { return '<tr><td class="small tnum">' + esc(stampTh(x[0])) + '</td><td>' + esc(x[1]) + '</td><td><span class="chip ' + (x[2] === 'REVEAL' ? 'warn' : 'idle') + '">' + esc(A[x[2]] || x[2]) + '</span></td><td class="small">' + (x[3] ? esc(thDate(x[3])) : '') + '</td><td>' + esc(x[4]) + '</td><td class="num muted">' + esc(x[5] || '–') + '</td><td class="num">' + esc(x[6] || '–') + '</td></tr>'; }).join('') + '</tbody></table></div>'
      : '<div class="empty">' + IC.inbox + 'ยังไม่มีประวัติ</div>';
  }).catch(function (e) { toast(e.message, true); });
}

/* ---------- หน่วยงาน ---------- */
function drawUnits(b, d) {
  var units = d.units.map(function (u) { return { id: u.id, name: u.name, color: u.color, scope: u.scope, report: u.report || unitReportDef(u.id) }; });
  var assign = {}; d.clinics.forEach(function (c) { assign[c.code] = c.unitId || ''; });
  var q = '', onlyNone = false, tmp = 0;
  var draw = function () {
    var cnt = {}; Object.keys(assign).forEach(function (k) { cnt[assign[k]] = (cnt[assign[k]] || 0) + 1; });
    var cl = d.clinics.slice().sort(function (a, b2) { return b2.vn - a.vn; }).filter(function (c) { if (onlyNone && assign[c.code]) return false; return !q || (c.code + ' ' + c.short + ' ' + c.name + ' ' + (c.location || c.locAuto)).toLowerCase().indexOf(q.toLowerCase()) >= 0; });
    var opts = function (cur) { return '<option value="">— ยังไม่ระบุ —</option>' + units.map(function (u) { return '<option value="' + esc(u.id) + '"' + (cur === u.id ? ' selected' : '') + '>' + esc(u.name || '(ยังไม่ตั้งชื่อ)') + '</option>'; }).join(''); };
    b.innerHTML = '<p class="small muted" style="margin-top:0"><b>SMC</b> = ทั้งหมด · หน่วยงานย่อยตั้งเองได้ (เช่น คลินิกชั้น 3 · ชั้น 6 · รังสีวิทยา · ทันตกรรม · แผนไทย · ฝากครรภ์) · แต่ละหน่วยงานคีย์หัตถการ/ยอดอื่น/ผู้ป่วยส่งต่อ/เจ้าหน้าที่ของตัวเอง · โครงรายงาน: หน่วยงาน › กลุ่มคลินิก › คลินิก › แพทย์ (กรองตามสถานที่ได้)</p>' +
      '<div class="glist">' + units.map(function (u, i) {
        return '<div class="gitem"><div class="sw" role="group" aria-label="สีหน่วยงาน">' + PAL_HEX.map(function (h, k) { return '<button type="button" data-uc="' + i + '" data-hex="' + h + '" style="background:' + PAL[k] + '" aria-pressed="' + (String(u.color).toLowerCase() === h) + '" aria-label="สี ' + (k + 1) + '"></button>'; }).join('') + '</div>' +
          '<input type="text" data-un="' + i + '" value="' + esc(u.name) + '" maxlength="60" placeholder="ชื่อหน่วยงาน เช่น แผนไทย" aria-label="ชื่อหน่วยงาน">' +
          '<select data-us="' + i + '" aria-label="รูปแบบรายงานตั้งต้น" title="รูปแบบรายงานตั้งต้นเมื่อเจ้าหน้าที่หน่วยนี้จัดทำรายงาน">' + Object.keys(SCOPE_TH).map(function (k) { return '<option value="' + k + '"' + (u.scope === k ? ' selected' : '') + '>รายงาน: ' + SCOPE_TH[k] + '</option>'; }).join('') + '</select>' +
          '<span class="chip idle">' + (cnt[u.id] || 0) + ' คลินิก</span>' + (u.id === 'U1' ? '<span class="chip brand">หน่วยงานหลัก</span>' : '') +
          '<span class="row" style="flex-wrap:nowrap"><button class="iconbtn" data-uup="' + i + '" aria-label="เลื่อนขึ้น"' + (i === 0 ? ' disabled' : '') + '>' + IC.up + '</button><button class="iconbtn" data-udn="' + i + '" aria-label="เลื่อนลง"' + (i === units.length - 1 ? ' disabled' : '') + '>' + IC.down + '</button>' + (u.id === 'U1' ? '' : '<button class="iconbtn" data-ux="' + i + '" aria-label="ลบหน่วยงาน">' + IC.trash + '</button>') + '</span>' +
          '<div class="urep"><span class="xs muted">รายงานมาตรฐาน</span><select data-ulv="' + i + '" aria-label="ระดับรายละเอียดมาตรฐาน">' + REPORT_LEVELS.map(function (l) { return '<option value="' + l[0] + '"' + (u.report.level === l[0] ? ' selected' : '') + '>' + l[1] + '</option>'; }).join('') + '</select>' +
            REPORT_SECTIONS.map(function (s2) { return '<label class="row xs"><input type="checkbox" data-urs="' + i + '" data-k="' + s2[0] + '"' + (u.report[s2[0]] !== false ? ' checked' : '') + '> ' + esc(s2[1].replace(/ \(.*\)$/, '')) + '</label>'; }).join('') + '</div></div>';
      }).join('') + '</div>' +
      '<div class="row" style="margin:10px 0 18px"><button class="btn" id="uadd2">' + IC.plus + 'เพิ่มหน่วยงาน</button></div>' +
      '<div class="row" style="justify-content:space-between;margin-bottom:8px"><b>เลือกหน่วยงานให้คลินิก</b><div class="row"><input type="search" id="uq" placeholder="ค้นหาคลินิก/สถานที่" value="' + esc(q) + '" aria-label="ค้นหาคลินิก"><label class="row small" for="unone"><input type="checkbox" id="unone"' + (onlyNone ? ' checked' : '') + '> เฉพาะที่ยังไม่ระบุ</label></div></div>' +
      '<div class="tbl-wrap" style="max-height:520px;overflow:auto"><table class="tbl"><thead><tr><th>คลินิก</th><th>สถานที่</th><th>ชื่อจาก API</th><th class="num">ผู้ป่วยสะสม</th><th>หน่วยงาน</th></tr></thead><tbody>' +
      cl.map(function (c) { return '<tr><td><span class="code">' + esc(c.code) + '</span> ' + esc(c.short) + (c.show ? '' : ' <span class="chip idle">ซ่อน</span>') + '</td><td class="small">' + esc(c.location || c.locAuto) + '</td><td class="small muted">' + esc(c.name) + '</td><td class="num">' + fmt(c.vn, 0) + '</td><td><select data-ua="' + esc(c.code) + '" aria-label="หน่วยงานของ ' + esc(c.code) + '">' + opts(assign[c.code]) + '</select></td></tr>'; }).join('') + '</tbody></table></div>' + saveBtn('sv');
    $$('[data-un]', b).forEach(function (x) { x.oninput = function () { units[+x.getAttribute('data-un')].name = x.value; }; x.onchange = draw; });
    $$('[data-us]', b).forEach(function (x) { x.onchange = function () { units[+x.getAttribute('data-us')].scope = x.value; }; });
    $$('[data-ulv]', b).forEach(function (x) { x.onchange = function () { units[+x.getAttribute('data-ulv')].report.level = x.value; }; });
    $$('[data-urs]', b).forEach(function (x) { x.onchange = function () { units[+x.getAttribute('data-urs')].report[x.getAttribute('data-k')] = x.checked; }; });
    $$('[data-uc]', b).forEach(function (x) { x.onclick = function () { units[+x.getAttribute('data-uc')].color = x.getAttribute('data-hex'); draw(); }; });
    $$('[data-uup]', b).forEach(function (x) { x.onclick = function () { var i = +x.getAttribute('data-uup'), t2 = units[i]; units[i] = units[i - 1]; units[i - 1] = t2; draw(); }; });
    $$('[data-udn]', b).forEach(function (x) { x.onclick = function () { var i = +x.getAttribute('data-udn'), t2 = units[i]; units[i] = units[i + 1]; units[i + 1] = t2; draw(); }; });
    $$('[data-ux]', b).forEach(function (x) { x.onclick = function () { var u = units[+x.getAttribute('data-ux')]; units.splice(+x.getAttribute('data-ux'), 1); Object.keys(assign).forEach(function (k) { if (assign[k] === u.id) assign[k] = ''; }); draw(); toast('ลบหน่วยงาน "' + (u.name || '') + '" แล้ว (กดบันทึกเพื่อยืนยัน)'); }; });
    $('#uadd2', b).onclick = function () { var used = units.map(function (g) { return g.color; }), col = PAL_HEX.filter(function (h) { return used.indexOf(h) < 0; })[0] || PAL_HEX[units.length % 8]; units.push({ id: 'new' + (++tmp), name: '', color: col, scope: 'own', report: { level: 'inline', rights: true, procs: true, refer: true, staff: true } }); draw(); var ins = $$('[data-un]', b); if (ins.length) ins[ins.length - 1].focus(); };
    $('#uq', b).oninput = debounce(function (e) { q = e.target.value; draw(); var x = $('#uq', b); x.focus(); x.setSelectionRange(q.length, q.length); }, 250);
    $('#unone', b).onchange = function (e) { onlyNone = e.target.checked; draw(); };
    $$('[data-ua]', b).forEach(function (x) { x.onchange = function () { assign[x.getAttribute('data-ua')] = x.value; }; });
    $('#sv', b).onclick = function () {
      if (units.some(function (g) { return !String(g.name).trim(); })) return toast('กรุณาตั้งชื่อหน่วยงานให้ครบ', true);
      busy($('#sv', b), api('saveUnits', { units: units, assign: assign, _rid: rid() }), 'กำลังบันทึก…').then(function (r) {
        toast('บันทึกหน่วยงานแล้ว · ' + r.units.length + ' หน่วย · ย้าย ' + r.moved + ' คลินิก'); forget('getAdmin'); FILT = null; return refreshBoot().then(pageSet);
      }).catch(function (e) { toast(e.message, true); });
    };
  };
  draw();
}

/* ---------- กลุ่มสิทธิการรักษา ---------- */
function drawRightsSet(b, d) {
  var groups = d.rightGroups.map(function (g) { return { id: g.id, name: g.name, color: g.color, prio: g.prio, cash: g.cash }; });
  var assign = {}; d.rightTypes.forEach(function (r) { assign[r.id] = r.groupId || ''; });
  var cnt = d.rightCounts || {}, tmp = 0, kind = SET.rkind || 'pt';
  var draw = function () {
    var gc = {}; d.rightTypes.forEach(function (r) { if (r.kind === kind) gc[assign[r.id]] = (gc[assign[r.id]] || 0) + 1; });
    var types = d.rightTypes.filter(function (r) { return r.kind === kind; }).sort(function (a, b2) { return (cnt[b2.id] || 0) - (cnt[a.id] || 0); });
    var opts = function (cur) { return '<option value="">— ยังไม่จัดกลุ่ม —</option>' + groups.map(function (g) { return '<option value="' + esc(g.id) + '"' + (cur === g.id ? ' selected' : '') + '>' + esc(g.name || '(ยังไม่ตั้งชื่อ)') + '</option>'; }).join(''); };
    var none = d.rightTypes.filter(function (r) { return (r.kind === 'pt' || r.kind === 'inv') && !assign[r.id]; }).length;
    b.innerHTML = '<p class="small muted" style="margin-top:0">กลุ่มสิทธิใช้ทั้งหน้ารายงานประจำวัน ใบรายงาน รายงาน และแดชบอร์ด · <b>ย้ายสิทธิข้ามกลุ่มได้ทุกเมื่อ</b> ข้อมูลย้อนหลังคำนวณตามกลุ่มใหม่ทันที · สิทธิใหม่ที่ API ส่งมาจะจัดกลุ่มให้ตามชื่อ (ตรวจได้ที่นี่)</p>' +
      (none ? '<div class="banner warn">' + IC.warn.replace('<svg', '<svg width="16" height="16"') + ' มี ' + none + ' สิทธิที่ยังไม่จัดกลุ่ม</div>' : '') +
      '<div class="glist">' + groups.map(function (g, i) {
        return '<div class="gitem"><div class="sw" role="group" aria-label="สีกลุ่ม">' + PAL_HEX.map(function (h, k) { return '<button type="button" data-rc="' + i + '" data-hex="' + h + '" style="background:' + PAL[k] + '" aria-pressed="' + (String(g.color).toLowerCase() === h) + '" aria-label="สี ' + (k + 1) + '"></button>'; }).join('') + '</div>' +
          '<input type="text" data-rn="' + i + '" value="' + esc(g.name) + '" maxlength="60" placeholder="ชื่อกลุ่มสิทธิ" aria-label="ชื่อกลุ่มสิทธิ">' +
          '<label class="row xs" title="VN ที่มีสิทธินี้ร่วมด้วย นับเป็นกลุ่มนี้แทนสิทธิหลัก (เช่น ประกันชีวิต ตาม SmartPremium)"><input type="checkbox" data-rp="' + i + '"' + (g.prio ? ' checked' : '') + '> นับก่อนสิทธิหลัก</label>' +
          '<label class="row xs" title="กลุ่มของผู้ป่วยที่ไม่เปิดสิทธิ (จ่ายเงินสด)"><input type="radio" name="rcash" data-rk="' + i + '"' + (g.cash ? ' checked' : '') + '> กลุ่มเงินสด</label>' +
          '<span class="row" style="flex-wrap:nowrap"><button class="iconbtn" data-rup="' + i + '" aria-label="เลื่อนขึ้น"' + (i === 0 ? ' disabled' : '') + '>' + IC.up + '</button><button class="iconbtn" data-rdn="' + i + '" aria-label="เลื่อนลง"' + (i === groups.length - 1 ? ' disabled' : '') + '>' + IC.down + '</button><button class="iconbtn" data-rx="' + i + '" aria-label="ลบกลุ่ม">' + IC.trash + '</button></span></div>';
      }).join('') + '</div>' +
      '<div class="row" style="margin:10px 0 18px"><button class="btn" id="radd">' + IC.plus + 'เพิ่มกลุ่มสิทธิ</button></div>' +
      '<div class="row" style="justify-content:space-between;margin-bottom:8px"><b>จับคู่สิทธิ → กลุ่ม</b><div class="seg" role="group"><button data-rkd="pt" aria-pressed="' + (kind === 'pt') + '">สิทธิ (ทะเบียน)</button><button data-rkd="inv" aria-pressed="' + (kind === 'inv') + '">สิทธิที่ชำระ</button><button data-rkd="dt" aria-pressed="' + (kind === 'dt') + '">สิทธิย่อย</button></div></div>' +
      (kind === 'dt' ? '<p class="xs muted">สิทธิย่อยอยู่ในกลุ่มเดียวกับสิทธิหลักของมัน (แสดงเพื่อดูรายละเอียด)</p>' : '') +
      '<div class="tbl-wrap" style="max-height:520px;overflow:auto"><table class="tbl"><thead><tr><th>' + (kind === 'pt' ? 'สิทธิ' : kind === 'inv' ? 'สิทธิที่ชำระ' : 'สิทธิย่อย') + '</th>' + (kind === 'dt' ? '<th>สิทธิหลัก</th>' : '') + '<th class="num">VN 90 วัน</th><th>พบครั้งแรก</th>' + (kind !== 'dt' ? '<th>กลุ่ม</th>' : '') + '</tr></thead><tbody>' +
      types.map(function (r) { return '<tr><td>' + esc(r.name) + (r.auto && kind !== 'dt' ? ' <span class="chip idle" title="ระบบจัดกลุ่มให้อัตโนมัติ">อัตโนมัติ</span>' : '') + '</td>' + (kind === 'dt' ? '<td class="small">' + esc(r.parent) + '</td>' : '') + '<td class="num">' + fmt(cnt[r.id] || 0, 0) + '</td><td class="small muted">' + (r.firstSeen ? esc(thDate(r.firstSeen)) : '') + '</td>' + (kind !== 'dt' ? '<td><select data-ra="' + esc(r.id) + '" aria-label="กลุ่มของ ' + esc(r.name) + '">' + opts(assign[r.id]) + '</select></td>' : '') + '</tr>'; }).join('') +
      (types.length ? '' : '<tr><td colspan="5" class="muted">ยังไม่มีข้อมูลสิทธิ (ระบบเริ่มเก็บเมื่อ API ส่งสิทธิมา)</td></tr>') + '</tbody></table></div>' + saveBtn('sv');
    $$('[data-rn]', b).forEach(function (x) { x.oninput = function () { groups[+x.getAttribute('data-rn')].name = x.value; }; x.onchange = draw; });
    $$('[data-rp]', b).forEach(function (x) { x.onchange = function () { groups[+x.getAttribute('data-rp')].prio = x.checked; }; });
    $$('[data-rk]', b).forEach(function (x) { x.onchange = function () { groups.forEach(function (g, i) { g.cash = i === +x.getAttribute('data-rk'); }); }; });
    $$('[data-rc]', b).forEach(function (x) { x.onclick = function () { groups[+x.getAttribute('data-rc')].color = x.getAttribute('data-hex'); draw(); }; });
    $$('[data-rup]', b).forEach(function (x) { x.onclick = function () { var i = +x.getAttribute('data-rup'), t2 = groups[i]; groups[i] = groups[i - 1]; groups[i - 1] = t2; draw(); }; });
    $$('[data-rdn]', b).forEach(function (x) { x.onclick = function () { var i = +x.getAttribute('data-rdn'), t2 = groups[i]; groups[i] = groups[i + 1]; groups[i + 1] = t2; draw(); }; });
    $$('[data-rx]', b).forEach(function (x) { x.onclick = function () { var g = groups[+x.getAttribute('data-rx')]; groups.splice(+x.getAttribute('data-rx'), 1); Object.keys(assign).forEach(function (k) { if (assign[k] === g.id) assign[k] = ''; }); draw(); toast('ลบกลุ่ม "' + (g.name || '') + '" แล้ว (กดบันทึกเพื่อยืนยัน)'); }; });
    $$('[data-rkd]', b).forEach(function (x) { x.onclick = function () { kind = SET.rkind = x.getAttribute('data-rkd'); draw(); }; });
    $('#radd', b).onclick = function () { var used = groups.map(function (g) { return g.color; }), col = PAL_HEX.filter(function (h) { return used.indexOf(h) < 0; })[0] || PAL_HEX[groups.length % 8]; groups.push({ id: 'new' + (++tmp), name: '', color: col, prio: false, cash: false }); draw(); var ins = $$('[data-rn]', b); if (ins.length) ins[ins.length - 1].focus(); };
    $$('[data-ra]', b).forEach(function (x) { x.onchange = function () { assign[x.getAttribute('data-ra')] = x.value; }; });
    $('#sv', b).onclick = function () {
      if (groups.some(function (g) { return !String(g.name).trim(); })) return toast('กรุณาตั้งชื่อกลุ่มให้ครบ', true);
      busy($('#sv', b), api('saveRights', { groups: groups, assign: assign, _rid: rid() }), 'กำลังบันทึก…').then(function (r) {
        toast('บันทึกแล้ว · ' + r.groups + ' กลุ่ม · ย้าย ' + r.moved + ' สิทธิ'); forget('getAdmin'); FILT = null; return refreshBoot().then(pageSet);
      }).catch(function (e) { toast(e.message, true); });
    };
  };
  draw();
}

/* ---------- ทวนสอบรายวัน (ดึงสดจากระบบ รพ. · HN ปิดบางหลัก · ไม่เก็บลงฐานข้อมูล) ---------- */
function drawRecon() {
  var b = $('#setBody'), date = SET.rdate || addDays(S.boot.today, -1);
  b.innerHTML = '<div class="row" style="margin-bottom:12px"><label class="field" for="rcd" style="min-width:180px">วันที่<input type="date" id="rcd" value="' + esc(date) + '" max="' + S.boot.today + '"></label><button class="btn btn-brand" id="rcgo" style="align-self:flex-end">' + IC.refresh + 'ดึงข้อมูลทวนสอบ</button></div>' +
    '<p class="small muted" style="margin-top:0">ดึงข้อมูลราย VN จาก API ของโรงพยาบาลสด ๆ เทียบกับยอดที่เก็บในระบบ · HN แสดงแบบปิดบางหลัก · ไม่บันทึกข้อมูลรายคนลงฐานข้อมูล · บันทึกประวัติการเปิดดู</p><div id="rcBox"></div>';
  var run = function () {
    date = SET.rdate = $('#rcd').value || date;
    busy($('#rcgo'), api('reconcileDay', { date: date }), 'กำลังดึง…').then(function (r) { SET.recon = r; drawReconResult(r); }).catch(function (e) { toast(e.message, true); });
  };
  $('#rcgo').onclick = run;
  if (SET.recon && SET.recon.date === date) drawReconResult(SET.recon);
}
function drawReconResult(r) {
  var box = $('#rcBox'); if (!box) return;
  var s = r.summary, ok = s.storedTotal === s.liveTotal, q = SET.rq || '';
  var mains = {}; r.vns.forEach(function (v) { mains[v.main] = (mains[v.main] || 0) + 1; });
  var rows = r.vns.filter(function (v) { return !q || (v.vn + ' ' + v.hn + ' ' + v.clinic + ' ' + v.doc + ' ' + v.main + ' ' + v.dt + ' ' + v.secs.join(' ') + ' ' + v.invs.join(' ')).toLowerCase().indexOf(q.toLowerCase()) >= 0; });
  box.innerHTML = '<div class="stats" style="margin-bottom:14px">' +
    '<div class="stat"><span class="lb">' + IC.users + 'VN (ครั้ง)</span><span class="v">' + fmt(s.vns != null ? s.vns : s.liveTotal, 0) + '<small>ครั้ง</small></span><span class="d muted">' + fmt(s.rows, 0) + ' แถวจาก API · ' + fmt(s.persons, 0) + ' คน</span></div>' +
    '<div class="stat"><span class="lb">' + IC.check.replace('class="ck" ', '') + 'เทียบยอดในระบบ</span><span class="v" style="color:' + (ok ? 'var(--ok)' : 'var(--warn)') + '">' + (s.storedTotal == null ? '–' : fmt(s.storedTotal, 0)) + '<small>ราย</small></span><span class="d ' + (ok ? 'muted' : 'down') + '">' + (ok ? 'ตรงกับ API ตอนนี้' : 'API ตอนนี้ ' + fmt(s.liveTotal, 0) + ' · ต่าง ' + fmt(s.liveTotal - (s.storedTotal || 0), 0)) + (s.storedAt ? ' · เก็บ ' + esc(stampTh(s.storedAt)) : '') + '</span></div>' +
    '<div class="stat"><span class="lb">' + IC.card + 'ตรวจความครบ</span><span class="v" style="font-size:1.1rem;line-height:1.5">ไม่มีสิทธิหลัก ' + s.noMain + '<br>ชำระหลายสิทธิ ' + s.multiInvoice + '</span><span class="d muted">ยังไม่มีค่าใช้จ่าย ' + s.noInvoice + ' · มาซ้ำ ' + s.repeat + ' คน</span></div></div>' +
    (r.clinicDiff.length ? '<div class="banner warn">ยอดรายคลินิกต่างจากที่เก็บในระบบ: ' + r.clinicDiff.map(function (x) { return esc(x[0]) + ' ' + (x[1] == null ? '–' : x[1]) + '→' + x[2]; }).join(' · ') + ' · กด "อัปเดตเดี๋ยวนี้" ในหน้ารายงานประจำวันของวันนั้นเพื่อเก็บยอดใหม่</div>' : '') +
    '<p class="small" style="margin:0 0 8px">สิทธิหลัก: ' + Object.keys(mains).sort(function (a, b2) { return mains[b2] - mains[a]; }).map(function (k) { return esc(k) + ' ' + mains[k]; }).join(' · ') + '</p>' +
    '<div class="row" style="justify-content:space-between;margin-bottom:8px"><input type="search" id="rcq" placeholder="ค้นหา VN / คลินิก / แพทย์ / สิทธิ" value="' + esc(q) + '" style="min-width:240px"><button class="btn" id="rcx">' + IC.xls + 'ส่งออก Excel</button></div>' +
    '<div class="tbl-wrap" style="max-height:520px;overflow:auto"><table class="tbl xs"><thead><tr><th>VN</th><th>HN</th><th>คลินิก</th><th>แพทย์</th><th>สิทธิหลัก</th><th>สิทธิย่อย</th><th>สิทธิรอง</th><th>สิทธิที่ชำระ</th><th class="num">แถว</th></tr></thead><tbody>' +
    rows.slice(0, 1500).map(function (v) { return '<tr' + (v.hidden ? ' class="hid"' : '') + '><td class="tnum">' + esc(v.vn) + '</td><td class="tnum">' + esc(v.hn) + '</td><td><span class="code">' + esc(v.clinic) + '</span></td><td>' + esc(v.doc) + '</td><td>' + esc(v.main) + '</td><td>' + esc(v.dt) + '</td><td>' + esc(v.secs.join(' + ')) + '</td><td>' + (v.invs.length ? esc(v.invs.join(' + ')) : '<span class="muted">ยังไม่มี</span>') + '</td><td class="num">' + v.rows + '</td></tr>'; }).join('') + '</tbody></table></div>';
  $('#rcq').oninput = debounce(function (e) { SET.rq = e.target.value; drawReconResult(r); var x = $('#rcq'); x.focus(); x.setSelectionRange(SET.rq.length, SET.rq.length); }, 250);
  $('#rcx').onclick = function () {
    busy($('#rcx'), loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js').then(function () {
      var X = window.XLSX, wb = X.utils.book_new();
      X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([['วันที่', r.date], ['แถวจาก API', s.rows], ['VN', s.vns], ['คน (HN)', s.persons], ['ยอดในระบบ', s.storedTotal], ['ยอด API ตอนนี้', s.liveTotal], ['ไม่มีสิทธิหลัก', s.noMain], ['ชำระหลายสิทธิ', s.multiInvoice], ['ยังไม่มีค่าใช้จ่าย', s.noInvoice]]), 'สรุป');
      X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([['VN', 'HN (ปิดบางหลัก)', 'คลินิก', 'แพทย์', 'สิทธิหลัก', 'สิทธิย่อย', 'สิทธิรอง', 'สิทธิที่ชำระ', 'แถวใน API']].concat(r.vns.map(function (v) { return [v.vn, v.hn, v.clinic, v.doc, v.main, v.dt, v.secs.join(' + '), v.invs.join(' + '), v.rows]; }))), 'ราย VN');
      X.writeFile(wb, 'SMC_Daily_ทวนสอบ_' + r.date + '.xlsx');
    }), 'กำลังสร้างไฟล์…').catch(function (e) { toast(e.message, true); });
  };
}

/* ---------- กลุ่มคลินิก ---------- */
function drawGroups(b, d) {
  var groups = d.groups.map(function (g) { return { id: g.id, name: g.name, color: g.color }; });
  var assign = {}; d.clinics.forEach(function (c) { assign[c.code] = c.groupId || ''; });
  var q = '', onlyNone = false, tmp = 0, sel = {};
  var draw = function () {
    var cnt = {}; Object.keys(assign).forEach(function (k) { cnt[assign[k]] = (cnt[assign[k]] || 0) + 1; });
    var cl = d.clinics.slice().sort(function (a, b2) { return b2.vn - a.vn; }).filter(function (c) {
      if (onlyNone && assign[c.code]) return false;
      return !q || (c.code + ' ' + c.short + ' ' + c.name).toLowerCase().indexOf(q.toLowerCase()) >= 0;
    });
    var opts = function (cur) { return '<option value="">— ยังไม่จัดกลุ่ม —</option>' + groups.map(function (g) { return '<option value="' + esc(g.id) + '"' + (cur === g.id ? ' selected' : '') + '>' + esc(g.name || '(ยังไม่ตั้งชื่อ)') + '</option>'; }).join(''); };
    b.innerHTML = '<p class="small muted" style="margin-top:0">สร้างกลุ่มเพื่อใช้กรองและสรุปในหน้ารายงาน/แดชบอร์ด · 1 คลินิกอยู่ได้ 1 กลุ่ม · สีของกลุ่มใช้ในกราฟทุกหน้า</p>' +
      '<div class="glist">' + (groups.length ? groups.map(function (g, i) {
        return '<div class="gitem"><div class="sw" role="group" aria-label="สีกลุ่ม">' + PAL_HEX.map(function (h, k) { return '<button type="button" data-gc="' + i + '" data-hex="' + h + '" style="background:' + PAL[k] + '" aria-pressed="' + (String(g.color).toLowerCase() === h) + '" aria-label="สี ' + (k + 1) + '"></button>'; }).join('') + '</div>' +
          '<input type="text" data-gn="' + i + '" value="' + esc(g.name) + '" maxlength="60" placeholder="ชื่อกลุ่ม เช่น ศัลยกรรม" aria-label="ชื่อกลุ่ม">' +
          '<span class="chip idle">' + (cnt[g.id] || 0) + ' คลินิก</span>' +
          '<span class="row" style="flex-wrap:nowrap"><button class="iconbtn" data-gu="' + i + '" aria-label="เลื่อนขึ้น"' + (i === 0 ? ' disabled' : '') + '>' + IC.up + '</button><button class="iconbtn" data-gd="' + i + '" aria-label="เลื่อนลง"' + (i === groups.length - 1 ? ' disabled' : '') + '>' + IC.down + '</button><button class="iconbtn" data-gx="' + i + '" aria-label="ลบกลุ่ม">' + IC.trash + '</button></span></div>';
      }).join('') : '<div class="empty" style="padding:14px">' + IC.tag + 'ยังไม่มีกลุ่ม · กด "เพิ่มกลุ่ม" เพื่อเริ่ม</div>') + '</div>' +
      '<div class="row" style="margin:10px 0 18px"><button class="btn" id="gadd">' + IC.plus + 'เพิ่มกลุ่ม</button></div>' +
      '<div class="row" style="justify-content:space-between;margin-bottom:8px"><b>เลือกกลุ่มให้คลินิก</b><div class="row"><input type="search" id="gq" placeholder="ค้นหาคลินิก" value="' + esc(q) + '" aria-label="ค้นหาคลินิก"><label class="row small" for="gnone"><input type="checkbox" id="gnone"' + (onlyNone ? ' checked' : '') + '> เฉพาะที่ยังไม่จัดกลุ่ม</label></div></div>' +
      '<div class="row gbulk"><span class="small muted">เลือกหลายคลินิกแล้วย้ายพร้อมกัน:</span><select id="gbsel" aria-label="ย้ายไปกลุ่ม">' + opts('') + '</select><button class="btn btn-sm" id="gbgo">ย้ายที่เลือก (' + Object.keys(sel).length + ')</button></div>' +
      '<div class="tbl-wrap" style="max-height:520px;overflow:auto"><table class="tbl"><thead><tr><th><input type="checkbox" id="gall" aria-label="เลือกทั้งหมดที่เห็น"></th><th>คลินิก</th><th>ชื่อจาก API</th><th class="num">ผู้ป่วยสะสม</th><th>กลุ่ม</th></tr></thead><tbody>' +
      cl.map(function (c) { return '<tr><td><input type="checkbox" data-gsel="' + esc(c.code) + '"' + (sel[c.code] ? ' checked' : '') + ' aria-label="เลือก ' + esc(c.code) + '"></td><td><span class="code">' + esc(c.code) + '</span> ' + esc(c.short) + (c.show ? '' : ' <span class="chip idle">ซ่อน</span>') + '</td><td class="small muted">' + esc(c.name) + '</td><td class="num">' + fmt(c.vn, 0) + '</td><td><select data-ga="' + esc(c.code) + '" aria-label="กลุ่มของ ' + esc(c.code) + '">' + opts(assign[c.code]) + '</select></td></tr>'; }).join('') +
      '</tbody></table></div>' + saveBtn('sv');
    $$('[data-gn]', b).forEach(function (x) { x.oninput = function () { groups[+x.getAttribute('data-gn')].name = x.value; }; x.onchange = draw; });
    $$('[data-gc]', b).forEach(function (x) { x.onclick = function () { groups[+x.getAttribute('data-gc')].color = x.getAttribute('data-hex'); draw(); }; });
    $$('[data-gu]', b).forEach(function (x) { x.onclick = function () { var i = +x.getAttribute('data-gu'), t2 = groups[i]; groups[i] = groups[i - 1]; groups[i - 1] = t2; draw(); }; });
    $$('[data-gd]', b).forEach(function (x) { x.onclick = function () { var i = +x.getAttribute('data-gd'), t2 = groups[i]; groups[i] = groups[i + 1]; groups[i + 1] = t2; draw(); }; });
    $$('[data-gx]', b).forEach(function (x) { x.onclick = function () { var g = groups[+x.getAttribute('data-gx')]; groups.splice(+x.getAttribute('data-gx'), 1); Object.keys(assign).forEach(function (k) { if (assign[k] === g.id) assign[k] = ''; }); draw(); toast('ลบกลุ่ม "' + (g.name || '') + '" แล้ว (กดบันทึกเพื่อยืนยัน)'); }; });
    $('#gadd', b).onclick = function () { var used = groups.map(function (g) { return g.color; }), col = PAL_HEX.filter(function (h) { return used.indexOf(h) < 0; })[0] || PAL_HEX[groups.length % 8]; groups.push({ id: 'new' + (++tmp), name: '', color: col }); draw(); var ins = $$('[data-gn]', b); if (ins.length) ins[ins.length - 1].focus(); };
    $('#gq', b).oninput = debounce(function (e) { q = e.target.value; draw(); var x = $('#gq', b); x.focus(); x.setSelectionRange(q.length, q.length); }, 250);
    $('#gnone', b).onchange = function (e) { onlyNone = e.target.checked; draw(); };
    $$('[data-ga]', b).forEach(function (x) { x.onchange = function () { assign[x.getAttribute('data-ga')] = x.value; }; });
    var upd = function () { $('#gbgo', b).textContent = 'ย้ายที่เลือก (' + Object.keys(sel).length + ')'; };
    $$('[data-gsel]', b).forEach(function (x) { x.onchange = function () { if (x.checked) sel[x.getAttribute('data-gsel')] = 1; else delete sel[x.getAttribute('data-gsel')]; upd(); }; });
    $('#gall', b).onchange = function (e) { $$('[data-gsel]', b).forEach(function (x) { x.checked = e.target.checked; if (e.target.checked) sel[x.getAttribute('data-gsel')] = 1; else delete sel[x.getAttribute('data-gsel')]; }); upd(); };
    $('#gbgo', b).onclick = function () { var to = $('#gbsel', b).value, n = Object.keys(sel).length; if (!n) return toast('ยังไม่ได้เลือกคลินิก', true); Object.keys(sel).forEach(function (k) { assign[k] = to; }); sel = {}; draw(); toast('ย้าย ' + n + ' คลินิกแล้ว (กดบันทึกเพื่อยืนยัน)'); };
    $('#sv', b).onclick = function () {
      if (groups.some(function (g) { return !String(g.name).trim(); })) return toast('กรุณาตั้งชื่อกลุ่มให้ครบ', true);
      busy($('#sv', b), api('saveGroups', { groups: groups, assign: assign, _rid: rid() }), 'กำลังบันทึก…').then(function (r) {
        toast('บันทึกกลุ่มแล้ว · ' + r.groups.length + ' กลุ่ม · ย้าย ' + r.moved + ' คลินิก'); forget('getAdmin'); FILT = null; return refreshBoot().then(pageSet);
      }).catch(function (e) { toast(e.message, true); });
    };
  };
  draw();
}
