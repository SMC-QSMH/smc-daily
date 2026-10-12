/* =====================================================================
   pages.js — หน้ารายงานประจำวัน · ปฏิทิน · จัดทำรายงาน (ข้อความ/ภาพ/พิมพ์ A4)
   ครั้งที่ 4: หน่วยงาน · แยกกลุ่มคลินิก · สิทธิการรักษา · หัตถการเฉพาะที่มียอด · ผู้รายงาน · แจ้งยอดเปลี่ยนหลังรายงาน
   ===================================================================== */
'use strict';

/* ---------- ข้อมูลตั้งต้นที่ใช้บ่อย ---------- */
var _cmap = null, _cmapBoot = null;
function clinicMap() { if (_cmapBoot !== S.boot) { _cmap = {}; (S.boot.clinics || []).forEach(function (c) { _cmap[c.code] = c; }); _cmapBoot = S.boot; } return _cmap; }
function isShown(code) { var c = clinicMap()[code]; return !c || c.show; }
function clinicShort(code) { var c = clinicMap()[code]; return c ? (c.short || c.name || code) : code; }
function itemsOf(unit) { return (S.boot.items || []).filter(function (i) { return i.active && (unit === ALL_UNITS || (i.unit || defaultUnitId()) === unit); }).sort(function (a, b) { return a.order - b.order; }); }
function activeItems() { return itemsOf(ALL_UNITS); }
function positionsOf(unit) { return (S.boot.positions || []).filter(function (p) { return p.show && (unit === ALL_UNITS || (p.unit || defaultUnitId()) === unit); }).sort(function (a, b) { return a.order - b.order; }); }
function shownPositions() { return positionsOf(DAY.unit && DAY.unit !== ALL_UNITS ? DAY.unit : defaultUnitId()); }
function dayTypeChip(t, hol) {
  if (t === 'H') return '<span class="chip hol">' + esc(hol || 'วันหยุดนักขัตฤกษ์') + '</span>';
  if (t === 'S') return '<span class="chip off">เสาร์–อาทิตย์</span>';
  if (t === 'C') return '<span class="chip idle">ปิดคลินิก</span>';
  return '';
}
function typeColor(t) { return t === 'W' ? 'var(--d-w)' : t === 'H' ? 'var(--d-h)' : t === 'C' ? 'var(--idle)' : 'var(--d-s)'; }
function typeName(t) { return { W: 'วันทำการ', S: 'เสาร์–อาทิตย์', H: 'วันหยุดนักขัตฤกษ์', C: 'ปิดคลินิก' }[t] || ''; }

/* =====================================================================
   หน้ารายงานประจำวัน
   ===================================================================== */
var DAY = { data: null, unit: null, rosters: {}, pend: { procs: {}, fields: {} }, pendUnit: null, staffDirty: false, saving: false, refreshing: false, refreshErr: '', timer: null, rView: 'reg' };
function rosterOf(u) { return DAY.rosters[u || DAY.unit] || null; }

function pageToday() {
  var date = S.date || S.boot.today;
  if (date > S.boot.today) date = S.date = S.boot.today;
  if (!DAY.unit || (DAY.unit !== ALL_UNITS && !unitById(DAY.unit))) DAY.unit = store('dayUnit:' + S.me.user) || homeUnit();
  if (DAY.unit !== ALL_UNITS && !unitById(DAY.unit)) DAY.unit = homeUnit();
  DAY.data = null; DAY.rosters = {}; DAY.refreshErr = ''; DAY.refreshing = false;
  clearInterval(DAY.timer);
  if (date === S.boot.today) DAY.timer = setInterval(function () { if (S.page === 'today' && S.date === date && DAY.data && DAY.data.api.canRefresh && !DAY.refreshing && !document.hidden) refreshApi(date, false); }, 5 * 60000);
  $('#main').innerHTML = banners() + heroSkeleton(date) + '<div class="grid-2"><div class="col"><div class="card skel" style="height:420px"></div></div><div class="col"><div class="card skel" style="height:520px"></div></div></div>';
  var drawn = false;
  api('getDay', { date: date }, {
    persist: date === S.boot.today, onCache: function (d) { if (S.page === 'today' && S.date === d.date && d.entries) { DAY.data = d; drawDay(); drawn = true; } }
  }).then(function (d) {
    if (S.page !== 'today' || S.date !== date) return;
    var had = DAY.data; DAY.data = d;
    if (!had || JSON.stringify(had.api) !== JSON.stringify(d.api) || JSON.stringify(had.entries) !== JSON.stringify(d.entries) || JSON.stringify(had.cases) !== JSON.stringify(d.cases)) drawDay(drawn);
    loadRoster(date);
    if (d.api.stale) refreshApi(date, false);
  }).catch(function (e) { if (S.page === 'today') { if (!DAY.data) $('#main').innerHTML = banners() + '<div class="card"><div class="empty">' + IC.warn + esc(e.message) + '<div style="margin-top:10px"><button class="btn" onclick="pageToday()">ลองอีกครั้ง</button></div></div></div>'; else toast(e.message, true); } });
}
/** ดึงยอดล่าสุดจาก API เบื้องหลัง (หน้าจอใช้งานได้ระหว่างรอ) */
function refreshApi(date, force, btn) {
  if (DAY.refreshing && !force) return;
  DAY.refreshing = true; DAY.refreshErr = ''; drawApiState();
  var p = api('refreshDay', { date: date, force: !!force });
  if (btn) busy(btn, p, 'กำลังดึง…').catch(function () { });
  p.then(function (d) {
    DAY.refreshing = false;
    if (S.page !== 'today' || S.date !== date || !DAY.data) return;
    forget('getDay|{"date":"' + date + '"}');
    var changed = JSON.stringify(DAY.data.api.rows) !== JSON.stringify(d.api.rows) || DAY.data.api.rights !== d.api.rights;
    DAY.data.api = d.api; DAY.data.trend = d.trend;
    DAY.refreshErr = d.warn || '';
    if (changed) { drawDay(true); if (force) toast('อัปเดตยอดแล้ว ' + (d.api.at || '').slice(11, 16) + ' น.'); } else drawApiState();
    if (force && !changed && !d.warn) toast('ยอดล่าสุดแล้ว (' + (d.api.at || '').slice(11, 16) + ' น.)');
  }).catch(function (e) { DAY.refreshing = false; DAY.refreshErr = e.message; drawApiState(); });
}
/** สถานะการดึงยอดในแถบหัวและหัวตารางผู้ป่วย */
function drawApiState() {
  var d = DAY.data; if (!d) return;
  var el = $('#apiState'), note = $('#apiNote');
  var html;
  if (DAY.refreshing) html = '<span class="live">' + IC.spin.replace('<svg', '<svg width="13" height="13" style="margin-right:6px"') + 'กำลังดึงยอดล่าสุดจากระบบ รพ.…</span>';
  else if (DAY.refreshErr) html = '<span class="live err" title="' + esc(DAY.refreshErr) + '">' + IC.warn.replace('<svg', '<svg width="13" height="13" style="margin-right:6px"') + esc(DAY.refreshErr.length > 70 ? DAY.refreshErr.slice(0, 70) + '…' : DAY.refreshErr) + '</span>' + (d.api.canRefresh ? '<button class="btn btn-sm hero-btn" id="apiRetry">' + IC.refresh + 'ลองอีกครั้ง</button>' : '');
  else {
    var isToday = d.date === S.boot.today, t = d.api.status !== 'ok' ? (/^error/.test(d.api.status) ? 'ดึงยอดไม่สำเร็จ' : 'ยังไม่มีข้อมูลจาก API') : d.api.final ? 'ยอดสุดท้ายของวัน' : (isToday ? 'ยอดสะสมวันนี้ · อัปเดต ' + (d.api.at || '').slice(11, 16) + ' น.' : 'อัปเดต ' + stampTh(d.api.at));
    html = '<span class="live">' + (isToday && !d.api.final && d.api.status === 'ok' ? '<span class="livedot"></span>' : '') + esc(t) + '</span>' + (d.api.todayOnly && d.date !== S.boot.today && d.api.status !== 'ok' ? '<span class="chip" title="API ของไอทีส่งเฉพาะยอดวันนี้">API ดึงย้อนหลังไม่ได้</span>' : '');
  }
  if (el) el.innerHTML = html + dayTypeChip(d.dayType, d.holiday);
  var r = $('#apiRetry'); if (r) r.onclick = function () { refreshApi(d.date, true, r); };
  if (note) note.textContent = d.api.status !== 'ok' ? (DAY.refreshing ? 'กำลังดึงข้อมูล…' : 'ยังไม่มีข้อมูลจาก API') : d.api.final ? 'ยอดสุดท้าย · ' + stampTh(d.api.at) : 'อัปเดต ' + (d.api.at || '').slice(11, 16) + ' น. · อัปเดตเองทุก 5 นาที';
  var br = $('#brefresh'); if (br) br.hidden = !d.api.canRefresh;
}
function heroSkeleton(date) {
  return '<section class="hero rise"><div><div class="dt">' + esc(thDate(date, true, true)) + '</div><div class="sub">กำลังดึงยอดล่าสุด…</div><div class="big" style="opacity:.5">—</div></div><div></div><div></div></section>';
}
function loadRoster(date, force) {
  var u = DAY.unit; if (u === ALL_UNITS) { drawStaff(); return; }
  var box = $('#staffBody'); if (box && !rosterOf(u)) box.innerHTML = '<div class="skel" style="height:90px"></div>';
  api('getRoster', { date: date, unit: u, force: !!force, fromDuty: !!force }).then(function (r) {
    if (S.page !== 'today' || S.date !== date) return;
    DAY.rosters[u] = r; if (DAY.unit === u) { drawStaff(); drawHeroRing(); }
  }).catch(function (e) { DAY.rosters[u] = { source: 'error', error: e.message, list: [] }; drawStaff(); });
}

/* ---------- ขอบเขตข้อมูลตามหน่วยงาน ---------- */
function inUnit(code, unit) { unit = unit || DAY.unit; return unit === ALL_UNITS || clinicUnit(code) === unit; }
function dayRows() { return (DAY.data.api.rows || []).slice(); }
function scopeRows(unit) { return dayRows().filter(function (r) { return isShown(r[0]) && inUnit(r[0], unit); }); }
function dayTotal(unit) { return scopeRows(unit).reduce(function (s, r) { return s + r[2]; }, 0); }
function curEntry(u) { u = u || DAY.unit; var e = (DAY.data.entries || {})[u]; return e || { procs: {}, consult: '', nightOpd: '', admit: '', other: '', note: '', noProc: false, reported: null }; }
function curProcs(u) {
  u = u || DAY.unit;
  if (u === ALL_UNITS) { var all = {}; unitsList().forEach(function (x) { var p = curProcs(x.id); Object.keys(p).forEach(function (k) { all[k] = (all[k] || 0) + p[k]; }); }); return all; }
  var p = JSON.parse(JSON.stringify(curEntry(u).procs || {}));
  if (DAY.pendUnit === u) Object.keys(DAY.pend.procs).forEach(function (k) { var v = DAY.pend.procs[k]; if (!v) delete p[k]; else p[k] = v; });
  return p;
}
function curField(k, u) {
  u = u || DAY.unit;
  if (u === ALL_UNITS) {
    if (k === 'noProc') return unitsList().every(function (x) { return curField('noProc', x.id) || !Object.keys(curProcs(x.id)).length; }) && unitsList().some(function (x) { return curField('noProc', x.id); });
    if (k === 'other' || k === 'note') return unitsList().map(function (x) { var v = curField(k, x.id); return v ? (unitsList().length > 1 ? unitName(x.id) + ': ' : '') + v : ''; }).filter(Boolean).join(' · ');
    return unitsList().reduce(function (s, x) { return s + (+curField(k, x.id) || 0); }, 0) || '';
  }
  return DAY.pendUnit === u && k in DAY.pend.fields ? DAY.pend.fields[k] : curEntry(u)[k];
}
/** จำนวนคน (HN ไม่ซ้ำ) ใช้ได้เมื่อขอบเขตครอบคลุมทุกคลินิกที่แสดง (คนนับรวมทั้งวัน แยกหน่วยงานไม่ได้) */
function scopePersons(u) {
  var d = DAY.data; if (!d || d.api.persons == null) return null;
  if (dayRows().some(function (r) { return !isShown(r[0]); })) return null;
  return scopeRows(u).length === dayRows().length ? d.api.persons : null;
}
function procSum(p) { return Object.keys(p).reduce(function (s, k) { return s + (+p[k] || 0); }, 0); }
function scopeCases(unit) { unit = unit || DAY.unit; return dayCases().filter(function (x) { return unit === ALL_UNITS || (x.unit || defaultUnitId()) === unit; }); }
function scopeRights(unit) {
  var cube = DAY.data && DAY.data.api.rights; if (!cube) return null;
  return decodeCube(cube).filter(function (e) { return isShown(e.c) && inUnit(e.c, unit); });
}

/** โครงต้นไม้ หน่วยงาน › กลุ่ม › คลินิก › แพทย์ (ใช้ทั้งหน้าจอ ใบพิมพ์ ภาพ และข้อความ) */
function buildTree(rows, byUnit) {
  var units = {}, order = [];
  rows.forEach(function (r) {
    var uk = byUnit ? (clinicUnit(r[0]) || '') : ALL_UNITS, gk = groupOf(r[0]) || '';
    var U = units[uk] || (units[uk] = { id: uk, total: 0, groups: {} }); if (order.indexOf(uk) < 0) order.push(uk);
    var G = U.groups[gk] || (U.groups[gk] = { id: gk, total: 0, clinics: {} });
    var C = G.clinics[r[0]] || (G.clinics[r[0]] = { code: r[0], total: 0, docs: {} });
    var dk = docKey(r[0], r[3] || r[1]), D = C.docs[dk] || (C.docs[dk] = { key: dk, name: docLabel(dk, r[1]), n: 0, cnt: 0 });
    D.n += r[2]; D.cnt++; C.total += r[2]; G.total += r[2]; U.total += r[2];
  });
  var uo = unitsList().map(function (u) { return u.id; });
  var gIdx = function (g) { var x = groupById(g); return x ? x.order : 9999; };
  return order.sort(function (a, b) { var ia = uo.indexOf(a), ib = uo.indexOf(b); return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib); }).map(function (uk) {
    var U = units[uk];
    U.groups = Object.keys(U.groups).map(function (gk) { return U.groups[gk]; }).sort(function (a, b) { return (gIdx(a.id) - gIdx(b.id)) || b.total - a.total; });
    U.groups.forEach(function (G) {
      G.clinics = Object.keys(G.clinics).map(function (k) { return G.clinics[k]; }).sort(function (a, b) { var ca = clinicMap()[a.code] || {}, cb = clinicMap()[b.code] || {}; return ((ca.order || 999) - (cb.order || 999)) || b.total - a.total; });
      G.clinics.forEach(function (C) { C.docs = Object.keys(C.docs).map(function (k) { return C.docs[k]; }).sort(function (a, b) { return b.n - a.n; }); });
    });
    return U;
  });
}
function grpName(id) { return groupsList().length ? groupName(id) : 'คลินิก'; }
function grpHex(id) { var g = groupById(id); return g ? g.color : '#8a8086'; }

