/* =====================================================================
   pages.js — หน้ารายงานประจำวัน · ปฏิทิน · ส่งไลน์/ภาพ/พิมพ์
   ===================================================================== */
'use strict';

/* ---------- ข้อมูลตั้งต้นที่ใช้บ่อย ---------- */
function clinicMap() { var m = {}; (S.boot.clinics || []).forEach(function (c) { m[c.code] = c; }); return m; }
function isShown(code) { var c = clinicMap()[code]; return !c || c.show; }
function clinicShort(code) { var c = clinicMap()[code]; return c ? (c.short || c.name || code) : code; }
function activeItems() { return (S.boot.items || []).filter(function (i) { return i.active; }).sort(function (a, b) { return a.order - b.order; }); }
function shownPositions() { return (S.boot.positions || []).filter(function (p) { return p.show; }).sort(function (a, b) { return a.order - b.order; }); }
function dayTypeChip(t, hol) {
  if (t === 'H') return '<span class="chip hol">' + esc(hol || 'วันหยุดนักขัตฤกษ์') + '</span>';
  if (t === 'S') return '<span class="chip off">เสาร์–อาทิตย์</span>';
  if (t === 'C') return '<span class="chip idle">ปิดคลินิก</span>';
  return '';
}
function typeColor(t) { return t === 'W' ? 'var(--brand)' : t === 'H' ? 'var(--hol)' : 'var(--off)'; }
function typeName(t) { return { W: 'วันทำการ', S: 'เสาร์–อาทิตย์', H: 'วันหยุดนักขัตฤกษ์', C: 'ปิดคลินิก' }[t] || ''; }

/* =====================================================================
   หน้ารายงานประจำวัน
   ===================================================================== */
var DAY = { data: null, roster: null, pend: { procs: {}, fields: {} }, staffDirty: false, saving: false, lastErr: '', refreshing: false, refreshErr: '', timer: null };

