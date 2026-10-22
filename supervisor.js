/* =====================================================================
   supervisor.js — รายงานส่งเวรตรวจการ (ครั้งที่ 6 · 22 ต.ค. 69)
   ตารางหน้าตาเดียวกับชีทเวรตรวจการ "NOPD /คลินิกพิเศษ" → กดคัดลอกครั้งเดียว ไปวางที่ช่อง W7 ได้ทันที
   แถว = หมวดสิทธิ 10 แถว (ลำดับตามชีทของทีมตรวจการ ห้ามเปลี่ยน) · คอลัมน์ = แพทย์ (คลินิกตรวจ) + คลินิกบริการ (ESOT, CTOT, …)
   กติกา (ตกลงกับผู้ใช้ 22 ต.ค. 69):
    - นับตามสิทธิหลัก (ตามทะเบียน) · มีสิทธิกลุ่ม "นับก่อน" ร่วม (ประกันชีวิต/คู่สัญญา) → นับแถวนั้น (เหมือนหน้ารายงานประจำวัน)
    - 30 บาท นับเป็น "ในเขต" ทั้งหมด · แถว "เด็ก" และ "30 บาท นอกเขต" ว่างไว้ (คงไว้ให้ตรงช่องในชีท)
    - คลินิกบริการแสดงเป็นรหัสคลินิก (แอดมินตั้งได้) · รหัสสาขารวมเข้ารหัสหลัก (ATOT-CLPC → ATOT) · แสดงเฉพาะที่มียอด
    - แพทย์เรียงตามตัวอักษร ลากเปลี่ยนลำดับได้ (จำแยกวัน/ผู้ใช้ในเครื่อง) · แพทย์ตรวจหลายคลินิก = คอลัมน์เดียว
    - คัดลอกเฉพาะ W7:…17 (หัวคอลัมน์ + 10 แถว) ไม่รวมแถว/คอลัมน์ "รวม" เพราะในชีทเป็นสูตร · ช่องที่ไม่มียอดเว้นว่าง
   ===================================================================== */
'use strict';
var SV_ROWS = [['sso', 'ปกส.'], ['gen', 'ทั่วไป'], ['kid', 'เด็ก'], ['ucin', '30 บาท ในเขต'], ['ucout', '30 บาท นอกเขต'], ['staff', 'จนท./ครอบครัว'], ['life', 'ประกันชีวิต'], ['mva', 'พรบ.'], ['fund', 'กองทุน'], ['gov', 'ขรก.']];
var SV_DEF_CLINICS = ['ESOT', 'CTOT', 'MROT', 'USOT', 'MAOT', 'ATOT', 'LABOT'];
var SV_START_COL = 23, SV_MAX_COLS = 22;   // ชีทเวรตรวจการ: W (คอลัมน์ที่ 23) ถึง AR = 22 คอลัมน์ · AS = สูตรรวมรายแถว
/** ชื่อสิทธิหลัก → แถว (ค่าตั้งต้น · แอดมินเปลี่ยนได้ที่ ตั้งค่า › ส่งเวรตรวจการ) */
var SV_RULES = [
  [/ประกันสังคม/, 'sso'], [/ประกันสุขภาพ|30\s*บาท|บัตรทอง/, 'ucin'],
  [/กรมบัญชีกลาง|ข้าราชการ|บำนาญ|ปกครองส่วนท้องถิ่น|อปท|เขตปกครองพิเศษ/, 'gov'],
  [/สภากาชาด/, 'staff'], [/ประกันชีวิต|คู่สัญญา|ใบส่งตัว|บริษัท/, 'life'], [/พรบ|ผู้ประสบภัย/, 'mva'], [/กองทุน/, 'fund']
];
var SV = { date: null, data: null, refreshing: false, err: '' };