function drawDay(quiet) {
  var d = DAY.data, date = d.date, u = DAY.unit, ed = canEditUnit(u);
  if (DAY.pendUnit && DAY.pendUnit !== u) flushSave();
  var rows = scopeRows(), hidden = dayRows().filter(function (r) { return !isShown(r[0]) && inUnit(r[0]); });
  var total = dayTotal(), nClin = {}, nDoc = {}; rows.forEach(function (r) { nClin[r[0]] = 1; nDoc[docKey(r[0], r[3] || r[1])] = 1; });
  var procs = curProcs(), apiOk = d.api.status === 'ok';
  var tree = buildTree(rows, u === ALL_UNITS && unitsList().length > 1), tb = '', n = 0, maxDoc = 1;
  rows.forEach(function (r) { maxDoc = Math.max(maxDoc, r[2]); });
  tree.forEach(function (U) {
    if (tree.length > 1 || (u === ALL_UNITS && unitsList().length > 1)) tb += '<tr class="un-row"><td colspan="3"><span class="dot" style="background:' + unitColor(U.id) + '"></span>' + esc(unitName(U.id)) + '</td><td class="num">' + fmt(U.total, 0) + '</td></tr>';
    U.groups.forEach(function (G) {
      tb += '<tr class="gr-row" style="--gc:' + palOf(grpHex(G.id)) + ';--gbg:' + hexA(grpHex(G.id), .1) + '"><td colspan="3">' + esc(grpName(G.id)) + ' <span class="xs muted">' + G.clinics.length + ' คลินิก</span></td><td class="num">' + fmt(G.total, 0) + '</td></tr>';
      G.clinics.forEach(function (C) {
        var loc = clinicLoc(C.code), merged = clinicMerged(C.code);
        tb += '<tr class="cl-group"><td colspan="3"><span class="code">' + esc(C.code) + '</span> ' + esc(clinicShort(C.code)) + (loc !== 'รพ.' ? ' <span class="chip loc">' + esc(loc) + '</span>' : '') + '</td><td class="num"><b>' + C.total + '</b></td></tr>';
        C.docs.forEach(function (D) {
          n++; tb += '<tr class="ptrow"><td class="muted tnum xs" style="width:26px">' + n + '</td><td>' + esc(D.name) + (merged && D.cnt > 1 ? ' <span class="xs muted">(' + D.cnt + ' ท่าน)</span>' : '') + '</td><td style="width:34%"><div class="bar"><i style="width:' + (D.n / maxDoc * 100).toFixed(1) + '%;animation-delay:' + Math.min(.5, n * .02).toFixed(2) + 's"></i></div></td><td class="num">' + D.n + '</td></tr>';
        });
      });
    });
  });
  hidden.forEach(function (r) { tb += '<tr class="ptrow hid"><td></td><td>' + esc(r[1]) + '</td><td><span class="code">' + esc(r[0]) + '</span></td><td class="num">' + r[2] + '</td></tr>'; });

  var main = $('#main');
  main.innerHTML = banners() + changeBanner() +
    '<section class="hero' + (quiet ? '' : ' rise') + '" id="hero"></section>' + unitBar() +
    '<div class="grid-2"><div class="col">' +
      '<section class="card' + (quiet ? '' : ' rise d2') + '" aria-labelledby="h-pt"><div class="card-h"><h3 id="h-pt"><span class="ic">' + IC.users + '</span>ผู้ป่วยแยกกลุ่ม คลินิก และแพทย์</h3><div class="row small muted"><span id="apiNote"></span> <button class="btn btn-sm" id="brefresh">' + IC.refresh + 'อัปเดตเดี๋ยวนี้</button></div></div>' +
        '<div class="card-b tbl-wrap">' + (rows.length ? '<table class="tbl ptree"><thead><tr><th>#</th><th>แพทย์</th><th></th><th class="num">ผู้ป่วย</th></tr></thead><tbody>' + tb + '</tbody><tfoot><tr><td></td><td>รวม ' + Object.keys(nClin).length + ' คลินิก · แพทย์ ' + Object.keys(nDoc).length + ' ท่าน</td><td></td><td class="num">' + fmt(total, 0) + '</td></tr></tfoot></table>' +
          (hidden.length ? '<p class="xs muted" style="margin:8px 0 0">ขีดฆ่า = คลินิกที่แอดมินซ่อน ไม่นับในยอดรวม</p>' : '')
          : '<div class="empty">' + IC.inbox + (apiOk ? (u === ALL_UNITS ? 'ไม่มีผู้ป่วยนอกเวลาในวันนี้' : 'ไม่มีผู้ป่วยของ' + esc(unitName(u)) + 'ในวันนี้') : DAY.refreshing ? 'กำลังดึงยอดจากระบบโรงพยาบาล…' : d.api.todayOnly && date !== S.boot.today ? 'ไม่มีข้อมูลของวันนี้ในระบบ (API ปัจจุบันส่งเฉพาะยอดวันนี้ ดึงย้อนหลังไม่ได้)' : 'ยังไม่มีข้อมูลจาก API ของวันนี้') + '</div>') + '</div></section>' +
      '<section class="card' + (quiet ? '' : ' rise d3') + '" id="rightsCard" aria-labelledby="h-rt"></section>' +
      '<section class="card' + (quiet ? '' : ' rise d3') + '" aria-labelledby="h-oth"><div class="card-h"><h3 id="h-oth"><span class="ic">' + IC.clinic + '</span>ยอดอื่น ๆ และหมายเหตุ</h3>' + (u === ALL_UNITS ? '<span class="chip idle">รวมทุกหน่วยงาน</span>' : '') + '</div><div class="card-b" style="display:flex;flex-direction:column;gap:12px">' +
        '<div class="others">' + [['consult', 'Consult แผนกอื่น'], ['nightOpd', 'โอน Night OPD ชั้น 4'], ['admit', 'Admit']].map(function (f) { return '<label class="field" for="f_' + f[0] + '">' + f[1] + '<input id="f_' + f[0] + '" data-field="' + f[0] + '" type="number" min="0" inputmode="numeric" placeholder="0" value="' + esc(curField(f[0])) + '"' + (ed ? '' : ' disabled') + '></label>'; }).join('') + '</div>' +
        '<label class="field" for="f_other">อื่นๆ<input id="f_other" data-field="other" type="text" maxlength="300" value="' + esc(curField('other')) + '"' + (ed ? '' : ' disabled') + '></label>' +
        '<label class="field" for="f_note">หมายเหตุท้ายรายงาน<textarea id="f_note" data-field="note" rows="2" maxlength="1000" placeholder="เช่น ยอดคลินิกที่ไม่ตรงกับหน้างาน"' + (ed ? '' : ' disabled') + '>' + esc(curField('note')) + '</textarea></label>' +
      '</div></section>' +
      '<section class="card' + (quiet ? '' : ' rise d4') + '" aria-labelledby="h-case" id="caseCard"></section>' +
    '</div><div class="col">' +
      procCardHtml(quiet, ed, procs) +
    '</div></div>' +
    '<section class="card' + (quiet ? '' : ' rise d4') + '" aria-labelledby="h-staff"><div class="card-h"><h3 id="h-staff"><span class="ic">' + IC.users + '</span>เจ้าหน้าที่ปฏิบัติงาน' + (unitsList().length > 1 && u !== ALL_UNITS ? ' <span class="chip idle">' + esc(unitName(u)) + '</span>' : '') + '</h3><div class="row small muted" id="staffSrc"></div></div><div class="card-b" id="staffBody"></div></section>';
  drawHero(quiet);
  drawRights();
  drawCases();
  drawStaff();
  bindDay();
}
function unitBar() {
  var us = unitsList(); if (us.length <= 1) return '';
  var opts = [ALL_UNITS].concat(us.map(function (x) { return x.id; }));
  return '<nav class="unitbar rise d1" aria-label="หน่วยงาน"><span class="xs muted">หน่วยงาน</span><div class="seg wrap">' + opts.map(function (id) {
    var mine = id !== ALL_UNITS && (S.me.units || []).indexOf(id) >= 0;
    return '<button data-unit="' + esc(id) + '" aria-pressed="' + (DAY.unit === id) + '">' + (id !== ALL_UNITS ? '<i class="dot" style="background:' + unitColor(id) + '"></i>' : '') + esc(id === ALL_UNITS ? 'ทุกหน่วยงาน' : unitName(id)) + (mine ? ' <small>(หน่วยของฉัน)</small>' : '') + '</button>';
  }).join('') + '</div></nav>';
}
function procCardHtml(quiet, ed, procs) {
  var u = DAY.unit, isAll = u === ALL_UNITS;
  var head = '<section class="card' + (quiet ? '' : ' rise d2') + '" aria-labelledby="h-proc"><div class="card-h"><h3 id="h-proc"><span class="ic">' + IC.syringe + '</span>หัตถการ <span class="chip brand" id="procSumChip">' + fmt(procSum(procs), 0) + ' ครั้ง</span></h3><span class="savestate" id="savest">' + (ed ? 'บันทึกอัตโนมัติ' : isAll ? 'รวมทุกหน่วยงาน' : 'ดูอย่างเดียว') + '</span></div>';
  if (isAll) {
    var body = unitsList().map(function (x) {
      var p = curProcs(x.id), its = itemsOf(x.id).filter(function (i) { return p[i.id]; }), extra = Object.keys(p).filter(function (k) { return !its.some(function (i) { return i.id === k; }); });
      if (!its.length && !extra.length) return unitsList().length > 1 ? '<div class="pu"><b>' + esc(unitName(x.id)) + '</b><span class="xs muted">' + (curField('noProc', x.id) ? 'ไม่มีหัตถการ' : 'ยังไม่คีย์') + '</span></div>' : '';
      return '<div class="pu">' + (unitsList().length > 1 ? '<b>' + esc(unitName(x.id)) + ' <span class="xs muted">' + fmt(procSum(p), 0) + ' ครั้ง</span></b>' : '') + '<div class="kvgrid">' + its.map(function (i) { return '<span>' + esc(i.name) + '</span><b>' + p[i.id] + '</b>'; }).join('') + extra.map(function (k) { return '<span>' + esc(itemName(k)) + '</span><b>' + p[k] + '</b>'; }).join('') + '</div></div>';
    }).join('');
    return head + '<div class="card-b">' + (body || '<div class="empty" style="padding:16px">' + IC.syringe + 'ยังไม่มีการคีย์หัตถการ</div>') + (canEdit() ? '<p class="xs muted" style="margin:10px 0 0">เลือกหน่วยงานด้านบนเพื่อคีย์หัตถการของหน่วยงานนั้น</p>' : '') + '</div></section>';
  }
  var items = itemsOf(u);
  var col = function (c) { return items.filter(function (i) { return i.col === c; }).map(function (i) { return procRow(i, procs[i.id], ed); }).join(''); };
  var e = curEntry(u);
  return head + '<div class="card-b">' + (items.length ? '<div class="procgrid"><div>' + col(1) + '</div><div>' + col(2) + '</div></div>' : '<p class="small muted" style="margin:0">หน่วยงานนี้ยังไม่มีรายการหัตถการ' + (ed ? ' · เพิ่มรายการได้ด้านล่าง' : '') + '</p>') +
    '<div class="row" style="margin-top:12px;justify-content:space-between">' +
      '<label class="row small" for="f_noProc"><input id="f_noProc" type="checkbox" data-field="noProc"' + (curField('noProc') ? ' checked' : '') + (ed ? '' : ' disabled') + '> วันนี้ไม่มีหัตถการ</label>' +
      (ed ? '<form class="row" id="addItem"><input type="text" id="newItem" maxlength="60" placeholder="เพิ่มรายการ เช่น ฉีดสี" style="width:170px" aria-label="ชื่อรายการหัตถการใหม่"><button class="btn btn-sm" type="submit">' + IC.plus + 'เพิ่ม</button></form>' : '') +
    '</div>' + (e.updatedAt ? '<p class="xs muted" style="margin:10px 0 0">แก้ไขล่าสุด ' + esc(stampTh(e.updatedAt)) + ' โดย ' + esc(e.updatedBy) + '</p>' : '') + '</div></section>';
}
function procRow(i, v, ed) {
  return '<div class="proc' + (v ? ' has' : '') + (i.custom ? ' custom' : '') + '" data-row="' + esc(i.id) + '"><label for="p_' + esc(i.id) + '">' + esc(i.name) + '</label>' +
    '<span class="stepper">' + (ed ? '<button type="button" tabindex="-1" data-step="-1" aria-label="ลด ' + esc(i.name) + '">' + IC.minus + '</button>' : '') +
    '<input id="p_' + esc(i.id) + '" data-proc="' + esc(i.id) + '" type="number" min="0" inputmode="numeric" placeholder="0" value="' + (v || '') + '"' + (ed ? '' : ' disabled') + '>' +
    (ed ? '<button type="button" tabindex="-1" data-step="1" aria-label="เพิ่ม ' + esc(i.name) + '">' + IC.plus + '</button>' : '') + '</span></div>';
}
/** แจ้งเตือน: ยอดในระบบ รพ. เปลี่ยนหลังจัดทำรายงาน (เช่น VN ยกเลิกย้อนหลัง) */
function reportedOf(u) { u = u || DAY.unit; var e = (DAY.data.entries || {})[u]; return e && e.reported ? e.reported : null; }
function changeBanner() {
  var d = DAY.data; if (!d || d.api.status !== 'ok') return '';
  var u = DAY.unit, r = reportedOf(u), cur = dayTotal(u);
  if (!r || r.total === cur) return '';
  return '<div class="banner warn changed" role="status">' + IC.warn.replace('<svg', '<svg width="18" height="18"') + '<div><b>ยอดผู้รับบริการได้รับการปรับปรุงจากระบบสารสนเทศโรงพยาบาลหลังจัดทำรายงาน</b><div class="small">เดิม <b>' + fmt(r.total, 0) + '</b> → ปัจจุบัน <b>' + fmt(cur, 0) + '</b> ราย (' + (cur > r.total ? '+' : '') + fmt(cur - r.total, 0) + ') · จัดทำรายงานเมื่อ ' + esc(stampTh(r.at)) + (r.by ? ' โดย ' + esc(r.by) : '') + ' · หากส่งรายงานไปแล้ว ควรแจ้งยอดที่ปรับปรุง</div></div></div>';
}