function pageToday() {
  var date = S.date || S.boot.today;
  if (date > S.boot.today) date = S.date = S.boot.today;
  DAY.data = null; DAY.roster = null; DAY.refreshErr = ''; DAY.refreshing = false;
  clearInterval(DAY.timer);
  if (date === S.boot.today) DAY.timer = setInterval(function () { if (S.page === 'today' && S.date === date && DAY.data && DAY.data.api.canRefresh && !DAY.refreshing && !document.hidden) refreshApi(date, false); }, 5 * 60000);
  $('#main').innerHTML = banners() + heroSkeleton(date) + '<div class="grid-2"><div class="col"><div class="card skel" style="height:420px"></div></div><div class="col"><div class="card skel" style="height:520px"></div></div></div>';
  var drawn = false;
  api('getDay', { date: date }, {
    persist: date === S.boot.today, onCache: function (d) { if (S.page === 'today' && S.date === d.date) { DAY.data = d; drawDay(); drawn = true; } }
  }).then(function (d) {
    if (S.page !== 'today' || S.date !== date) return;
    var had = DAY.data; DAY.data = d;
    if (!had || JSON.stringify(had.api) !== JSON.stringify(d.api) || JSON.stringify(had.entry) !== JSON.stringify(d.entry)) drawDay(drawn);
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
    var changed = JSON.stringify(DAY.data.api.rows) !== JSON.stringify(d.api.rows);
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
  var box = $('#staffBody'); if (box && !DAY.roster) box.innerHTML = '<div class="skel" style="height:90px"></div>';
  api('getRoster', { date: date, force: !!force, fromDuty: !!force }).then(function (r) {
    if (S.page !== 'today' || S.date !== date) return;
    DAY.roster = r; drawStaff(); drawHeroRing();
  }).catch(function (e) { DAY.roster = { source: 'error', error: e.message, list: [] }; drawStaff(); });
}

function dayRows() { return (DAY.data.api.rows || []).slice(); }
function dayTotal() { return dayRows().reduce(function (s, r) { return s + (isShown(r[0]) ? r[2] : 0); }, 0); }
function curProcs() { var p = JSON.parse(JSON.stringify(DAY.data.entry.procs || {})); Object.keys(DAY.pend.procs).forEach(function (k) { var v = DAY.pend.procs[k]; if (!v) delete p[k]; else p[k] = v; }); return p; }
function curField(k) { return k in DAY.pend.fields ? DAY.pend.fields[k] : DAY.data.entry[k]; }
function procSum(p) { return Object.keys(p).reduce(function (s, k) { return s + (+p[k] || 0); }, 0); }

function drawDay(quiet) {
  var d = DAY.data, date = d.date, ed = canEdit();
  var rows = dayRows(), shown = rows.filter(function (r) { return isShown(r[0]); }), hidden = rows.filter(function (r) { return !isShown(r[0]); });
  var total = dayTotal(), nClin = {}, nDoc = {}; shown.forEach(function (r) { nClin[r[0]] = (nClin[r[0]] || 0) + r[2]; nDoc[r[1]] = 1; });
  var procs = curProcs(), apiOk = d.api.status === 'ok';
  var maxDoc = Math.max.apply(null, shown.map(function (r) { return r[2]; }).concat([1]));
  // ตารางผู้ป่วย: จัดกลุ่มตามคลินิก
  var order = Object.keys(nClin).sort(function (a, b) { var ca = clinicMap()[a] || {}, cb = clinicMap()[b] || {}; return ((ca.order || 999) - (cb.order || 999)) || nClin[b] - nClin[a]; });
  var tb = '', n = 0;
  order.forEach(function (code) {
    tb += '<tr class="cl-group"><td colspan="3"><span class="code">' + esc(code) + '</span> ' + esc(clinicShort(code)) + '</td><td class="num"><b>' + nClin[code] + '</b></td></tr>';
    shown.filter(function (r) { return r[0] === code; }).sort(function (a, b) { return b[2] - a[2]; }).forEach(function (r) {
      n++; tb += '<tr class="ptrow"><td class="muted tnum xs" style="width:26px">' + n + '</td><td>' + esc(r[1]) + '</td><td style="width:34%"><div class="bar"><i style="width:' + (r[2] / maxDoc * 100).toFixed(1) + '%;animation-delay:' + Math.min(.5, n * .02).toFixed(2) + 's"></i></div></td><td class="num">' + r[2] + '</td></tr>';
    });
  });
  hidden.forEach(function (r) { tb += '<tr class="ptrow hid"><td></td><td>' + esc(r[1]) + '</td><td><span class="code">' + esc(r[0]) + '</span></td><td class="num">' + r[2] + '</td></tr>'; });

  // หัตถการ
  var items = activeItems();
  var col = function (c) { return items.filter(function (i) { return i.col === c; }).map(function (i) { return procRow(i, procs[i.id], ed); }).join(''); };
  var main = $('#main');
  main.innerHTML = banners() +
    '<section class="hero' + (quiet ? '' : ' rise') + '" id="hero"></section>' +
    '<div class="grid-2"><div class="col">' +
      '<section class="card' + (quiet ? '' : ' rise d2') + '" aria-labelledby="h-pt"><div class="card-h"><h3 id="h-pt"><span class="ic">' + IC.users + '</span>ผู้ป่วยแยกแพทย์และคลินิก</h3><div class="row small muted"><span id="apiNote"></span> <button class="btn btn-sm" id="brefresh">' + IC.refresh + 'อัปเดตเดี๋ยวนี้</button></div></div>' +
        '<div class="card-b tbl-wrap">' + (shown.length ? '<table class="tbl"><thead><tr><th>#</th><th>แพทย์</th><th></th><th class="num">ผู้ป่วย</th></tr></thead><tbody>' + tb + '</tbody><tfoot><tr><td></td><td>รวม ' + order.length + ' คลินิก · แพทย์ ' + Object.keys(nDoc).length + ' ท่าน</td><td></td><td class="num">' + fmt(total, 0) + '</td></tr></tfoot></table>' +
          (hidden.length ? '<p class="xs muted" style="margin:8px 0 0">ขีดฆ่า = คลินิกที่แอดมินซ่อน ไม่นับในยอดรวม</p>' : '')
          : '<div class="empty">' + IC.inbox + (apiOk ? 'ไม่มีผู้ป่วยนอกเวลาในวันนี้' : DAY.refreshing ? 'กำลังดึงยอดจากระบบโรงพยาบาล…' : d.api.todayOnly && date !== S.boot.today ? 'ไม่มีข้อมูลของวันนี้ในระบบ (API ปัจจุบันส่งเฉพาะยอดวันนี้ ดึงย้อนหลังไม่ได้)' : 'ยังไม่มีข้อมูลจาก API ของวันนี้') + '</div>') + '</div></section>' +
      '<section class="card' + (quiet ? '' : ' rise d3') + '" aria-labelledby="h-oth"><div class="card-h"><h3 id="h-oth"><span class="ic">' + IC.clinic + '</span>ยอดอื่น ๆ และหมายเหตุ</h3></div><div class="card-b" style="display:flex;flex-direction:column;gap:12px">' +
        '<div class="others">' + [['consult', 'Consult แผนกอื่น'], ['nightOpd', 'โอน Night OPD ชั้น 4'], ['admit', 'Admit']].map(function (f) { return '<label class="field" for="f_' + f[0] + '">' + f[1] + '<input id="f_' + f[0] + '" data-field="' + f[0] + '" type="number" min="0" inputmode="numeric" placeholder="0" value="' + esc(curField(f[0])) + '"' + (ed ? '' : ' disabled') + '></label>'; }).join('') + '</div>' +
        '<label class="field" for="f_other">อื่นๆ<input id="f_other" data-field="other" type="text" maxlength="300" value="' + esc(curField('other')) + '"' + (ed ? '' : ' disabled') + '></label>' +
        '<label class="field" for="f_note">หมายเหตุท้ายรายงาน<textarea id="f_note" data-field="note" rows="2" maxlength="1000" placeholder="เช่น ยอดคลินิกที่ไม่ตรงกับหน้างาน"' + (ed ? '' : ' disabled') + '>' + esc(curField('note')) + '</textarea></label>' +
      '</div></section>' +
    '</div><div class="col">' +
      '<section class="card' + (quiet ? '' : ' rise d2') + '" aria-labelledby="h-proc"><div class="card-h"><h3 id="h-proc"><span class="ic">' + IC.syringe + '</span>หัตถการ <span class="chip brand" id="procSumChip">' + fmt(procSum(procs), 0) + ' ครั้ง</span></h3><span class="savestate" id="savest">' + (ed ? 'บันทึกอัตโนมัติ' : 'ดูอย่างเดียว') + '</span></div>' +
        '<div class="card-b"><div class="procgrid"><div>' + col(1) + '</div><div>' + col(2) + '</div></div>' +
        '<div class="row" style="margin-top:12px;justify-content:space-between">' +
          '<label class="row small" for="f_noProc"><input id="f_noProc" type="checkbox" data-field="noProc"' + (curField('noProc') ? ' checked' : '') + (ed ? '' : ' disabled') + '> วันนี้ไม่มีหัตถการ</label>' +
          (ed ? '<form class="row" id="addItem"><input type="text" id="newItem" maxlength="60" placeholder="เพิ่มรายการ เช่น PVR" style="width:170px" aria-label="ชื่อรายการหัตถการใหม่"><button class="btn btn-sm" type="submit">' + IC.plus + 'เพิ่ม</button></form>' : '') +
        '</div>' + (d.entry.updatedAt ? '<p class="xs muted" style="margin:10px 0 0">แก้ไขล่าสุด ' + esc(stampTh(d.entry.updatedAt)) + ' โดย ' + esc(d.entry.updatedBy) + '</p>' : '') + '</div></section>' +
    '</div></div>' +
    '<section class="card' + (quiet ? '' : ' rise d4') + '" aria-labelledby="h-staff"><div class="card-h"><h3 id="h-staff"><span class="ic">' + IC.users + '</span>เจ้าหน้าที่ปฏิบัติงาน</h3><div class="row small muted" id="staffSrc"></div></div><div class="card-b" id="staffBody"></div></section>';
  drawHero(quiet);
  if (DAY.roster) drawStaff(); else $('#staffBody').innerHTML = '<div class="skel" style="height:90px"></div>';
  bindDay();
}

function procRow(i, v, ed) {
  return '<div class="proc' + (v ? ' has' : '') + (i.custom ? ' custom' : '') + '" data-row="' + esc(i.id) + '"><label for="p_' + esc(i.id) + '">' + esc(i.name) + '</label>' +
    '<span class="stepper">' + (ed ? '<button type="button" tabindex="-1" data-step="-1" aria-label="ลด ' + esc(i.name) + '">' + IC.minus + '</button>' : '') +
    '<input id="p_' + esc(i.id) + '" data-proc="' + esc(i.id) + '" type="number" min="0" inputmode="numeric" placeholder="0" value="' + (v || '') + '"' + (ed ? '' : ' disabled') + '>' +
    (ed ? '<button type="button" tabindex="-1" data-step="1" aria-label="เพิ่ม ' + esc(i.name) + '">' + IC.plus + '</button>' : '') + '</span></div>';
}

function drawHero(quiet) {
  var d = DAY.data, date = d.date, total = dayTotal(), rows = dayRows().filter(function (r) { return isShown(r[0]); });
  var nC = {}, nD = {}; rows.forEach(function (r) { nC[r[0]] = 1; nD[r[1]] = 1; });
  var isToday = date === S.boot.today;
  var hero = $('#hero');
  hero.innerHTML = '<svg class="ecg" viewBox="0 0 1200 70" preserveAspectRatio="none" aria-hidden="true"><path d="M0,40 L240,40 L258,40 L270,26 L282,40 L300,40 L312,6 L326,66 L340,40 L360,40 L376,32 L392,40 L640,40 L658,40 L670,26 L682,40 L700,40 L712,6 L726,66 L740,40 L760,40 L776,32 L792,40 L1200,40"/></svg>' +
    '<div><div class="dnav"><button class="iconbtn" id="dprev" aria-label="วันก่อนหน้า">' + IC.prev + '</button><button class="iconbtn" id="dnext" aria-label="วันถัดไป"' + (isToday ? ' disabled' : '') + '>' + IC.next + '</button>' +
      '<input type="date" id="dpick" value="' + date + '" max="' + S.boot.today + '" aria-label="เลือกวันที่">' + (isToday ? '' : '<button class="btn btn-sm" id="dtoday" style="background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.25);color:#fff">วันนี้</button>') + '</div>' +
      '<div class="dt" style="margin-top:10px">' + esc(thDate(date, true, true)) + '</div>' +
      '<div class="row" id="apiState" style="margin-top:6px"></div>' +
      '<div class="big" style="margin-top:12px"><span data-count="' + total + '">' + (quiet ? fmt(total, 0) : '0') + '</span><small>ราย</small></div>' +
      '<div class="kv"><div><b>' + Object.keys(nC).length + '</b><span>คลินิก</span></div><div><b>' + Object.keys(nD).length + '</b><span>แพทย์</span></div><div><b id="heroProc">' + fmt(procSum(curProcs()), 0) + '</b><span>หัตถการ</span></div></div></div>' +
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
  var d = DAY.data, p = curProcs(), steps = [
    [d.api.status === 'ok', 'ยอดผู้ป่วยจาก API'],
    [Object.keys(p).length > 0 || !!curField('noProc'), 'คีย์หัตถการ'],
    [!!(DAY.roster && DAY.roster.list && DAY.roster.list.length), 'รายชื่อเจ้าหน้าที่']
  ], done = steps.filter(function (s) { return s[0]; }).length;
  w.innerHTML = ring(done / 3, done + '/3', 'ความครบถ้วน') + '<div class="steps">' + steps.map(function (s) { return '<span class="' + (s[0] ? 'on' : '') + '">' + (s[0] ? IC.check : IC.dot) + esc(s[1]) + '</span>'; }).join('') + '</div>';
  animateRings(w);
}
function setDate(d) { if (d > S.boot.today) return; flushSave(); S.date = d; pageToday(); }

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
  if (!DAY.data || DAY.saving || !hasPending() || !canEdit()) return;
  var date = DAY.data.date, payload = { date: date, procs: DAY.pend.procs, fields: DAY.pend.fields, _rid: rid() };
  DAY.pend = { procs: {}, fields: {} }; DAY.saving = true; setSaveState('busy', 'กำลังบันทึก…');
  api('saveEntry', payload).then(function (r) {
    DAY.saving = false;
    if (DAY.data && DAY.data.date === date) {
      Object.keys(payload.procs).forEach(function (k) { var v = +payload.procs[k] || 0; if (v) DAY.data.entry.procs[k] = v; else delete DAY.data.entry.procs[k]; });
      Object.keys(payload.fields).forEach(function (k) { DAY.data.entry[k] = payload.fields[k]; });
      if (r.at) { DAY.data.entry.updatedAt = r.at; DAY.data.entry.updatedBy = r.by || S.me.name; }
    }
    forget('getDay|{"date":"' + date + '"'); forget('getMonth'); forget('getReport'); forget('getDashboard');
    setSaveState('saved', 'บันทึกแล้ว ' + (r.at || '').slice(11, 16));
    if (hasPending()) flushSave();
  }).catch(function (e) {
    DAY.saving = false;
    Object.keys(payload.procs).forEach(function (k) { if (!(k in DAY.pend.procs)) DAY.pend.procs[k] = payload.procs[k]; });
    Object.keys(payload.fields).forEach(function (k) { if (!(k in DAY.pend.fields)) DAY.pend.fields[k] = payload.fields[k]; });
    setSaveState('err', 'ยังไม่ได้บันทึก: ' + e.message);
  });
}
window.addEventListener('beforeunload', function (e) { if (hasPending() || DAY.saving) { flushSave(); e.preventDefault(); e.returnValue = ''; } });

function bindDay() {
  var main = $('#main'), date = DAY.data.date;
  var br = $('#brefresh'); if (br) br.onclick = function () { refreshApi(date, true, br); };
  if (!canEdit()) return addDayTools();
  var onProc = function (inp) {
    var id = inp.getAttribute('data-proc'), v = inp.value === '' ? 0 : Math.max(0, Math.round(+inp.value || 0));
    if (inp.value !== '' && String(v) !== inp.value) inp.value = v || '';
    DAY.pend.procs[id] = v;
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
      DAY.pend.fields[k] = v; if (k === 'noProc') drawHeroRing(); setSaveState('', 'มีการเปลี่ยนแปลง…'); saveSoon();
    };
    inp.addEventListener(inp.type === 'checkbox' ? 'change' : 'input', h);
  });
  var af = $('#addItem'); if (af) af.onsubmit = function (e) {
    e.preventDefault(); var nm = $('#newItem').value.trim(); if (!nm) return;
    busy($('#addItem button'), api('addItem', { name: nm, _rid: rid() })).then(function (r) {
      if (!r.existed) S.boot.items.push({ id: r.id, name: r.name, col: 2, order: 9999, active: true, custom: true });
      else S.boot.items.forEach(function (i) { if (i.id === r.id) i.active = true; });
      store('boot', S.boot); flushSave(); drawDay(true);
      var el = $('#p_' + r.id); if (el) { el.focus(); el.scrollIntoView({ block: 'center', behavior: REDUCED ? 'auto' : 'smooth' }); }
      toast(r.existed ? 'มีรายการนี้อยู่แล้ว' : 'เพิ่ม "' + r.name + '" แล้ว');
    }).catch(function (err) { toast(err.message, true); });
  };
  addDayTools();
}
function addDayTools() {
  var hero = $('#hero'); if (!hero || $('#dayTools')) return;
  var t = document.createElement('div'); t.id = 'dayTools'; t.className = 'row'; t.style.cssText = 'grid-column:1/-1;margin-top:4px';
  t.innerHTML = '<button class="btn btn-sm" id="bline" style="background:#fff;border-color:#fff;color:#9e1527">' + IC.line + 'ข้อความไลน์</button>' +
    '<button class="btn btn-sm" id="bimg" style="background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.25);color:#fff">' + IC.img + 'ภาพรายงาน</button>' +
    '<button class="btn btn-sm" id="bprint" style="background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.25);color:#fff">' + IC.print + 'พิมพ์ A4</button>';
  hero.appendChild(t);
  $('#bline').onclick = function () { flushSave(); openLine(); };
  $('#bimg').onclick = function () { flushSave(); openImage(); };
  $('#bprint').onclick = function () { flushSave(); printDay(); };
}

