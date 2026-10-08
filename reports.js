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
   รายงาน
   ===================================================================== */
var REP = { mode: 'month', key: null, data: null };
function pageRep() {
  if (!REP.key) REP.key = defaultKey(REP.mode);
  var req = rangeReq(REP);
  $('#main').innerHTML = banners() + '<div class="pagehead rise"><div><div class="eyebrow">รายงาน</div><h1>' + esc(periodLabel(REP.mode, REP.key)) + '</h1><div class="small muted">' + esc(thDate(req.from)) + ' – ' + esc(thDate(req.to)) + '</div></div>' +
    '<div class="row"><button class="btn" id="rxls">' + IC.xls + 'ส่งออก Excel</button><button class="btn" id="rprint">' + IC.print + 'พิมพ์</button><button class="btn" id="rline">' + IC.line + 'สรุปส่งไลน์</button></div></div>' +
    periodPicker(REP, 'rp') + '<div id="repBody"><div class="stats">' + [1, 2, 3, 4].map(function () { return '<div class="stat skel" style="height:96px"></div>'; }).join('') + '</div></div>';
  bindPicker(REP, 'rp', pageRep);
  var key = REP.mode + REP.key;
  api('getReport', req, { onCache: function (d) { REP.data = d; drawRep(req); } }).then(function (d) { if (S.page === 'rep' && REP.mode + REP.key === key) { REP.data = d; drawRep(req); } }).catch(function (e) { toast(e.message, true); });
  $('#rxls').onclick = function () { exportRep(req); };
  $('#rprint').onclick = function () { printRep(req); };
  $('#rline').onclick = function () { if (!REP.data) return; var m = modal('สรุปส่งไลน์', '<pre class="linetxt" id="rtx">' + esc(repText(req)) + '</pre>', '<button class="btn btn-brand" id="rcp">' + IC.copy + 'คัดลอกข้อความ</button>'); $('#rcp', m).onclick = function () { copyText(repText(req), $('#rtx', m)); }; };
}
function drawRep(req) {
  var box = $('#repBody'); if (!box || !REP.data) return;
  var c = REP.data.cur, p = REP.data.prev, okPrev = p && p.openDays > 0 && !p.nodataDays;
  var wdAvg = c.wd.n ? c.wd.vn / c.wd.n : null, offAvg = c.off.n ? c.off.vn / c.off.n : null;
  var items = Object.keys(c.procs || {}).map(function (k) { return [k, c.procs[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
  box.innerHTML = (c.nodataDays ? '<div class="banner warn" style="margin-bottom:12px">' + IC.warn.replace('<svg', '<svg width="16" height="16"') + ' ยังไม่มียอดจาก API ' + c.nodataDays + ' วันในช่วงนี้ (ระบบกำลังดึงย้อนหลังหรือ API ไม่ตอบ)</div>' : '') +
    '<div class="stats">' +
    '<div class="stat rise d1"><span class="lb">' + IC.users + 'ผู้ป่วยทั้งหมด</span><span class="v"><span data-count="' + c.total + '">0</span><small>ราย</small></span>' + deltaHtml(c.total, p && p.total, REP.mode, okPrev, req.partial) + '</div>' +
    '<div class="stat rise d2"><span class="lb">' + IC.clinic + 'วันที่เปิดคลินิก</span><span class="v"><span data-count="' + c.openDays + '">0</span><small>วัน</small></span><span class="d muted">วันทำการ ' + c.wd.n + ' · วันหยุด ' + c.off.n + '</span></div>' +
    '<div class="stat rise d3"><span class="lb">' + IC.pulse + 'เฉลี่ยต่อวันทำการ</span><span class="v"><span data-count="' + (wdAvg || 0) + '" data-dec="1">0</span><small>ราย</small></span><span class="d muted">วันหยุดเฉลี่ย ' + fmt(offAvg) + ' ราย</span></div>' +
    '<div class="stat rise d4"><span class="lb">' + IC.syringe + 'หัตถการรวม</span><span class="v"><span data-count="' + c.procTotal + '">0</span><small>ครั้ง</small></span><span class="d ' + (c.missingDays ? 'down' : 'muted') + '">' + (c.missingDays ? 'ยังไม่คีย์ ' + c.missingDays + ' วัน' : 'คีย์ครบทุกวันที่เปิด') + '</span></div></div>' +
    '<div class="grid-2" style="margin-top:18px"><section class="card rise d2"><div class="card-h"><h3><span class="ic">' + IC.clinic + '</span>ผู้ป่วยแยกคลินิก</h3><span class="small muted">' + (c.clinics || []).length + ' คลินิก</span></div><div class="card-b tbl-wrap"><table class="tbl"><thead><tr><th>คลินิก</th><th class="num">วันที่เปิด</th><th class="num">ผู้ป่วย</th><th class="num">เฉลี่ย/วัน</th><th style="width:22%">สัดส่วน</th></tr></thead><tbody>' +
      (c.clinics || []).map(function (x) { var sh = c.total ? x[1] / c.total * 100 : 0; return '<tr><td><span class="code">' + esc(x[0]) + '</span> <span class="small">' + esc(clinicShort(x[0])) + '</span></td><td class="num">' + x[2] + '</td><td class="num"><b>' + fmt(x[1], 0) + '</b></td><td class="num">' + fmt(x[1] / x[2]) + '</td><td><div class="ptrow"><div class="bar" title="' + fmt(sh) + '%"><i style="width:' + Math.max(2, sh / ((c.clinics[0][1] / c.total * 100) || 1) * 100).toFixed(1) + '%"></i></div></div><span class="xs muted">' + fmt(sh) + '%</span></td></tr>'; }).join('') +
      '</tbody><tfoot><tr><td>รวม</td><td class="num">' + c.openDays + '</td><td class="num">' + fmt(c.total, 0) + '</td><td class="num">' + (c.openDays ? fmt(c.total / c.openDays) : '–') + '</td><td>100%</td></tr></tfoot></table></div></section>' +
    '<div class="col"><section class="card rise d3"><div class="card-h"><h3><span class="ic">' + IC.syringe + '</span>หัตถการ</h3><span class="small muted">ต่อผู้ป่วย 100 ราย</span></div><div class="card-b tbl-wrap"><table class="tbl"><thead><tr><th>รายการ</th><th class="num">ครั้ง</th><th class="num">/100 ราย</th></tr></thead><tbody>' +
      (items.map(function (x) { return '<tr><td>' + esc(itemName(x[0])) + '</td><td class="num"><b>' + fmt(x[1], 0) + '</b></td><td class="num">' + (c.total ? fmt(x[1] / c.total * 100) : '–') + '</td></tr>'; }).join('') || '<tr><td colspan="3" class="muted">ยังไม่มีการคีย์</td></tr>') +
      '</tbody><tfoot><tr><td>รวม</td><td class="num">' + fmt(c.procTotal, 0) + '</td><td class="num">' + (c.total ? fmt(c.procTotal / c.total * 100) : '–') + '</td></tr></tfoot></table></div></section>' +
    '<section class="card rise d4"><div class="card-h"><h3><span class="ic">' + IC.pulse + '</span>ยอดอื่น ๆ</h3></div><div class="card-b"><dl class="kvlist"><dt>Consult แผนกอื่น</dt><dd class="num" style="text-align:left"><b>' + fmt(c.other.consult, 0) + '</b> ราย</dd><dt>โอนตรวจต่อ Night OPD ชั้น 4</dt><dd><b>' + fmt(c.other.nightOpd, 0) + '</b> ราย</dd><dt>Admit</dt><dd><b>' + fmt(c.other.admit, 0) + '</b> ราย</dd></dl></div></section></div></div>' +
    '<section class="card rise d4" style="margin-top:18px"><div class="card-h"><h3><span class="ic">' + IC.users + '</span>ผู้ป่วยแยกแพทย์</h3><input type="search" id="dq" placeholder="ค้นหาชื่อแพทย์" aria-label="ค้นหาชื่อแพทย์"></div><div class="card-b tbl-wrap" style="max-height:460px;overflow:auto"><table class="tbl"><thead><tr><th>#</th><th>แพทย์</th><th class="num">ผู้ป่วย</th><th class="num">สัดส่วน</th></tr></thead><tbody id="dbody">' +
      (c.doctors || []).map(function (x, i) { return '<tr data-dn="' + esc(x[0]) + '"><td class="muted tnum xs">' + (i + 1) + '</td><td>' + esc(x[0]) + '</td><td class="num">' + fmt(x[1], 0) + '</td><td class="num">' + (c.total ? fmt(x[1] / c.total * 100) : '–') + '%</td></tr>'; }).join('') + '</tbody></table></div></section>' +
    (c.daily && c.daily.length > 1 ? '<section class="card rise d5" style="margin-top:18px"><div class="card-h"><h3><span class="ic">' + IC.cal + '</span>รายวัน</h3></div><div class="card-b tbl-wrap" style="max-height:420px;overflow:auto"><table class="tbl"><thead><tr><th>วันที่</th><th>ประเภทวัน</th><th class="num">ผู้ป่วย</th></tr></thead><tbody>' +
      c.daily.slice().reverse().map(function (x) { return '<tr><td><a href="#" data-go-day="' + x[0] + '">' + esc(thDate(x[0], true)) + '</a></td><td class="small" style="color:' + typeColor(x[2]) + '">' + typeName(x[2]) + '</td><td class="num">' + (x[1] == null ? '<span class="muted">รอข้อมูล</span>' : fmt(x[1], 0)) + '</td></tr>'; }).join('') + '</tbody></table></div></section>' : '');
  countUp(box);
  $('#dq').oninput = function (e) { var q = e.target.value.trim(); $$('#dbody tr').forEach(function (tr) { tr.hidden = !!q && tr.getAttribute('data-dn').indexOf(q) < 0; }); };
  $$('[data-go-day]', box).forEach(function (a) { a.onclick = function (e) { e.preventDefault(); S.date = a.getAttribute('data-go-day'); go('today'); }; });
}
function repText(req) {
  var c = REP.data.cur, its = Object.keys(c.procs || {}).sort(function (a, b) { return c.procs[b] - c.procs[a]; });
  return '📊 สรุปรายงาน คลินิกพิเศษเฉพาะทางนอกเวลา\n' + periodLabel(REP.mode, REP.key) + ' (' + thDate(req.from) + ' – ' + thDate(req.to) + ')\n\n' +
    '👥 ผู้ป่วยทั้งหมด ' + fmt(c.total, 0) + ' ราย · เปิด ' + c.openDays + ' วัน · เฉลี่ยวันทำการ ' + fmt(c.wd.n ? c.wd.vn / c.wd.n : 0) + ' ราย/วัน\n' +
    'คลินิกสูงสุด: ' + (c.clinics || []).slice(0, 5).map(function (x) { return x[0] + ' ' + fmt(x[1], 0); }).join(' · ') + '\n\n' +
    '💉 หัตถการ ' + fmt(c.procTotal, 0) + ' ครั้ง: ' + its.slice(0, 8).map(function (k) { return itemName(k) + ' ' + fmt(c.procs[k], 0); }).join(' · ') + '\n' +
    'Consult ' + fmt(c.other.consult, 0) + ' · Night OPD ' + fmt(c.other.nightOpd, 0) + ' · Admit ' + fmt(c.other.admit, 0);
}
function exportRep(req) {
  if (!REP.data) return;
  loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js').then(function () {
    var c = REP.data.cur, X = window.XLSX, wb = X.utils.book_new();
    var sum = [['รายงานคลินิกพิเศษเฉพาะทางนอกเวลา'], [periodLabel(REP.mode, REP.key)], ['ตั้งแต่', req.from, 'ถึง', req.to], [], ['ผู้ป่วยทั้งหมด', c.total], ['วันที่เปิดคลินิก', c.openDays], ['วันทำการ', c.wd.n, 'ผู้ป่วย', c.wd.vn], ['วันหยุด', c.off.n, 'ผู้ป่วย', c.off.vn], ['หัตถการรวม', c.procTotal], ['Consult แผนกอื่น', c.other.consult], ['โอน Night OPD ชั้น 4', c.other.nightOpd], ['Admit', c.other.admit]];
    X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(sum), 'สรุป');
    X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([['รหัสคลินิก', 'คลินิก', 'วันที่เปิด', 'ผู้ป่วย', 'เฉลี่ย/วัน']].concat((c.clinics || []).map(function (x) { return [x[0], clinicShort(x[0]), x[2], x[1], Math.round(x[1] / x[2] * 10) / 10]; }))), 'คลินิก');
    X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([['แพทย์', 'ผู้ป่วย']].concat(c.doctors || [])), 'แพทย์');
    X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([['หัตถการ', 'ครั้ง']].concat(Object.keys(c.procs || {}).map(function (k) { return [itemName(k), c.procs[k]]; }))), 'หัตถการ');
    X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([['วันที่', 'ประเภทวัน', 'ผู้ป่วย']].concat((c.daily || []).map(function (x) { return [x[0], typeName(x[2]), x[1]]; }))), 'รายวัน');
    X.writeFile(wb, 'SMC_Daily_' + req.from + '_' + req.to + '.xlsx');
    toast('ส่งออก Excel แล้ว');
  }).catch(function (e) { toast(e.message, true); });
}
function printRep(req) {
  if (!REP.data) return; var c = REP.data.cur;
  $('#printArea').innerHTML = '<div class="paper"><h4>รายงานคลินิกพิเศษเฉพาะทางนอกเวลา · ' + esc(periodLabel(REP.mode, REP.key)) + '</h4><div class="dl">' + esc(thDate(req.from, false, true)) + ' – ' + esc(thDate(req.to, false, true)) + '</div>' +
    '<table><tbody><tr><th>ผู้ป่วยทั้งหมด</th><td class="n">' + fmt(c.total, 0) + '</td><th>วันที่เปิด</th><td class="n">' + c.openDays + '</td><th>หัตถการรวม</th><td class="n">' + fmt(c.procTotal, 0) + '</td></tr>' +
    '<tr><th>Consult</th><td class="n">' + c.other.consult + '</td><th>Night OPD ชั้น 4</th><td class="n">' + c.other.nightOpd + '</td><th>Admit</th><td class="n">' + c.other.admit + '</td></tr></tbody></table><br>' +
    '<table><thead><tr><th>คลินิก</th><th>ชื่อ</th><th>วันที่เปิด</th><th>ผู้ป่วย</th></tr></thead><tbody>' + (c.clinics || []).map(function (x) { return '<tr><td>' + esc(x[0]) + '</td><td>' + esc(clinicShort(x[0])) + '</td><td class="n">' + x[2] + '</td><td class="n">' + fmt(x[1], 0) + '</td></tr>'; }).join('') + '</tbody></table><br>' +
    '<table><thead><tr><th>หัตถการ</th><th>ครั้ง</th></tr></thead><tbody>' + Object.keys(c.procs || {}).sort(function (a, b) { return c.procs[b] - c.procs[a]; }).map(function (k) { return '<tr><td>' + esc(itemName(k)) + '</td><td class="n">' + fmt(c.procs[k], 0) + '</td></tr>'; }).join('') + '</tbody></table>' +
    '<div style="text-align:right;color:#888;font-size:10px;margin-top:6px">พิมพ์จาก SMC Daily ' + esc(stampTh(nowStamp())) + '</div></div>';
  setTimeout(function () { window.print(); }, 60);
}