function drawHero(quiet) {
  var d = DAY.data, date = d.date, u = DAY.unit, total = dayTotal(), rows = scopeRows();
  var nC = {}, nD = {}; rows.forEach(function (r) { nC[r[0]] = 1; nD[docKey(r[0], r[3] || r[1])] = 1; });
  var isToday = date === S.boot.today, persons = scopePersons(u);
  var hero = $('#hero');
  hero.innerHTML = '<svg class="ecg" viewBox="0 0 1200 70" preserveAspectRatio="none" aria-hidden="true"><path d="M0,40 L240,40 L258,40 L270,26 L282,40 L300,40 L312,6 L326,66 L340,40 L360,40 L376,32 L392,40 L640,40 L658,40 L670,26 L682,40 L700,40 L712,6 L726,66 L740,40 L760,40 L776,32 L792,40 L1200,40"/></svg>' +
    '<div><div class="dnav"><button class="iconbtn" id="dprev" aria-label="วันก่อนหน้า">' + IC.prev + '</button><button class="iconbtn" id="dnext" aria-label="วันถัดไป"' + (isToday ? ' disabled' : '') + '>' + IC.next + '</button>' +
      '<input type="date" id="dpick" value="' + date + '" max="' + S.boot.today + '" aria-label="เลือกวันที่">' + (isToday ? '' : '<button class="btn btn-sm" id="dtoday" style="background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.25);color:#fff">วันนี้</button>') + '</div>' +
      '<div class="dt" style="margin-top:10px">' + esc(thDate(date, true, true)) + '</div>' +
      (unitsList().length > 1 ? '<div class="sub">' + esc(unitName(u)) + '</div>' : '') +
      '<div class="row" id="apiState" style="margin-top:6px"></div>' +
      '<div class="big" style="margin-top:12px"><span data-count="' + total + '">' + (quiet ? fmt(total, 0) : '0') + '</span><small>ราย</small></div>' +
      '<div class="kv">' + (persons != null ? '<div><b>' + fmt(persons, 0) + '</b><span>คน (HN ไม่ซ้ำ)</span></div>' : '') + '<div><b>' + Object.keys(nC).length + '</b><span>คลินิก</span></div><div><b>' + Object.keys(nD).length + '</b><span>แพทย์</span></div><div><b id="heroProc">' + fmt(procSum(curProcs()), 0) + '</b><span>หัตถการ</span></div></div></div>' +
    '<div class="spark">' + heroSpark(d.trend || []) + '</div>' +
    '<div class="ringwrap" id="ringwrap"></div>';
  drawHeroRing(); drawApiState();
  if (!quiet) countUp(hero); else $$('[data-count]', hero).forEach(function (el) { el.textContent = fmt(+el.getAttribute('data-count'), 0); });
  $('#dprev').onclick = function () { setDate(addDays(date, -1)); };
  $('#dnext').onclick = function () { if (!isToday) setDate(addDays(date, 1)); };
  $('#dpick').onchange = function (e) { if (e.target.value) setDate(e.target.value); };
  var dt = $('#dtoday'); if (dt) dt.onclick = function () { setDate(S.boot.today); };
}
function drawHeroRing() {
  var w = $('#ringwrap'); if (!w || !DAY.data) return;
  var d = DAY.data, p = curProcs(), r = rosterOf(), steps = [
    [d.api.status === 'ok', 'ยอดผู้ป่วยจาก API'],
    [Object.keys(p).length > 0 || !!curField('noProc'), 'คีย์หัตถการ'],
    [DAY.unit === ALL_UNITS ? true : !!(r && r.list && r.list.length), 'รายชื่อเจ้าหน้าที่']
  ], done = steps.filter(function (s) { return s[0]; }).length;
  w.innerHTML = ring(done / 3, done + '/3', 'ความครบถ้วน') + '<div class="steps">' + steps.map(function (s) { return '<span class="' + (s[0] ? 'on' : '') + '">' + (s[0] ? IC.check : IC.dot) + esc(s[1]) + '</span>'; }).join('') + '</div>';
  animateRings(w);
}
function setDate(d) { if (d > S.boot.today) return; flushSave(); S.date = d; pageToday(); }
function setUnit(u) { flushSave(); saveStaff(); DAY.unit = u; store('dayUnit:' + S.me.user, u); drawDay(true); if (u !== ALL_UNITS && !rosterOf(u)) loadRoster(DAY.data.date); }