function svCfg() { var c = (S.boot && S.boot.supervisor) || {}; return { clinics: Array.isArray(c.clinics) ? c.clinics : SV_DEF_CLINICS.slice(), map: c.map || {} }; }
function svRowLabel(id) { var r = SV_ROWS.filter(function (x) { return x[0] === id; })[0]; return r ? r[1] : id; }
function svRuleRow(name) { for (var i = 0; i < SV_RULES.length; i++) if (SV_RULES[i][0].test(name)) return SV_RULES[i][1]; return 'gen'; }
function svRowOfName(name, cfg) { cfg = cfg || svCfg(); return cfg.map[name] || svRuleRow(name); }
/** แถวของ 1 รายการใน cube สิทธิ: สิทธิหลัก · ถ้ามีสิทธิของกลุ่ม "นับก่อนสิทธิหลัก" ร่วม (เช่น ประกันชีวิต) → แถวของสิทธินั้น */
function svRowOf(e, cfg) {
  var main = rtName(e.m);
  if (e.s) {
    var sec = rtName(e.s).split(' + ');
    for (var i = 0; i < sec.length; i++) { var g = rgById(ptGroupByName(sec[i])); if (g && g.prio && sec[i] !== main) return svRowOfName(sec[i], cfg); }
  }
  return svRowOfName(main, cfg);
}
/** คลินิกนี้แสดงเป็นคอลัมน์คลินิกไหม → รหัสคอลัมน์ ('' = แยกตามแพทย์) */
function svClinicCol(code, cfg) {
  var l = cfg.clinics;
  for (var i = 0; i < l.length; i++) if (code === l[i] || code.indexOf(l[i] + '-') === 0) return l[i];
  return clinicMerged(code) ? code : '';
}
function svLetter(n) { var s = ''; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
function svOrdKey(date) { return 'sv:ord:' + S.me.user + ':' + date; }

/** สร้างตารางจากข้อมูลของวัน → {cols:[{key, label, kind, total, clinics, tip}], grid:{col:{row:n}}, total, warn:[]} */
function svBuild(d) {
  var cfg = svCfg(), cols = {}, warn = [], unknown = 0;
  var rows = (d.api.rows || []).filter(function (r) { return isShown(r[0]); });
  rows.forEach(function (r) {
    var cc = svClinicCol(r[0], cfg), key = cc ? 'c:' + cc : 'd:' + (r[3] || r[1]);
    var C = cols[key] || (cols[key] = { key: key, kind: cc ? 'c' : 'd', code: cc, name: r[1], total: 0, clinics: {}, grid: {} });
    C.total += r[2]; C.clinics[r[0]] = (C.clinics[r[0]] || 0) + r[2];
  });
  var cube = d.api.rights ? decodeCube(d.api.rights).filter(function (e) { return isShown(e.c); }) : null;
  if (cube) cube.forEach(function (e) {
    var cc = svClinicCol(e.c, cfg), C = cols[cc ? 'c:' + cc : 'd:' + e.d]; if (!C) return;
    if (!rtName(e.m)) unknown += e.n;
    var row = svRowOf(e, cfg); C.grid[row] = (C.grid[row] || 0) + e.n;
  });
  var list = Object.keys(cols).map(function (k) { return cols[k]; });
  // ชื่อหัวคอลัมน์แพทย์: "พ.ชื่อต้น" · ชื่อต้นซ้ำกัน → เติมอักษรแรกของนามสกุล
  var docs = list.filter(function (c) { return c.kind === 'd'; }), fc = {};
  docs.forEach(function (c) { c.first = firstName(c.name); fc[c.first] = (fc[c.first] || 0) + 1; });
  docs.forEach(function (c) { var last = bareName(c.name).split(' ')[1]; c.label = 'พ.' + c.first + (fc[c.first] > 1 && last ? ' ' + last.charAt(0) + '.' : ''); });
  list.forEach(function (c) {
    if (c.kind === 'c') c.label = c.code;
    c.tip = c.kind === 'd' ? personName(c.name) + ' · ' + Object.keys(c.clinics).map(function (k) { return k + ' ' + c.clinics[k]; }).join(', ') : Object.keys(c.clinics).map(function (k) { return clinicShort(k) + ' (' + k + ') ' + c.clinics[k]; }).join(', ');
    c.sum = Object.keys(c.grid).reduce(function (s, k) { return s + c.grid[k]; }, 0);
  });
  // ลำดับ: แพทย์เรียงตามตัวอักษร → คลินิกบริการตามลำดับที่แอดมินตั้ง · ลำดับที่ผู้ใช้ลากไว้ใช้ก่อน
  docs.sort(function (a, b) { return a.label.localeCompare(b.label, 'th'); });
  var cl = list.filter(function (c) { return c.kind === 'c'; }).sort(function (a, b) { var ia = cfg.clinics.indexOf(a.code), ib = cfg.clinics.indexOf(b.code); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.code.localeCompare(b.code); });
  var def = docs.concat(cl), by = {}; def.forEach(function (c) { by[c.key] = c; });
  var saved = store(svOrdKey(d.date)) || [], out = [];
  saved.forEach(function (k) { if (by[k]) { out.push(by[k]); delete by[k]; } });
  def.forEach(function (c) {
    if (!by[c.key]) return;
    if (c.kind === 'd') { var at = -1; out.some(function (x, i) { if (x.kind === 'c') { at = i; return true; } return false; }); if (at < 0) out.push(c); else out.splice(at, 0, c); }
    else out.push(c);
  });
  var total = list.reduce(function (s, c) { return s + c.total; }, 0);
  if (rows.length && !cube) warn.push('วันนี้ยังไม่มีข้อมูลสิทธิการรักษาจากระบบ รพ. จึงแยกตามสิทธิไม่ได้ (แสดงเฉพาะยอดรวม)');
  else {
    var bad = out.filter(function (c) { return c.sum !== c.total; });
    if (bad.length) warn.push('ยอดแยกตามสิทธิไม่เท่ากับยอดผู้ป่วยใน ' + bad.length + ' คอลัมน์ (' + bad.map(function (c) { return c.label + ' ' + c.sum + '/' + c.total; }).join(', ') + ') · กด "อัปเดตเดี๋ยวนี้" แล้วลองใหม่');
  }
  return { cols: out, total: total, warn: warn, unknown: unknown, custom: saved.length > 0, noRights: rows.length > 0 && !cube };
}
/** ข้อความแบบแท็บ (TSV) สำหรับวางใน Google Sheet · ไม่มียอด = ว่าง */
function svTsv(T, withHead) {
  var lines = [];
  if (withHead) lines.push(T.cols.map(function (c) { return c.label; }).join('\t'));
  SV_ROWS.forEach(function (r) { lines.push(T.cols.map(function (c) { return c.grid[r[0]] ? String(c.grid[r[0]]) : ''; }).join('\t')); });
  return lines.join('\n');
}

/* ---------- หน้า ---------- */
function pageSv() {
  var date = S.date || S.boot.today;
  if (date > S.boot.today) date = S.date = S.boot.today;
  SV.date = date; SV.data = null; SV.err = '';
  $('#main').innerHTML = banners() + svHead(date);
  $('#svBody').innerHTML = '<section class="card"><div class="card-b"><div class="skel" style="height:360px"></div></div></section>';
  svBindHead(date);
  api('getDay', { date: date }, { onCache: function (d) { if (S.page === 'sv' && SV.date === d.date) { SV.data = d; svDraw(); } } }).then(function (d) {
    if (S.page !== 'sv' || SV.date !== date) return;
    SV.data = d; svDraw();
    if (d.api.stale) svRefresh(false);
  }).catch(function (e) { if (S.page === 'sv') { if (!SV.data) $('#svBody').innerHTML = '<div class="empty">' + IC.warn + esc(e.message) + '</div>'; else toast(e.message, true); } });
}
function svHead(date) {
  var isToday = date === S.boot.today;
  return '<div class="pagehead rise"><div><div class="eyebrow">ส่งเวรตรวจการ · ชีท “NOPD /คลินิกพิเศษ”</div><h1>' + esc(thDate(date, true, true)) + '</h1><div class="small muted">ยอดผู้ป่วยแยกสิทธิ × แพทย์/คลินิก · กดคัดลอกแล้ววางที่ช่อง <b>W7</b> ของชีทเวรตรวจการ</div></div>' +
    '<div class="row">' + helpBtn() + '<div class="dnav sv-dnav"><button class="iconbtn" id="sprev" aria-label="วันก่อนหน้า">' + IC.prev + '</button><input type="date" id="spick" value="' + date + '" max="' + S.boot.today + '" aria-label="เลือกวันที่"><button class="iconbtn" id="snext" aria-label="วันถัดไป"' + (isToday ? ' disabled' : '') + '>' + IC.next + '</button>' + (isToday ? '' : '<button class="btn btn-sm" id="stoday">วันนี้</button>') + '</div></div></div>' +
    '<div id="svBody"></div>';
}
function svBindHead(date) {
  bindHelp($('#main'));
  var go2 = function (d) { if (d > S.boot.today) return; S.date = d; pageSv(); };
  $('#sprev').onclick = function () { go2(addDays(date, -1)); };
  $('#snext').onclick = function () { if (date < S.boot.today) go2(addDays(date, 1)); };
  $('#spick').onchange = function (e) { if (e.target.value) go2(e.target.value); };
  var t = $('#stoday'); if (t) t.onclick = function () { go2(S.boot.today); };
}
function svRefresh(force, btn) {
  if (SV.refreshing && !force) return;
  var date = SV.date; SV.refreshing = true; SV.err = ''; svState();
  var p = api('refreshDay', { date: date, force: !!force });
  if (btn) busy(btn, p, 'กำลังดึง…').catch(function () { });
  p.then(function (d) {
    SV.refreshing = false;
    if (S.page !== 'sv' || SV.date !== date || !SV.data) return;
    forget('getDay|{"date":"' + date + '"}');
    var changed = JSON.stringify(SV.data.api.rows) !== JSON.stringify(d.api.rows) || SV.data.api.rights !== d.api.rights;
    SV.data.api = d.api; SV.err = d.warn || '';
    if (changed) { svDraw(); if (force) toast('อัปเดตยอดแล้ว ' + (d.api.at || '').slice(11, 16) + ' น.'); } else { svState(); if (force && !d.warn) toast('ยอดล่าสุดแล้ว (' + (d.api.at || '').slice(11, 16) + ' น.)'); }
  }).catch(function (e) { SV.refreshing = false; SV.err = e.message; svState(); });
}
function svState() {
  var el = $('#svState'), d = SV.data; if (!el || !d) return;
  var t = SV.refreshing ? 'กำลังดึงยอดล่าสุดจากระบบ รพ.…' : SV.err ? SV.err : d.api.status !== 'ok' ? 'ยังไม่มีข้อมูลจากระบบ รพ.' : d.api.final ? 'ยอดสุดท้ายของวัน · ' + stampTh(d.api.at) : 'ข้อมูล ณ ' + (d.date === S.boot.today ? (d.api.at || '').slice(11, 16) + ' น.' : stampTh(d.api.at));
  el.innerHTML = (SV.refreshing ? IC.spin.replace('<svg', '<svg width="13" height="13"') : '') + esc(t);
  el.className = 'small ' + (SV.err ? 'sv-err' : 'muted');
  var b = $('#svRef'); if (b) b.hidden = !d.api.canRefresh;
}

function svDraw() {
  var d = SV.data, box = $('#svBody'); if (!d || !box) return;
  var T = svBuild(d); SV.T = T;
  if (T.unknown && !SV.bootAsked) { SV.bootAsked = true; refreshBoot().then(function () { if (S.page === 'sv') svDraw(); }).catch(function () { }); }
  var withHead = store('sv:head') !== false, n = T.cols.length, nd = T.cols.filter(function (c) { return c.kind === 'd'; }).length;
  var lastCol = svLetter(SV_START_COL + Math.max(n, 1) - 1), over = n > SV_MAX_COLS;
  var top = '<div class="sv-bar">' +
    '<div class="sv-kpi"><b>' + fmt(T.total, 0) + '</b><span>ราย</span><i></i><b>' + nd + '</b><span>แพทย์</span><i></i><b>' + (n - nd) + '</b><span>คลินิกบริการ</span><i></i><b>' + n + '</b><span>คอลัมน์ (W–' + lastCol + ')</span></div>' +
    '<div class="row sv-st"><span id="svState" class="small muted"></span><button class="btn btn-sm" id="svRef">' + IC.refresh + 'อัปเดตเดี๋ยวนี้</button></div></div>';
  var warns = T.warn.slice();
  if (over) warns.push('มี ' + n + ' คอลัมน์ เกินช่องของชีท (W–AR รับได้ 22 คอลัมน์) · ถ้าวางทั้งหมด คอลัมน์ที่ 23 ขึ้นไปจะทับคอลัมน์ AS “รวม 16-20.30” ที่เป็นสูตร — รวมบางคลินิกเองก่อน หรือแทรกคอลัมน์ในชีทก่อนวาง');
  var hd = '<tr class="sv-letters"><th></th>' + T.cols.map(function (c, i) { return '<th class="' + (i >= SV_MAX_COLS ? 'sv-over' : '') + '">' + svLetter(SV_START_COL + i) + '</th>'; }).join('') + '<th class="sv-sumc"></th></tr>' +
    '<tr class="sv-hrow"><th class="sv-lab">Pt./แพทย์</th>' + T.cols.map(function (c, i) {
      return '<th class="sv-h ' + (c.kind === 'c' ? 'is-c' : 'is-d') + (i >= SV_MAX_COLS ? ' sv-over' : '') + '" draggable="true" data-col="' + esc(c.key) + '" title="' + esc(c.tip) + ' · ลากเพื่อย้ายลำดับ">' +
        '<span class="sv-hn">' + esc(c.label) + '</span><span class="sv-mv"><button type="button" data-mv="-1" aria-label="ย้าย ' + esc(c.label) + ' ไปซ้าย"' + (i ? '' : ' disabled') + '>‹</button><span class="sv-grip" aria-hidden="true">' + IC.grip + '</span><button type="button" data-mv="1" aria-label="ย้าย ' + esc(c.label) + ' ไปขวา"' + (i < n - 1 ? '' : ' disabled') + '>›</button></span></th>';
    }).join('') + '<th class="sv-sumc">รวม</th></tr>';
  var bd = SV_ROWS.map(function (r) {
    var s = T.cols.reduce(function (a, c) { return a + (c.grid[r[0]] || 0); }, 0);
    return '<tr' + (r[0] === 'kid' || r[0] === 'ucout' ? ' class="sv-na" title="ไม่แยกแล้ว (ตกลง 22 ต.ค. 69) · เว้นว่างไว้ให้ตรงช่องในชีท"' : '') + '><th class="sv-lab">' + esc(r[1]) + '</th>' + T.cols.map(function (c, i) { var v = c.grid[r[0]] || 0; return '<td class="num' + (v ? '' : ' z') + (i >= SV_MAX_COLS ? ' sv-over' : '') + '">' + (v || '') + '</td>'; }).join('') + '<td class="num sv-sumc">' + (s || '') + '</td></tr>';
  }).join('');
  var ft = '<tr><th class="sv-lab">รวม</th>' + T.cols.map(function (c) { return '<td class="num">' + c.sum + '</td>'; }).join('') + '<td class="num sv-sumc">' + T.cols.reduce(function (a, c) { return a + c.sum; }, 0) + '</td></tr>';
  box.innerHTML = '<section class="card rise d1">' + top + (warns.length ? '<div class="sv-warns">' + warns.map(function (w) { return '<div class="banner warn">' + IC.warn.replace('<svg', '<svg width="16" height="16"') + '<span>' + esc(w) + '</span></div>'; }).join('') + '</div>' : '') +
    (n ? '<div class="sv-copybar"><label class="row small" for="svHead"><input type="checkbox" id="svHead"' + (withHead ? ' checked' : '') + '> รวมแถวชื่อแพทย์/คลินิก</label><span class="small muted" id="svWhere">' + svWhere(withHead, n) + '</span><span class="grow"></span>' +
      (T.custom ? '<button class="btn btn-sm btn-ghost" id="svSort" title="ยกเลิกลำดับที่ลากไว้">เรียงตามตัวอักษร</button>' : '') + '<button class="btn btn-brand" id="svCopy">' + IC.copy + 'คัดลอกไปวางในชีท</button></div>' +
      '<div class="tbl-wrap sv-wrap"><table class="sv-tbl" id="svTbl"><thead>' + hd + '</thead><tbody>' + bd + '</tbody><tfoot>' + ft + '</tfoot></table></div>' +
      '<p class="xs muted sv-note">พื้นที่สีอ่อน = ส่วนที่คัดลอก · แถว/คอลัมน์ “รวม” ไม่คัดลอก (ในชีทเป็นสูตรอยู่แล้ว) · นับตามสิทธิหลัก มีประกันชีวิต/คู่สัญญาร่วม → ประกันชีวิต · 30 บาทนับเป็นในเขตทั้งหมด · รหัสสาขารวมเข้ารหัสหลัก (เช่น ATOT-CLPC → ATOT) · แพทย์ตรวจหลายคลินิกรวมเป็นคอลัมน์เดียว · ลาก/กด ‹ › ที่หัวคอลัมน์เพื่อย้ายลำดับ (จำไว้เฉพาะเครื่องนี้)</p>'
      : '<div class="empty">' + IC.inbox + (d.api.status === 'ok' ? 'ไม่มีผู้ป่วยนอกเวลาในวันนี้' : SV.refreshing ? 'กำลังดึงยอดจากระบบโรงพยาบาล…' : 'ยังไม่มีข้อมูลจากระบบ รพ. ของวันนี้') + '</div>') + '</section>';
  svState();
  $('#svRef').onclick = function () { svRefresh(true, $('#svRef')); };
  if (!n) return;
  $('#svHead').onchange = function (e) { store('sv:head', e.target.checked); $('#svWhere').innerHTML = svWhere(e.target.checked, n); $('#svTbl').classList.toggle('nohead', !e.target.checked); };
  $('#svTbl').classList.toggle('nohead', !withHead);
  $('#svCopy').onclick = function () { svCopy($('#svHead').checked); };
  var so = $('#svSort'); if (so) so.onclick = function () { store(svOrdKey(d.date), null); svDraw(); };
  svBindOrder();
}
function svWhere(h, n) { var a = h ? 'W7' : 'W8', b = svLetter(SV_START_COL + n - 1) + '17'; return 'คลิกช่อง <b>' + a + '</b> ในชีทแล้ววาง (ได้ ' + a + ':' + b + ')'; }
function svMove(key, to) {
  var keys = SV.T.cols.map(function (c) { return c.key; }), i = keys.indexOf(key); if (i < 0) return;
  keys.splice(i, 1); keys.splice(Math.max(0, Math.min(keys.length, to)), 0, key);
  store(svOrdKey(SV.data.date), keys); svDraw();
}
function svBindOrder() {
  var drag = null;
  $$('.sv-h').forEach(function (th) {
    var key = th.getAttribute('data-col');
    $$('[data-mv]', th).forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); var i = SV.T.cols.map(function (c) { return c.key; }).indexOf(key); svMove(key, i + (+b.getAttribute('data-mv'))); }; });
    th.addEventListener('dragstart', function (e) { drag = key; th.classList.add('dragging'); try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', key); } catch (x) { } });
    th.addEventListener('dragend', function () { drag = null; $$('.sv-h').forEach(function (x) { x.classList.remove('dragging', 'drop-l', 'drop-r'); }); });
    th.addEventListener('dragover', function (e) { if (!drag || drag === key) return; e.preventDefault(); var r = th.getBoundingClientRect(), left = e.clientX < r.left + r.width / 2; th.classList.toggle('drop-l', left); th.classList.toggle('drop-r', !left); });
    th.addEventListener('dragleave', function () { th.classList.remove('drop-l', 'drop-r'); });
    th.addEventListener('drop', function (e) {
      e.preventDefault(); if (!drag || drag === key) return;
      var keys = SV.T.cols.map(function (c) { return c.key; }).filter(function (k) { return k !== drag; }), r = th.getBoundingClientRect(), at = keys.indexOf(key) + (e.clientX < r.left + r.width / 2 ? 0 : 1);
      keys.splice(at, 0, drag); store(svOrdKey(SV.data.date), keys); svDraw();
    });
  });
}
function svCopy(withHead) {
  var T = SV.T; if (!T || !T.cols.length) return;
  var txt = svTsv(T, withHead), msg = 'คัดลอกแล้ว · ไปที่ชีทเวรตรวจการ คลิกช่อง ' + (withHead ? 'W7' : 'W8') + ' แล้วกด Ctrl+V (มือถือ: แตะค้าง › วาง)';
  var fallback = function () {
    var ta = document.createElement('textarea'); ta.value = txt; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(ta); ta.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e) { }
    ta.remove(); if (ok) toast(msg); else svShowText(txt);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function () { toast(msg); }, fallback); else fallback();
  SV.lastCopy = txt;
}
function svShowText(txt) {
  var m = modal('คัดลอกเอง', '<p class="small">เบราว์เซอร์นี้ไม่อนุญาตให้คัดลอกอัตโนมัติ · เลือกข้อความด้านล่างทั้งหมดแล้วคัดลอก</p><textarea class="sv-raw" rows="8" readonly>' + esc(txt) + '</textarea>', '', 'sheet');
  var ta = $('textarea', m); ta.focus(); ta.select();
}