/* ---------- เจ้าหน้าที่ ---------- */
var saveStaffSoon = debounce(function () { saveStaff(); }, 1000);
function staffList() { return (DAY.roster && DAY.roster.list) || []; }
function drawStaff() {
  var body = $('#staffBody'), src = $('#staffSrc'); if (!body) return;
  var r = DAY.roster || { list: [] }, ed = canEdit(), list = staffList(), pos = shownPositions();
  if (src) src.innerHTML = r.source === 'duty' ? 'จากตารางเวร SMC Duty' + (r.at ? ' · ' + esc((r.at || '').slice(11, 16)) + ' น.' : '') :
    r.source === 'saved' ? 'แก้ไขแล้วโดย ' + esc(r.by || '') + (ed ? ' <button class="btn btn-sm" id="reDuty">' + IC.refresh + 'ดึงจาก SMC Duty ใหม่</button>' : '') :
    r.source === 'error' ? '<span style="color:var(--warn)">' + IC.warn.replace('<svg', '<svg width="14" height="14"') + ' ' + esc(r.error) + '</span>' : '';
  if (!pos.length) { body.innerHTML = '<p class="muted small">ยังไม่ได้เลือกตำแหน่งที่จะแสดง (ตั้งค่า › ตำแหน่ง)</p>'; return; }
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
  $$('[data-sclin]', body).forEach(function (inp) { inp.addEventListener('input', function () { staffList()[+inp.getAttribute('data-sclin')].clinic = inp.value; DAY.staffDirty = true; saveStaffSoon(); }); });
  $$('[data-sdel]', body).forEach(function (b) { b.onclick = function () { staffList().splice(+b.getAttribute('data-sdel'), 1); DAY.staffDirty = true; drawStaff(); drawHeroRing(); saveStaff(); }; });
  $$('[data-sadd]', body).forEach(function (b) { b.onclick = function () { addPerson(b.getAttribute('data-sadd')); }; });
  var rd = $('#reDuty'); if (rd) rd.onclick = function () {
    busy(rd, api('saveStaff', { date: DAY.data.date, reset: true, list: [], _rid: rid() }), 'กำลังดึง…').then(function () { DAY.roster = null; forget('getRoster'); loadRoster(DAY.data.date, true); toast('ดึงรายชื่อจาก SMC Duty ใหม่แล้ว'); }).catch(function (e) { toast(e.message, true); });
  };
}
function addPerson(posId) {
  var p = (S.boot.positions || []).filter(function (x) { return x.id === posId; })[0] || { short: '', clinicBox: false };
  var m = modal('เพิ่ม ' + esc(p.short), '<form id="apf" style="display:flex;flex-direction:column;gap:12px"><label class="field" for="apn">ชื่อ-สกุล<input id="apn" type="text" maxlength="80" required></label>' +
    (p.clinicBox ? '<label class="field" for="apc">คลินิกที่ประจำ<input id="apc" type="text" maxlength="30" placeholder="เช่น Ey, SE+OR"></label>' : '') +
    '<button class="btn btn-brand" type="submit" style="align-self:flex-end">' + IC.plus + 'เพิ่ม</button></form>', '', 'sm');
  $('#apn', m).focus();
  $('#apf', m).onsubmit = function (e) {
    e.preventDefault(); if (!DAY.roster) DAY.roster = { source: 'saved', list: [] };
    DAY.roster.list = staffList(); DAY.roster.list.push({ pos: posId, name: $('#apn', m).value.trim(), clinic: ($('#apc', m) || {}).value || '', emp: '', slot: '' });
    m.close(); DAY.staffDirty = true; drawStaff(); drawHeroRing(); saveStaff();
  };
}
function saveStaff() {
  if (!DAY.staffDirty || !DAY.data) return; DAY.staffDirty = false;
  var date = DAY.data.date;
  api('saveStaff', { date: date, list: staffList(), _rid: rid() }).then(function (r) {
    if (DAY.roster && S.date === date) { DAY.roster.source = 'saved'; DAY.roster.by = S.me.name; var src = $('#staffSrc'); if (src && src.textContent.indexOf('แก้ไขแล้ว') < 0) drawStaff(); }
    forget('getRoster'); setSaveState('saved', 'บันทึกรายชื่อแล้ว ' + (r.at || '').slice(11, 16));
  }).catch(function (e) { DAY.staffDirty = true; toast('บันทึกรายชื่อไม่สำเร็จ: ' + e.message, true); });
}

