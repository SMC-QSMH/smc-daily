/* =====================================================================
   model.js — โครงข้อมูลที่ใช้ร่วมกันทุกหน้า (ครั้งที่ 4 · 12 ต.ค. 69)
   หน่วยงาน › กลุ่มคลินิก › คลินิก › แพทย์ · สถานที่ (รพ./ศูนย์สาขา) · รวมแพทย์ (เช่น LABOT) · สิทธิการรักษา
   ===================================================================== */
'use strict';

/* ---------- หน่วยงาน ---------- */
var ALL_UNITS = '*';
function unitsList() {
  var u = (S.boot.units || []).slice().sort(function (a, b) { return a.order - b.order; });
  if (!u.length) u = [{ id: S.boot.defaultUnit || 'U1', name: 'หน่วยงานหลัก', color: '#d72638', order: 1, scope: 'own' }];
  return u;
}
function unitById(id) { return unitsList().filter(function (u) { return u.id === id; })[0] || null; }
function unitName(id) { if (id === ALL_UNITS) return 'ทุกหน่วยงาน'; var u = unitById(id); return u ? u.name : 'ยังไม่ระบุหน่วยงาน'; }
function unitColor(id) { var u = unitById(id); return u ? palOf(u.color) : 'var(--idle)'; }
function defaultUnitId() { return S.boot.defaultUnit || 'U1'; }
function clinicUnit(code) { var c = clinicMap()[code]; return (c && c.unitId) || ''; }
function clinicLoc(code) { var c = clinicMap()[code]; return (c && c.loc) || 'รพ.'; }
function clinicMerged(code) { var c = clinicMap()[code]; return !!(c && c.merge); }
/** หน่วยงานที่ผู้ใช้คีย์ได้ (ว่าง = ทุกหน่วย) */
function myUnits() { var u = (S.me && S.me.units) || []; return u.length ? u : unitsList().map(function (x) { return x.id; }); }
function canEditUnit(u) { if (!canEdit() || u === ALL_UNITS) return false; if (S.me.role === 'admin') return true; var m = (S.me.units || []); return !m.length || m.indexOf(u) >= 0; }
/** หน่วยงานตั้งต้นของผู้ใช้บนหน้ารายงานประจำวัน */
function homeUnit() {
  var m = (S.me && S.me.units) || [];
  if (m.length) return m[0];
  if (unitsList().length <= 1) return unitsList()[0].id;
  return S.me.role === 'nurse' ? defaultUnitId() : ALL_UNITS;
}
/** รูปแบบรายงานตั้งต้นของหน่วยงาน: own = เฉพาะหน่วยตัวเอง · split = ทุกหน่วยแยกส่วน · all = รวมเป็นยอดเดียว */
function unitScope(id) { if (id === ALL_UNITS) return 'split'; var u = unitById(id); return (u && u.scope) || 'own'; }
var SCOPE_TH = { own: 'เฉพาะหน่วยงานนี้', split: 'ทุกหน่วยงาน (แยกส่วน + ยอดรวม)', all: 'ทุกหน่วยงาน (รวมเป็นยอดเดียว)' };
function locationsList() { var s = {}; (S.boot.clinics || []).forEach(function (c) { s[c.loc || 'รพ.'] = 1; }); return Object.keys(s).sort(function (a, b) { return a === 'รพ.' ? -1 : b === 'รพ.' ? 1 : a.localeCompare(b, 'th'); }); }
/** คีย์แพทย์สำหรับการรวม: คลินิกที่ "รวมแพทย์" → แพทย์ทุกท่านเป็นแถวเดียว */
function docKey(code, dct) { return clinicMerged(code) ? '*' + code : dct; }
function docLabel(key, name) { return key.charAt(0) === '*' ? 'รวมแพทย์ทุกท่าน' : name; }
function hexA(hex, a) { var h = String(hex || '').replace('#', ''); if (h.length !== 6) return 'rgba(140,128,134,' + a + ')'; return 'rgba(' + parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) + ',' + parseInt(h.slice(4, 6), 16) + ',' + a + ')'; }

/* ---------- สิทธิการรักษา ----------
 * Rights cube ต่อวัน: 'คลินิก.แพทย์.สิทธิหลัก.สิทธิย่อย.ชุดสิทธิรอง.สิทธิที่ชำระ.จำนวน,…' (รหัสสั้นจาก RightTypes)
 * มุมมอง "ตามทะเบียน" = กลุ่มของสิทธิหลัก (ถ้ามีสิทธิของกลุ่มที่ตั้ง "นับก่อนสิทธิหลัก" ร่วมด้วย → นับกลุ่มนั้น)
 * มุมมอง "ที่ชำระจริง" = กลุ่มของสิทธิในรายการค่าใช้จ่าย (หลายสิทธิ → สิทธิที่ไม่ใช่เงินสดก่อน · ว่าง = ยังไม่มีรายการค่าใช้จ่าย) */