/* ---------- สิทธิการรักษา (การ์ด) ---------- */
function drawRights() {
  var box = $('#rightsCard'); if (!box || !DAY.data) return;
  var ents = scopeRights(), view = DAY.rView;
  var head = '<div class="card-h"><h3 id="h-rt"><span class="ic">' + IC.card + '</span>สิทธิการรักษา</h3>' + (ents ? '<div class="seg" role="group" aria-label="มุมมองสิทธิ"><button data-rv="reg" aria-pressed="' + (view === 'reg') + '" title="สิทธิหลักตามทะเบียนผู้ป่วย">ตามทะเบียน</button><button data-rv="pay" aria-pressed="' + (view === 'pay') + '" title="สิทธิในรายการค่าใช้จ่าย">ที่ชำระจริง</button></div>' : '') + '</div>';
  if (!ents) { box.innerHTML = head + '<div class="card-b"><p class="small muted" style="margin:0">' + (DAY.data.api.status === 'ok' ? 'วันนี้ยังไม่มีข้อมูลสิทธิ (ข้อมูลก่อนไอทีเพิ่มสิทธิ ระบบกำลังดึงย้อนหลังให้เอง)' : 'รอยอดจากระบบโรงพยาบาล') + '</p></div>'; return; }
  var s = rightsSum(ents), rows = rgRows(view === 'reg' ? s.reg : s.pay), mx = Math.max.apply(null, rows.map(function (r) { return r.v; }).concat([1]));
  var check = s.usage.single + s.usage.combo + s.usage.cash, tot = dayTotal();
  box.innerHTML = head + '<div class="card-b">' +
    '<div class="rbars">' + rows.map(function (r) { return '<span class="nm"><i style="background:' + r.color + '"></i>' + esc(r.name) + '</span><span class="tr"><b style="width:' + (r.v / mx * 100).toFixed(1) + '%;background:' + r.color + '"></b></span><span class="num"><b>' + fmt(r.v, 0) + '</b></span><span class="num xs muted">' + fmt(r.v / (s.total || 1) * 100) + '%</span>'; }).join('') + '</div>' +
    '<div class="rusage">' + ['single', 'combo', 'cash'].map(function (k) { return '<span class="u-' + k + '"><b>' + fmt(s.usage[k], 0) + '</b>' + USAGE_TH[k] + '</span>'; }).join('') + '</div>' +
    '<p class="xs ' + (check === tot && s.total === tot ? 'okline' : 'warnline') + '" style="margin:8px 0 0">' + (check === tot && s.total === tot ? IC.check.replace('class="ck" ', '').replace('<svg', '<svg width="13" height="13"') + ' ตรวจแล้ว: สิทธิเดียว + สิทธิร่วม + เงินสด = ผู้รับบริการ ' + fmt(tot, 0) + ' ราย' : IC.warn.replace('<svg', '<svg width="13" height="13"') + ' ยอดสิทธิ ' + fmt(s.total, 0) + ' ≠ ผู้รับบริการ ' + fmt(tot, 0) + ' (ข้อมูลกำลังอัปเดต)') +
      (view === 'pay' && s.mixed ? ' · ร่วมจ่ายเงินสด ' + fmt(s.mixed, 0) + ' ราย' : '') + (view === 'pay' && s.pay.none ? ' · ยังไม่มีรายการค่าใช้จ่าย ' + fmt(s.pay.none, 0) + ' ราย' : '') + '</p>' +
    '<details class="rdetail"><summary>รายละเอียดสิทธิ สิทธิร่วม และเทียบทะเบียนกับที่ชำระ</summary>' + rightsDetailHtml(s) + '</details>' +
    '<p class="xs muted" style="margin:8px 0 0">' + (view === 'reg' ? 'ตามทะเบียน = สิทธิหลักของผู้ป่วย' + (rgList().some(function (g) { return g.prio; }) ? ' (' + rgList().filter(function (g) { return g.prio; }).map(function (g) { return g.name; }).join(', ') + ' นับก่อนเมื่อมีร่วม)' : '') : 'ที่ชำระจริง = สิทธิในรายการค่าใช้จ่าย (ชำระหลายสิทธิ → นับสิทธิที่ไม่ใช่เงินสด)') + '</p></div>';
  $$('[data-rv]', box).forEach(function (b) { b.onclick = function () { DAY.rView = b.getAttribute('data-rv'); drawRights(); }; });
}
function rightsDetailHtml(s) {
  var pts = Object.keys(s.pt).sort(function (a, b) { return s.pt[b] - s.pt[a]; });
  var dts = Object.keys(s.dt).sort(function (a, b) { return s.dt[b] - s.dt[a]; });
  var cmb = Object.keys(s.combos).sort(function (a, b) { return s.combos[b] - s.combos[a]; });
  var regs = rgRows(s.reg), pays = rgRows(s.pay);
  return '<div class="rgrid"><div><h5>สิทธิหลัก (ตามทะเบียน)</h5><table class="tbl xs">' + pts.map(function (k) { return '<tr><td><span class="dot" style="background:' + rgColor(rtGroup(k)) + '"></span>' + esc(rtName(k)) + '</td><td class="num">' + fmt(s.pt[k], 0) + '</td></tr>'; }).join('') + '</table>' +
    '<h5>สิทธิย่อย</h5><table class="tbl xs">' + dts.map(function (k) { return '<tr><td>' + esc(rtName(k)) + '</td><td class="num">' + fmt(s.dt[k], 0) + '</td></tr>'; }).join('') + '</table></div>' +
    '<div><h5>สิทธิร่วม (หลัก + รอง)</h5>' + (cmb.length ? '<table class="tbl xs">' + cmb.map(function (k) { return '<tr><td>' + esc(k) + '</td><td class="num">' + fmt(s.combos[k], 0) + '</td></tr>'; }).join('') + '</table>' : '<p class="xs muted">ไม่มี</p>') +
    '<h5>ตามทะเบียน → ที่ชำระจริง</h5><div class="tbl-wrap"><table class="tbl xs xtab"><thead><tr><th></th>' + pays.map(function (p) { return '<th class="num" title="' + esc(p.name) + '">' + esc(p.name.length > 10 ? p.name.slice(0, 9) + '…' : p.name) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      regs.map(function (r) { return '<tr><td>' + esc(r.name) + '</td>' + pays.map(function (p) { var v = s.cross[r.id + '>' + p.id] || 0; return '<td class="num' + (v && r.id !== p.id ? ' hl' : '') + '">' + (v ? fmt(v, 0) : '') + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div><p class="xs muted">ช่องเน้นสี = สิทธิตามทะเบียนต่างจากที่ชำระจริง</p></div></div>';
}

/* ---------- บันทึก ---------- */
var saveSoon = debounce(function () { flushSave(); }, 900);
function setSaveState(kind, txt) {
  var s = $('#savest'); if (!s) return;
  s.className = 'savestate' + (kind ? ' ' + kind : '');
  s.innerHTML = (kind === 'saved' ? IC.check : kind === 'busy' ? IC.spin : kind === 'err' ? IC.warn : '') + '<span>' + esc(txt) + '</span>' + (kind === 'err' ? ' <button class="btn btn-sm" id="retrySave">ลองอีกครั้ง</button>' : '');
  var r = $('#retrySave'); if (r) r.onclick = flushSave;
}
function hasPending() { return Object.keys(DAY.pend.procs).length || Object.keys(DAY.pend.fields).length; }
function flushSave() {
  if (!DAY.data || DAY.saving || !hasPending() || !DAY.pendUnit) return;
  var date = DAY.data.date, unit = DAY.pendUnit, payload = { date: date, unit: unit, procs: DAY.pend.procs, fields: DAY.pend.fields, _rid: rid() };
  DAY.pend = { procs: {}, fields: {} }; DAY.saving = true; setSaveState('busy', 'กำลังบันทึก…');
  api('saveEntry', payload).then(function (r) {
    DAY.saving = false;
    if (DAY.data && DAY.data.date === date) {
      var e = DAY.data.entries[unit] || (DAY.data.entries[unit] = { procs: {} });
      Object.keys(payload.procs).forEach(function (k) { var v = +payload.procs[k] || 0; if (v) e.procs[k] = v; else delete e.procs[k]; });
      Object.keys(payload.fields).forEach(function (k) { e[k] = payload.fields[k]; });
      if (r.at) { e.updatedAt = r.at; e.updatedBy = r.by || S.me.name; }
    }
    forget('getDay|{"date":"' + date + '"'); forget('getMonth'); MP_dirty(date);
    setSaveState('saved', 'บันทึกแล้ว ' + (r.at || '').slice(11, 16));
    if (hasPending()) flushSave(); else DAY.pendUnit = DAY.unit;
  }).catch(function (e) {
    DAY.saving = false;
    Object.keys(payload.procs).forEach(function (k) { if (!(k in DAY.pend.procs)) DAY.pend.procs[k] = payload.procs[k]; });
    Object.keys(payload.fields).forEach(function (k) { if (!(k in DAY.pend.fields)) DAY.pend.fields[k] = payload.fields[k]; });
    setSaveState('err', 'ยังไม่ได้บันทึก: ' + e.message);
  });
}
window.addEventListener('beforeunload', function (e) { if (hasPending() || DAY.saving) { flushSave(); e.preventDefault(); e.returnValue = ''; } });

function bindDay() {
  var main = $('#main'), date = DAY.data.date, u = DAY.unit;
  var br = $('#brefresh'); if (br) br.onclick = function () { refreshApi(date, true, br); };
  $$('[data-unit]', main).forEach(function (b) { b.onclick = function () { setUnit(b.getAttribute('data-unit')); }; });
  addDayTools();
  if (!canEditUnit(u)) return;
  DAY.pendUnit = u;
  var onProc = function (inp) {
    var id = inp.getAttribute('data-proc'), v = inp.value === '' ? 0 : Math.max(0, Math.round(+inp.value || 0));
    if (inp.value !== '' && String(v) !== inp.value) inp.value = v || '';
    DAY.pendUnit = u; DAY.pend.procs[id] = v;
    var row = inp.closest('.proc'); row.classList.toggle('has', !!v); row.classList.remove('bump'); void row.offsetWidth; row.classList.add('bump');
    var sum = procSum(curProcs()); $('#procSumChip').textContent = fmt(sum, 0) + ' ครั้ง'; var hp = $('#heroProc'); if (hp) hp.textContent = fmt(sum, 0);
    drawHeroRing(); setSaveState('', 'มีการเปลี่ยนแปลง…'); saveSoon();
  };
  $$('[data-proc]', main).forEach(function (inp) {
    inp.addEventListener('input', function () { onProc(inp); });
    inp.addEventListener('focus', function () { inp.select(); });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); var all = $$('[data-proc]', main), i = all.indexOf(inp); if (all[i + 1]) all[i + 1].focus(); } });
  });
  $$('[data-step]', main).forEach(function (b) {
    b.onclick = function () { var inp = $('input', b.parentNode), v = Math.max(0, (+inp.value || 0) + (+b.getAttribute('data-step'))); inp.value = v || ''; onProc(inp); };
  });
  $$('[data-field]', main).forEach(function (inp) {
    var h = function () {
      var k = inp.getAttribute('data-field'), v = inp.type === 'checkbox' ? inp.checked : inp.value;
      DAY.pendUnit = u; DAY.pend.fields[k] = v; if (k === 'noProc') drawHeroRing(); setSaveState('', 'มีการเปลี่ยนแปลง…'); saveSoon();
    };
    inp.addEventListener(inp.type === 'checkbox' ? 'change' : 'input', h);
  });
  var af = $('#addItem'); if (af) af.onsubmit = function (e) {
    e.preventDefault(); var nm = $('#newItem').value.trim(); if (!nm) return;
    busy($('#addItem button'), api('addItem', { name: nm, unit: u, _rid: rid() })).then(function (r) {
      if (!r.existed) S.boot.items.push({ id: r.id, name: r.name, col: 2, order: 9999, active: true, custom: true, unit: u });
      else S.boot.items.forEach(function (i) { if (i.id === r.id) i.active = true; });
      store('boot', S.boot); flushSave(); drawDay(true);
      var el = $('#p_' + r.id); if (el) { el.focus(); el.scrollIntoView({ block: 'center', behavior: REDUCED ? 'auto' : 'smooth' }); }
      toast(r.existed ? 'มีรายการนี้อยู่แล้ว' : 'เพิ่ม "' + r.name + '" แล้ว');
    }).catch(function (err) { toast(err.message, true); });
  };
}
function addDayTools() {
  var hero = $('#hero'); if (!hero || $('#dayTools')) return;
  var t = document.createElement('div'); t.id = 'dayTools'; t.className = 'row'; t.style.cssText = 'grid-column:1/-1;margin-top:4px';
  t.innerHTML = '<button class="btn btn-sm" id="bline" style="background:#fff;border-color:#fff;color:#9e1527">' + IC.line + 'ข้อความรายงาน</button>' +
    '<button class="btn btn-sm" id="bimg" style="background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.25);color:#fff">' + IC.img + 'ภาพรายงาน</button>' +
    '<button class="btn btn-sm" id="bprint" style="background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.25);color:#fff">' + IC.print + 'พิมพ์ A4</button>';
  hero.appendChild(t);
  $('#bline').onclick = function () { flushSave(); openLine(); };
  $('#bimg').onclick = function () { flushSave(); openImage(); };
  $('#bprint').onclick = function () { flushSave(); printDay(); };
}

/* ---------- เจ้าหน้าที่ (แยกหน่วยงาน) ---------- */
var saveStaffSoon = debounce(function () { saveStaff(); }, 1000);
function staffList(u) { var r = rosterOf(u); return (r && r.list) || []; }
function drawStaff() {
  var body = $('#staffBody'), src = $('#staffSrc'); if (!body) return;
  var u = DAY.unit;
  if (u === ALL_UNITS) { if (src) src.innerHTML = ''; body.innerHTML = '<p class="small muted" style="margin:0">รายชื่อเจ้าหน้าที่แยกตามหน่วยงาน · เลือกหน่วยงานด้านบนเพื่อดูหรือแก้ไข</p>'; return; }
  var r = rosterOf(u) || { list: [] }, ed = canEditUnit(u), list = staffList(u), pos = positionsOf(u);
  if (!rosterOf(u)) { body.innerHTML = '<div class="skel" style="height:90px"></div>'; return; }
  if (src) src.innerHTML = (r.source === 'duty' ? '<span>จากตารางเวร SMC Duty' + (r.at ? ' · ซิงก์ ' + esc((r.at || '').slice(11, 16)) + ' น.' : '') + '</span>' :
    r.source === 'saved' ? '<span>แก้ไขแล้วโดย ' + esc(r.by || '') + (r.at ? ' · ' + esc(String(r.at).slice(11, 16)) + ' น.' : '') + '</span>' :
    r.source === 'error' ? '<span style="color:var(--warn)">' + IC.warn.replace('<svg', '<svg width="14" height="14"') + ' ' + esc(r.error) + '</span>' : '') +
    (ed && DAY.data ? ' <button class="btn btn-sm" id="reDuty" title="ดึงรายชื่อจากตารางเวร SMC Duty ล่าสุด">' + IC.refresh + 'ซิงก์ตารางเวร</button>' : '');
  if (!pos.length) { body.innerHTML = '<p class="muted small">ยังไม่ได้เลือกตำแหน่งที่จะแสดงของหน่วยงานนี้ (ตั้งค่า › ตำแหน่ง)</p>'; return; }
  body.innerHTML = pos.map(function (p) {
    var ppl = list.map(function (x, i) { return { x: x, i: i }; }).filter(function (o) { return o.x.pos === p.id; });
    return '<div class="staffgrp"><div class="pos">' + esc(p.short) + '<small>' + esc(p.name) + ' · ' + ppl.length + ' คน</small></div><div class="people">' +
      ppl.map(function (o, k) {
        return '<span class="person" style="animation-delay:' + (k * .03).toFixed(2) + 's"><span class="ini">' + esc(initials(o.x.name)) + '</span><span class="nm">' + esc(String(o.x.name).replace(/\s*\(ตัวอย่าง\)$/, '')) + '</span>' +
          (p.clinicBox ? '<input aria-label="คลินิกที่ประจำของ ' + esc(o.x.name) + '" data-sclin="' + o.i + '" value="' + esc(o.x.clinic || '') + '" placeholder="คลินิก" maxlength="30"' + (ed ? '' : ' disabled') + '>' : '') +
          (ed ? '<button data-sdel="' + o.i + '" aria-label="ลบ ' + esc(o.x.name) + '" title="ลบออกจากรายงานวันนี้">' + IC.x + '</button>' : '') + '</span>';
      }).join('') + (!ppl.length ? '<span class="xs muted" style="align-self:center">ไม่มีในตารางเวร</span>' : '') +
      (ed ? '<button class="btn btn-sm btn-ghost" data-sadd="' + p.id + '">' + IC.plus + 'เพิ่ม</button>' : '') + '</div></div>';
  }).join('');
  if (!ed) return;
  $$('[data-sclin]', body).forEach(function (inp) { inp.addEventListener('input', function () { staffList(u)[+inp.getAttribute('data-sclin')].clinic = inp.value; DAY.staffDirty = u; saveStaffSoon(); }); });
  $$('[data-sdel]', body).forEach(function (b) { b.onclick = function () { staffList(u).splice(+b.getAttribute('data-sdel'), 1); DAY.staffDirty = u; drawStaff(); drawHeroRing(); saveStaff(); }; });
  $$('[data-sadd]', body).forEach(function (b) { b.onclick = function () { addPerson(b.getAttribute('data-sadd')); }; });
  var rd = $('#reDuty'); if (rd) rd.onclick = function () { syncRoster(rd); };
}
/** ซิงก์ตารางเวรจาก SMC Duty ใหม่ (ถ้าแก้รายชื่อไว้แล้ว → ถามก่อนแทนที่) */
function syncRoster(btn) {
  var date = DAY.data.date, u = DAY.unit, saved = rosterOf(u) && rosterOf(u).source === 'saved';
  var run = function (b) {
    var p = (saved ? api('saveStaff', { date: date, unit: u, reset: true, list: [], _rid: rid() }) : Promise.resolve())
      .then(function () { return api('getRoster', { date: date, unit: u, force: true, fromDuty: true }); });
    return busy(b, p, 'กำลังซิงก์…').then(function (r) { forget('getRoster'); if (S.page !== 'today' || S.date !== date) return; DAY.rosters[u] = r; drawStaff(); drawHeroRing(); toast(r.source === 'error' ? r.error : 'ซิงก์ตารางเวรแล้ว ' + (r.list || []).length + ' คน', r.source === 'error'); });
  };
  if (!saved) return run(btn).catch(function (e) { toast(e.message, true); });
  var m = modal('ซิงก์ตารางเวรใหม่?', '<p style="margin:0">รายชื่อของวันนี้ถูกแก้ไขไว้แล้ว (เพิ่ม/ลบ/ใส่คลินิก) การซิงก์จะ<b>แทนที่ด้วยตารางเวรล่าสุดจาก SMC Duty</b> และสิ่งที่แก้ไว้จะหายไป</p>',
    '<button class="btn" data-close>ยกเลิก</button><button class="btn btn-brand" id="rsyok">' + IC.refresh + 'ซิงก์และแทนที่</button>', 'sm');
  $('#rsyok', m).onclick = function () { run($('#rsyok', m)).then(function () { m.close(); }).catch(function (e) { toast(e.message, true); }); };
}
function addPerson(posId) {
  var u = DAY.unit, p = (S.boot.positions || []).filter(function (x) { return x.id === posId; })[0] || { short: '', clinicBox: false };
  var m = modal('เพิ่ม ' + esc(p.short), '<form id="apf" style="display:flex;flex-direction:column;gap:12px"><label class="field" for="apn">ชื่อ-สกุล<input id="apn" type="text" maxlength="80" required></label>' +
    (p.clinicBox ? '<label class="field" for="apc">คลินิกที่ประจำ<input id="apc" type="text" maxlength="30" placeholder="เช่น Ey, SE+OR"></label>' : '') +
    '<button class="btn btn-brand" type="submit" style="align-self:flex-end">' + IC.plus + 'เพิ่ม</button></form>', '', 'sm');
  $('#apn', m).focus();
  $('#apf', m).onsubmit = function (e) {
    e.preventDefault(); if (!rosterOf(u)) DAY.rosters[u] = { source: 'saved', list: [] };
    rosterOf(u).list = staffList(u); rosterOf(u).list.push({ pos: posId, name: $('#apn', m).value.trim(), clinic: ($('#apc', m) || {}).value || '', emp: '', slot: '' });
    m.close(); DAY.staffDirty = u; drawStaff(); drawHeroRing(); saveStaff();
  };
}
function saveStaff() {
  var u = DAY.staffDirty; if (!u || !DAY.data) return; DAY.staffDirty = false;
  var date = DAY.data.date;
  api('saveStaff', { date: date, unit: u, list: staffList(u), _rid: rid() }).then(function (r) {
    var ro = rosterOf(u); if (ro && S.date === date) { ro.source = 'saved'; ro.by = S.me.name; if (DAY.unit === u) drawStaff(); }
    forget('getRoster'); setSaveState('saved', 'บันทึกรายชื่อแล้ว ' + (r.at || '').slice(11, 16));
  }).catch(function (e) { DAY.staffDirty = u; toast('บันทึกรายชื่อไม่สำเร็จ: ' + e.message, true); });
}

/* ---------- ผู้ป่วยส่งต่อ (Admit / Consult / Night OPD) ---------- */
var CASE_T = { admit: 'Admit', consult: 'Consult แผนกอื่น', nightOpd: 'โอน Night OPD ชั้น 4' };
var CASE_SHORT = { admit: 'Admit', consult: 'Consult', nightOpd: 'Night OPD' };
function dayCases() { return (DAY.data && DAY.data.cases) || []; }
function maskName(n) { n = String(n || '').trim(); if (!n) return ''; if (/•/.test(n)) return n; var p = n.split(/\s+/); return p.map(function (w, i) { return i === 0 && p.length > 1 && /^(นาย|นาง|น\.ส\.|ด\.ช\.|ด\.ญ\.|เด็กชาย|เด็กหญิง|นางสาว)$/.test(w) ? w : w.charAt(0) + '•••'; }).join(' '); }
function maskHn(h) { h = String(h || ''); if (/•/.test(h)) return h; return h.length > 3 ? h.slice(0, Math.max(2, h.length - 3)) + '•••' : h; }
function caseLine(x, detail) {
  if (!detail) return CASE_SHORT[x.type] + (x.dest ? ' → ' + x.dest : '');
  return CASE_SHORT[x.type] + ': ' + [x.name, x.hn ? 'HN ' + x.hn : '', x.age ? x.age + ' ปี' : ''].filter(Boolean).join(' · ') + (x.dx ? ' · Dx ' + x.dx : '') + (x.dest ? ' → ' + x.dest : '') + (x.note ? ' (' + x.note + ')' : '');
}
function casesMasked() { return dayCases().some(function (x) { return x.masked; }); }
/** ผู้บริหาร: ชื่อ/HN ปิดไว้ก่อน · กดแสดง = ขอข้อมูลเต็มจากเซิร์ฟเวอร์ (บันทึกประวัติตาม PDPA) */
function revealDayCases(btn) {
  var date = DAY.data.date;
  return busy(btn, api('revealCases', { date: date }), 'กำลังโหลด…').then(function (r) { if (DAY.data && DAY.data.date === date) { DAY.data.cases = r.cases; drawCases(); } toast('แสดงข้อมูลผู้ป่วยแล้ว (บันทึกการเปิดดู)'); });
}
function drawCases() {
  var box = $('#caseCard'); if (!box || !DAY.data) return;
  var u = DAY.unit, ed = canEditUnit(u), list = scopeCases(), show = store('caseShow'); if (show === null) show = true;
  var masked = casesMasked(); if (masked) show = false;
  var cnt = { admit: 0, consult: 0, nightOpd: 0 }; list.forEach(function (x) { cnt[x.type]++; });
  box.innerHTML = '<div class="card-h"><h3 id="h-case"><span class="ic">' + IC.ambul + '</span>ผู้ป่วยส่งต่อ <span class="chip brand">' + list.length + ' ราย</span></h3>' +
    '<div class="row">' + (list.length ? (masked ? '<button class="btn btn-sm btn-ghost" id="caseReveal" title="แสดงชื่อและ HN (บันทึกการเปิดดู)">' + IC.eye + 'แสดงชื่อ/HN</button>' : '<button class="btn btn-sm btn-ghost" id="caseEye" aria-pressed="' + show + '" title="' + (show ? 'ซ่อน' : 'แสดง') + 'ชื่อและ HN บนจอ">' + (show ? IC.eye : IC.eyeOff) + (show ? 'ซ่อนชื่อ' : 'แสดงชื่อ') + '</button>') : '') +
    (ed ? '<button class="btn btn-sm btn-soft" id="caseAdd">' + IC.plus + 'เพิ่ม</button>' : '') + '</div></div>' +
    '<div class="card-b">' + (list.length ? '<div class="caselist">' + list.map(function (x) {
      return '<div class="case t-' + x.type + '"><span class="ctype">' + esc(CASE_SHORT[x.type]) + '</span><div class="cmain"><b>' + esc(show ? (x.name || '(ไม่ระบุชื่อ)') : maskName(x.name) || '•••') + '</b>' + (u === ALL_UNITS && unitsList().length > 1 ? ' <span class="chip idle">' + esc(unitName(x.unit)) + '</span>' : '') +
        '<span class="cmeta">' + [x.hn ? 'HN ' + esc(show ? x.hn : maskHn(x.hn)) : '', x.age ? esc(x.age) + ' ปี' : '', x.dx ? 'Dx ' + esc(x.dx) : ''].filter(Boolean).join(' · ') + '</span>' +
        (x.dest || x.note ? '<span class="cmeta">' + (x.dest ? '→ <b>' + esc(x.dest) + '</b>' : '') + (x.note ? (x.dest ? ' · ' : '') + esc(x.note) : '') + '</span>' : '') + '</div>' +
        (ed ? '<div class="cact"><button class="iconbtn" data-cedit="' + esc(x.id) + '" aria-label="แก้ไข">' + IC.edit + '</button><button class="iconbtn" data-cdel="' + esc(x.id) + '" aria-label="ลบ">' + IC.trash + '</button></div>' : '') + '</div>';
    }).join('') + '</div><p class="xs muted" style="margin:10px 0 0">Admit ' + cnt.admit + ' · Consult ' + cnt.consult + ' · Night OPD ' + cnt.nightOpd + ' · จำนวนในช่องด้านบนปรับตามรายชื่อให้เอง · ข้อมูลผู้ป่วยแสดงในรายงานเฉพาะเมื่อเลือก</p>'
      : '<div class="empty" style="padding:16px 8px">' + IC.ambul + (ed ? 'ยังไม่มีผู้ป่วยส่งต่อ · กด "+ เพิ่ม" เมื่อมี Admit / Consult / โอน Night OPD' : 'ไม่มีผู้ป่วยส่งต่อ') + '</div>') + '</div>';
  var eye = $('#caseEye', box); if (eye) eye.onclick = function () { store('caseShow', !show); drawCases(); };
  var rv = $('#caseReveal', box); if (rv) rv.onclick = function () { revealDayCases(rv).catch(function (e) { toast(e.message, true); }); };
  var add = $('#caseAdd', box); if (add) add.onclick = function () { caseForm(null); };
  $$('[data-cedit]', box).forEach(function (b) { b.onclick = function () { caseForm(list.filter(function (x) { return x.id === b.getAttribute('data-cedit'); })[0]); }; });
  $$('[data-cdel]', box).forEach(function (b) { b.onclick = function () {
    var x = list.filter(function (y) { return y.id === b.getAttribute('data-cdel'); })[0];
    var m = modal('ลบรายการนี้?', '<p style="margin:0">' + esc(CASE_T[x.type]) + ' · ' + esc(x.name || '') + (x.hn ? ' HN ' + esc(x.hn) : '') + '</p><p class="small muted">จำนวนในช่องด้านบนจะไม่ลดลงเอง แก้ตัวเลขได้ถ้าต้องการ</p>', '<button class="btn" data-close>ยกเลิก</button><button class="btn btn-brand" id="cdok">' + IC.trash + 'ลบ</button>', 'sm');
    $('#cdok', m).onclick = function () { saveCaseReq({ date: DAY.data.date, unit: x.unit, id: x.id, remove: true }, $('#cdok', m)).then(function () { m.close(); toast('ลบแล้ว'); }); };
  }; });
}
function saveCaseReq(p, btn) {
  p._rid = rid(); var date = p.date;
  return busy(btn, api('saveCase', p), 'กำลังบันทึก…').then(function (r) {
    forget('getDay|{"date":"' + date + '"'); forget('getMonth'); forget('getCases'); MP_dirty(date);
    if (DAY.data && DAY.data.date === date) {
      DAY.data.cases = r.cases;
      var e = DAY.data.entries[r.unit] || (DAY.data.entries[r.unit] = { procs: {} });
      Object.keys(r.fields || {}).forEach(function (k) { if (!(DAY.pendUnit === r.unit && k in DAY.pend.fields)) { e[k] = r.fields[k]; var inp = $('#f_' + k); if (inp && DAY.unit === r.unit && document.activeElement !== inp) inp.value = r.fields[k]; } });
      drawCases();
    }
    return r;
  }).catch(function (e) { toast(e.message, true); throw e; });
}
function caseForm(x) {
  var isNew = !x; x = x || { type: store('caseLastType') || 'admit', name: '', hn: '', age: '', dx: '', dest: '', note: '', unit: DAY.unit };
  var m = modal(isNew ? 'เพิ่มผู้ป่วยส่งต่อ' : 'แก้ไขผู้ป่วยส่งต่อ', '<form id="cform" class="cform">' +
    '<div class="seg wide" role="radiogroup" aria-label="ประเภท">' + Object.keys(CASE_T).map(function (k) { return '<button type="button" role="radio" data-ct="' + k + '" aria-pressed="' + (x.type === k) + '">' + esc(CASE_T[k]) + '</button>'; }).join('') + '</div>' +
    '<div class="g2"><label class="field" for="c_name">ชื่อ-สกุล<input id="c_name" type="text" maxlength="80" value="' + esc(x.name) + '" autocomplete="off"></label>' +
    '<label class="field" for="c_hn">HN<input id="c_hn" type="text" maxlength="20" value="' + esc(x.hn) + '" autocomplete="off" inputmode="text"></label></div>' +
    '<div class="g2"><label class="field" for="c_age">อายุ (ปี)<input id="c_age" type="text" maxlength="12" value="' + esc(x.age) + '" inputmode="numeric" autocomplete="off"></label>' +
    '<label class="field" for="c_dest"><span class="destlbl">' + (x.type === 'admit' ? 'Ward' : 'ส่งต่อหน่วยงาน') + '</span><input id="c_dest" type="text" maxlength="80" value="' + esc(x.dest) + '" placeholder="เช่น Ward 5 / ER / OPD ศัลยกรรม" autocomplete="off"></label></div>' +
    '<label class="field" for="c_dx">DX / การวินิจฉัย<input id="c_dx" type="text" maxlength="200" value="' + esc(x.dx) + '" autocomplete="off"></label>' +
    '<label class="field" for="c_note">หมายเหตุ<input id="c_note" type="text" maxlength="200" value="' + esc(x.note) + '" autocomplete="off"></label>' +
    '<p class="xs muted" style="margin:0">ใส่ชื่อหรือ HN อย่างน้อย 1 อย่าง · ข้อมูลใช้ภายในเพื่อติดตามเคส ไม่แสดงในรายงานถ้าไม่เลือก' + (unitsList().length > 1 ? ' · หน่วยงาน: ' + esc(unitName(x.unit || DAY.unit)) : '') + '</p></form>',
    '<button class="btn" data-close>ยกเลิก</button><button class="btn btn-brand" id="csave" form="cform" type="submit">' + IC.check.replace('class="ck" ', '') + 'บันทึก</button>', 'sm');
  var type = x.type;
  $$('[data-ct]', m).forEach(function (b) { b.onclick = function () { type = b.getAttribute('data-ct'); $$('[data-ct]', m).forEach(function (y) { y.setAttribute('aria-pressed', y === b); }); $('.destlbl', m).textContent = type === 'admit' ? 'Ward' : 'ส่งต่อหน่วยงาน'; }; });
  setTimeout(function () { var f = $('#c_name', m); if (f) f.focus(); }, 60);
  $('#cform', m).onsubmit = function (e) {
    e.preventDefault();
    var p = { date: DAY.data.date, unit: x.unit || DAY.unit, type: type, name: $('#c_name', m).value, hn: $('#c_hn', m).value, age: $('#c_age', m).value, dx: $('#c_dx', m).value, dest: $('#c_dest', m).value, note: $('#c_note', m).value };
    if (!p.name.trim() && !p.hn.trim()) return toast('กรุณาใส่ชื่อ-สกุล หรือ HN', true);
    if (!isNew) p.id = x.id;
    store('caseLastType', type);
    saveCaseReq(p, $('#csave', m)).then(function () { m.close(); toast(isNew ? 'เพิ่มแล้ว' : 'บันทึกแล้ว'); });
  };
}
function MP_dirty(date) { if (typeof AN !== 'undefined' && AN.months) { delete AN.months[date.slice(0, 7)]; } }

/* =====================================================================
   จัดทำรายงาน: ตัวเลือกร่วม (ขอบเขต · ส่วนที่แสดง · ผู้รายงาน) → ข้อความ / ภาพ / พิมพ์ A4
   ===================================================================== */
var LOGO_URL = typeof LOGO_DATA !== 'undefined' ? LOGO_DATA : 'logo-hospital.png';
function nowStamp() { var n = new Date(); return ds(n) + ' ' + ('0' + n.getHours()).slice(-2) + ':' + ('0' + n.getMinutes()).slice(-2); }
/** ตัวเลือก (จำแยกตามชนิดรายงาน) */
function outOpts(kind) {
  var o = store('out4:' + kind) || {};
  var def = { scope: DAY.unit === ALL_UNITS ? 'split' : unitScope(DAY.unit), docs: kind !== 'line', rights: true, procs: true, cases: kind === 'print', staff: kind !== 'line', groupsOnly: false };
  Object.keys(def).forEach(function (k) { if (o[k] === undefined) o[k] = def[k]; });
  if (DAY.unit === ALL_UNITS && o.scope === 'own') o.scope = 'split';
  if (unitsList().length <= 1) o.scope = 'own';
  return o;
}
function repUnit(o) { return o.scope === 'own' && DAY.unit !== ALL_UNITS ? DAY.unit : ALL_UNITS; }
/** ผู้รายงาน: ชื่อ/ตำแหน่งจากบัญชีผู้ใช้ · ถ้าไม่อยู่ในเวรวันนั้น เลือกคนในเวรแทนได้ */
function reporter() {
  var date = DAY.data.date, pick = store('rep:' + S.me.user + ':' + date);
  if (pick && pick.name) return pick;
  return { name: S.me.reportName || S.me.name, title: S.me.title || '', self: true };
}
function inRoster(name) {
  var all = []; Object.keys(DAY.rosters).forEach(function (u) { all = all.concat(staffList(u)); });
  if (!all.length) return null;
  var key = String(name || '').replace(/^(นาย|นาง|นางสาว|น\.ส\.|พว\.|พย\.|นพ\.|พญ\.)\s*/, '').split(/\s+/)[0];
  return key && all.some(function (x) { return String(x.name).indexOf(key) >= 0; });
}
function optPanel(kind, o) {
  var us = unitsList().length > 1, cs = scopeCases(repUnit(o)).length, rp = reporter(), roster = [];
  Object.keys(DAY.rosters).forEach(function (u) { staffList(u).forEach(function (x) { if (roster.indexOf(x.name) < 0) roster.push(String(x.name).replace(/\s*\(ตัวอย่าง\)$/, '')); }); });
  var notIn = inRoster(rp.name) === false;
  return '<div class="optpanel">' +
    (us ? '<label class="fsel"><span class="t">ขอบเขต</span><select id="o_scope">' + (DAY.unit !== ALL_UNITS ? '<option value="own"' + (o.scope === 'own' ? ' selected' : '') + '>' + esc(unitName(DAY.unit)) + '</option>' : '') + '<option value="split"' + (o.scope === 'split' ? ' selected' : '') + '>ทุกหน่วยงาน แยกส่วน</option><option value="all"' + (o.scope === 'all' ? ' selected' : '') + '>ทุกหน่วยงาน รวมยอดเดียว</option></select></label>' : '') +
    '<div class="optchecks">' +
      '<label class="row small" for="o_docs"><input type="checkbox" id="o_docs"' + (o.docs ? ' checked' : '') + '> รายชื่อแพทย์</label>' +
      '<label class="row small" for="o_rights"><input type="checkbox" id="o_rights"' + (o.rights ? ' checked' : '') + '> สิทธิการรักษา</label>' +
      '<label class="row small" for="o_procs"><input type="checkbox" id="o_procs"' + (o.procs ? ' checked' : '') + '> หัตถการ</label>' +
      '<label class="row small" for="o_staff"><input type="checkbox" id="o_staff"' + (o.staff ? ' checked' : '') + '> เจ้าหน้าที่</label>' +
      (cs ? '<label class="row small" for="o_cases"><input type="checkbox" id="o_cases"' + (o.cases ? ' checked' : '') + '> ชื่อ/HN ผู้ป่วยส่งต่อ</label>' : '') +
    '</div>' +
    '<div class="reprow"><span class="small">ผู้รายงาน: <b>' + esc(rp.name) + '</b>' + (rp.title ? ' · ' + esc(rp.title) : '') + '</span>' +
      (notIn && roster.length ? '<span class="chip warn" title="ชื่อในบัญชีไม่อยู่ในตารางเวรวันนี้">ไม่อยู่ในเวรวันนี้</span>' : '') +
      (roster.length ? '<select id="o_rep" aria-label="เปลี่ยนผู้รายงาน"><option value="">' + (rp.self ? 'เปลี่ยนเป็นคนในเวร…' : 'ใช้ชื่อของฉัน') + '</option>' + roster.map(function (n) { return '<option value="' + esc(n) + '">' + esc(n) + '</option>'; }).join('') + '</select>' : '') +
      (!S.me.title ? '<span class="xs muted">ยังไม่มีตำแหน่ง (แอดมินตั้งที่ ตั้งค่า › ผู้ใช้)</span>' : '') + '</div></div>';
}
function bindOptPanel(m, kind, o, redraw) {
  var sc = $('#o_scope', m); if (sc) sc.onchange = function () { o.scope = sc.value; store('out4:' + kind, o); redraw(true); };
  ['docs', 'rights', 'procs', 'staff', 'cases'].forEach(function (k) { var c = $('#o_' + k, m); if (c) c.onchange = function () { o[k] = c.checked; store('out4:' + kind, o); redraw(); }; });
  var rp = $('#o_rep', m); if (rp) rp.onchange = function () {
    var k = 'rep:' + S.me.user + ':' + DAY.data.date;
    if (!rp.value) store(k, null); else { var pos = ''; Object.keys(DAY.rosters).forEach(function (u) { staffList(u).forEach(function (x) { if (String(x.name).replace(/\s*\(ตัวอย่าง\)$/, '') === rp.value) { var p = (S.boot.positions || []).filter(function (y) { return y.id === x.pos; })[0]; pos = p ? p.name : ''; } }); }); store(k, { name: rp.value, title: pos }); }
    redraw(true);
  };
}
/** บันทึกยอดตอนจัดทำรายงาน → ใช้เตือนเมื่อยอดเปลี่ยนภายหลัง */
function markReported(o, kind) {
  if (!canEdit() || !DAY.data || DAY.data.api.status !== 'ok') return;
  var u = repUnit(o), tot = dayTotal(u);
  api('markReported', { date: DAY.data.date, unit: u, total: tot, kind: kind, _rid: rid() }).then(function (r) {
    if (r.saved && DAY.data) { DAY.data.entries[u] = DAY.data.entries[u] || {}; DAY.data.entries[u].reported = { total: tot, at: r.at, by: S.me.name, kind: kind }; forget('getDay'); forget('getMonth'); }
  }).catch(function () { });
}

/* ---------- เนื้อหารายงาน (ใช้ร่วม: ใบ A4 · ภาพ · ข้อความ) ---------- */
function repData(o) {
  var u = repUnit(o), rows = scopeRows(u), tree = buildTree(rows, o.scope === 'split' && u === ALL_UNITS && unitsList().length > 1);
  var nC = {}, nD = {}; rows.forEach(function (r) { nC[r[0]] = 1; nD[docKey(r[0], r[3] || r[1])] = 1; });
  var ents = scopeRights(u), rs = ents ? rightsSum(ents) : null;
  var units = u === ALL_UNITS ? unitsList().map(function (x) { return x.id; }) : [u];
  var procs = units.map(function (id) { var p = curProcs(id); return { unit: id, items: itemsOf(id).filter(function (i) { return p[i.id]; }).map(function (i) { return [i.name, p[i.id]]; }).concat(Object.keys(p).filter(function (k) { return !itemsOf(id).some(function (i) { return i.id === k; }); }).map(function (k) { return [itemName(k), p[k]]; })), total: procSum(p), noProc: !!curField('noProc', id) }; });
  var pTotal = procs.reduce(function (s, x) { return s + x.total; }, 0);
  var persons = scopePersons(u);
  return { u: u, tree: tree, total: rows.reduce(function (s, r) { return s + r[2]; }, 0), clinics: Object.keys(nC).length, docs: Object.keys(nD).length, rs: rs, procs: procs, pTotal: pTotal, persons: persons,
    consult: +curField('consult', u) || 0, nightOpd: +curField('nightOpd', u) || 0, admit: +curField('admit', u) || 0, other: curField('other', u) || '', note: curField('note', u) || '',
    cases: scopeCases(u), rep: reporter(), title: S.boot.texts.reportTitle || 'แบบบันทึกรายงานประจำวัน คลินิกพิเศษเฉพาะทางนอกเวลา', unitLabel: u === ALL_UNITS ? (unitsList().length > 1 ? 'ทุกหน่วยงาน' : '') : unitName(u) };
}
function staffBlock(o, u) {
  var units = u === ALL_UNITS ? unitsList().map(function (x) { return x.id; }) : [u], out = [];
  units.forEach(function (id) {
    var list = staffList(id); if (!list.length) return;
    positionsOf(id).forEach(function (ps) {
      var n = list.filter(function (x) { return x.pos === ps.id; }).map(function (x) { return String(x.name).replace(/\s*\(ตัวอย่าง\)$/, '') + (ps.clinicBox && x.clinic ? ' (' + x.clinic + ')' : ''); });
      if (n.length) out.push([(units.length > 1 ? unitName(id) + ' · ' : '') + ps.short, n]);
    });
  });
  return out;
}
/** ใบรายงาน A4 (พิมพ์ขาวดำได้ชัด · ภาพสวยด้วยสีประจำกลุ่ม) */
function paperHtml(o) {
  var R = repData(o), d = DAY.data, dt = pd(d.date), split = R.tree.length > 1;
  var pt = '';
  R.tree.forEach(function (U) {
    if (split) pt += '<tr class="rp-u"><td colspan="2">' + esc(unitName(U.id)) + '</td><td class="n">' + fmt(U.total, 0) + '</td></tr>';
    U.groups.forEach(function (G) {
      var hx = grpHex(G.id);
      pt += '<tr class="rp-g" style="--gc:' + hx + ';--gbg:' + hexA(hx, .13) + '"><td colspan="2">' + esc(grpName(G.id)) + '</td><td class="n">' + fmt(G.total, 0) + '</td></tr>';
      G.clinics.forEach(function (C) {
        var loc = clinicLoc(C.code);
        if (o.docs) {
          pt += '<tr class="rp-c"><td colspan="2"><span class="rp-code">' + esc(C.code) + '</span> ' + esc(clinicShort(C.code)) + (loc !== 'รพ.' ? ' <i>(' + esc(loc) + ')</i>' : '') + '</td><td class="n">' + C.total + '</td></tr>';
          C.docs.forEach(function (D) { pt += '<tr class="rp-d"><td></td><td>' + esc(D.name) + (D.cnt > 1 && D.key.charAt(0) === '*' ? ' (' + D.cnt + ' ท่าน)' : '') + '</td><td class="n">' + D.n + '</td></tr>'; });
        } else pt += '<tr class="rp-c"><td><span class="rp-code">' + esc(C.code) + '</span></td><td>' + esc(clinicShort(C.code)) + (loc !== 'รพ.' ? ' <i>(' + esc(loc) + ')</i>' : '') + '</td><td class="n">' + C.total + '</td></tr>';
      });
    });
  });
  var procHtml = '';
  if (o.procs) {
    var any = R.procs.some(function (p) { return p.items.length; });
    procHtml = '<section class="rp-box"><h5><span>หัตถการ</span><span><b>' + fmt(R.pTotal, 0) + '</b> ครั้ง</span></h5>' + (any ? R.procs.map(function (p) {
      if (!p.items.length) return R.procs.length > 1 ? '<div class="rp-sub">' + esc(unitName(p.unit)) + ': ' + (p.noProc ? 'ไม่มีหัตถการ' : 'ยังไม่คีย์') + '</div>' : '';
      return (R.procs.length > 1 ? '<div class="rp-sub">' + esc(unitName(p.unit)) + ' · ' + fmt(p.total, 0) + '</div>' : '') + '<table class="rp-kv">' + p.items.map(function (x) { return '<tr><td>' + esc(x[0]) + '</td><td class="n">' + x[1] + '</td></tr>'; }).join('') + '</table>';
    }).join('') : '<p class="rp-empty">' + (R.procs.every(function (p) { return p.noProc; }) ? 'ไม่มีหัตถการ' : 'ยังไม่ได้คีย์หัตถการ') + '</p>') + '</section>';
  }
  var rtHtml = '';
  if (o.rights && R.rs) {
    var ids = rgRows(R.rs.reg).map(function (x) { return x.id; }); rgRows(R.rs.pay).forEach(function (x) { if (ids.indexOf(x.id) < 0) ids.push(x.id); });
    ids.sort(function (a, b) { return (a === 'none' ? 999 : a === '' ? 998 : rgOrder(a)) - (b === 'none' ? 999 : b === '' ? 998 : rgOrder(b)); });
    rtHtml = '<section class="rp-box"><h5>สิทธิการรักษา</h5><table class="rp-kv rp-rt"><thead><tr><th></th><th>ตามทะเบียน</th><th>ที่ชำระจริง</th></tr></thead><tbody>' +
      ids.map(function (id) { return '<tr><td><i class="rp-sw" style="background:' + (id === 'none' ? '#ddd' : rgHex(id)) + '"></i>' + esc(rgName(id)) + '</td><td class="n">' + (R.rs.reg[id] ? fmt(R.rs.reg[id], 0) : (id === 'none' ? '' : '–')) + '</td><td class="n">' + (R.rs.pay[id] ? fmt(R.rs.pay[id], 0) : '–') + '</td></tr>'; }).join('') +
      '</tbody><tfoot><tr><td>รวม</td><td class="n">' + fmt(R.rs.total, 0) + '</td><td class="n">' + fmt(R.rs.total, 0) + '</td></tr></tfoot></table>' +
      '<div class="rp-sub">สิทธิเดียว ' + fmt(R.rs.usage.single, 0) + ' · สิทธิร่วม ' + fmt(R.rs.usage.combo, 0) + ' · เงินสด (ไม่เปิดสิทธิ) ' + fmt(R.rs.usage.cash, 0) + (R.rs.mixed ? ' · ร่วมจ่ายเงินสด ' + fmt(R.rs.mixed, 0) : '') + '</div></section>';
  }
  var caseHtml = '';
  if (R.cases.length) {
    if (o.cases && !casesMasked()) caseHtml = '<section class="rp-wide"><h5>ผู้ป่วยส่งต่อ ' + R.cases.length + ' ราย</h5><table class="rp-tbl"><thead><tr><th>ประเภท</th><th>ชื่อ-สกุล</th><th>HN</th><th>อายุ</th><th>DX</th><th>Ward/หน่วยงาน</th><th>หมายเหตุ</th></tr></thead><tbody>' +
      R.cases.map(function (x) { return '<tr><td>' + esc(CASE_SHORT[x.type]) + '</td><td>' + esc(x.name) + '</td><td>' + esc(x.hn) + '</td><td class="n">' + esc(x.age) + '</td><td>' + esc(x.dx) + '</td><td>' + esc(x.dest) + '</td><td>' + esc(x.note) + '</td></tr>'; }).join('') + '</tbody></table></section>';
    else caseHtml = '<div class="rp-line"><b>ผู้ป่วยส่งต่อ ' + R.cases.length + ' ราย:</b> ' + esc(R.cases.map(function (x) { return caseLine(x, false); }).join(' · ')) + '</div>';
  }
  var st = o.staff ? staffBlock(o, R.u) : [];
  var at = DAY.data.api.at || nowStamp();
  return '<div class="paper rp">' +
    '<header class="rp-h"><img class="rp-logo" src="' + LOGO_URL + '" alt="" crossorigin="anonymous" onerror="this.style.display=\'none\'"><div class="rp-t"><h4>' + esc(R.title) + '</h4><div>' + esc(ORG.hosp) + ' ' + esc(ORG.trc) + '</div></div>' +
      '<div class="rp-dt"><b>วัน' + TH_D[dt.getDay()] + 'ที่ ' + dt.getDate() + ' ' + TH_MF[dt.getMonth()] + ' ' + (dt.getFullYear() + 543) + '</b>' + (d.holiday ? '<span>' + esc(d.holiday) + '</span>' : '') + (R.unitLabel ? '<span>หน่วยงาน: ' + esc(R.unitLabel) + '</span>' : '') + '</div></header>' +
    '<div class="rp-kpi"><div class="k1"><span>ผู้รับบริการ</span><b>' + fmt(R.total, 0) + '</b><small>ราย' + (R.persons != null ? ' · ' + fmt(R.persons, 0) + ' คน' : '') + '</small></div><div><span>คลินิก</span><b>' + R.clinics + '</b></div><div><span>แพทย์</span><b>' + R.docs + '</b></div><div><span>หัตถการ</span><b>' + fmt(R.pTotal, 0) + '</b></div><div><span>Consult</span><b>' + R.consult + '</b></div><div><span>Night OPD ชั้น 4</span><b>' + R.nightOpd + '</b></div><div><span>Admit</span><b>' + R.admit + '</b></div></div>' +
    '<div class="rp-cols' + (o.procs || (o.rights && R.rs) ? '' : ' one') + '"><section class="rp-pt"><table class="rp-tbl"><thead><tr><th colspan="2">' + (groupsList().length ? 'กลุ่มคลินิก › คลินิก' + (o.docs ? ' › แพทย์' : '') : 'คลินิก' + (o.docs ? ' › แพทย์' : '')) + '</th><th class="n">ราย</th></tr></thead><tbody>' + (pt || '<tr><td colspan="3" class="rp-empty">ไม่มีผู้ป่วย</td></tr>') + '</tbody><tfoot><tr><td colspan="2">รวมผู้รับบริการ</td><td class="n">' + fmt(R.total, 0) + '</td></tr></tfoot></table></section>' +
      (o.procs || (o.rights && R.rs) ? '<aside class="rp-side">' + procHtml + rtHtml + '</aside>' : '') + '</div>' +
    caseHtml +
    (R.other ? '<div class="rp-line"><b>อื่นๆ:</b> ' + esc(R.other) + '</div>' : '') + (R.note ? '<div class="rp-line"><b>หมายเหตุ:</b> ' + esc(R.note) + '</div>' : '') +
    (st.length ? '<section class="rp-wide rp-staff"><h5>เจ้าหน้าที่ปฏิบัติงาน</h5>' + st.map(function (x) { return '<div><b>' + esc(x[0]) + ':</b> ' + esc(x[1].join(' · ')) + '</div>'; }).join('') + '</section>' : '') +
    '<footer class="rp-sign"><div><span>ผู้รายงาน</span><b>' + esc(R.rep.name) + '</b>' + (R.rep.title ? '<span>ตำแหน่ง ' + esc(R.rep.title) + '</span>' : '<span>ตำแหน่ง ……………………………</span>') + '</div>' +
      '<div class="rp-asof">ข้อมูล ณ ' + esc(stampTh(at.slice(0, 16))) + ' · ยอดผู้รับบริการจากระบบสารสนเทศโรงพยาบาล<br>จัดทำ ' + esc(stampTh(nowStamp())) + ' · SMC Daily</div></footer></div>';
}
/** ภาพสรุปมือถือ */
function cardHtml(o) {
  var R = repData(o), d = DAY.data, gs = [];
  R.tree.forEach(function (U) { U.groups.forEach(function (G) { gs.push({ u: U.id, g: G }); }); });
  var mx = Math.max.apply(null, gs.map(function (x) { return x.g.total; }).concat([1]));
  var rr = R.rs ? rgRows(R.rs.reg) : [];
  var st = o.staff ? staffBlock(o, R.u) : [];
  return '<div class="mcard mc4"><div class="hd"><svg viewBox="0 0 400 46" preserveAspectRatio="none"><path d="M0,30 L120,30 L132,20 L144,30 L160,30 L170,4 L182,44 L194,30 L400,30" fill="none" stroke="#fff" stroke-width="2"/></svg><small>' + esc(S.boot.texts.lineHeader || '') + (R.unitLabel ? ' · ' + esc(R.unitLabel) : '') + '</small><div class="dt">' + esc(thDate(d.date, true, true)) + '</div>' +
    '<div class="big">' + fmt(R.total, 0) + ' <span style="font-size:17px;font-weight:500">ราย' + (R.persons != null ? ' · ' + fmt(R.persons, 0) + ' คน' : '') + '</span></div><small>' + R.clinics + ' คลินิก · แพทย์ ' + R.docs + ' ท่าน · หัตถการ ' + fmt(R.pTotal, 0) + ' ครั้ง</small></div>' +
    '<div class="sec"><h5>ผู้ป่วยแยกกลุ่มคลินิก</h5>' + gs.map(function (x) {
      var hx = grpHex(x.g.id);
      return '<div class="mg"><div class="mgh"><i style="background:' + hx + '"></i><b>' + esc(grpName(x.g.id)) + (R.tree.length > 1 ? ' <small>' + esc(unitName(x.u)) + '</small>' : '') + '</b><span class="mgbar"><em style="width:' + (x.g.total / mx * 100).toFixed(0) + '%;background:' + hx + '"></em></span><b class="n">' + fmt(x.g.total, 0) + '</b></div>' +
        '<div class="mgc">' + x.g.clinics.map(function (C) { return '<span>' + esc(C.code) + ' <b>' + C.total + '</b></span>'; }).join('') + '</div></div>';
    }).join('') + '</div>' +
    (o.rights && R.rs ? '<div class="sec"><h5>สิทธิการรักษา (ตามทะเบียน)</h5><div class="mrt">' + rr.map(function (x) { return '<span><i style="background:' + x.hex + '"></i>' + esc(x.name) + '</span><b>' + fmt(x.v, 0) + '</b>'; }).join('') + '</div><p class="mnote">สิทธิเดียว ' + fmt(R.rs.usage.single, 0) + ' · สิทธิร่วม ' + fmt(R.rs.usage.combo, 0) + ' · เงินสด ' + fmt(R.rs.usage.cash, 0) + '</p></div>' : '') +
    (o.procs ? '<div class="sec"><h5>หัตถการ ' + fmt(R.pTotal, 0) + ' ครั้ง</h5>' + (R.procs.some(function (p) { return p.items.length; }) ? R.procs.map(function (p) { return p.items.length ? (R.procs.length > 1 ? '<div class="mnote">' + esc(unitName(p.unit)) + '</div>' : '') + '<div class="kv">' + p.items.sort(function (a, b) { return b[1] - a[1]; }).map(function (x) { return '<span>' + esc(x[0]) + '</span><b>' + x[1] + '</b>'; }).join('') + '</div>' : ''; }).join('') : '<p class="mnote">' + (R.procs.every(function (p) { return p.noProc; }) ? 'ไม่มีหัตถการ' : 'ยังไม่คีย์') + '</p>') + '</div>' : '') +
    '<div class="sec"><div class="kv"><span>Consult แผนกอื่น</span><b>' + R.consult + '</b><span>โอน Night OPD ชั้น 4</span><b>' + R.nightOpd + '</b><span>Admit</span><b>' + R.admit + '</b></div>' +
    (R.cases.length ? '<div class="cs">' + R.cases.map(function (x) { return '<div>• ' + esc(caseLine(x, !!o.cases && !casesMasked())) + '</div>'; }).join('') + '</div>' : '') +
    (R.note ? '<p class="mnote">หมายเหตุ: ' + esc(R.note) + '</p>' : '') + '</div>' +
    (st.length ? '<div class="sec st"><h5>เจ้าหน้าที่</h5>' + st.map(function (x) { return '<div><b>' + esc(x[0]) + '</b> ' + esc(x[1].map(function (n) { return n.split(' ')[0]; }).join(', ')) + '</div>'; }).join('') + '</div>' : '') +
    '<div class="msign">ผู้รายงาน <b>' + esc(R.rep.name) + '</b>' + (R.rep.title ? ' · ' + esc(R.rep.title) : '') + '</div>' +
    '<div class="ft"><span>SMC Daily · ' + ORG.abbr + '</span><span>ข้อมูล ณ ' + esc(stampTh((DAY.data.api.at || nowStamp()).slice(0, 16))) + '</span></div></div>';
}
/** ข้อความรายงาน (วางในไลน์/แชต) */
function lineText(o) {
  var R = repData(o), d = DAY.data, t = '📋 ' + (S.boot.texts.lineHeader || 'รายงานประจำวัน') + (R.unitLabel ? ' · ' + R.unitLabel : '') + '\n' + thDate(d.date, true, true) + (d.holiday ? ' (' + d.holiday + ')' : '') + '\n\n';
  t += '👥 ผู้รับบริการ ' + fmt(R.total, 0) + ' ราย' + (R.persons != null ? ' (' + fmt(R.persons, 0) + ' คน)' : '') + ' · ' + R.clinics + ' คลินิก · แพทย์ ' + R.docs + ' ท่าน\n';
  R.tree.forEach(function (U) {
    if (R.tree.length > 1) t += '\n【' + unitName(U.id) + ' ' + fmt(U.total, 0) + '】\n';
    U.groups.forEach(function (G) { t += '▸ ' + grpName(G.id) + ' ' + fmt(G.total, 0) + ': ' + G.clinics.map(function (C) { return C.code + ' ' + C.total; }).join(' · ') + '\n'; });
  });
  if (o.rights && R.rs) {
    t += '\n💳 สิทธิ (ตามทะเบียน): ' + rgRows(R.rs.reg).map(function (x) { return x.name + ' ' + fmt(x.v, 0); }).join(' · ') + '\n';
    t += '   สิทธิเดียว ' + fmt(R.rs.usage.single, 0) + ' · สิทธิร่วม ' + fmt(R.rs.usage.combo, 0) + ' · เงินสด ' + fmt(R.rs.usage.cash, 0) + '\n';
  }
  if (o.procs) {
    var items = []; R.procs.forEach(function (p) { p.items.forEach(function (x) { items.push((R.procs.length > 1 ? unitName(p.unit) + ':' : '') + x[0] + ' ' + x[1]); }); });
    t += '\n💉 หัตถการ ' + fmt(R.pTotal, 0) + ' ครั้ง' + (items.length ? ': ' + items.join(' · ') : (R.procs.every(function (p) { return p.noProc; }) ? ' (ไม่มีหัตถการ)' : ' (ยังไม่คีย์)')) + '\n';
  }
  t += '🚑 Consult ' + R.consult + ' · Night OPD ชั้น 4 ' + R.nightOpd + ' · Admit ' + R.admit;
  if (R.cases.length) {
    t += '\n   ผู้ป่วยส่งต่อ ' + R.cases.length + ' ราย';
    if (o.cases && !casesMasked()) R.cases.forEach(function (x) { t += '\n   • ' + caseLine(x, true); });
    else t += ': ' + R.cases.map(function (x) { return caseLine(x, false); }).join(' · ');
  }
  if (R.other) t += '\nอื่นๆ: ' + R.other;
  if (R.note) t += '\n📝 ' + R.note;
  if (o.staff) { var st = staffBlock(o, R.u); if (st.length) { t += '\n\n👩‍⚕️ เจ้าหน้าที่'; st.forEach(function (x) { t += '\n' + x[0] + ': ' + x[1].map(function (n) { return n.split(' ')[0]; }).join(', '); }); } }
  t += '\n\nผู้รายงาน: ' + R.rep.name + (R.rep.title ? ' (' + R.rep.title + ')' : '') + '\nข้อมูล ณ ' + stampTh((DAY.data.api.at || nowStamp()).slice(0, 16));
  return t;
}
function openLine() {
  var o = outOpts('line');
  var m = modal('ข้อความรายงาน', optPanel('line', o) + '<pre class="linetxt" id="ltxt">' + esc(lineText(o)) + '</pre>',
    '<span class="small muted grow">คัดลอกแล้ววางในกลุ่มไลน์</span><button class="btn btn-brand" id="lcopy">' + IC.copy + 'คัดลอกข้อความ</button>', 'sheet');
  var redraw = function (full) { if (full) { m.close(); openLine(); return; } $('#ltxt', m).textContent = lineText(o); };
  bindOptPanel(m, 'line', o, redraw);
  $('#lcopy', m).onclick = function () { copyText(lineText(o), $('#ltxt', m)); markReported(o, 'text'); };
}
/** วาดภาพนอกจอที่ขนาดจริง (ไม่ขึ้นกับการย่อพรีวิว) → canvas */
function renderOffscreen(html, bg) {
  return loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js').then(function () {
    var host = document.createElement('div'); host.className = 'offscreen'; host.innerHTML = html; document.body.appendChild(host);
    var el = host.firstElementChild, imgs = $$('img', el);
    return Promise.all(imgs.map(function (im) { return im.complete ? null : new Promise(function (r) { im.onload = im.onerror = r; setTimeout(r, 2500); }); }))
      .then(function () { return document.fonts && document.fonts.ready ? document.fonts.ready : null; })
      .then(function () { return window.html2canvas(el, { scale: 2, backgroundColor: bg, useCORS: true, logging: false }); })
      .then(function (cv) { host.remove(); return cv; }, function (e) { host.remove(); throw e; });
  });
}
function fitPreview(box) {
  var el = box.firstElementChild; if (!el || el.tagName === 'IMG') return;
  el.style.transform = ''; box.style.height = '';
  var w = el.offsetWidth, avail = box.clientWidth - 24;
  if (w > avail && avail > 0) { var k = avail / w; el.style.transformOrigin = 'top left'; el.style.transform = 'scale(' + k + ')'; box.style.height = (el.offsetHeight * k + 24) + 'px'; el.style.marginLeft = '0'; }
  else el.style.marginLeft = '';
}
var UA = navigator.userAgent || '';
var IS_TOUCH = window.matchMedia && matchMedia('(pointer: coarse)').matches;
var IS_ANDROID = /Android/i.test(UA), IN_LINE = /\sLine\//i.test(UA), IN_APP = IN_LINE || /FBAN|FBAV|Instagram|KAKAOTALK|; wv\)/i.test(UA);
/** เปิดหน้าเดิมในเบราว์เซอร์ภายนอก (ไลน์รองรับพารามิเตอร์ openExternalBrowser=1) */
function externalUrl() { var u = location.href.split('#')[0]; return u + (u.indexOf('?') >= 0 ? '&' : '?') + 'openExternalBrowser=1'; }
function canCopyImage() { return !!(window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) && !IS_ANDROID && !IN_APP; }
function openImage() {
  var mode = store('imgMode') || 'card', o = outOpts('image'), blob = null, url = null, gen = 0;
  var shareOk = !!(navigator.canShare && window.File) && IS_TOUCH;
  var m = modal('ภาพรายงาน', (IN_APP ? '<div class="banner warn" style="margin:0 0 10px">' + IC.warn.replace('<svg', '<svg width="16" height="16"') + '<div>เปิดจากในแอป' + (IN_LINE ? 'ไลน์' : '') + ' ปุ่มคัดลอก/บันทึกภาพอาจใช้ไม่ได้ · <b>กดค้างที่ภาพ</b>เพื่อบันทึก หรือ <a href="' + esc(externalUrl()) + '" target="_blank" rel="noopener">เปิดใน Chrome / Safari</a></div></div>' : '') +
    '<div class="row" style="justify-content:space-between;margin-bottom:10px"><div class="seg" role="group" aria-label="แบบภาพ"><button data-im="card" aria-pressed="' + (mode === 'card') + '">แบบสรุปมือถือ</button><button data-im="form" aria-pressed="' + (mode === 'form') + '">แบบฟอร์ม A4</button></div></div>' +
    optPanel('image', o) + '<div class="paperwrap" id="imgbox"></div>',
    '<span class="small muted grow" id="imgnote">กำลังเตรียมภาพ…</span>' +
    (canCopyImage() ? '<button class="btn" id="imgcopy" disabled>' + IC.copy + 'คัดลอกภาพ</button>' : '') +
    (shareOk ? '<button class="btn btn-brand" id="imgshare" disabled>' + IC.share + 'แชร์ไปไลน์ / แอปอื่น</button>' : '') +
    '<button class="btn' + (shareOk ? '' : ' btn-brand') + '" id="imgsave" disabled>' + IC.img + 'บันทึกภาพ</button>', 'sheet');
  var box = $('#imgbox', m), note = $('#imgnote', m), bc = $('#imgcopy', m), bs = $('#imgsave', m), bh = $('#imgshare', m);
  var fname = function () { return 'รายงานประจำวัน_' + DAY.data.date + (mode === 'form' ? '_A4' : '') + '.png'; };
  var setBtns = function (on) { [bc, bs, bh].forEach(function (b) { if (b) b.disabled = !on; }); };
  var showImg = function (msg) {   // แสดงภาพจริง → กดค้างเพื่อบันทึก/แชร์/คัดลอก (ใช้ได้ทุกมือถือ รวมถึงในแอปไลน์)
    if (!url) return;
    box.innerHTML = '<img class="outimg" src="' + url + '" alt="ภาพรายงาน">' + '<p class="xs muted" style="text-align:center;margin:8px 0 0">' + (msg || 'กดค้างที่ภาพ › บันทึกรูปภาพ / แชร์ / คัดลอก') + '</p>';
  };
  var draw = function () {
    var html = mode === 'form' ? paperHtml(o) : cardHtml(o), my = ++gen;
    box.innerHTML = html; requestAnimationFrame(function () { fitPreview(box); });
    blob = null; if (url) { URL.revokeObjectURL(url); url = null; } setBtns(false); note.textContent = 'กำลังเตรียมภาพ…';
    renderOffscreen(html, mode === 'form' ? '#ffffff' : null).then(function (cv) {
      cv.toBlob(function (b) {
        if (my !== gen) return; blob = b; setBtns(!!b);
        if (b) { url = URL.createObjectURL(b); if (IS_TOUCH) showImg(); }
        note.textContent = b ? (IS_TOUCH ? 'พร้อมแล้ว · แชร์ หรือกดค้างที่ภาพเพื่อบันทึก' : 'พร้อมแล้ว · คัดลอกไปวางในไลน์ หรือบันทึกเป็นรูป') : 'สร้างภาพไม่สำเร็จ';
      }, 'image/png');
    }).catch(function (e) { if (my === gen) note.textContent = e.message || 'สร้างภาพไม่สำเร็จ'; });
  };
  draw();
  var onR = debounce(function () { if (box.isConnected) fitPreview(box); else removeEventListener('resize', onR); }, 150); addEventListener('resize', onR);
  $$('[data-im]', m).forEach(function (b) { b.onclick = function () { mode = b.getAttribute('data-im'); store('imgMode', mode); $$('[data-im]', m).forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); draw(); }; });
  bindOptPanel(m, 'image', o, function (full) { if (full) { m.close(); openImage(); return; } draw(); });
  var file = function () { return window.File ? new File([blob], fname(), { type: 'image/png' }) : null; };
  if (bh) bh.onclick = function () {
    if (!blob) return; var f = file();
    if (f && navigator.canShare && navigator.canShare({ files: [f] })) {
      navigator.share({ files: [f], title: 'รายงานประจำวัน' }).then(function () { markReported(o, 'image'); }).catch(function (e) { if (e && e.name !== 'AbortError') { showImg('แชร์ไม่ได้ในเบราว์เซอร์นี้ · กดค้างที่ภาพเพื่อบันทึกหรือแชร์'); toast('แชร์ไม่สำเร็จ · กดค้างที่ภาพแทน', true); } });
    } else { showImg('เบราว์เซอร์นี้แชร์ไฟล์ไม่ได้ · กดค้างที่ภาพเพื่อบันทึกหรือแชร์'); }
  };
  bs.onclick = function () {
    if (!blob) return;
    markReported(o, 'image');
    if (IN_APP) { showImg('กดค้างที่ภาพ › บันทึกรูปภาพ'); return; }
    var a = document.createElement('a'); a.href = url; a.download = fname(); document.body.appendChild(a); a.click(); a.remove();
    toast('บันทึกภาพแล้ว');
    if (IS_TOUCH) showImg('ถ้าไม่พบไฟล์ในเครื่อง กดค้างที่ภาพ › บันทึกรูปภาพ');
  };
  if (bc) bc.onclick = function () {
    if (!blob) return;
    navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).then(function () { toast('คัดลอกภาพแล้ว วางในไลน์ได้เลย'); markReported(o, 'image'); }, function () { showImg('คัดลอกไม่ได้ในเบราว์เซอร์นี้ · คลิกขวาที่ภาพ › คัดลอกรูปภาพ'); toast('คัดลอกภาพไม่สำเร็จ ใช้ปุ่มบันทึกภาพแทน', true); });
  };
}
/** พิมพ์ A4: ย่อให้จบในหน้าเดียวเสมอ */
function printDay() {
  var o = outOpts('print');
  var m = modal('พิมพ์ A4', optPanel('print', o) + '<div class="paperwrap" id="prbox"></div>',
    '<span class="small muted grow">ย่อให้พอดีกระดาษ A4 หนึ่งแผ่นอัตโนมัติ · พิมพ์ขาวดำได้ชัด</span><button class="btn btn-brand" id="prgo">' + IC.print + 'พิมพ์</button>', 'sheet');
  var box = $('#prbox', m), draw = function () { box.innerHTML = paperHtml(o); requestAnimationFrame(function () { fitPreview(box); }); };
  draw(); bindOptPanel(m, 'print', o, function (full) { if (full) { m.close(); printDay(); return; } draw(); });
  $('#prgo', m).onclick = function () { markReported(o, 'print'); m.close(); printHtml(paperHtml(o)); };
}
function printHtml(html) {
  var pa = $('#printArea'); pa.innerHTML = html;
  var el = pa.firstElementChild; pa.classList.add('measure');
  var go = function () {
    var h = el.offsetHeight, maxH = 1025;   // A4 ลบขอบ 10 มม. ที่ความกว้างกระดาษ ~718px (เผื่อ 2%)
    pa.classList.remove('measure');
    el.style.zoom = h > maxH ? (maxH / h).toFixed(3) : '';
    setTimeout(function () { window.print(); }, 80);
  };
  var im = $('img', el); if (im && !im.complete) { im.onload = im.onerror = go; setTimeout(function () { if (pa.classList.contains('measure')) go(); }, 1500); } else go();
}