/* ---------- ข้อความไลน์ / ภาพ / พิมพ์ ---------- */
function staffNames(posIds, withClinic) {
  return staffList().filter(function (x) { return posIds.indexOf(x.pos) >= 0; }).map(function (x) { return String(x.name).replace(/\s*\(ตัวอย่าง\)$/, '').split(' ')[0] + (withClinic && x.clinic ? ' (' + x.clinic + ')' : ''); }).join(', ');
}
function lineText(withStaff) {
  var d = DAY.data, rows = dayRows().filter(function (r) { return isShown(r[0]); }), total = dayTotal(), byC = {};
  rows.forEach(function (r) { byC[r[0]] = (byC[r[0]] || 0) + r[2]; });
  var p = curProcs(), items = activeItems().filter(function (i) { return p[i.id]; });
  var t = '📋 ' + (S.boot.texts.lineHeader || 'รายงานประจำวัน') + '\n' + thDate(d.date, true, true) + (d.holiday ? ' (' + d.holiday + ')' : '') + '\n\n';
  t += '👥 ผู้ป่วยทั้งหมด ' + fmt(total, 0) + ' ราย (' + Object.keys(byC).length + ' คลินิก · แพทย์ ' + new Set(rows.map(function (r) { return r[1]; })).size + ' ท่าน)\n';
  t += Object.keys(byC).sort(function (a, b) { return byC[b] - byC[a]; }).map(function (c) { return c + ' ' + byC[c]; }).join(' · ') + '\n\n';
  t += '💉 หัตถการ ' + fmt(procSum(p), 0) + ' ครั้ง\n' + (items.length ? items.map(function (i) { return i.name + ' ' + p[i.id]; }).join(' · ') : (curField('noProc') ? 'ไม่มีหัตถการ' : '(ยังไม่คีย์)')) + '\n\n';
  t += 'Consult ' + (curField('consult') || 0) + ' · Night OPD ชั้น 4 ' + (curField('nightOpd') || 0) + ' · Admit ' + (curField('admit') || 0);
  if (curField('other')) t += '\nอื่นๆ: ' + curField('other');
  if (curField('note')) t += '\n📝 ' + curField('note');
  if (withStaff && staffList().length) {
    t += '\n\n👩‍⚕️ เจ้าหน้าที่';
    shownPositions().forEach(function (ps) { var n = staffNames([ps.id], ps.clinicBox); if (n) t += '\n' + ps.short + ': ' + n; });
  }
  return t;
}
function openLine() {
  var withStaff = store('lineStaff'); if (withStaff === null) withStaff = true;
  var m = modal('ข้อความส่งไลน์', '<pre class="linetxt" id="ltxt">' + esc(lineText(withStaff)) + '</pre><label class="row small" style="margin-top:12px" for="lst"><input type="checkbox" id="lst"' + (withStaff ? ' checked' : '') + '> แนบรายชื่อเจ้าหน้าที่</label>',
    '<span class="small muted" style="margin-right:auto">คัดลอกแล้ววางในกลุ่มไลน์</span><button class="btn btn-brand" id="lcopy">' + IC.copy + 'คัดลอกข้อความ</button>');
  $('#lst', m).onchange = function (e) { withStaff = e.target.checked; store('lineStaff', withStaff); $('#ltxt', m).textContent = lineText(withStaff); };
  $('#lcopy', m).onclick = function () { copyText(lineText(withStaff), $('#ltxt', m)); };
}
function paperHtml() {
  var d = DAY.data, rows = dayRows().filter(function (r) { return isShown(r[0]); }).sort(function (a, b) { return a[0].localeCompare(b[0]) || b[2] - a[2]; });
  var p = curProcs(), c1 = activeItems().filter(function (i) { return i.col === 1; }), c2 = activeItems().filter(function (i) { return i.col === 2; });
  var n = Math.max(17, rows.length, c1.length, c2.length), dt = pd(d.date), body = '';
  for (var i = 0; i < n; i++) {
    var r = rows[i], a = c1[i], b = c2[i];
    body += '<tr><td style="text-align:center;width:28px">' + (i + 1) + '</td><td>' + (r ? esc(r[1]) : '') + '</td><td style="width:62px">' + (r ? esc(r[0]) : '') + '</td><td class="n" style="width:46px">' + (r ? r[2] : '') + '</td><td>' + (a ? esc(a.name) : '') + '</td><td class="n" style="width:44px">' + (a && p[a.id] ? p[a.id] : '') + '</td><td>' + (b ? esc(b.name) : '') + '</td><td class="n" style="width:44px">' + (b && p[b.id] ? p[b.id] : '') + '</td></tr>';
  }
  var staffLine = function (ps) { var n = staffList().filter(function (x) { return x.pos === ps.id; }).map(function (x) { return esc(String(x.name).replace(/\s*\(ตัวอย่าง\)$/, '')) + (x.clinic ? ' <span style="color:#666">(' + esc(x.clinic) + ')</span>' : ''); }).join(' · '); return '<div><b style="color:#111">' + esc(ps.short) + ':</b> ' + (n || '-') + '</div>'; };
  return '<div class="paper"><h4>' + esc(S.boot.texts.reportTitle || 'แบบบันทึกรายงานประจำวัน') + '</h4><div class="dl">วัน' + TH_D[dt.getDay()] + ' ที่ ' + dt.getDate() + ' เดือน ' + TH_MF[dt.getMonth()] + ' พ.ศ. ' + (dt.getFullYear() + 543) + (d.holiday ? ' (' + esc(d.holiday) + ')' : '') + '</div>' +
    '<table><thead><tr><th>NO</th><th>แพทย์</th><th>คลินิก</th><th>จำนวน PT</th><th>หัตถการ</th><th>จำนวน</th><th>หัตถการ</th><th>จำนวน</th></tr></thead><tbody>' + body + '</tbody></table>' +
    '<div class="foot"><div>จำนวนผู้ป่วยทั้งหมด <b>' + fmt(dayTotal(), 0) + '</b> ราย &nbsp; โอนตรวจต่อ Night OPD ชั้น 4 <b>' + (curField('nightOpd') || 0) + '</b> ราย &nbsp; Consult แผนกอื่น <b>' + (curField('consult') || 0) + '</b> &nbsp; Admit <b>' + (curField('admit') || 0) + '</b> &nbsp; หัตถการรวม <b>' + fmt(procSum(p), 0) + '</b></div>' +
    '<div>อื่นๆ ' + (esc(curField('other')) || '-') + (curField('note') ? ' &nbsp;·&nbsp; หมายเหตุ: ' + esc(curField('note')) : '') + '</div></div>' +
    '<div class="foot"><div><b style="color:#111">รายชื่อเจ้าหน้าที่ปฏิบัติงาน</b></div>' + shownPositions().map(staffLine).join('') + '</div>' +
    '<div style="text-align:right;color:#888;font-size:10px;margin-top:6px">สร้างจาก SMC Daily ' + esc(stampTh(nowStamp())) + ' · ยอดผู้ป่วยจากระบบโรงพยาบาล</div></div>';
}
function nowStamp() { var n = new Date(); return ds(n) + ' ' + ('0' + n.getHours()).slice(-2) + ':' + ('0' + n.getMinutes()).slice(-2); }
function cardHtml() {
  var d = DAY.data, rows = dayRows().filter(function (r) { return isShown(r[0]); }), byC = {};
  rows.forEach(function (r) { byC[r[0]] = (byC[r[0]] || 0) + r[2]; });
  var top = Object.keys(byC).sort(function (a, b) { return byC[b] - byC[a]; }), mx = top.length ? byC[top[0]] : 1, p = curProcs();
  var its = activeItems().filter(function (i) { return p[i.id]; }).sort(function (a, b) { return p[b.id] - p[a.id]; });
  return '<div class="mcard"><div class="hd"><svg viewBox="0 0 400 46" preserveAspectRatio="none"><path d="M0,30 L120,30 L132,20 L144,30 L160,30 L170,4 L182,44 L194,30 L400,30" fill="none" stroke="#fff" stroke-width="2"/></svg><small>' + esc(S.boot.texts.lineHeader || '') + '</small><div class="dt">' + esc(thDate(d.date, true, true)) + '</div>' +
    '<div class="big">' + fmt(dayTotal(), 0) + ' <span style="font-size:17px;font-weight:500">ราย</span></div><small>' + top.length + ' คลินิก · แพทย์ ' + new Set(rows.map(function (r) { return r[1]; })).size + ' ท่าน · หัตถการ ' + fmt(procSum(p), 0) + ' ครั้ง</small></div>' +
    '<div class="sec"><h5>ผู้ป่วยแยกคลินิก</h5><div class="bars">' + top.map(function (c) { return '<span>' + esc(c) + '</span><i style="width:' + (byC[c] / mx * 100).toFixed(0) + '%"></i><b style="text-align:right">' + byC[c] + '</b>'; }).join('') + '</div></div>' +
    '<div class="sec"><h5>หัตถการ</h5><div class="kv">' + (its.map(function (i) { return '<span>' + esc(i.name) + '</span><b>' + p[i.id] + '</b>'; }).join('') || '<span>' + (curField('noProc') ? 'ไม่มีหัตถการ' : 'ยังไม่คีย์') + '</span><b></b>') + '</div></div>' +
    '<div class="sec"><div class="kv"><span>Consult แผนกอื่น</span><b>' + (curField('consult') || 0) + '</b><span>โอน Night OPD ชั้น 4</span><b>' + (curField('nightOpd') || 0) + '</b><span>Admit</span><b>' + (curField('admit') || 0) + '</b></div>' + (curField('note') ? '<p style="font-size:12px;margin:8px 0 0">หมายเหตุ: ' + esc(curField('note')) + '</p>' : '') + '</div>' +
    '<div class="ft"><span>SMC Daily</span><span>' + esc(stampTh(nowStamp())) + '</span></div></div>';
}
function openImage() {
  var mode = store('imgMode') || 'card';
  var m = modal('ภาพรายงาน', '<div class="seg" role="group" aria-label="แบบภาพ" style="margin-bottom:14px"><button data-im="card" aria-pressed="' + (mode === 'card') + '">แบบสรุปมือถือ</button><button data-im="form" aria-pressed="' + (mode === 'form') + '">แบบฟอร์มเต็ม</button></div><div class="paperwrap" id="imgbox"></div>',
    '<span class="small muted" style="margin-right:auto" id="imgnote">บันทึกเป็นไฟล์ PNG หรือคัดลอกภาพไปวางในไลน์</span><button class="btn" id="imgcopy">' + IC.copy + 'คัดลอกภาพ</button><button class="btn btn-brand" id="imgsave">' + IC.img + 'บันทึกภาพ</button>');
  var draw = function () { $('#imgbox', m).innerHTML = mode === 'form' ? paperHtml() : cardHtml(); };
  draw();
  $$('[data-im]', m).forEach(function (b) { b.onclick = function () { mode = b.getAttribute('data-im'); store('imgMode', mode); $$('[data-im]', m).forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); draw(); }; });
  var render = function () {
    return loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js').then(function () {
      var el = $('#imgbox', m).firstElementChild; return window.html2canvas(el, { scale: 2, backgroundColor: mode === 'form' ? '#ffffff' : null, useCORS: true });
    });
  };
  var fname = 'รายงานประจำวัน_' + DAY.data.date + (mode === 'form' ? '_แบบฟอร์ม' : '') + '.png';
  $('#imgsave', m).onclick = function () {
    busy($('#imgsave', m), render()).then(function (cv) { var a = document.createElement('a'); a.href = cv.toDataURL('image/png'); a.download = fname; document.body.appendChild(a); a.click(); a.remove(); toast('บันทึกภาพแล้ว'); })
      .catch(function (e) { toast(e.message || 'สร้างภาพไม่สำเร็จ', true); });
  };
  $('#imgcopy', m).onclick = function () {
    busy($('#imgcopy', m), render()).then(function (cv) { return new Promise(function (res, rej) { cv.toBlob(function (b) { if (!b || !window.ClipboardItem || !navigator.clipboard) return rej(new Error('เบราว์เซอร์นี้คัดลอกภาพไม่ได้ ใช้ปุ่มบันทึกภาพแทน')); navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]).then(res, rej); }); }); })
      .then(function () { toast('คัดลอกภาพแล้ว วางในไลน์ได้เลย (Ctrl+V)'); }).catch(function (e) { toast(e.message || 'คัดลอกภาพไม่สำเร็จ', true); });
  };
}
function printDay() { var pa = $('#printArea'); pa.innerHTML = paperHtml(); setTimeout(function () { window.print(); }, 60); }

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
    '<div class="row"><button class="iconbtn" id="cprev" aria-label="เดือนก่อน"' + (i >= months.length - 1 ? ' disabled' : '') + '>' + IC.prev + '</button><select id="cym" aria-label="เลือกเดือน">' + months.map(function (k) { return '<option value="' + k + '"' + (k === ym ? ' selected' : '') + '>' + thMonth(k) + '</option>'; }).join('') + '</select><button class="iconbtn" id="cnext" aria-label="เดือนถัดไป"' + (i <= 0 ? ' disabled' : '') + '>' + IC.next + '</button></div></div>' +
    '<div id="calBody"><div class="card skel" style="height:520px"></div></div>';
  $('#cprev').onclick = function () { CALS.ym = months[i + 1]; pageCal(); };
  $('#cnext').onclick = function () { CALS.ym = months[i - 1]; pageCal(); };
  $('#cym').onchange = function (e) { CALS.ym = e.target.value; pageCal(); };
  api('getMonth', { ym: ym }, { onCache: function (d) { drawCal(d); } }).then(function (d) { if (CALS.ym === ym && S.page === 'cal') drawCal(d); }).catch(function (e) { toast(e.message, true); });
}
function drawCal(d) {
  var box = $('#calBody'); if (!box) return;
  var first = pd(d.ym + '-01').getDay(), cnt = { done: 0, missing: 0, closed: 0, nodata: 0 }, mx = 1, sum = 0, open = 0, cells = '';
  d.days.forEach(function (x) { if (x.total) { mx = Math.max(mx, x.total); sum += x.total; open++; } if (cnt[x.status] !== undefined) cnt[x.status]++; });
  for (var k = 0; k < first; k++) cells += '<div class="c out" aria-hidden="true"></div>';
  d.days.forEach(function (x, i) {
    var dn = +x.date.slice(8), st = x.status;
    var chip = { done: '<span class="chip ok">' + IC.check + 'ครบ</span>', missing: '<span class="chip warn">ยังไม่คีย์</span>', open: '<span class="chip brand">วันนี้</span>', closed: '<span class="chip idle">ไม่มีคลินิก</span>', nodata: '<span class="chip idle">รอข้อมูล</span>', future: '' }[st];
    var dot = { done: 'var(--ok)', missing: 'var(--warn)', open: 'var(--brand)' }[st] || 'transparent';
    cells += '<button class="c ' + x.type + (x.date === S.boot.today ? ' today' : '') + '" data-day="' + x.date + '"' + (st === 'future' ? ' disabled' : '') + ' style="animation-delay:' + (i * .012).toFixed(3) + 's" aria-label="' + esc(thDate(x.date, true)) + ' ' + (x.total || 0) + ' ราย">' +
      '<span class="dn"><span>' + dn + '</span><span class="dotst" style="background:' + dot + '"></span></span><span class="vn">' + (x.total ? fmt(x.total, 0) : '') + '</span>' + (x.holiday ? '<span class="hn">' + esc(x.holiday) + '</span>' : '') + '<span class="st">' + chip + '</span>' +
      (x.total ? '<span class="heat" style="background:' + heatColor(x.total, mx) + '"></span>' : '') + '</button>';
  });
  box.innerHTML = '<div class="stats rise d1" style="margin-bottom:16px">' +
    '<div class="stat"><span class="lb">' + IC.users + 'ผู้ป่วยทั้งเดือน</span><span class="v"><span data-count="' + sum + '">0</span><small>ราย</small></span><span class="d muted">เปิดคลินิก ' + open + ' วัน</span></div>' +
    '<div class="stat"><span class="lb">' + IC.check.replace('class="ck" ', '') + 'คีย์หัตถการครบ</span><span class="v"><span data-count="' + cnt.done + '">0</span><small>วัน</small></span><span class="d muted">จากวันที่เปิด ' + open + ' วัน</span></div>' +
    '<div class="stat"><span class="lb">' + IC.warn + 'ยังไม่คีย์</span><span class="v" style="color:' + (cnt.missing ? 'var(--warn)' : 'inherit') + '"><span data-count="' + cnt.missing + '">0</span><small>วัน</small></span><span class="d muted">กดวันที่เพื่อคีย์ย้อนหลัง</span></div></div>' +
    '<div class="card rise d2" style="padding:14px"><div class="cal">' + TH_DS.map(function (x) { return '<div class="dow">' + x + '</div>'; }).join('') + cells + '</div>' +
    '<div class="legend" style="margin-top:12px"><span><i style="background:var(--ok)"></i>คีย์ครบ</span><span><i style="background:var(--warn)"></i>ยังไม่คีย์</span><span><i style="background:var(--off)"></i>เสาร์–อาทิตย์</span><span><i style="background:var(--hol)"></i>วันหยุดนักขัตฤกษ์</span>' +
    '<span style="margin-left:auto" class="heatlegend">น้อย ' + [1, 2, 3, 4, 5].map(function (k) { return '<i style="background:var(--heat-' + k + ')"></i>'; }).join('') + ' มาก</span></div></div>';
  countUp(box);
  $$('[data-day]', box).forEach(function (b) { b.onclick = function () { S.date = b.getAttribute('data-day'); go('today'); }; });
}