var RT = { at: null, byId: {}, byName: {} };
function rtIndex() {
  if (RT.at === S.boot) return RT;
  RT = { at: S.boot, byId: {}, byName: {} };
  (S.boot.rightTypes || []).forEach(function (r) { var o = { id: r[0], kind: r[1], name: r[2], parent: r[3], group: r[4] || '' }; RT.byId[o.id] = o; RT.byName[o.kind + '|' + o.name] = o; });
  return RT;
}
function rgList() { return (S.boot.rightGroups || []).slice().sort(function (a, b) { return a.order - b.order; }); }
function rgById(id) { return rgList().filter(function (g) { return g.id === id; })[0] || null; }
function rgName(id) { if (id === 'none') return 'ยังไม่มีรายการค่าใช้จ่าย'; var g = rgById(id); return g ? g.name : 'ยังไม่จัดกลุ่ม'; }
function rgColor(id) { if (id === 'none') return 'var(--line)'; var g = rgById(id); return g ? palOf(g.color) : 'var(--idle)'; }
function rgHex(id) { var g = rgById(id); return g ? g.color : '#8a8086'; }
function rgOrder(id) { var g = rgById(id); return g ? g.order : 999; }
function cashGroup() { var g = rgList().filter(function (x) { return x.cash; })[0]; return g ? g.id : ''; }
function rtName(id) { var r = rtIndex().byId[id]; return r ? r.name : ''; }
function rtGroup(id) { var r = rtIndex().byId[id]; return r ? r.group : ''; }
/** กลุ่มของชื่อสิทธิที่ชำระ (ชื่อเดี่ยว) */
function invGroupByName(n) { var r = rtIndex().byName['inv|' + n]; return r ? r.group : ''; }
function ptGroupByName(n) { var r = rtIndex().byName['pt|' + n]; return r ? r.group : ''; }
function decodeCube(s) {
  if (!s) return [];
  return String(s).split(',').map(function (x) { var p = x.split('.'); return { c: p[0], d: p[1], m: p[2], t: p[3], s: p[4], v: p[5], n: +p[6] || 0 }; });
}
var _rgMemo = {};
/** กลุ่มตามทะเบียนของ 1 รายการ (memo ต่อชุด m|s) */
function regGroup(e) {
  var k = e.m + '|' + e.s + '|' + (S.boot.packVer || '') + rgList().length; if (_rgMemo[k] !== undefined && _rgMemo.__b === S.boot) return _rgMemo[k];
  if (_rgMemo.__b !== S.boot) _rgMemo = { __b: S.boot };
  var g = rtGroup(e.m);
  if (e.s) {
    var prio = rgList().filter(function (x) { return x.prio; }).map(function (x) { return x.id; });
    if (prio.length) {
      var sec = rtName(e.s).split(' + ').map(ptGroupByName);
      for (var i = 0; i < prio.length; i++) if (sec.indexOf(prio[i]) >= 0 && g !== prio[i]) { g = prio[i]; break; }
    }
  }
  return (_rgMemo[k] = g);
}
/** กลุ่มตามที่ชำระจริง + ร่วมจ่ายเงินสดไหม */
function payInfo(e) {
  if (!e.v) return { g: 'none', mixed: false };
  var r = rtIndex().byId[e.v]; if (!r) return { g: '', mixed: false };
  if (r.kind === 'inv') return { g: r.group, mixed: false };
  var cash = cashGroup(), gs = r.name.split(' + ').map(invGroupByName);
  var non = gs.filter(function (g) { return g !== cash; }).sort(function (a, b) { return rgOrder(a) - rgOrder(b); });
  return { g: non.length ? non[0] : cash, mixed: non.length > 0 && gs.indexOf(cash) >= 0 };
}
/** ประเภทการใช้สิทธิ: cash = เงินสด (ไม่เปิดสิทธิ) · combo = สิทธิร่วม (มีสิทธิรอง) · single = สิทธิเดียว */
function usageOf(e) { if (e.s) return 'combo'; return rtGroup(e.m) === cashGroup() && cashGroup() ? 'cash' : 'single'; }
var USAGE_TH = { single: 'สิทธิเดียว', combo: 'สิทธิร่วม', cash: 'เงินสด (ไม่เปิดสิทธิ)' };
/** สรุปสิทธิของรายการ cube (กรองด้วย keep(e) ได้) */
function rightsSum(entries, keep) {
  var o = { total: 0, reg: {}, pay: {}, usage: { single: 0, combo: 0, cash: 0 }, combos: {}, cross: {}, pt: {}, dt: {}, inv: {}, mixed: 0 };
  entries.forEach(function (e) {
    if (keep && !keep(e)) return;
    var n = e.n, rg = regGroup(e), pi = payInfo(e), u = usageOf(e);
    o.total += n; o.reg[rg] = (o.reg[rg] || 0) + n; o.pay[pi.g] = (o.pay[pi.g] || 0) + n; o.usage[u] += n;
    if (pi.mixed) o.mixed += n;
    if (e.s) { var cn = rtName(e.m) + ' + ' + rtName(e.s); o.combos[cn] = (o.combos[cn] || 0) + n; }
    var ck = rg + '>' + pi.g; o.cross[ck] = (o.cross[ck] || 0) + n;
    o.pt[e.m] = (o.pt[e.m] || 0) + n; if (e.t) o.dt[e.t] = (o.dt[e.t] || 0) + n; if (e.v) o.inv[e.v] = (o.inv[e.v] || 0) + n;
  });
  return o;
}
/** แถวกลุ่มเรียงตามลำดับกลุ่ม (เฉพาะที่มีค่า + ยังไม่จัดกลุ่ม/ยังไม่มีค่าใช้จ่ายท้ายสุด) */
function rgRows(map) {
  var ids = rgList().map(function (g) { return g.id; }).filter(function (id) { return map[id]; });
  if (map['']) ids.push(''); if (map.none) ids.push('none');
  return ids.map(function (id) { return { id: id, name: rgName(id), v: map[id], color: rgColor(id), hex: id === 'none' ? '#c9c2c5' : rgHex(id) }; });
}