/* ---------- ตั้งค่า › ส่งเวรตรวจการ (แอดมิน) ---------- */
function drawSvSet(b, d) {
  var cfg = svCfg(), clinics = cfg.clinics.slice(), map = {}, counts = d.rightCounts || {};
  var pts = (d.rightTypes || []).filter(function (r) { return r.kind === 'pt'; }).map(function (r) { return { id: r.id, name: r.name, n: counts[r.id] || 0 }; });
  if (!pts.some(function (p) { return p.name === 'เงินสด'; })) pts.push({ id: '', name: 'เงินสด', n: 0 });
  pts.sort(function (a, b2) { return (b2.n - a.n) || a.name.localeCompare(b2.name, 'th'); });
  pts.forEach(function (p) { map[p.name] = svRowOfName(p.name, cfg); });
  var codes = (d.clinics || []).map(function (c) { return c.code; }).sort();
  var draw = function () {
    b.innerHTML = '<p class="small muted" style="margin-top:0">ใช้กับเมนู <b>ส่งเวรตรวจการ</b> (ตารางวางในชีทเวรตรวจการ “NOPD /คลินิกพิเศษ” ที่ช่อง W7) · แถว 10 แถวตายตัวตามชีทของทีมตรวจการ</p>' +
      '<h4 class="sv-sh">คลินิกที่แสดงเป็นคอลัมน์คลินิก (ไม่แยกแพทย์)</h4><p class="xs muted">เรียงตามลำดับนี้ ต่อท้ายคอลัมน์แพทย์ · รหัสสาขารวมเข้ารหัสหลักเอง (เช่น ATOT-CLPC, ATOT-CNPPC → ATOT) · คลินิกที่ตั้ง “รวมแพทย์” แสดงเป็นคอลัมน์คลินิกเสมอ · คลินิกอื่นแยกตามแพทย์</p>' +
      '<div class="sv-chips">' + clinics.map(function (c, i) { return '<span class="sv-chip"><button type="button" data-cm="' + i + '" data-d="-1" aria-label="เลื่อน ' + esc(c) + ' ขึ้น"' + (i ? '' : ' disabled') + '>‹</button><b>' + esc(c) + '</b><button type="button" data-cm="' + i + '" data-d="1" aria-label="เลื่อน ' + esc(c) + ' ลง"' + (i < clinics.length - 1 ? '' : ' disabled') + '>›</button><button type="button" data-cx="' + i + '" aria-label="เอา ' + esc(c) + ' ออก">×</button></span>'; }).join('') +
      '<form class="row" id="svAdd"><select id="svAddSel" aria-label="เพิ่มคลินิก"><option value="">+ เพิ่มคลินิก…</option>' + codes.filter(function (c) { return clinics.indexOf(c) < 0; }).map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('') + '</select><button class="btn btn-sm" type="submit">เพิ่ม</button><button class="btn btn-sm btn-ghost" type="button" id="svDefC">ค่าตั้งต้น</button></form></div>' +
      '<h4 class="sv-sh">จับคู่สิทธิการรักษา → แถวในชีทเวรตรวจการ</h4><p class="xs muted">ใช้สิทธิหลักของผู้ป่วย (ตามทะเบียน) · ถ้ามีสิทธิของกลุ่มที่ตั้ง “นับก่อนสิทธิหลัก” ร่วม (ตั้งค่า › สิทธิการรักษา เช่น ประกันชีวิต) จะนับแถวของสิทธินั้น · สิทธิใหม่ที่ยังไม่จับคู่ใช้ค่าตั้งต้นตามชื่อ (ไม่ตรงกฎ = ทั่วไป)</p>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>สิทธิ (จากระบบ รพ.)</th><th class="num">ผู้ป่วย 90 วัน</th><th>แถวในชีท</th><th></th></tr></thead><tbody>' +
      pts.map(function (p) { var dr = svRuleRow(p.name); return '<tr><td>' + esc(p.name) + '</td><td class="num">' + fmt(p.n, 0) + '</td><td><select data-pt="' + esc(p.name) + '" aria-label="แถวของ ' + esc(p.name) + '">' + SV_ROWS.map(function (r) { return '<option value="' + r[0] + '"' + (map[p.name] === r[0] ? ' selected' : '') + '>' + esc(r[1]) + (r[0] === dr ? ' (ค่าตั้งต้น)' : '') + '</option>'; }).join('') + '</select></td><td class="xs muted">' + (map[p.name] !== dr ? 'แก้จากค่าตั้งต้น' : '') + '</td></tr>'; }).join('') +
      '</tbody></table></div>' + saveBtn('svSave');
    $$('[data-cm]', b).forEach(function (x) { x.onclick = function () { var i = +x.getAttribute('data-cm'), j = i + (+x.getAttribute('data-d')), t = clinics[i]; clinics[i] = clinics[j]; clinics[j] = t; draw(); }; });
    $$('[data-cx]', b).forEach(function (x) { x.onclick = function () { clinics.splice(+x.getAttribute('data-cx'), 1); draw(); }; });
    $('#svAdd', b).onsubmit = function (e) { e.preventDefault(); var v = $('#svAddSel', b).value; if (v && clinics.indexOf(v) < 0) { clinics.push(v); draw(); } };
    $('#svDefC', b).onclick = function () { clinics = SV_DEF_CLINICS.slice(); draw(); };
    $$('[data-pt]', b).forEach(function (s) { s.onchange = function () { map[s.getAttribute('data-pt')] = s.value; draw(); }; });
    $('#svSave', b).onclick = function () {
      var over = {}; Object.keys(map).forEach(function (k) { if (map[k] !== svRuleRow(k)) over[k] = map[k]; });
      busy($('#svSave', b), api('saveSupervisor', { clinics: clinics, map: over, _rid: rid() }), 'กำลังบันทึก…').then(function (r) {
        toast('บันทึกแล้ว · คลินิก ' + r.clinics.length + ' รายการ · จับคู่สิทธิที่แก้ ' + Object.keys(r.map).length + ' รายการ'); SET.dirty = false; forget('getAdmin'); return refreshBoot();
      }).catch(function (e) { toast(e.message, true); });
    };
  };
  draw();
}