/* =====================================================================
   แดชบอร์ด
   ===================================================================== */
var DASH = { mode: 'month', key: null };
function pageDash() {
  if (!DASH.key || DASH.mode === 'day') { DASH.mode = DASH.mode === 'day' ? 'month' : DASH.mode; DASH.key = defaultKey(DASH.mode); }
  var req = rangeReq(DASH); req.fy = fyOf(req.to);
  $('#main').innerHTML = banners() + '<div class="pagehead rise"><div><div class="eyebrow">แดชบอร์ด</div><h1>' + esc(periodLabel(DASH.mode, DASH.key)) + '</h1><div class="small muted">' + esc(thDate(req.from)) + ' – ' + esc(thDate(req.to)) + '</div></div></div>' +
    periodPicker(DASH, 'dp', true) + '<div id="dashBody"><div class="stats">' + [1, 2, 3, 4].map(function () { return '<div class="stat skel" style="height:104px"></div>'; }).join('') + '</div><div class="card skel" style="height:300px;margin-top:18px"></div></div>';
  bindPicker(DASH, 'dp', pageDash);
  var key = DASH.mode + DASH.key;
  api('getDashboard', req, { onCache: function (d) { drawDash(d, req); } }).then(function (d) { if (S.page === 'dash' && DASH.mode + DASH.key === key) drawDash(d, req); }).catch(function (e) { toast(e.message, true); });
}
function drawDash(D, req) {
  var box = $('#dashBody'); if (!box) return;
  var c = D.cur, p = D.prev, okPrev = p && p.openDays > 0 && !p.nodataDays, fy = D.fy;
  var wdAvg = c.wd.n ? c.wd.vn / c.wd.n : 0, pwd = p && p.wd.n ? p.wd.vn / p.wd.n : null;
  var daily = c.daily || [], long = daily.length > 100;
  var trend;
  if (!long) trend = daily.map(function (x) { var d = pd(x[0]); return { label: String(d.getDate()), v: x[1] || 0, color: typeColor(x[2]), tip: '<b>' + esc(thDate(x[0], true)) + '</b><br>' + (x[1] == null ? 'รอข้อมูล' : fmt(x[1], 0) + ' ราย') + ' · ' + typeName(x[2]) }; });
  else { var mm = {}, ord = []; daily.forEach(function (x) { var k = x[0].slice(0, 7); if (!(k in mm)) { mm[k] = 0; ord.push(k); } mm[k] += x[1] || 0; }); trend = ord.map(function (k) { return { label: TH_M[+k.slice(5) - 1], v: mm[k], tip: '<b>' + esc(thMonth(k)) + '</b><br>' + fmt(mm[k], 0) + ' ราย' }; }); }
  var fyBars = fy.months.map(function (m, i) { var pv = fy.prevMonths[i] ? fy.prevMonths[i][1] : null; return { label: TH_M[+m[0].slice(5) - 1], v: m[1] || 0, ghost: pv || 0, tip: '<b>' + esc(thMonth(m[0])) + '</b><br>' + (m[1] == null ? 'ยังไม่มีข้อมูล' : fmt(m[1], 0) + ' ราย') + (pv ? '<br><span style="opacity:.75">ปีงบก่อน ' + fmt(pv, 0) + ' ราย</span>' : '') }; });
  var sparkVals = daily.slice(-30).map(function (x) { return x[1]; });
  var fyEnd = (fy.fy - 543) + '-09-30', lastH = fy.heat.length ? fy.heat[fy.heat.length - 1][0] : (fy.fy - 544) + '-09-30';
  for (var dd = addDays(lastH, 1); dd <= fyEnd; dd = addDays(dd, 1)) fy.heat.push([dd, null, '']);   // ทั้งปีงบ (วันที่ยังไม่ถึง = ช่องว่าง)
  var hmx = Math.max.apply(null, fy.heat.map(function (x) { return x[1] || 0; }).concat([1]));
  var firstDow = pd(fy.heat[0][0]).getDay(), heat = '';
  for (var k = 0; k < firstDow; k++) heat += '<i style="visibility:hidden"></i>';
  fy.heat.forEach(function (x, i) { heat += '<i data-tip="' + esc('<b>' + thDate(x[0], true) + '</b><br>' + (x[1] == null ? (x[0] > S.boot.today ? 'ยังไม่ถึง' : 'ไม่มีข้อมูล') : fmt(x[1], 0) + ' ราย')) + '" style="background:' + (x[0] > S.boot.today ? 'var(--surface-2);box-shadow:inset 0 0 0 1px var(--line)' : heatColor(x[1], hmx)) + ';animation-delay:' + (i * .002).toFixed(3) + 's"></i>'; });
  var clin = (c.clinics || []).slice(0, 10).map(function (x) { return ['<span class="code">' + esc(x[0]) + '</span> ' + esc(clinicShort(x[0])), x[1], x[0] + ' ' + clinicShort(x[0])]; });
  var docs = (c.doctors || []).slice(0, 10).map(function (x) { return [esc(x[0]), x[1], x[0]]; });
  var procs = Object.keys(c.procs || {}).map(function (k) { return [esc(itemName(k)), c.procs[k], itemName(k)]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 10);
  box.innerHTML = (c.nodataDays ? '<div class="banner warn" style="margin-bottom:12px">ยังไม่มียอดจาก API ' + c.nodataDays + ' วันในช่วงนี้</div>' : '') +
    '<div class="stats">' +
      '<div class="stat rise d1"><span class="lb">' + IC.users + 'ผู้ป่วยทั้งหมด</span><span class="v"><span data-count="' + c.total + '">0</span><small>ราย</small></span>' + deltaHtml(c.total, p && p.total, DASH.mode, okPrev, req.partial) + miniLine(sparkVals) + '</div>' +
      '<div class="stat rise d2"><span class="lb">' + IC.pulse + 'เฉลี่ยต่อวันทำการ</span><span class="v"><span data-count="' + wdAvg + '" data-dec="1">0</span><small>ราย/วัน</small></span>' + deltaHtml(wdAvg, pwd, DASH.mode, okPrev, req.partial) + '</div>' +
      '<div class="stat rise d3"><span class="lb">' + IC.cal + 'เฉลี่ยวันหยุด</span><span class="v"><span data-count="' + (c.off.n ? c.off.vn / c.off.n : 0) + '" data-dec="1">0</span><small>ราย/วัน</small></span><span class="d muted">' + c.off.n + ' วัน (เสาร์–อาทิตย์/นักขัตฤกษ์)</span></div>' +
      '<div class="stat rise d4"><span class="lb">' + IC.syringe + 'หัตถการรวม</span><span class="v"><span data-count="' + c.procTotal + '">0</span><small>ครั้ง</small></span><span class="d muted">' + (c.total ? fmt(c.procTotal / c.total * 100) + ' ครั้งต่อผู้ป่วย 100 ราย' : '') + (c.missingDays ? ' · ยังไม่คีย์ ' + c.missingDays + ' วัน' : '') + '</span></div></div>' +
    '<div class="dash-grid" style="margin-top:18px">' +
      '<section class="card wide rise d2"><div class="card-h"><h3><span class="ic">' + IC.dash + '</span>' + (long ? 'ผู้ป่วยรายเดือน' : 'แนวโน้มผู้ป่วยรายวัน') + '</h3>' + (long ? '' : '<div class="legend"><span><i style="background:var(--brand)"></i>วันทำการ</span><span><i style="background:var(--off)"></i>เสาร์–อาทิตย์</span><span><i style="background:var(--hol)"></i>วันหยุดนักขัตฤกษ์</span></div>') + '</div><div class="card-b">' + barChart(trend, { h: 240, aria: 'แนวโน้มผู้ป่วย', maxLabels: long ? 12 : 31 }) + '</div></section>' +
      '<section class="card rise d3"><div class="card-h"><h3><span class="ic">' + IC.clinic + '</span>Top 10 คลินิก</h3><span class="small muted">ผู้ป่วย (ราย)</span></div><div class="card-b">' + hbars(clin) + '</div></section>' +
      '<section class="card rise d3"><div class="card-h"><h3><span class="ic">' + IC.users + '</span>Top 10 แพทย์</h3><span class="small muted">ผู้ป่วย (ราย)</span></div><div class="card-b">' + hbars(docs) + '</div></section>' +
      '<section class="card rise d4"><div class="card-h"><h3><span class="ic">' + IC.syringe + '</span>หัตถการ Top 10</h3><span class="small muted">ครั้ง</span></div><div class="card-b">' + hbars(procs) + '</div></section>' +
      '<section class="card rise d4"><div class="card-h"><h3><span class="ic">' + IC.dash + '</span>รายเดือน ปีงบ ' + fy.fy + '</h3><div class="legend"><span><i style="background:var(--brand)"></i>ปีงบ ' + fy.fy + '</span><span><i style="background:transparent;outline:1.5px dashed var(--muted)"></i>ปีงบ ' + (fy.fy - 1) + '</span></div></div><div class="card-b">' + barChart(fyBars, { w: 440, h: 250, aria: 'ผู้ป่วยรายเดือนในปีงบ', maxLabels: 12 }) +
        '<p class="small muted" style="margin:8px 0 0">รวมปีงบ ' + fy.fy + ' <b>' + fmt(fy.total, 0) + '</b> ราย' + (fy.prevTotal ? ' · ปีงบ ' + (fy.fy - 1) + ' ' + fmt(fy.prevTotal, 0) + ' ราย' : '') + '</p></div></section>' +
      '<section class="card wide rise d5"><div class="card-h"><h3><span class="ic">' + IC.cal + '</span>ปฏิทินความหนาแน่น ปีงบ ' + fy.fy + '</h3><span class="heatlegend">น้อย ' + [0, 1, 2, 3, 4, 5].map(function (k) { return '<i style="background:var(--heat-' + k + ')"></i>'; }).join('') + ' มาก</span></div><div class="card-b"><div class="heatmap">' + heat + '</div><div class="row xs muted" style="justify-content:space-between;margin-top:6px"><span>ต.ค. ' + (fy.fy - 1) + '</span><span>ก.ย. ' + fy.fy + '</span></div></div></section>' +
    '</div>';
  countUp(box); bindTips(box);
}

/* =====================================================================
   ตั้งค่า (แอดมิน)
   ===================================================================== */
var SET = { tab: 'clinics', data: null };
function pageSet() {
  var tabs = [['clinics', 'คลินิก'], ['items', 'หัตถการ'], ['pos', 'ตำแหน่งเจ้าหน้าที่'], ['users', 'ผู้ใช้'], ['conn', 'การเชื่อมต่อ'], ['backfill', 'ข้อมูลย้อนหลัง'], ['audit', 'ประวัติการแก้ไข']];
  $('#main').innerHTML = banners() + '<div class="pagehead rise"><div><div class="eyebrow">ตั้งค่า · แอดมิน</div><h1>' + tabs.filter(function (t) { return t[0] === SET.tab; })[0][1] + '</h1></div></div>' +
    '<div class="tabs" role="tablist">' + tabs.map(function (t) { return '<button role="tab" data-st="' + t[0] + '" aria-selected="' + (SET.tab === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div><section class="card rise d1" style="padding:18px" id="setBody"><div class="skel" style="height:240px"></div></section>';
  $$('[data-st]').forEach(function (b) { b.onclick = function () { SET.tab = b.getAttribute('data-st'); pageSet(); }; });
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
    b.innerHTML = '<p class="small muted" style="margin-top:0">คลินิกใหม่ที่ API ส่งมาจะเพิ่มเองและแสดงไว้ก่อน · <b>ปิด</b> = ไม่แสดงและไม่นับในยอดรวมทุกหน้า (ข้อมูลดิบยังเก็บครบ เปิดกลับได้) · ลำดับว่าง = เรียงตามจำนวนผู้ป่วย</p><div class="tbl-wrap"><table class="tbl"><thead><tr><th>แสดง</th><th>รหัส</th><th>ชื่อย่อบนรายงาน</th><th>ชื่อจาก API</th><th class="num">ลำดับ</th><th class="num">ผู้ป่วยสะสม</th><th>พบล่าสุด</th></tr></thead><tbody>' +
      list.map(function (c) { return '<tr data-code="' + esc(c.code) + '"><td><label class="switch"><input type="checkbox" data-k="show"' + (c.show ? ' checked' : '') + ' aria-label="แสดง ' + esc(c.code) + '"><span></span></label></td><td><span class="code">' + esc(c.code) + '</span></td><td><input type="text" data-k="short" value="' + esc(c.short) + '" maxlength="40" style="width:150px" aria-label="ชื่อย่อ ' + esc(c.code) + '"></td><td class="small muted">' + esc(c.name) + '<br>' + esc(c.group) + '</td><td class="num"><input type="number" data-k="order" value="' + (c.order < 999 ? c.order : '') + '" style="width:64px" aria-label="ลำดับ ' + esc(c.code) + '"></td><td class="num">' + fmt(c.vn, 0) + '</td><td class="small muted">' + (c.last ? esc(thDate(c.last)) : '–') + '</td></tr>'; }).join('') + '</tbody></table></div>' + saveBtn('sv');
    $('#sv').onclick = function () {
      var out = $$('tr[data-code]', b).map(function (tr) { return { code: tr.getAttribute('data-code'), show: $('[data-k=show]', tr).checked, short: $('[data-k=short]', tr).value, order: $('[data-k=order]', tr).value }; });
      api('saveClinics', { list: out, _rid: rid() }).then(function (r) { toast('บันทึกแล้ว ' + r.saved + ' คลินิก'); forget('get'); return refreshBoot(); }).catch(function (e) { toast(e.message, true); });
    };
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
      $('#sv').onclick = function () { api('saveItems', { list: its, _rid: rid() }).then(function (r) { toast('บันทึกแล้ว ' + r.saved + ' รายการ'); forget('getAdmin'); return refreshBoot().then(pageSet); }).catch(function (e) { toast(e.message, true); }); };
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
      $('#sv').onclick = function () { api('savePositions', { list: ps, _rid: rid() }).then(function (r) { toast('บันทึกแล้ว ' + r.saved + ' ตำแหน่ง'); forget('getAdmin'); return refreshBoot(); }).catch(function (e) { toast(e.message, true); }); };
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
        api('saveUser', { username: $('#uu', m).value, name: $('#un', m).value, role: $('#ur', m).value, active: isNew ? true : $('#ua', m).checked, _rid: rid() }).then(function (r) {
          m.close(); forget('getAdmin'); if (r.tempPassword) showTemp(r.username, r.tempPassword); else toast('บันทึกแล้ว'); pageSet();
        }).catch(function (err) { toast(err.message, true); });
      };
    };
    $('#uadd').onclick = function () { userForm(null); };
    $$('[data-ue]', b).forEach(function (x) { x.onclick = function () { userForm(d.users.filter(function (u) { return u.username === x.getAttribute('data-ue'); })[0]); }; });
    $$('[data-ur]', b).forEach(function (x) { x.onclick = function () {
      var u = x.getAttribute('data-ur'), m = modal('ตั้งรหัสผ่านใหม่', '<p>ตั้งรหัสผ่านชั่วคราวใหม่ให้ <b>' + esc(u) + '</b>? ผู้ใช้จะออกจากระบบทุกเครื่องและต้องเปลี่ยนรหัสตอนเข้าครั้งถัดไป</p>', '<button class="btn" data-close>ยกเลิก</button><button class="btn btn-brand" id="rpok">ตั้งรหัสใหม่</button>', 'sm');
      $('#rpok', m).onclick = function () { api('resetPassword', { username: u, _rid: rid() }).then(function (r) { m.close(); showTemp(r.username, r.tempPassword); }).catch(function (e) { toast(e.message, true); }); };
    }; });
  } else if (t === 'conn') {
    var c = d.conn;
    b.innerHTML = '<div style="display:flex;flex-direction:column;gap:14px;max-width:760px">' +
      '<label class="field" for="capi">ลิงก์ API ยอดผู้ป่วย ({date} = yyyyMMdd)<input id="capi" type="text" value="' + esc(c.apiUrl) + '"></label>' +
      '<div class="row"><button class="btn" id="tapi">' + IC.refresh + 'ทดสอบ API (เมื่อวาน)</button><span class="small" id="tapiR"></span></div><hr style="border:0;border-top:1px solid var(--line);width:100%">' +
      '<label class="field" for="cduty">ลิงก์ /exec ของ SMC Duty<input id="cduty" type="text" value="' + esc(c.smcDutyUrl) + '" placeholder="https://script.google.com/macros/s/…/exec"></label>' +
      '<label class="field" for="ckey">รหัสลับร่วมกับ SMC Duty (DAILY_FEED_KEY) ' + (c.dutyKeySet ? '<span class="chip ok">ตั้งแล้ว</span>' : '<span class="chip warn">ยังไม่ได้ตั้ง</span>') + '<input id="ckey" type="password" autocomplete="off" placeholder="' + (c.dutyKeySet ? 'เว้นว่าง = ใช้รหัสเดิม' : 'วางรหัสลับ') + '"></label>' +
      '<div class="row"><button class="btn btn-sm" id="gkey">' + IC.key + 'สร้างรหัสลับใหม่</button><span class="xs muted">สร้างแล้วนำไปใส่ใน SMC Duty › Script Properties › DAILY_FEED_KEY ด้วย</span></div><div id="gkeyBox"></div>' +
      '<div class="row"><button class="btn" id="tduty">' + IC.refresh + 'ทดสอบ SMC Duty</button><button class="btn" id="scal">' + IC.cal + 'ซิงก์วันหยุดตอนนี้</button><span class="small" id="tdutyR"></span></div>' +
      '<dl class="kvlist"><dt>ซิงก์วันหยุดล่าสุด</dt><dd>' + esc(stampTh(c.calendarSyncedAt) || '–') + '</dd><dt>งานกลางคืนล่าสุด</dt><dd class="small">' + esc(c.lastNightly || '–') + '</dd><dt>หลังบ้าน build</dt><dd>' + esc(d.build) + '</dd></dl><hr style="border:0;border-top:1px solid var(--line);width:100%">' +
      '<label class="field" for="clh">บรรทัดแรกของข้อความไลน์<input id="clh" type="text" value="' + esc(c.lineHeader) + '" maxlength="120"></label>' +
      '<label class="field" for="crt">หัวกระดาษใบรายงาน<input id="crt" type="text" value="' + esc(c.reportTitle) + '" maxlength="160"></label></div>' + saveBtn('sv');
    var res = function (el, r) { $(el).innerHTML = r.ok ? '<span style="color:var(--ok)">✓ ' + r.text + '</span>' : '<span style="color:var(--bad)">✗ ' + esc(r.text) + '</span>'; };
    $('#tapi').onclick = function () { $('#tapiR').innerHTML = IC.spin.replace('<svg', '<svg width="14" height="14"'); api('testApi', {}).then(function (r) { res('#tapiR', r.ok ? { ok: 1, text: thDate(r.date) + ' ได้ ' + r.rows + ' แถว ผู้ป่วย ' + fmt(r.total, 0) + ' ราย (' + (r.ms / 1000).toFixed(1) + ' วิ)' } : { text: r.error }); }).catch(function (e) { res('#tapiR', { text: e.message }); }); };
    $('#tduty').onclick = function () { $('#tdutyR').innerHTML = IC.spin.replace('<svg', '<svg width="14" height="14"'); api('testDuty', {}).then(function (r) { res('#tdutyR', r.ok ? { ok: 1, text: 'เชื่อมต่อได้ · วันนี้ ' + r.people + ' คนในตารางเวร · ' + r.positions + ' ตำแหน่ง' } : { text: r.error }); }).catch(function (e) { res('#tdutyR', { text: e.message }); }); };
    $('#scal').onclick = function () { api('syncCalendar', {}).then(function (r) { toast('ซิงก์วันหยุดแล้ว ' + r.days + ' วัน'); refreshBoot(); }).catch(function (e) { toast(e.message, true); }); };
    $('#gkey').onclick = function () { api('newDutyKey', {}).then(function (r) { $('#ckey').value = r.key; $('#gkeyBox').innerHTML = '<div class="secret">' + esc(r.key) + '</div><p class="xs muted">คัดลอกรหัสนี้ไปใส่ใน SMC Duty แล้วกดบันทึกด้านล่าง</p>'; }).catch(function (e) { toast(e.message, true); }); };
    $('#sv').onclick = function () {
      var p = { apiUrl: $('#capi').value, smcDutyUrl: $('#cduty').value, lineHeader: $('#clh').value, reportTitle: $('#crt').value, _rid: rid() };
      if ($('#ckey').value) p.smcDutyKey = $('#ckey').value;
      api('saveConnection', p).then(function () { toast('บันทึกแล้ว'); forget('getAdmin'); refreshBoot().then(pageSet); }).catch(function (e) { toast(e.message, true); });
    };
  } else if (t === 'backfill') {
    var bf = d.backfill, total = datesIn(bf.from, bf.today).length, have = Math.min(total, bf.daysOk), p2 = total ? have / total * 100 : 0;
    var st = bf.status === 'done' ? '<span class="chip ok">' + IC.check + 'ครบแล้ว</span>' : bf.status === 'running' || bf.status === 'retry' ? '<span class="chip warn">' + IC.spin.replace('<svg', '<svg width="12" height="12"') + ' กำลังดึง</span>' : '<span class="chip idle">ยังไม่เริ่ม</span>';
    b.innerHTML = '<div style="display:flex;flex-direction:column;gap:14px;max-width:720px"><div class="row" style="justify-content:space-between"><b>ยอดผู้ป่วยย้อนหลังในระบบ</b>' + st + '</div>' +
      '<div class="progress" role="progressbar" aria-valuenow="' + Math.round(p2) + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + p2.toFixed(1) + '%"></i></div>' +
      '<dl class="kvlist"><dt>ช่วงที่ต้องการ</dt><dd>' + esc(thDate(bf.from)) + ' – ' + esc(thDate(bf.today)) + ' (' + fmt(total, 0) + ' วัน)</dd><dt>มีข้อมูลแล้ว</dt><dd>' + fmt(have, 0) + ' วัน (' + fmt(p2) + '%) · เก่าสุด ' + esc(bf.firstDate ? thDate(bf.firstDate) : '–') + '</dd>' +
      (bf.status && bf.status !== 'done' ? '<dt>กำลังดึงถึงวันที่</dt><dd>' + esc(bf.cursor ? thDate(bf.cursor) : '–') + '</dd>' : '') + '<dt>ดึงไม่สำเร็จ (จะลองใหม่)</dt><dd>' + bf.errors + ' วัน</dd></dl>' +
      '<p class="small muted" style="margin:0">ระบบดึงเบื้องหลังทุก 10 นาที ครั้งละประมาณ 4 นาที เว้นช่วง 1.5 วินาทีต่อวัน (API ตอบว่างถ้าถามถี่) · ไม่กระทบการใช้งานของพยาบาล</p>' +
      '<form class="row" id="bff"><label class="small" for="bfd">ดึงย้อนหลังตั้งแต่</label><input type="date" id="bfd" value="' + esc(bf.from) + '" min="2020-07-01" max="' + esc(bf.today) + '"><button class="btn" type="submit">เริ่มดึง</button><span class="xs muted">ข้อมูลใน API เริ่มประมาณ ก.ค. 2563</span></form></div>';
    $('#bff').onsubmit = function (e) { e.preventDefault(); api('startBackfill', { from: $('#bfd').value }).then(function () { toast('เริ่มดึงย้อนหลังแล้ว ระบบทำต่อเบื้องหลัง'); forget('getAdmin'); pageSet(); }).catch(function (er) { toast(er.message, true); }); };
  }
}
function showTemp(u, pw) { modal('รหัสผ่านชั่วคราว', '<p>ผู้ใช้ <b>' + esc(u) + '</b></p><div class="secret" style="font-size:1.3rem;text-align:center">' + esc(pw) + '</div><p class="small muted">แจ้งรหัสนี้ให้ผู้ใช้ทางช่องทางส่วนตัว · แสดงครั้งเดียว · ผู้ใช้ต้องเปลี่ยนรหัสตอนเข้าครั้งแรก</p>', '<button class="btn btn-brand" data-close>รับทราบ</button>', 'sm'); }
function drawAudit() {
  var b = $('#setBody');
  api('getAudit', { limit: 300 }).then(function (r) {
    var A = { PROC: 'หัตถการ', FIELD: 'ยอดอื่น', STAFF: 'เจ้าหน้าที่', ADD_ITEM: 'เพิ่มรายการ', CLINIC: 'คลินิก', ADD_USER: 'เพิ่มผู้ใช้', EDIT_USER: 'แก้ผู้ใช้', RESET_PASSWORD: 'ตั้งรหัสใหม่', CHANGE_PASSWORD: 'เปลี่ยนรหัส', CONNECTION: 'การเชื่อมต่อ', BACKFILL: 'ดึงย้อนหลัง' };
    b.innerHTML = r.rows.length ? '<div class="tbl-wrap" style="max-height:600px;overflow:auto"><table class="tbl"><thead><tr><th>เวลา</th><th>ผู้ใช้</th><th>เรื่อง</th><th>วันที่รายงาน</th><th>ช่อง</th><th class="num">เดิม</th><th class="num">ใหม่</th></tr></thead><tbody>' +
      r.rows.map(function (x) { return '<tr><td class="small tnum">' + esc(stampTh(x[0])) + '</td><td>' + esc(x[1]) + '</td><td><span class="chip idle">' + esc(A[x[2]] || x[2]) + '</span></td><td class="small">' + (x[3] ? esc(thDate(x[3])) : '') + '</td><td>' + esc(x[4]) + '</td><td class="num muted">' + esc(x[5] || '–') + '</td><td class="num">' + esc(x[6] || '–') + '</td></tr>'; }).join('') + '</tbody></table></div>'
      : '<div class="empty">' + IC.inbox + 'ยังไม่มีประวัติการแก้ไข</div>';
  }).catch(function (e) { toast(e.message, true); });
}