/* =====================================================================
   ปฏิทินย้อนหลัง
   ===================================================================== */
var CALS = { ym: null };
function monthsAvail() { var out = [], a = S.boot.firstDate.slice(0, 7), b = S.boot.today.slice(0, 7), d = pd(a + '-01'); while (ds(d).slice(0, 7) <= b) { out.push(ds(d).slice(0, 7)); d.setMonth(d.getMonth() + 1); } return out.reverse(); }
function pageCal() {
  if (!CALS.ym) CALS.ym = S.boot.today.slice(0, 7);
  var ym = CALS.ym, months = monthsAvail(), i = months.indexOf(ym);
  if (i < 0) { months.unshift(ym); i = 0; }
  $('#main').innerHTML = banners() + '<div class="pagehead rise"><div><div class="eyebrow">ปฏิทินย้อนหลัง</div><h1>' + esc(thMonth(ym)) + '</h1></div>' +
    '<div class="row">' + helpBtn() + '<button class="iconbtn" id="cprev" aria-label="เดือนก่อน"' + (i >= months.length - 1 ? ' disabled' : '') + '>' + IC.prev + '</button><select id="cym" aria-label="เลือกเดือน">' + months.map(function (k) { return '<option value="' + k + '"' + (k === ym ? ' selected' : '') + '>' + thMonth(k) + '</option>'; }).join('') + '</select><button class="iconbtn" id="cnext" aria-label="เดือนถัดไป"' + (i <= 0 ? ' disabled' : '') + '>' + IC.next + '</button></div></div>' +
    '<div id="calBody"><div class="card skel" style="height:520px"></div></div>';
  bindHelp($('#main'));
  $('#cprev').onclick = function () { CALS.ym = months[i + 1]; pageCal(); };
  $('#cnext').onclick = function () { CALS.ym = months[i - 1]; pageCal(); };
  $('#cym').onchange = function (e) { CALS.ym = e.target.value; pageCal(); };
  api('getMonth', { ym: ym }, { onCache: function (d) { drawCal(d); } }).then(function (d) { if (CALS.ym === ym && S.page === 'cal') drawCal(d); }).catch(function (e) { toast(e.message, true); });
}
function drawCal(d) {
  var box = $('#calBody'); if (!box) return;
  var first = pd(d.ym + '-01').getDay(), cnt = { done: 0, missing: 0, closed: 0, nodata: 0 }, mx = 1, sum = 0, open = 0, cells = '', changed = 0;
  d.days.forEach(function (x) { if (x.total) { mx = Math.max(mx, x.total); sum += x.total; open++; } if (cnt[x.status] !== undefined) cnt[x.status]++; if (x.changed) changed++; });
  var bins = heatBins(d.days.map(function (x) { return x.total || 0; }));
  for (var k = 0; k < first; k++) cells += '<div class="c out" aria-hidden="true"></div>';
  d.days.forEach(function (x, i) {
    var dn = +x.date.slice(8), st = x.status;
    var chip = { done: '<span class="chip ok">' + IC.check + 'ครบ</span>', missing: '<span class="chip warn">ยังไม่คีย์</span>', open: '<span class="chip brand">วันนี้</span>', closed: '<span class="chip idle">ไม่มีคลินิก</span>', nodata: '<span class="chip idle">รอข้อมูล</span>', future: '' }[st];
    var dot = { done: 'var(--ok)', missing: 'var(--warn)', open: 'var(--brand)' }[st] || 'transparent';
    cells += '<button class="c ' + x.type + (x.date === S.boot.today ? ' today' : '') + (x.changed ? ' chg' : '') + '" data-day="' + x.date + '"' + (st === 'future' ? ' disabled' : '') + ' style="animation-delay:' + (i * .012).toFixed(3) + 's" aria-label="' + esc(thDate(x.date, true)) + ' ' + (x.total || 0) + ' ราย' + (x.changed ? ' ยอดเปลี่ยนหลังรายงาน' : '') + '"' + (x.changed ? ' title="ยอดเปลี่ยนหลังจัดทำรายงาน: ' + x.changed[0] + ' → ' + x.changed[1] + '"' : '') + '>' +
      '<span class="dn"><span>' + dn + '</span><span class="dotst" style="background:' + dot + '"></span></span><span class="vn">' + (x.total ? fmt(x.total, 0) : '') + (x.changed ? '<sup class="chgmark">' + (x.changed[1] > x.changed[0] ? '+' : '') + (x.changed[1] - x.changed[0]) + '</sup>' : '') + '</span>' + (x.holiday ? '<span class="hn">' + esc(x.holiday) + '</span>' : '') + '<span class="st">' + chip + '</span>' +
      (x.total ? '<span class="heat" style="background:' + heatColor(x.total, mx, bins) + '"></span>' : '') + '</button>';
  });
  box.innerHTML = '<div class="stats rise d1" style="margin-bottom:16px">' +
    '<div class="stat"><span class="lb">' + IC.users + 'ผู้ป่วยทั้งเดือน</span><span class="v"><span data-count="' + sum + '">0</span><small>ราย</small></span><span class="d muted">เปิดคลินิก ' + open + ' วัน</span></div>' +
    '<div class="stat"><span class="lb">' + IC.check.replace('class="ck" ', '') + 'คีย์หัตถการครบ</span><span class="v"><span data-count="' + cnt.done + '">0</span><small>วัน</small></span><span class="d muted">จากวันที่เปิด ' + open + ' วัน</span></div>' +
    '<div class="stat"><span class="lb">' + IC.warn + 'ยังไม่คีย์</span><span class="v" style="color:' + (cnt.missing ? 'var(--warn)' : 'inherit') + '"><span data-count="' + cnt.missing + '">0</span><small>วัน</small></span><span class="d muted">' + (changed ? 'ยอดเปลี่ยนหลังรายงาน ' + changed + ' วัน' : 'กดวันที่เพื่อคีย์ย้อนหลัง') + '</span></div></div>' +
    '<div class="card rise d2" style="padding:14px"><div class="cal">' + TH_DS.map(function (x) { return '<div class="dow">' + x + '</div>'; }).join('') + cells + '</div>' +
    '<div class="legend" style="margin-top:12px"><span><i style="background:var(--ok)"></i>คีย์ครบ</span><span><i style="background:var(--warn)"></i>ยังไม่คีย์</span><span><i style="background:var(--d-s)"></i>เสาร์–อาทิตย์</span><span><i style="background:var(--d-h)"></i>วันหยุดนักขัตฤกษ์</span>' + (changed ? '<span><i style="background:var(--bad)"></i>ยอดเปลี่ยนหลังจัดทำรายงาน (ตัวเลขเล็ก = ส่วนต่าง)</span>' : '') + '</div>' +
    '<div style="margin-top:8px"><span class="xs muted">แถบสีล่างช่อง = ความหนาแน่นผู้ป่วย</span>' + heatLegend(bins) + '</div></div>';
  countUp(box);
  $$('[data-day]', box).forEach(function (b) { b.onclick = function () { S.date = b.getAttribute('data-day'); go('today'); }; });
}
