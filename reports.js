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
function procNote() { return filtActive() ? '<span class="chip idle" title="หัตถการและยอดอื่น ๆ คีย์เป็นยอดรวมทั้งวัน จึงไม่แยกตามคลินิก/แพทย์">ยอดรวมทั้งคลินิกพิเศษ ไม่แยกตามตัวกรอง</span>' : ''; }
function statCards(c, p, mode, partial, okPrev) {
  var wdAvg = c.wd.n ? c.wd.vn / c.wd.n : 0, pwd = p && p.wd.n ? p.wd.vn / p.wd.n : null;
  var spark = c.daily.slice(-30).map(function (x) { return x[1]; });
  return '<div class="stats">' +
    '<div class="stat rise d1"><span class="lb">' + IC.users + 'ผู้ป่วยทั้งหมด</span><span class="v"><span data-count="' + c.total + '">0</span><small>ราย</small></span>' + deltaHtml(c.total, p && p.total, mode, okPrev, partial) + miniLine(spark) + '</div>' +
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
  anLoad(req.prevFrom < req.from ? req.prevFrom : req.from, req.to).then(function () { if (S.page === 'rep' && REP.mode + REP.key === key) drawRep(); }).catch(function (e) { toast(e.message, true); });
  $('#rxls').onclick = function () { exportRep(); };
  $('#rprint').onclick = function () { printRep(); };
  $('#rline').onclick = function () { if (!REP.cur) return; var m = modal('สรุปส่งไลน์', '<pre class="linetxt" id="rtx">' + esc(repText()) + '</pre>', '<button class="btn btn-brand" id="rcp">' + IC.copy + 'คัดลอกข้อความ</button>', 'sheet'); $('#rcp', m).onclick = function () { copyText(repText(), $('#rtx', m)); }; };
}
function drawRep() {
  var box = $('#repBody'), req = REP.req; if (!box) return;
  var f = filt(), c = REP.cur = anAgg(req.from, req.to, f), p = REP.prev = anAgg(req.prevFrom, req.prevTo, f), okPrev = p.openDays > 0 && !p.nodata;
  var sy = scrollY;
  box.innerHTML = filterBar(req.from, req.to, drawRep) + (filtDesc() ? '<div class="fdesc">' + IC.filter + '<span>' + esc(filtDesc()) + '</span></div>' : '') +
    (c.nodata ? '<div class="banner warn">' + IC.warn.replace('<svg', '<svg width="16" height="16"') + ' ยังไม่มียอดจากระบบโรงพยาบาล ' + c.nodata + ' วันในช่วงนี้</div>' : '') +
    statCards(c, p, REP.mode, req.partial, okPrev) +
    (c.daily.length > 1 ? '<div style="margin-top:18px">' + trendCard(c, 'lblR') + '</div>' : '') +
    '<div class="grid-rep" style="margin-top:18px">' + breakdownCard(c, f.by) + '<div class="col">' + procCard(c) + '</div></div>' +
    (f.by !== 'doc' ? docTableCard(c) : '') +
    (c.daily.length > 1 ? '<details class="card rise d5" style="margin-top:18px"><summary class="card-h"><h3><span class="ic">' + IC.cal + '</span>รายวัน (' + c.daily.length + ' วัน)</h3><span class="small muted">กดเพื่อเปิด/ปิด</span></summary><div class="card-b tbl-wrap" style="max-height:420px;overflow:auto"><table class="tbl"><thead><tr><th>วันที่</th><th>ประเภทวัน</th><th class="num">ผู้ป่วย</th></tr></thead><tbody>' +
      c.daily.slice().reverse().map(function (x) { return '<tr><td><a href="#" data-go-day="' + x[0] + '">' + esc(thDate(x[0], true)) + '</a></td><td class="small"><span class="dot" style="background:' + typeColor(x[2]) + '"></span>' + typeName(x[2]) + '</td><td class="num">' + (x[1] == null ? '<span class="muted">ไม่มีข้อมูล</span>' : fmt(x[1], 0)) + '</td></tr>'; }).join('') + '</tbody></table></div></details>' : '') +
    '<section class="card rise d5" id="repCases" style="margin-top:18px"></section>';
  bindFilterBar(); bindPicks(box); countUp(box); bindTips(box);
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
    '💉 หัตถการ ' + fmt(c.procTotal, 0) + ' ครั้ง' + (filtActive() ? ' (ยอดรวมทั้งคลินิกพิเศษ)' : '') + ': ' + its.slice(0, 8).map(function (k) { return itemName(k) + ' ' + fmt(c.procs[k], 0); }).join(' · ') + '\n' +
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
      X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([['รหัสคลินิก', 'คลินิก', 'กลุ่ม', 'วันที่มีผู้ป่วย', 'ผู้ป่วย', 'เฉลี่ย/วัน']].concat(anRows(c, 'clinic').map(function (x) { return [x.id, clinicShort(x.id), groupName(groupOf(x.id)), x.days, x.v, Math.round(x.v / (x.days || 1) * 10) / 10]; }))), 'คลินิก');
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
  anLoad(a, req.to > y + '-09-30' ? req.to : y + '-09-30').then(function () { if (S.page === 'dash' && DASH.mode + DASH.key === key) drawDash(); }).catch(function (e) { toast(e.message, true); });
}
function drawDash() {
  var box = $('#dashBody'), req = DASH.req; if (!box) return;
  var f = filt(), c = anAgg(req.from, req.to, f), p = anAgg(req.prevFrom, req.prevTo, f), okPrev = p.openDays > 0 && !p.nodata, by = f.by;
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
      '<section class="card wide rise d4"><div class="card-h"><h3><span class="ic">' + IC.dash + '</span>รายเดือน ปีงบ ' + req.fy + ' เทียบปีงบ ' + (req.fy - 1) + '</h3><div class="row"><div class="legend"><span><i style="background:var(--c1)"></i>ปีงบ ' + req.fy + '</span><span><i style="background:transparent;outline:1.5px dashed var(--muted)"></i>ปีงบ ' + (req.fy - 1) + '</span></div>' + labelsToggle('lblF') + '</div></div><div class="card-b">' + barChart(fyBars, { w: 900, h: 260, labels: labelsOn(), aria: 'ผู้ป่วยรายเดือนในปีงบ', maxLabels: 12 }) +
        '<p class="small muted" style="margin:8px 0 0">รวมปีงบ ' + req.fy + ' <b>' + fmt(fyA.total, 0) + '</b> ราย' + (fyB.total ? ' · ปีงบ ' + (req.fy - 1) + ' ' + fmt(fyB.total, 0) + ' ราย' : '') + (filtDesc() ? ' · ตามตัวกรอง' : '') + '</p></div></section>' +
      '<section class="card wide rise d5"><div class="card-h"><h3><span class="ic">' + IC.cal + '</span>ปฏิทินความหนาแน่น ปีงบ ' + req.fy + '</h3><span class="small muted">1 ช่อง = 1 วัน · ชี้เพื่อดูยอด</span></div><div class="card-b">' + heatmapHtml(fs, fe, function (d) { return d in dmap ? dmap[d] : null; }) + '</div></section>' +
    '</div>';
  bindFilterBar(); bindPicks(box); countUp(box); bindTips(box);
  ['lblD', 'lblF'].forEach(function (id) { var lb = $('#' + id); if (lb) lb.onchange = function () { store('chartLabels', lb.checked); drawDash(); }; });
  if (sy) window.scrollTo(0, sy);
}