/* ---------- วิธีใช้ ---------- */
if (typeof HELP !== 'undefined') {
  HELP.sv = ['ส่งเวรตรวจการ', [
    ['ใช้ทำอะไร', 'สร้างตารางยอดผู้ป่วยแยกสิทธิ × แพทย์/คลินิก หน้าตาเหมือนชีทเวรตรวจการ “NOPD /คลินิกพิเศษ” ไม่ต้องนับ/บวกเอง'],
    ['คัดลอกไปวาง', 'กด “คัดลอกไปวางในชีท” → เปิดชีทเวรตรวจการของวัน คลิกช่อง W7 (หัวคอลัมน์ชื่อแพทย์) แล้วกด Ctrl+V · ถ้าเอาติ๊ก “รวมแถวชื่อแพทย์” ออก ให้วางที่ W8'],
    ['ไม่ทับสูตร', 'คัดลอกเฉพาะหัวคอลัมน์ + 10 แถวสิทธิ ไม่รวมแถว/คอลัมน์ “รวม” ซึ่งในชีทเป็นสูตรอยู่แล้ว · ช่องที่ไม่มียอดเว้นว่าง'],
    ['เกิน 22 คอลัมน์', 'ชีทมีช่อง W–AR (22 คอลัมน์) ถ้ามากกว่านี้จะมีแถบเตือน · รวมบางคลินิกเองหรือแทรกคอลัมน์ในชีทก่อนวาง ไม่ให้ทับคอลัมน์ AS'],
    ['ย้ายลำดับคอลัมน์', 'แพทย์เรียงตามตัวอักษร · ลากหัวคอลัมน์ หรือกด ‹ › เพื่อย้าย · ระบบจำไว้เฉพาะวันนั้นในเครื่องนี้ · กด “เรียงตามตัวอักษร” เพื่อกลับค่าเดิม'],
    ['กติกาการนับ', 'นับตามสิทธิหลัก มีประกันชีวิต/คู่สัญญาร่วม → ประกันชีวิต · 30 บาทนับเป็นในเขตทั้งหมด · เด็ก/30 บาทนอกเขตว่างไว้ · คลินิกบริการ (ESOT CTOT MROT USOT MAOT ATOT LABOT) แสดงเป็นรหัสคลินิก รวมทุกสาขา · แอดมินปรับได้ที่ ตั้งค่า › ส่งเวรตรวจการ'],
    ['ยอดล่าสุด', 'ยอดอัปเดตจากระบบ รพ. ทุก 5 นาที · กด “อัปเดตเดี๋ยวนี้” ก่อนคัดลอก · เลือกวันย้อนหลังได้ที่ช่องวันที่']]];
  if (HELP.set) HELP.set[1].push(['ส่งเวรตรวจการ', 'ตั้งคลินิกที่แสดงเป็นคอลัมน์คลินิก (เรียงลำดับได้) และจับคู่สิทธิการรักษากับแถวในชีทเวรตรวจการ']);
}