/* =====================================================================
   ตั้งค่า (แอดมิน)
   ===================================================================== */
var SET = { tab: 'clinics', data: null };
function pageSet() {
  var tabs = [['clinics', 'คลินิก'], ['groups', 'กลุ่มคลินิก'], ['items', 'หัตถการ'], ['pos', 'ตำแหน่งเจ้าหน้าที่'], ['users', 'ผู้ใช้'], ['conn', 'การเชื่อมต่อ'], ['backfill', 'ข้อมูลย้อนหลัง'], ['audit', 'ประวัติการแก้ไข']];
  $('#main').innerHTML = banners() + '<div class="pagehead rise"><div><div class="eyebrow">ตั้งค่า · แอดมิน</div><h1>' + tabs.filter(function (t) { return t[0] === SET.tab; })[0][1] + '</h1></div><div class="row">' + helpBtn() + '</div></div>' +
    '<div class="tabs" role="tablist">' + tabs.map(function (t) { return '<button role="tab" data-st="' + t[0] + '" aria-selected="' + (SET.tab === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div><section class="card rise d1" style="padding:18px" id="setBody"><div class="skel" style="height:240px"></div></section>';
  $$('[data-st]').forEach(function (b) { b.onclick = function () { SET.tab = b.getAttribute('data-st'); pageSet(); }; });
  bindHelp($('#main'));
  if (SET.tab === 'audit') return drawAudit();
  api('getAdmin', {}, { onCache: function (d) { SET.data = d; drawSet(); } }).then(function (d) { SET.data = d; if (S.page === 'set') drawSet(); }).catch(function (e) { toast(e.message, true); });
}
function refreshBoot() { return api('bootstrap', {}).then(function (b) { applyBoot(b); }); }
function saveBtn(id, label) { return '<div class="row" style="justify-content:flex-end;margin-top:14px"><span class="small muted" id="' + id + 'msg"></span><button class="btn btn-brand" id="' + id + '">' + (label || 'บันทึกการเปลี่ยนแปลง') + '</button></div>'; }
function drawSet() {
  var b = $('#setBody'), d = SET.data; if (!b || !d) return;
  var t = SET.tab;
  if (t === 'clinics') {
    var list = d.clinics.slice().sort(function (a, b2) { return (a.order - b2.order) || (b2.vn - a.vn); });
    b.innerHTML = '<p class="small muted" style="margin-top:0">คลินิกใหม่ที่ API ส่งมาจะเพิ่มเองและแสดงไว้ก่อน · <b>ปิด</b> = ไม่แสดงและไม่นับในยอดรวมทุกหน้า (ข้อมูลดิบยังเก็บครบ เปิดกลับได้) · ลำดับว่าง = เรียงตามจำนวนผู้ป่วย</p><div class="tbl-wrap"><table class="tbl"><thead><tr><th>แสดง</th><th>รหัส</th><th>ชื่อย่อบนรายงาน</th><th>ชื่อจาก API</th><th>กลุ่ม</th><th class="num">ลำดับ</th><th class="num">ผู้ป่วยสะสม</th><th>พบล่าสุด</th></tr></thead><tbody>' +
      list.map(function (c) { return '<tr data-code="' + esc(c.code) + '"><td><label class="switch"><input type="checkbox" data-k="show"' + (c.show ? ' checked' : '') + ' aria-label="แสดง ' + esc(c.code) + '"><span></span></label></td><td><span class="code">' + esc(c.code) + '</span></td><td><input type="text" data-k="short" value="' + esc(c.short) + '" maxlength="40" style="width:150px" aria-label="ชื่อย่อ ' + esc(c.code) + '"></td><td class="small muted">' + esc(c.name) + '<br>' + esc(c.group) + '</td><td class="small">' + (c.groupId ? '<span class="gchip"><i style="background:' + palOf((d.groups.filter(function (g) { return g.id === c.groupId; })[0] || {}).color) + '"></i>' + esc((d.groups.filter(function (g) { return g.id === c.groupId; })[0] || {}).name || '') + '</span>' : '<span class="muted">–</span>') + '</td><td class="num"><input type="number" data-k="order" value="' + (c.order < 999 ? c.order : '') + '" style="width:64px" aria-label="ลำดับ ' + esc(c.code) + '"></td><td class="num">' + fmt(c.vn, 0) + '</td><td class="small muted">' + (c.last ? esc(thDate(c.last)) : '–') + '</td></tr>'; }).join('') + '</tbody></table></div>' + saveBtn('sv');
    $('#sv').onclick = function () {
      var out = $$('tr[data-code]', b).map(function (tr) { return { code: tr.getAttribute('data-code'), show: $('[data-k=show]', tr).checked, short: $('[data-k=short]', tr).value, order: $('[data-k=order]', tr).value }; });
      busy($('#sv'), api('saveClinics', { list: out, _rid: rid() }), 'กำลังบันทึก…').then(function (r) { toast('บันทึกแล้ว ' + r.saved + ' คลินิก'); forget('get'); return refreshBoot(); }).catch(function (e) { toast(e.message, true); });
    };
  } else if (t === 'groups') {
    drawGroups(b, d);
  } else if (t === 'items') {
    var its = d.items.slice().sort(function (a, b2) { return a.order - b2.order; });
    var draw = function () {
      b.innerHTML = '<p class="small muted" style="margin-top:0">เรียงตามแบบฟอร์มเดิม · ซ้าย/ขวา = คอลัมน์บนใบรายงาน · ปิด = ซ่อนจากหน้าคีย์ (ข้อมูลเก่ายังอยู่)</p><div class="tbl-wrap"><table class="tbl"><thead><tr><th>ใช้งาน</th><th>รายการ</th><th>คอลัมน์</th><th>ลำดับ</th></tr></thead><tbody>' +
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
      $('#sv').onclick = function () { busy($('#sv'), api('saveItems', { list: its, _rid: rid() }), 'กำลังบันทึก…').then(function (r) { toast('บันทึกแล้ว ' + r.saved + ' รายการ'); forget('getAdmin'); return refreshBoot().then(pageSet); }).catch(function (e) { toast(e.message, true); }); };
    };
    draw();
  } else if (t === 'pos') {
    var ps = d.positions.slice().sort(function (a, b2) { return a.order - b2.order; });
    var drawP = function () {
      b.innerHTML = '<p class="small muted" style="margin-top:0">ตำแหน่งของคลินิกพิเศษเฉพาะทางนอกเวลาจาก SMC Duty (ตำแหน่งใหม่จะเพิ่มเองตอนดึงตารางเวร) · เลือกที่จะแสดงในรายงาน · "ช่องคลินิก" = ให้ใส่คลินิกที่ประจำต่อท้ายชื่อ</p><div class="tbl-wrap"><table class="tbl"><thead><tr><th>แสดง</th><th>ชื่อย่อบนรายงาน</th><th>ตำแหน่งใน SMC Duty</th><th>ช่องคลินิก</th><th>ลำดับ</th></tr></thead><tbody>' +
        ps.map(function (p, ix) { return '<tr><td><label class="switch"><input type="checkbox" data-ps="' + ix + '"' + (p.show ? ' checked' : '') + ' aria-label="แสดง ' + esc(p.name) + '"><span></span></label></td><td><input type="text" data-pn="' + ix + '" value="' + esc(p.short) + '" maxlength="40" style="width:160px" aria-label="ชื่อย่อ"></td><td>' + esc(p.name) + ' <span class="xs muted">' + esc(p.id) + '</span></td><td><label class="switch"><input type="checkbox" data-pc="' + ix + '"' + (p.clinicBox ? ' checked' : '') + ' aria-label="ช่องคลินิก ' + esc(p.name) + '"><span></span></label></td>' +
          '<td class="row"><button class="iconbtn" data-pu="' + ix + '" aria-label="เลื่อนขึ้น"' + (ix === 0 ? ' disabled' : '') + '>' + IC.up + '</button><button class="iconbtn" data-pd="' + ix + '" aria-label="เลื่อนลง"' + (ix === ps.length - 1 ? ' disabled' : '') + '>' + IC.down + '</button></td></tr>'; }).join('') + '</tbody></table></div>' + saveBtn('sv');
      $$('[data-ps]', b).forEach(function (x) { x.onchange = function () { ps[+x.getAttribute('data-ps')].show = x.checked; }; });
      $$('[data-pc]', b).forEach(function (x) { x.onchange = function () { ps[+x.getAttribute('data-pc')].clinicBox = x.checked; }; });
      $$('[data-pn]', b).forEach(function (x) { x.oninput = function () { ps[+x.getAttribute('data-pn')].short = x.value; }; });
      $$('[data-pu]', b).forEach(function (x) { x.onclick = function () { var i = +x.getAttribute('data-pu'), tmp = ps[i]; ps[i] = ps[i - 1]; ps[i - 1] = tmp; drawP(); }; });
      $$('[data-pd]', b).forEach(function (x) { x.onclick = function () { var i = +x.getAttribute('data-pd'), tmp = ps[i]; ps[i] = ps[i + 1]; ps[i + 1] = tmp; drawP(); }; });
      $('#sv').onclick = function () { busy($('#sv'), api('savePositions', { list: ps, _rid: rid() }), 'กำลังบันทึก…').then(function (r) { toast('บันทึกแล้ว ' + r.saved + ' ตำแหน่ง'); forget('getAdmin'); return refreshBoot(); }).catch(function (e) { toast(e.message, true); }); };
    };
    drawP();
  } else if (t === 'users') {
    b.innerHTML = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>ชื่อผู้ใช้</th><th>ชื่อที่แสดง</th><th>บทบาท</th><th>สถานะ</th><th>เข้าล่าสุด</th><th></th></tr></thead><tbody>' +
      d.users.map(function (u) { return '<tr><td class="tnum"><b>' + esc(u.username) + '</b></td><td>' + esc(u.name) + '</td><td><span class="chip ' + (u.role === 'admin' ? 'brand' : u.role === 'exec' ? 'off' : 'ok') + '">' + ROLE_TH[u.role] + '</span></td><td>' + (u.active ? (u.mustChange ? '<span class="chip warn">รอเปลี่ยนรหัส</span>' : '<span class="chip ok">ใช้งาน</span>') : '<span class="chip idle">ปิด</span>') + '</td><td class="small muted">' + esc(stampTh(u.lastLogin)) + '</td>' +
        '<td class="row"><button class="btn btn-sm" data-ue="' + esc(u.username) + '">แก้ไข</button><button class="btn btn-sm" data-ur="' + esc(u.username) + '">ตั้งรหัสใหม่</button></td></tr>'; }).join('') + '</tbody></table></div>' +
      '<div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn btn-brand" id="uadd">' + IC.plus + 'เพิ่มผู้ใช้</button></div>';
    var userForm = function (u) {
      var isNew = !u; u = u || { username: '', name: '', role: 'exec', active: true };
      var m = modal(isNew ? 'เพิ่มผู้ใช้' : 'แก้ไขผู้ใช้ ' + esc(u.username), '<form id="uf" style="display:flex;flex-direction:column;gap:12px">' +
        '<label class="field" for="uu">ชื่อผู้ใช้ (a-z 0-9 . _ -)<input id="uu" type="text" value="' + esc(u.username) + '"' + (isNew ? '' : ' disabled') + ' required pattern="[a-zA-Z0-9._\\-]{3,30}"></label>' +
        '<label class="field" for="un">ชื่อที่แสดง<input id="un" type="text" value="' + esc(u.name) + '" maxlength="80" required></label>' +
        '<label class="field" for="ur">บทบาท<select id="ur"><option value="exec"' + (u.role === 'exec' ? ' selected' : '') + '>ผู้บริหาร — ดูรายงาน/แดชบอร์ด</option><option value="nurse"' + (u.role === 'nurse' ? ' selected' : '') + '>พยาบาล — คีย์ข้อมูล</option><option value="admin"' + (u.role === 'admin' ? ' selected' : '') + '>แอดมิน — ทุกอย่าง</option></select></label>' +
        (isNew ? '' : '<label class="row small" for="ua"><input id="ua" type="checkbox"' + (u.active ? ' checked' : '') + '> เปิดใช้งาน</label>') +
        '<button class="btn btn-brand" type="submit" style="align-self:flex-end">บันทึก</button></form>', '', 'sm');
      $('#uf', m).onsubmit = function (e) {
        e.preventDefault();
        busy($('#uf button[type=submit]', m), api('saveUser', { username: $('#uu', m).value, name: $('#un', m).value, role: $('#ur', m).value, active: isNew ? true : $('#ua', m).checked, _rid: rid() }), 'กำลังบันทึก…').then(function (r) {
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
  } else if (t === 'conn') {
    var c = d.conn;
    b.innerHTML = '<div style="display:flex;flex-direction:column;gap:14px;max-width:760px">' +
      '<label class="field" for="capi">ลิงก์ API ยอดผู้ป่วย ({date} = yyyyMMdd)<input id="capi" type="text" value="' + esc(c.apiUrl) + '"></label>' +
      '<div class="row"><button class="btn" id="tapi">' + IC.refresh + 'ทดสอบ API</button><span class="small" id="tapiR"></span></div><hr style="border:0;border-top:1px solid var(--line);width:100%">' +
      '<label class="field" for="cduty">ลิงก์ /exec ของ SMC Duty<input id="cduty" type="text" value="' + esc(c.smcDutyUrl) + '" placeholder="https://script.google.com/macros/s/…/exec"></label>' +
      '<label class="field" for="ckey">รหัสลับร่วมกับ SMC Duty (DAILY_FEED_KEY) ' + (c.dutyKeySet ? '<span class="chip ok">ตั้งแล้ว</span>' : '<span class="chip warn">ยังไม่ได้ตั้ง</span>') + '<input id="ckey" type="password" autocomplete="off" placeholder="' + (c.dutyKeySet ? 'เว้นว่าง = ใช้รหัสเดิม' : 'วางรหัสลับ') + '"></label>' +
      '<div class="row"><button class="btn btn-sm" id="gkey">' + IC.key + 'สร้างรหัสลับใหม่</button><span class="xs muted">สร้างแล้วนำไปวางในไฟล์ DailyFeed ของ SMC Duty ด้วย</span></div><div id="gkeyBox"></div>' +
      '<div class="row"><button class="btn" id="tduty">' + IC.refresh + 'ทดสอบ SMC Duty</button><button class="btn" id="scal">' + IC.cal + 'ซิงก์วันหยุดตอนนี้</button><span class="small" id="tdutyR"></span></div>' +
      '<dl class="kvlist"><dt>โหมด API</dt><dd>' + (c.apiModeCheckedAt ? (c.apiTodayOnly ? '<span class="chip warn">ส่งเฉพาะยอดวันนี้</span> <span class="xs muted">ระบบเก็บยอดวันนี้ทุก 30 นาที · ดึงย้อนหลังไม่ได้ ขอไอทีให้รับ search_st</span>' : '<span class="chip ok">รับวันที่ ดึงย้อนหลังได้</span>') + ' <span class="xs muted">ตรวจ ' + esc(stampTh(c.apiModeCheckedAt)) + '</span>' : '<span class="muted">ยังไม่ได้ตรวจ (กดทดสอบ API)</span>') + '</dd><dt>ซิงก์วันหยุดล่าสุด</dt><dd>' + esc(stampTh(c.calendarSyncedAt) || '–') + '</dd><dt>งานกลางคืนล่าสุด</dt><dd class="small">' + esc(c.lastNightly || '–') + '</dd><dt>เก็บยอดปิดวันล่าสุด</dt><dd class="small">' + esc(c.lastEvening || '–') + '</dd><dt>หลังบ้าน build</dt><dd>' + esc(d.build) + '</dd></dl><hr style="border:0;border-top:1px solid var(--line);width:100%">' +
      '<label class="field" for="clh">บรรทัดแรกของข้อความไลน์<input id="clh" type="text" value="' + esc(c.lineHeader) + '" maxlength="120"></label>' +
      '<label class="field" for="crt">หัวกระดาษใบรายงาน<input id="crt" type="text" value="' + esc(c.reportTitle) + '" maxlength="160"></label>' +
      '<label class="field" for="cct">ข้อมูลติดต่อท้ายระบบ<input id="cct" type="text" value="' + esc(c.contactText || '') + '" maxlength="160" placeholder="เช่น เจ้าหน้าที่ประสานงาน โทรภายใน 13507"></label>' +
      '<label class="field" for="cmu">ลิงก์คู่มือการใช้งาน (ปุ่ม ? ในระบบ)<input id="cmu" type="text" value="' + esc(c.manualUrl || '') + '" maxlength="300" placeholder="https://…"></label>' +
      '<dl class="kvlist"><dt>ประวัติการแก้ไขที่เก็บถาวร</dt><dd>' + (c.auditArchived ? fmt(c.auditArchived, 0) + ' แถว · ไฟล์ "SMC Daily — ประวัติการแก้ไข (เก็บถาวร)" ใน Google Drive ของบัญชีคลินิก' : '<span class="muted">ยังไม่มี (ระบบย้ายเองเมื่อเกิน 20,000 แถว)</span>') + '</dd></dl></div>' + saveBtn('sv');
    var res = function (el, r) { $(el).innerHTML = r.ok ? '<span style="color:var(--ok)">✓ ' + r.text + '</span>' : '<span style="color:var(--bad)">✗ ' + esc(r.text) + '</span>'; };
    $('#tapi').onclick = function () { $('#tapiR').innerHTML = '<span class="muted">กำลังถาม API 2 วันที่ (วันนี้ + 7 วันก่อน)…</span>'; busy($('#tapi'), api('testApi', {}), 'กำลังทดสอบ…').then(function (r) { res('#tapiR', r.ok ? { ok: 1, text: 'วันนี้ได้ ' + r.rows + ' แถว ผู้ป่วย ' + fmt(r.total, 0) + ' ราย (' + (r.ms / 1000).toFixed(1) + ' วิ) · ' + (r.todayOnly ? '⚠ API ส่งเฉพาะยอดวันนี้ ดึงย้อนหลังไม่ได้' : 'API รับวันที่ ดึงย้อนหลังได้') } : { text: r.error }); forget('getAdmin'); }).catch(function (e) { res('#tapiR', { text: e.message }); }); };
    $('#tduty').onclick = function () { $('#tdutyR').innerHTML = ''; busy($('#tduty'), api('testDuty', {}), 'กำลังทดสอบ…').then(function (r) { res('#tdutyR', r.ok ? { ok: 1, text: 'เชื่อมต่อได้ · วันนี้ ' + r.people + ' คนในตารางเวร · ' + r.positions + ' ตำแหน่ง' } : { text: r.error }); }).catch(function (e) { res('#tdutyR', { text: e.message }); }); };
    $('#scal').onclick = function () { busy($('#scal'), api('syncCalendar', {}), 'กำลังซิงก์…').then(function (r) { toast('ซิงก์วันหยุดแล้ว ' + r.days + ' วัน'); refreshBoot(); }).catch(function (e) { toast(e.message, true); }); };
    $('#gkey').onclick = function () { busy($('#gkey'), api('newDutyKey', {})).then(function (r) { $('#ckey').value = r.key; $('#gkeyBox').innerHTML = '<div class="secret">' + esc(r.key) + '</div><p class="xs muted">คัดลอกรหัสนี้ไปวางในไฟล์ DailyFeed ของ SMC Duty (บรรทัด var DAILY_FEED_KEY = \'…\') แล้วกดบันทึกด้านล่าง</p>'; }).catch(function (e) { toast(e.message, true); }); };
    $('#sv').onclick = function () {
      var p = { apiUrl: $('#capi').value, smcDutyUrl: $('#cduty').value, lineHeader: $('#clh').value, reportTitle: $('#crt').value, contactText: $('#cct').value, manualUrl: $('#cmu').value, _rid: rid() };
      if ($('#ckey').value) p.smcDutyKey = $('#ckey').value;
      busy($('#sv'), api('saveConnection', p), 'กำลังบันทึก…').then(function () { toast('บันทึกแล้ว'); forget('getAdmin'); refreshBoot().then(pageSet); }).catch(function (e) { toast(e.message, true); });
    };
  } else if (t === 'backfill') {
    var bf = d.backfill, total = datesIn(bf.from, bf.today).length, have = Math.min(total, bf.daysOk), p2 = total ? have / total * 100 : 0;
    var st = bf.status === 'blocked' ? '<span class="chip warn">หยุดไว้: API ส่งเฉพาะยอดวันนี้</span>' : bf.status === 'done' ? '<span class="chip ok">' + IC.check + 'ครบแล้ว</span>' : bf.status === 'running' || bf.status === 'retry' ? '<span class="chip warn">' + IC.spin.replace('<svg', '<svg width="12" height="12"') + ' กำลังดึง</span>' : '<span class="chip idle">ยังไม่เริ่ม</span>';
    b.innerHTML = '<div style="display:flex;flex-direction:column;gap:14px;max-width:720px"><div class="row" style="justify-content:space-between"><b>ยอดผู้ป่วยย้อนหลังในระบบ</b>' + st + '</div>' +
      '<div class="progress" role="progressbar" aria-valuenow="' + Math.round(p2) + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + p2.toFixed(1) + '%"></i></div>' +
      '<dl class="kvlist"><dt>ช่วงที่ต้องการ</dt><dd>' + esc(thDate(bf.from)) + ' – ' + esc(thDate(bf.today)) + ' (' + fmt(total, 0) + ' วัน)</dd><dt>มีข้อมูลแล้ว</dt><dd>' + fmt(have, 0) + ' วัน (' + fmt(p2) + '%) · เก่าสุด ' + esc(bf.firstDate ? thDate(bf.firstDate) : '–') + '</dd>' +
      (bf.status && bf.status !== 'done' ? '<dt>กำลังดึงถึงวันที่</dt><dd>' + esc(bf.cursor ? thDate(bf.cursor) : '–') + '</dd>' : '') + '<dt>ดึงไม่สำเร็จ (จะลองใหม่)</dt><dd>' + bf.errors + ' วัน</dd></dl>' +
      (bf.status === 'blocked' ? '<div class="banner warn">API ของไอทีตอนนี้ส่งเฉพาะยอดวันนี้ (ส่งวันที่ไปเท่าไรก็ได้ข้อมูลชุดเดิม) จึงดึงย้อนหลังไม่ได้ · ระบบเก็บยอดวันนี้ทุก 30 นาทีไปก่อน · เมื่อไอทีแก้ให้รับวันที่ ระบบตรวจพบเองตอนตี 1:30 แล้วดึงย้อนหลังต่ออัตโนมัติ</div>' : '') +
      '<p class="small muted" style="margin:0">ระบบดึงเบื้องหลังทุก 10 นาที ครั้งละประมาณ 4 นาที เว้นช่วง 1.5 วินาทีต่อวัน (API ตอบว่างถ้าถามถี่) · ไม่กระทบการใช้งานของพยาบาล</p>' +
      '<form class="row" id="bff"><label class="small" for="bfd">ดึงย้อนหลังตั้งแต่</label><input type="date" id="bfd" value="' + esc(bf.from) + '" min="2020-07-01" max="' + esc(bf.today) + '"><button class="btn" type="submit">เริ่มดึง</button><span class="xs muted">ข้อมูลใน API เริ่มประมาณ ก.ค. 2563</span></form></div>';
    $('#bff').onsubmit = function (e) { e.preventDefault(); busy($('#bff button'), api('startBackfill', { from: $('#bfd').value }), 'กำลังเริ่ม…').then(function () { toast('เริ่มดึงย้อนหลังแล้ว ระบบทำต่อเบื้องหลัง'); forget('getAdmin'); pageSet(); }).catch(function (er) { toast(er.message, true); }); };
  }
}
function showTemp(u, pw) { modal('รหัสผ่านชั่วคราว', '<p>ผู้ใช้ <b>' + esc(u) + '</b></p><div class="secret" style="font-size:1.3rem;text-align:center">' + esc(pw) + '</div><p class="small muted">แจ้งรหัสนี้ให้ผู้ใช้ทางช่องทางส่วนตัว · แสดงครั้งเดียว · ผู้ใช้ต้องเปลี่ยนรหัสตอนเข้าครั้งแรก</p>', '<button class="btn btn-brand" data-close>รับทราบ</button>', 'sm'); }
function drawAudit() {
  var b = $('#setBody');
  api('getAudit', { limit: 300 }).then(function (r) {
    var A = { CASE_ADD: 'เพิ่มผู้ป่วยส่งต่อ', CASE_EDIT: 'แก้ผู้ป่วยส่งต่อ', CASE_DEL: 'ลบผู้ป่วยส่งต่อ', GROUPS: 'กลุ่มคลินิก', PROC: 'หัตถการ', FIELD: 'ยอดอื่น', STAFF: 'เจ้าหน้าที่', ADD_ITEM: 'เพิ่มรายการ', CLINIC: 'คลินิก', ADD_USER: 'เพิ่มผู้ใช้', EDIT_USER: 'แก้ผู้ใช้', RESET_PASSWORD: 'ตั้งรหัสใหม่', CHANGE_PASSWORD: 'เปลี่ยนรหัส', CONNECTION: 'การเชื่อมต่อ', BACKFILL: 'ดึงย้อนหลัง' };
    b.innerHTML = r.rows.length ? '<div class="tbl-wrap" style="max-height:600px;overflow:auto"><table class="tbl"><thead><tr><th>เวลา</th><th>ผู้ใช้</th><th>เรื่อง</th><th>วันที่รายงาน</th><th>ช่อง</th><th class="num">เดิม</th><th class="num">ใหม่</th></tr></thead><tbody>' +
      r.rows.map(function (x) { return '<tr><td class="small tnum">' + esc(stampTh(x[0])) + '</td><td>' + esc(x[1]) + '</td><td><span class="chip idle">' + esc(A[x[2]] || x[2]) + '</span></td><td class="small">' + (x[3] ? esc(thDate(x[3])) : '') + '</td><td>' + esc(x[4]) + '</td><td class="num muted">' + esc(x[5] || '–') + '</td><td class="num">' + esc(x[6] || '–') + '</td></tr>'; }).join('') + '</tbody></table></div>'
      : '<div class="empty">' + IC.inbox + 'ยังไม่มีประวัติการแก้ไข</div>';
  }).catch(function (e) { toast(e.message, true); });
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
