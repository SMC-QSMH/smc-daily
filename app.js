/* =====================================================================
   app.js — แกนหน้าเว็บ SMC Daily: เรียกหลังบ้าน แคช ล็อกอิน โครงหน้า กราฟ
   ===================================================================== */
'use strict';
var IS_DEMO = (typeof API_URL !== 'undefined' && API_URL === 'demo');
/** ข้อมูลหน่วยงาน (แสดงหน้าเข้าสู่ระบบ + ท้ายทุกหน้า) */
var ORG = {
  system: 'ระบบรายงานผลการปฏิบัติงานประจำวัน', clinic: 'คลินิกพิเศษเฉพาะทางนอกเวลา', hosp: 'โรงพยาบาลสมเด็จพระบรมราชเทวี ณ ศรีราชา', trc: 'สภากาชาดไทย',
  en: 'Special Medical Clinic – Queen Savang Vadhana Memorial Hospital, Thai Red Cross Society', abbr: 'SMC-QSMH',
  contact: 'เจ้าหน้าที่ประสานงาน โทรภายใน 13507', updated: '9 ต.ค. 2569', year: '2569',
  manual: 'https://claude.ai/artifact/TpQsQi6zm1uj5VboEyNn4V'
};

/* ---------------- ตัวช่วย ---------------- */
var $ = function (s, el) { return (el || document).querySelector(s); };
var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function fmt(n, d) { if (n == null || n === '' || isNaN(n)) return '–'; var p = Math.pow(10, d == null ? 1 : d); return (Math.round(n * p) / p).toLocaleString('en-US'); }
function pct(a, b) { return b ? (a - b) / b * 100 : null; }
var TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
var TH_MF = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
var TH_D = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
var TH_DS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
function pd(s) { var p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
function ds(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
function addDays(s, n) { var d = pd(s); d.setDate(d.getDate() + n); return ds(d); }
function thDate(s, long, full) { var d = pd(s); return (long ? TH_D[d.getDay()] + ' ' : '') + d.getDate() + ' ' + (full ? TH_MF : TH_M)[d.getMonth()] + ' ' + (d.getFullYear() + 543); }
function thMonth(ym) { var p = ym.split('-').map(Number); return TH_MF[p[1] - 1] + ' ' + (p[0] + 543); }
function stampTh(s) { if (!s) return ''; var p = s.split(' '); return thDate(p[0]) + (p[1] ? ' ' + p[1].slice(0, 5) + ' น.' : ''); }
function fyOf(s) { var d = pd(s); return d.getFullYear() + (d.getMonth() >= 9 ? 1 : 0) + 543; }
function qOf(s) { var m = pd(s).getMonth(); return m >= 9 ? 1 : m <= 2 ? 2 : m <= 5 ? 3 : 4; }
function datesIn(a, b) { var o = []; for (var d = a; d <= b; d = addDays(d, 1)) o.push(d); return o; }
function initials(n) { n = String(n || '').replace(/^(นพ\.|พญ\.|นาย|นาง|น\.ส\.|ทพ\.|ทพญ\.)/, '').trim(); return n.charAt(0) || '?'; }
function debounce(fn, ms) { var t; return function () { var a = arguments, self = this; clearTimeout(t); t = setTimeout(function () { fn.apply(self, a); }, ms); }; }
function store(k, v) { try { if (v === undefined) { var x = localStorage.getItem('smcd:' + k); return x ? JSON.parse(x) : null; } if (v === null) localStorage.removeItem('smcd:' + k); else localStorage.setItem('smcd:' + k, JSON.stringify(v)); } catch (e) { return null; } }
function rid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
var REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

var IC = {
  logo: '<svg viewBox="0 0 32 32" fill="none"><path d="M3 17h6l3-7 4 14 4-11 2 4h7" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4h6M8 4H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/><path d="M7 13h2l1.5-3 2 6 1.5-3h3"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  rep: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h4"/></svg>',
  dash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 20V11M10 20V4M16 20v-6M22 20H2"/></svg>',
  set: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
  prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M15 6l-6 6 6 6"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>',
  line: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M21 11.5c0 4.1-4 7.5-9 7.5-.9 0-1.8-.1-2.6-.3L5 21l.8-3.6C4 16 3 13.9 3 11.5 3 7.4 7 4 12 4s9 3.4 9 7.5z"/></svg>',
  img: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></svg>',
  print: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M7 9V3h10v6M7 18H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M7 14h10v7H7z"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M20 11a8 8 0 0 0-14.7-4.4L4 8M4 4v4h4M4 13a8 8 0 0 0 14.7 4.4L20 16M20 20v-4h-4"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path class="ck" d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  dot: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" fill="currentColor"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20c-.5-2.6-1.9-4.3-3.8-5"/></svg>',
  pulse: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h4l2.5-6 4 12 3-8 1.5 2H22"/></svg>',
  syringe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2l4 4M20 4l-9 9M14 6l4 4M7 13l4 4M4 20l3-3M9.5 10.5l-4 4 4 4 4-4"/></svg>',
  clinic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 21V8l9-5 9 5v13M9 21v-6h6v6M12 8v4M10 10h4"/></svg>',
  logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3"/></svg>',
  key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>',
  xls: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 3h9l4 4v14H6z"/><path d="M9 11l5 6M14 11l-5 6"/></svg>',
  spin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path class="sp" style="transform-origin:center" d="M12 3a9 9 0 1 0 9 9"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3.2 3.9M6.6 7.5C3.8 9.3 2 12 2 12s3.6 6 10 6c1.6 0 3-.4 4.3-1M9.9 10a3 3 0 0 0 4.2 4.1"/></svg>',
  help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="9.2"/><path d="M9.4 9.3a2.7 2.7 0 0 1 5.2 1c0 1.8-2.6 2.2-2.6 3.9M12 17.2v.3"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M7.5 7.5 12 3l4.5 4.5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>',
  filter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h18l-7 8.5V20l-4-2v-4.5z"/></svg>',
  ambul: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 16V7h11v9M14 10h4l3 3.5V16h-7"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M8.5 9v4M6.5 11h4"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.4"/></svg>',
  inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1.5 2.5h5L16 13h5"/></svg>'
};

/* ---------------- เรียกหลังบ้าน ----------------
 * ไม่ตั้ง Content-Type (text/plain) → ไม่มี preflight · อ่าน = ลองซ้ำ 3 ครั้ง · เขียน = ส่งเลขคำขอ (_rid) ลองซ้ำได้ไม่บันทึกซ้ำ
 * แคช 2 ชั้น (หน่วยความจำ + เครื่อง) → เปิดหน้าเห็นข้อมูลเดิมทันที แล้วอัปเดตตาม */
var S = { token: null, me: null, boot: null, page: 'today', date: null };
var NET = { active: 0, queue: [], MAX: 4, busy: 0 };
function netSlot() { return new Promise(function (res) { if (NET.active < NET.MAX) { NET.active++; res(); } else NET.queue.push(res); }); }
function netDone() { var n = NET.queue.shift(); if (n) n(); else NET.active = Math.max(0, NET.active - 1); }
var ACT_TH = { getMonths: 'กำลังโหลดข้อมูลรายงาน', getCases: 'กำลังโหลดรายชื่อผู้ป่วยส่งต่อ', saveCase: 'กำลังบันทึกผู้ป่วยส่งต่อ', saveGroups: 'กำลังบันทึกกลุ่มคลินิก', login: 'กำลังเข้าสู่ระบบ', bootstrap: 'กำลังโหลดข้อมูลตั้งต้น', getDay: 'กำลังโหลดรายงาน', refreshDay: 'กำลังดึงยอดล่าสุดจากระบบ รพ.', getRoster: 'กำลังดึงตารางเวรจาก SMC Duty', saveEntry: 'กำลังบันทึก', saveStaff: 'กำลังบันทึกรายชื่อ', addItem: 'กำลังเพิ่มรายการ',
  getMonth: 'กำลังโหลดปฏิทิน', getReport: 'กำลังสรุปรายงาน', getDashboard: 'กำลังสรุปแดชบอร์ด', getAdmin: 'กำลังโหลดการตั้งค่า', testApi: 'กำลังทดสอบ API', testDuty: 'กำลังทดสอบ SMC Duty', getAudit: 'กำลังโหลดประวัติ' };
var ACTS = {}, actTimer = null;
function netBar(d, action) {
  NET.busy += d; if (action) { ACTS[action] = (ACTS[action] || 0) + d; if (ACTS[action] <= 0) delete ACTS[action]; }
  var b = $('#netbar'); if (b) b.hidden = NET.busy <= 0;
  clearTimeout(actTimer);
  var pill = $('#activity');
  if (NET.busy <= 0) { if (pill) pill.hidden = true; return; }
  actTimer = setTimeout(function () {   // แสดงเมื่อรอเกิน 0.35 วินาที (ไม่กะพริบเมื่อเร็ว)
    if (NET.busy <= 0) return;
    if (!pill) { pill = document.createElement('div'); pill.id = 'activity'; pill.className = 'activity'; pill.setAttribute('role', 'status'); document.body.appendChild(pill); }
    var names = Object.keys(ACTS).map(function (a) { return ACT_TH[a] || 'กำลังทำงาน'; });
    pill.innerHTML = IC.spin + '<span>' + esc(names[0] || 'กำลังทำงาน') + '…' + (names.length > 1 ? ' (+' + (names.length - 1) + ')' : '') + '</span>';
    pill.hidden = false;
  }, 350);
}
/** ปุ่มที่กดแล้วรอเซิร์ฟเวอร์: ปิดปุ่ม + หมุน + คืนค่าเดิมเมื่อเสร็จ */
function busy(btn, promise, label) {
  if (!btn) return promise;
  var html = btn.innerHTML, w = btn.offsetWidth; btn.disabled = true; btn.classList.add('is-busy'); btn.style.minWidth = w + 'px';
  btn.innerHTML = IC.spin + (label ? '<span>' + esc(label) + '</span>' : '');
  var done = function () { btn.disabled = false; btn.classList.remove('is-busy'); btn.innerHTML = html; btn.style.minWidth = ''; };
  return Promise.resolve(promise).then(function (x) { done(); return x; }, function (e) { done(); throw e; });
}
/** ปุ่มดู/ซ่อนรหัสผ่าน */
function pwField(id, label, ac, extra) {
  return '<label class="field" for="' + id + '">' + label + '<span class="pw"><input id="' + id + '" type="password" autocomplete="' + ac + '" ' + (extra || '') + ' required><button type="button" class="pweye" data-eye="' + id + '" aria-label="แสดงรหัสผ่าน" title="แสดง/ซ่อนรหัสผ่าน">' + IC.eye + '</button></span></label>';
}
function bindEyes(root) {
  $$('[data-eye]', root).forEach(function (b) { b.onclick = function () { var i = $('#' + b.getAttribute('data-eye'), root), show = i.type === 'password'; i.type = show ? 'text' : 'password'; b.innerHTML = show ? IC.eyeOff : IC.eye; b.setAttribute('aria-label', show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'); i.focus(); }; });
}
function isRead(a) { return /^(get|bootstrap|ping|login|refresh)/.test(a); }
function fetchOnce(action, payload) {
  if (IS_DEMO) return new Promise(function (res) { setTimeout(function () { res(JSON.parse(JSON.stringify(DEMO_BACKEND.rpc(action, S.token, JSON.parse(JSON.stringify(payload || {})))))); }, 120 + Math.random() * 260); });
  var ctl = window.AbortController ? new AbortController() : null, tm = ctl ? setTimeout(function () { ctl.abort(); }, 90000) : null;
  return fetch(API_URL, { method: 'POST', redirect: 'follow', credentials: 'omit', cache: 'no-store', body: JSON.stringify({ action: action, token: S.token, payload: payload || {} }), signal: ctl ? ctl.signal : undefined })
    .then(function (r) { clearTimeout(tm); return r.text(); }, function (e) { clearTimeout(tm); if (e && e.name === 'AbortError') { var er = new Error('เซิร์ฟเวอร์ตอบช้าเกิน 90 วินาที กรุณาลองใหม่'); er.noRetry = true; throw er; } throw e; })
    .then(function (t) { if (String(t).trim().charAt(0) === '<') { var e = new Error('เซิร์ฟเวอร์ Google ไม่ว่างชั่วคราว'); e.retry = true; throw e; } return JSON.parse(t); });
}
function rawCall(action, payload) {
  var waits = [700, 1600, 3200], tries = 0, canRetry = isRead(action) || (payload && payload._rid);
  netBar(1, action);
  var attempt = function () {
    return netSlot().then(function () { return fetchOnce(action, payload); })
      .then(function (x) { netDone(); return x; }, function (e) {
        netDone();
        if (canRetry && !e.noRetry && tries < waits.length) { var w = waits[tries++]; return new Promise(function (r) { setTimeout(r, w); }).then(attempt); }
        throw new Error(e && e.message && !/Failed to fetch|NetworkError|Load failed/.test(e.message) ? e.message : 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่');
      });
  };
  return attempt().then(function (x) { netBar(-1, action); return x; }, function (e) { netBar(-1, action); throw e; });
}
var MEMO = {}, MEMO_T = {};
function mkey(a, p) { return a + '|' + JSON.stringify(p || {}); }
function pcGet(k) { return S.me ? store('c:' + S.me.user + ':' + k) : null; }
function pcSet(k, d) { try { if (S.me && JSON.stringify(d).length < 300000) store('c:' + S.me.user + ':' + k, d); } catch (e) { } }
function cacheClear() { MEMO = {}; MEMO_T = {}; try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf('smcd:c:') === 0) localStorage.removeItem(k); }); } catch (e) { } }
function api(action, payload, opt) {
  opt = opt || {};
  var k = mkey(action, payload);
  if (opt.onCache) { var cd = MEMO[k] || pcGet(k); if (cd) { try { opt.onCache(cd); } catch (e) { console.error(e); } } }
  if (opt.maxAge && MEMO[k] && Date.now() - MEMO_T[k] < opt.maxAge) return Promise.resolve(MEMO[k]);
  return rawCall(action, payload).then(function (res) {
    if (res.ok) { if (isRead(action)) { MEMO[k] = res.data; MEMO_T[k] = Date.now(); if (opt.persist) pcSet(k, res.data); } return res.data; }
    if (res.error === 'SESSION_EXPIRED') { logout(true); throw new Error('หมดเวลาการเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่'); }
    throw new Error(res.error);
  });
}
function forget(prefix) { Object.keys(MEMO).forEach(function (k) { if (k.indexOf(prefix) === 0) { delete MEMO[k]; delete MEMO_T[k]; } }); }

/* ---------------- UI พื้นฐาน ---------------- */
function toast(msg, err) { $$('.toast').forEach(function (t) { t.remove(); }); var t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : ''); t.setAttribute('role', 'status'); t.textContent = msg; document.body.appendChild(t); setTimeout(function () { t.remove(); }, err ? 4200 : 2400); }
function modal(title, body, foot, cls) {
  var m = document.createElement('div'); m.className = 'modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
  document.documentElement.classList.add('modal-open');
  m.innerHTML = '<div class="box ' + (cls || '') + '"><div class="mh"><h3>' + title + '</h3><button class="iconbtn" data-close aria-label="ปิด">' + IC.x + '</button></div><div class="mb">' + body + '</div>' + (foot ? '<div class="mf">' + foot + '</div>' : '') + '</div>';
  var close = function () { m.remove(); document.removeEventListener('keydown', key); if (!$('.modal')) document.documentElement.classList.remove('modal-open'); };
  var key = function (e) { if (e.key === 'Escape') close(); };
  m.addEventListener('click', function (e) { if (e.target === m || e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', key);
  var obs = new MutationObserver(function () { if (!m.isConnected) { obs.disconnect(); if (!$('.modal')) document.documentElement.classList.remove('modal-open'); } });
  obs.observe(document.body, { childList: true });
  document.body.appendChild(m); m.close = close; return m;
}
var tip = (function () { var el; return {
  show: function (html, x, y) { if (!el) { el = document.createElement('div'); el.className = 'tip'; document.body.appendChild(el); } el.innerHTML = html; el.hidden = false; var w = el.offsetWidth; el.style.left = Math.min(innerWidth - w - 8, Math.max(8, x - w / 2)) + 'px'; el.style.top = Math.max(8, y - el.offsetHeight - 14) + 'px'; },
  hide: function () { if (el) el.hidden = true; } }; })();
function bindTips(root) { $$('[data-tip]', root).forEach(function (n) { n.addEventListener('mousemove', function (e) { tip.show(n.getAttribute('data-tip'), e.clientX, e.clientY); }); n.addEventListener('mouseleave', tip.hide); }); }
/** ตัวเลขวิ่งขึ้น */
function countUp(root) {
  $$('[data-count]', root).forEach(function (el) {
    var to = +el.getAttribute('data-count'), dec = +(el.getAttribute('data-dec') || 0);
    if (REDUCED || !isFinite(to)) { el.textContent = fmt(to, dec); return; }
    var t0 = performance.now(), dur = 900;
    (function step(t) { var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(to * e, dec); if (k < 1) requestAnimationFrame(step); })(t0);
  });
}
function loadScript(src) { return new Promise(function (res, rej) { if ($('script[src="' + src + '"]')) return res(); var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function () { rej(new Error('โหลดตัวช่วยไม่สำเร็จ')); }; document.head.appendChild(s); }); }
function copyText(txt, fallbackEl) {
  return (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { toast('คัดลอกแล้ว วางในไลน์ได้เลย'); }, function () {
    if (fallbackEl) { var r = document.createRange(); r.selectNodeContents(fallbackEl); var s = getSelection(); s.removeAllRanges(); s.addRange(r); }
    toast('เลือกข้อความไว้แล้ว กด Ctrl+C เพื่อคัดลอก');
  });
}

/* ---------------- กราฟ ---------------- */
function niceStep(max) { var raw = max / 4, p = Math.pow(10, Math.floor(Math.log10(raw || 1))), n = raw / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; }
/** ชุดสีข้อมูล (ตรวจความต่างสีสำหรับผู้ที่มองสีบกพร่องแล้ว) · สีตามตัวตน ไม่เปลี่ยนตามอันดับ */
var PAL = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)', 'var(--c7)', 'var(--c8)'];
var PAL_HEX = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];
function palOf(hex) { var i = PAL_HEX.indexOf(String(hex || '').toLowerCase()); return i >= 0 ? PAL[i] : (hex || 'var(--c1)'); }
function shortNum(v) { return v >= 10000 ? (Math.round(v / 100) / 10) + 'k' : fmt(v, 0); }
/** ตัวเลขบนกราฟ: เปิด/ปิดได้ จำค่าของแต่ละคน */
function labelsOn() { var v = store('chartLabels'); return v === null ? true : !!v; }
function labelsToggle(id) { return '<label class="row xs muted switchline" for="' + id + '"><span class="switch sm"><input type="checkbox" id="' + id + '"' + (labelsOn() ? ' checked' : '') + '><span></span></span>ตัวเลขบนกราฟ</label>'; }
/** แท่ง: data [{label, v, ghost, color, tip, key}] · o.labels = แสดงตัวเลขบนแท่ง */
function barChart(data, o) {
  o = o || {};
  var W = o.w || 760, H = o.h || 230, L = 42, B = 26, T = o.labels ? 18 : 10, R = 6;
  var max = Math.max(1, Math.max.apply(null, data.map(function (d) { return Math.max(d.v || 0, d.ghost || 0); })));
  var step = niceStep(max), top = Math.ceil(max / step) * step, iw = W - L - R, ih = H - T - B, bw = iw / Math.max(1, data.length), gap = Math.max(2, Math.min(6, bw * 0.26));
  var g = '';
  for (var v = 0; v <= top + 1e-9; v += step) { var y = T + ih - v / top * ih; g += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '"/><text x="' + (L - 7) + '" y="' + (y + 4) + '" text-anchor="end">' + fmt(v, 0) + '</text>'; }
  var every = Math.ceil(data.length / (o.maxLabels || 16)), bars = '';
  var lblFs = bw >= 26 ? 11 : bw >= 17 ? 9.5 : 8.5, showLbl = o.labels && bw >= 11;
  data.forEach(function (d, i) {
    var x = L + i * bw + gap / 2, w = Math.max(1.5, bw - gap), h = (d.v || 0) / top * ih, y = T + ih - h, r = Math.min(4, w / 2, h);
    var path = h > 0 ? 'M' + x + ',' + (T + ih) + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + (T + ih) + 'Z' : '';
    var gh = d.ghost ? '<rect class="ghost" x="' + (x - 1) + '" y="' + (T + ih - d.ghost / top * ih) + '" width="' + (w + 2) + '" height="' + (d.ghost / top * ih) + '" rx="3"/>' : '';
    var lbl = showLbl && d.v ? (bw < 17 && d.v >= 100 ? '<text class="vl" x="' + (x + w / 2) + '" y="' + (y - 3) + '" text-anchor="start" transform="rotate(-90 ' + (x + w / 2) + ' ' + (y - 3) + ')" style="font-size:' + lblFs + 'px">' + shortNum(d.v) + '</text>' : '<text class="vl" x="' + (x + w / 2) + '" y="' + (y - 4) + '" text-anchor="middle" style="font-size:' + lblFs + 'px">' + shortNum(d.v) + '</text>') : '';
    bars += '<g data-tip="' + esc(d.tip || '') + '"' + (d.key ? ' data-pick="' + esc(d.key) + '" class="pickable"' : '') + '><rect class="hit" x="' + (L + i * bw) + '" y="' + T + '" width="' + bw + '" height="' + ih + '"/>' + gh +
      (path ? '<path class="bar" style="animation-delay:' + Math.min(0.6, i * 0.012).toFixed(3) + 's" d="' + path + '" fill="' + (d.color || 'var(--c1)') + '"/>' : '') + lbl +
      (i % every === 0 ? '<text x="' + (L + i * bw + bw / 2) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(d.label) + '</text>' : '') + '</g>';
  });
  return '<div class="chart"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.aria || '') + '"><line class="axis" x1="' + L + '" x2="' + (W - R) + '" y1="' + (T + ih) + '" y2="' + (T + ih) + '"/>' + g + bars + '</svg></div>';
}
/** โดนัท: list [{name, v, color, key, sub}] · คืน svg + คำอธิบาย */
function donut(list, o) {
  o = o || {}; var tot = list.reduce(function (s, x) { return s + x.v; }, 0) || 1, R = 74, r0 = 50, cx = 90, cy = 90, a = -Math.PI / 2, segs = '';
  var gapA = list.length > 1 ? 0.012 : 0;
  list.forEach(function (x, i) {
    var f = x.v / tot, a2 = a + f * Math.PI * 2;
    if (f > 0) {
      var s1 = a + gapA, e1 = Math.max(s1 + 0.001, a2 - gapA), big = e1 - s1 > Math.PI ? 1 : 0;
      if (f >= 0.9999) segs += '<g data-tip="' + esc(x.tip || '') + '"' + (x.key ? ' data-pick="' + esc(x.key) + '" class="pickable"' : '') + '><circle cx="' + cx + '" cy="' + cy + '" r="' + ((R + r0) / 2) + '" fill="none" stroke="' + x.color + '" stroke-width="' + (R - r0) + '"/></g>';
      else segs += '<g data-tip="' + esc(x.tip || '') + '"' + (x.key ? ' data-pick="' + esc(x.key) + '" class="pickable"' : '') + '><path class="seg" style="animation-delay:' + (i * .05).toFixed(2) + 's" fill="' + x.color + '" d="M' + (cx + R * Math.cos(s1)).toFixed(2) + ',' + (cy + R * Math.sin(s1)).toFixed(2) + 'A' + R + ',' + R + ' 0 ' + big + ' 1 ' + (cx + R * Math.cos(e1)).toFixed(2) + ',' + (cy + R * Math.sin(e1)).toFixed(2) +
        'L' + (cx + r0 * Math.cos(e1)).toFixed(2) + ',' + (cy + r0 * Math.sin(e1)).toFixed(2) + 'A' + r0 + ',' + r0 + ' 0 ' + big + ' 0 ' + (cx + r0 * Math.cos(s1)).toFixed(2) + ',' + (cy + r0 * Math.sin(s1)).toFixed(2) + 'Z"/></g>';
    }
    a = a2;
  });
  var leg = list.map(function (x) { return '<li' + (x.key ? ' data-pick="' + esc(x.key) + '" class="pickable"' : '') + '><i style="background:' + x.color + '"></i><span class="nm" title="' + esc(x.title || x.name) + '">' + x.name + '</span><b class="num">' + fmt(x.v, 0) + '</b><span class="pc num">' + fmt(x.v / tot * 100) + '%</span></li>'; }).join('');
  return '<div class="donut"><svg viewBox="0 0 180 180" role="img" aria-label="' + esc(o.aria || 'สัดส่วน') + '">' + segs + '<text x="90" y="86" text-anchor="middle" class="dt">' + fmt(tot, 0) + '</text><text x="90" y="106" text-anchor="middle" class="ds">' + esc(o.unit || 'ราย') + '</text></svg><ul class="dleg">' + leg + '</ul></div>';
}
/** ช่วงสีปฏิทินความหนาแน่น: คำนวณจากข้อมูลจริง (ควอนไทล์ ปัดเป็นเลขกลม) → 5 ระดับ */
function heatBins(vals) {
  var v = vals.filter(function (x) { return x > 0; }).sort(function (a, b) { return a - b; });
  if (!v.length) return [1, 2, 3, 4];
  var mx = v[v.length - 1], unit = mx >= 400 ? 50 : mx >= 150 ? 10 : mx >= 40 ? 5 : 1, out = [];
  [0.2, 0.4, 0.6, 0.8].forEach(function (q) { var x = v[Math.min(v.length - 1, Math.floor(q * v.length))]; x = Math.max(unit, Math.round(x / unit) * unit); if (out.length && x <= out[out.length - 1]) x = out[out.length - 1] + unit; out.push(x); });
  return out;
}
function heatLevel(v, bins) { if (v == null) return -1; if (!v) return 0; for (var i = 0; i < bins.length; i++) if (v <= bins[i]) return i + 1; return 5; }
function heatLegend(bins) {
  var r = [['1', bins[0]]]; for (var i = 1; i < 4; i++) r.push([bins[i - 1] + 1, bins[i]]); r.push([bins[3] + 1, null]);
  return '<div class="heatkey"><span><i style="background:var(--heat-0)"></i>0 / ปิด</span>' + r.map(function (x, i) { return '<span><i style="background:var(--heat-' + (i + 1) + ')"></i>' + fmt(+x[0], 0) + (x[1] == null ? ' ขึ้นไป' : '–' + fmt(x[1], 0)) + '</span>'; }).join('') + '<span class="muted">ราย/วัน</span></div>';
}
/** เส้นเล็กในบัตรตัวเลข */
function miniLine(vals, w, h) {
  w = w || 84; h = h || 30; var v = vals.filter(function (x) { return x != null; }); if (v.length < 2) return '';
  var mx = Math.max.apply(null, v), mn = Math.min.apply(null, v), sx = w / (vals.length - 1), d = '';
  vals.forEach(function (x, i) { if (x == null) return; d += (d ? 'L' : 'M') + (i * sx).toFixed(1) + ',' + (h - 2 - (x - mn) / ((mx - mn) || 1) * (h - 4)).toFixed(1); });
  return '<svg class="mini" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true"><path d="' + d + '"/></svg>';
}
/** เส้นแนวโน้มในแถบหัว (พื้นแดง) */
function heroSpark(pts) {
  var v = pts.filter(function (p) { return p[1] != null; }); if (v.length < 2) return '';
  var W = 360, H = 90, mx = Math.max.apply(null, v.map(function (p) { return p[1]; })) || 1, sx = W / (pts.length - 1), d = '', a = '', last = null, len = 0, px = null, py = null;
  pts.forEach(function (p, i) {
    if (p[1] == null) return; var x = i * sx, y = H - 16 - p[1] / mx * (H - 26);
    d += (d ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1); if (px != null) len += Math.hypot(x - px, y - py); px = x; py = y; last = [x, y, p];
  });
  a = d + 'L' + last[0].toFixed(1) + ',' + (H - 16) + 'L0,' + (H - 16) + 'Z';
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" aria-label="แนวโน้ม 14 วัน"><defs><linearGradient id="spk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>' +
    '<path class="ar" d="' + a + '"/><path class="ln" style="--len:' + Math.ceil(len) + ';stroke-dashoffset:0" d="' + d + '"/><circle class="pt" cx="' + last[0] + '" cy="' + last[1] + '" r="4"/>' +
    '<text x="0" y="' + (H - 2) + '">' + esc(thDate(pts[0][0])) + '</text><text x="' + W + '" y="' + (H - 2) + '" text-anchor="end">' + esc(thDate(pts[pts.length - 1][0])) + '</text></svg>';
}
function ring(pctv, label, sub) {
  var r = 52, c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(1, pctv)));
  return '<div class="ring"><svg viewBox="0 0 120 120"><circle class="tr" cx="60" cy="60" r="' + r + '"/><circle class="fg" cx="60" cy="60" r="' + r + '" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + c.toFixed(1) + '" data-off="' + off.toFixed(1) + '"/></svg><div class="lbl"><div><b>' + label + '</b>' + sub + '</div></div></div>';
}
function animateRings(root) { requestAnimationFrame(function () { requestAnimationFrame(function () { $$('.ring .fg', root).forEach(function (c) { c.style.strokeDashoffset = c.getAttribute('data-off'); }); }); }); }
function hbars(list, o) {
  o = o || {}; var max = list.length ? list[0][1] : 0;
  return list.map(function (x, i) { return '<div class="hbar' + (x[4] ? ' pickable' : '') + '"' + (x[4] ? ' data-pick="' + esc(x[4]) + '"' : '') + '><span class="nm" title="' + esc(x[2] || x[0]) + '"><span class="rank">' + (i + 1) + '</span>' + x[0] + '</span><span class="tr"><span class="fl" style="width:' + (max ? x[1] / max * 100 : 0).toFixed(1) + '%;display:block;animation-delay:' + (i * 0.05).toFixed(2) + 's' + (x[3] ? ';background:' + x[3] : '') + '"></span></span><span class="num">' + fmt(x[1], 0) + '</span></div>'; }).join('') || '<div class="empty">' + IC.inbox + 'ไม่มีข้อมูลตามตัวกรอง</div>';
}
function heatColor(v, max, bins) { if (v == null) return 'var(--line-2)'; if (!v) return 'var(--heat-0)'; if (bins) return 'var(--heat-' + heatLevel(v, bins) + ')'; var k = v / (max || 1); return 'var(--heat-' + (k < .2 ? 1 : k < .4 ? 2 : k < .6 ? 3 : k < .85 ? 4 : 5) + ')'; }

/* ---------------- ล็อกอิน / โครงหน้า ---------------- */
var ROLE_TH = { nurse: 'พยาบาล', exec: 'ผู้บริหาร', admin: 'แอดมิน' };
function canEdit() { return S.me && (S.me.role === 'nurse' || S.me.role === 'admin'); }
function logout(expired) {
  S.token = null; S.me = null; S.boot = null; cacheClear(); store('token', null);
  renderLogin(expired ? 'หมดเวลาการเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่' : '');
}
function renderLogin(msg) {
  document.title = 'SMC Daily · ' + ORG.system;
  var ecg = 'M0,70 L140,70 L160,70 L172,52 L184,70 L206,70 L218,18 L232,118 L246,70 L270,70 L290,60 L312,70 L470,70 L490,70 L502,52 L514,70 L536,70 L548,18 L562,118 L576,70 L600,70 L620,60 L642,70 L800,70';
  $('#app').innerHTML = '<div class="login">' +
    '<section class="art"><div class="brand" style="padding:0"><div class="mark">' + IC.logo + '</div><div><b style="color:#fff">SMC Daily</b><span style="color:rgba(255,255,255,.8)">' + ORG.clinic + ' · ' + ORG.abbr + '</span></div></div>' +
    '<div><div class="art-org">' + ORG.hosp + ' ' + ORG.trc + '</div><h1>' + ORG.system + '<span>' + ORG.clinic + '</span></h1>' +
    '<svg class="monitor" viewBox="0 0 800 140" preserveAspectRatio="none" aria-hidden="true"><path class="base" d="' + ecg + '"/><path d="' + ecg + '"/></svg></div>' +
    '<div class="feats"><div class="feat d1"><b>ยอดผู้รับบริการ</b>เชื่อมระบบสารสนเทศโรงพยาบาลอัตโนมัติ</div><div class="feat d2"><b>บันทึกหัตถการ</b>บันทึกทันที ตรวจสอบย้อนหลังได้</div><div class="feat d3"><b>รายงานและแดชบอร์ด</b>รายวัน เดือน ไตรมาส ปีงบประมาณ</div></div></section>' +
    '<section class="formside"><form id="lf" autocomplete="on"><div><div class="eyebrow">' + esc(IS_DEMO ? 'โหมดทดลองใช้' : ORG.clinic) + '</div><h2>เข้าสู่ระบบ</h2></div>' +
    (msg ? '<div class="banner warn">' + esc(msg) + '</div>' : '') +
    (IS_DEMO ? '<div class="demo"><b>บัญชีทดลอง</b> รหัสผ่าน <b>demo1234</b> ทุกบัญชี<div class="row"><button type="button" class="btn btn-sm" data-u="nurse.smc">พยาบาล</button><button type="button" class="btn btn-sm" data-u="exec">ผู้บริหาร</button><button type="button" class="btn btn-sm" data-u="admin">แอดมิน</button></div></div>' : '') +
    '<label class="field" for="lu">ชื่อผู้ใช้<input id="lu" name="username" type="text" autocomplete="username" autocapitalize="none" required></label>' +
    pwField('lp', 'รหัสผ่าน', 'current-password', 'name="password"') +
    '<label class="row small" for="lr"><input id="lr" type="checkbox" checked> จำการเข้าสู่ระบบ 30 วัน (เครื่องเคาน์เตอร์)</label>' +
    '<button class="btn btn-brand btn-lg" id="lb" type="submit" style="justify-content:center">เข้าสู่ระบบ</button>' +
    '<p class="small" id="lhint" hidden style="margin:0;color:var(--warn)">เซิร์ฟเวอร์ Google กำลังเริ่มทำงาน ครั้งแรกของวันอาจใช้ 5–15 วินาที ครั้งต่อไปจะเร็วขึ้น</p>' +
    '<p class="small muted" style="margin:0">ขอรหัสเข้าใช้งานหรือลืมรหัสผ่าน ติดต่อ' + esc(ORG.contact) + '</p>' +
    '<a class="small" href="' + esc(ORG.manual) + '" target="_blank" rel="noopener" style="align-self:flex-start">' + IC.help.replace('<svg', '<svg width="15" height="15" style="vertical-align:-3px;margin-right:4px"') + 'คู่มือการใช้งาน</a></form>' + footerHtml(true) + '</section></div>';
  $$('[data-u]').forEach(function (b) { b.onclick = function () { $('#lu').value = b.getAttribute('data-u'); $('#lp').value = 'demo1234'; $('#lb').click(); }; });
  $('#lf').onsubmit = function (e) {
    e.preventDefault();
    var btn = $('#lb'), t0 = Date.now(); btn.disabled = true; btn.innerHTML = IC.spin + ' กำลังเข้าสู่ระบบ…';
    var tick = setInterval(function () { var s = Math.round((Date.now() - t0) / 1000); btn.innerHTML = IC.spin + ' กำลังเข้าสู่ระบบ… ' + s + ' วิ'; var h = $('#lhint'); if (h && s >= 6) h.hidden = false; }, 1000);
    var today = ds(new Date()), first = { action: 'getDay', payload: { date: today } };
    api('login', { username: $('#lu').value, password: $('#lp').value, remember: $('#lr').checked, withBoot: true, first: first }).then(function (r) {
      S.token = r.token; if (!IS_DEMO) store('token', r.token); applyBoot(r.boot);
      if (r.first) { var k = mkey('getDay', r.first.payload); MEMO[k] = r.first.data; MEMO_T[k] = Date.now(); }
      clearInterval(tick); S.date = today; startApp();
      if (r.mustChange) changePassword(true);
    }).catch(function (err) { clearInterval(tick); btn.disabled = false; btn.textContent = 'เข้าสู่ระบบ'; var h = $('#lhint'); if (h) h.hidden = true; toast(err.message, true); });
  };
  bindEyes($('#lf'));
  if (!IS_DEMO) { try { rawCall('ping', {}).catch(function () { }); } catch (e) { } }   // ปลุกเซิร์ฟเวอร์ระหว่างพิมพ์รหัสผ่าน
  setTimeout(function () { var u = $('#lu'); if (u) u.focus(); }, 50);
}
function applyBoot(b) { S.boot = b; S.me = b.me; store('boot', b); }
function changePassword(forced) {
  var m = modal(forced ? 'ตั้งรหัสผ่านใหม่ก่อนใช้งาน' : 'เปลี่ยนรหัสผ่าน', '<form id="cpf" style="display:flex;flex-direction:column;gap:12px">' +
    (forced ? '<p class="small muted" style="margin:0">รหัสผ่านที่ได้รับเป็นรหัสชั่วคราว กรุณาตั้งรหัสใหม่อย่างน้อย 8 ตัว</p>' : '') +
    pwField('cp0', 'รหัสผ่านเดิม (หรือรหัสชั่วคราว)', 'current-password') + pwField('cp1', 'รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)', 'new-password', 'minlength="8"') + pwField('cp2', 'ยืนยันรหัสผ่านใหม่', 'new-password', 'minlength="8"') +
    '<button class="btn btn-brand" id="cpb" type="submit" style="align-self:flex-end">บันทึกรหัสผ่าน</button></form>', '', 'sm');
  bindEyes(m);
  if (forced) { var x = $('[data-close]', m); if (x) x.remove(); }
  $('#cpf', m).onsubmit = function (e) {
    e.preventDefault();
    if ($('#cp1', m).value !== $('#cp2', m).value) return toast('รหัสผ่านใหม่ 2 ช่องไม่ตรงกัน', true);
    busy($('#cpb', m), api('changePassword', { oldPassword: $('#cp0', m).value, newPassword: $('#cp1', m).value, remember: true, _rid: rid() }), 'กำลังบันทึก…').then(function (r) {
      S.token = r.token; if (!IS_DEMO) store('token', r.token); S.me.mustChange = false; m.remove(); toast('เปลี่ยนรหัสผ่านแล้ว');
    }).catch(function (err) { toast(err.message, true); });
  };
}

var PAGES = [['today', 'รายงานประจำวัน', 'today'], ['cal', 'ปฏิทินย้อนหลัง', 'cal'], ['rep', 'รายงาน', 'rep'], ['dash', 'แดชบอร์ด', 'dash'], ['set', 'ตั้งค่า', 'set']];
function startApp() {
  var sticky = store('sticky:' + S.me.user);
  S.page = (sticky && Date.now() - sticky.t < 12 * 3600000) ? (sticky.page || 'today') : 'today';
  if (!S.date) S.date = S.boot.today;
  renderShell(); go(S.page, true);
  if (!IS_DEMO) setInterval(checkVersion, 10 * 60000);
}
function navList() { return PAGES.filter(function (p) { return p[0] !== 'set' || S.me.role === 'admin'; }); }
function renderShell() {
  var b = S.boot, me = S.me, nav = navList();
  document.title = 'SMC Daily';
  $('#app').innerHTML = '<div class="netbar" id="netbar" hidden><i></i></div><div class="app">' +
    '<aside class="side"><div class="brand"><div class="mark">' + IC.logo + '</div><div><b>SMC Daily</b><span>' + ORG.system + '<br>' + ORG.clinic + '</span></div></div>' +
    '<nav class="nav" aria-label="เมนูหลัก">' + nav.map(function (n) { return '<button data-go="' + n[0] + '">' + IC[n[2]] + n[1] + '</button>'; }).join('') + '</nav>' +
    '<button class="sidehelp" data-help>' + IC.help + 'วิธีใช้หน้านี้</button>' +
    '<div class="who"><div class="avatar">' + esc(initials(me.name)) + '</div><div style="min-width:0"><b>' + esc(me.name) + '</b><span class="r">' + ROLE_TH[me.role] + (me.role === 'exec' ? ' · ดูอย่างเดียว' : '') + '</span></div>' +
    '<div class="tools"><button id="bpw" title="เปลี่ยนรหัสผ่าน" aria-label="เปลี่ยนรหัสผ่าน">' + IC.key + '</button><button id="bout" title="ออกจากระบบ" aria-label="ออกจากระบบ">' + IC.logout + '</button></div></div>' +
    '<div class="ver"><span class="livedot"></span>' + esc(b.app.short) + ' ' + esc(b.app.version) + ' · build ' + esc(b.app.build) + '</div></aside>' +
    '<header class="topbar"><div class="brand" style="padding:0"><div class="mark">' + IC.logo + '</div><b>SMC Daily</b></div><div class="row" style="flex-wrap:nowrap"><button class="iconbtn tb-help" data-help aria-label="วิธีใช้หน้านี้">' + IC.help + '</button><select id="mnav" aria-label="เมนู">' + nav.map(function (n) { return '<option value="' + n[0] + '">' + n[1] + '</option>'; }).join('') + '<option value="__pw">เปลี่ยนรหัสผ่าน</option><option value="__out">ออกจากระบบ</option></select></div></header>' +
    '<div class="content"><main class="main" id="main" tabindex="-1"></main>' + footerHtml() + '</div></div><div id="printArea"></div>';
  $$('[data-go]').forEach(function (bt) { bt.onclick = function () { go(bt.getAttribute('data-go')); }; });
  $('#mnav').onchange = function (e) { var v = e.target.value; if (v === '__pw') { changePassword(); e.target.value = S.page; } else if (v === '__out') logout(); else go(v); };
  $('#bout').onclick = function () { logout(); };
  $('#bpw').onclick = function () { changePassword(); };
  $$('[data-help]').forEach(function (b) { b.onclick = function () { openHelp(S.page); }; });
}
function go(p, first) {
  if (!navList().some(function (n) { return n[0] === p; })) p = 'today';
  if (!first && S.page === 'today' && typeof flushSave === 'function') flushSave();
  S.page = p; store('sticky:' + S.me.user, { page: p, t: Date.now() });
  $$('[data-go]').forEach(function (b) { if (b.getAttribute('data-go') === p) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  var mn = $('#mnav'); if (mn) mn.value = p;
  tip.hide();
  ({ today: pageToday, cal: pageCal, rep: pageRep, dash: pageDash, set: pageSet })[p]();
  if (!first) window.scrollTo(0, 0);
}
function banners() {
  var h = '';
  if (IS_DEMO) h += '<div class="banner demo"><b>โหมดทดลองใช้</b> ยอดผู้ป่วย 1 ก.ย.–8 ต.ค. 69 เป็นข้อมูลจริงจาก API · เดือนก่อนหน้าจำลองจากยอดรวมรายเดือนจริง · หัตถการก่อน 5 ต.ค. และรายชื่อเจ้าหน้าที่เป็นข้อมูลตัวอย่าง · รีเฟรชแล้วข้อมูลกลับค่าตั้งต้น</div>';
  if (S.verWarn) h += '<div class="banner info">' + S.verWarn + '<button class="btn btn-sm" onclick="location.reload()">โหลดใหม่</button></div>';
  return h;
}
function checkVersion() {
  fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (v) {
    if (v.build && S.boot && v.build !== FRONT_BUILD) S.verWarn = 'มีหน้าเว็บเวอร์ชันใหม่ (' + esc(v.build) + ')';
    else if (S.boot && S.boot.app.build !== FRONT_BUILD) S.verWarn = 'หลังบ้านเป็น build ' + esc(S.boot.app.build) + ' แต่หน้าเว็บเป็น ' + esc(FRONT_BUILD) + ' — แจ้งแอดมินให้อัปเดตให้ตรงกัน';
  }).catch(function () { });
}

/* ---------------- ท้ายหน้า · วิธีใช้ · ประเภทวัน ---------------- */
function footerHtml(login) {
  var b = S.boot, contact = (b && b.texts && b.texts.contact) || ORG.contact;
  var ver = b ? b.app.version + ' (build ' + b.app.build + ')' : '1.2569' + (typeof FRONT_BUILD !== 'undefined' ? ' (build ' + FRONT_BUILD + ')' : '');
  var upd = b && b.app.buildTh ? String(b.app.buildTh).replace(/\s*\(.*\)\s*$/, '') : ORG.updated;
  return '<footer class="appfoot' + (login ? ' onlogin' : '') + '"><div class="f1"><b>' + ORG.system + '</b> · SMC Daily เวอร์ชัน ' + esc(ver) + ' · ปรับปรุงล่าสุด ' + esc(upd) + '</div>' +
    '<div>พัฒนาระบบโดย ' + ORG.clinic + ' ' + ORG.hosp + ' ' + ORG.trc + '</div><div class="en">' + ORG.en + ' (' + ORG.abbr + ')</div>' +
    '<div>ติดต่อประสานงาน: ' + esc(contact) + ' · © ' + ORG.year + ' ' + ORG.clinic + ' สงวนลิขสิทธิ์</div></footer>';
}
function manualUrl() { return (S.boot && S.boot.texts && S.boot.texts.manualUrl) || ORG.manual; }
function helpBtn() { return '<button class="iconbtn helpbtn" data-help-inline aria-label="วิธีใช้หน้านี้" title="วิธีใช้หน้านี้">' + IC.help + '</button>'; }
function bindHelp(root) { $$('[data-help-inline]', root).forEach(function (b) { b.onclick = function () { openHelp(S.page); }; }); }
var HELP = {
  today: ['รายงานประจำวัน', [
    ['ยอดผู้ป่วยขึ้นเอง', 'ระบบดึงจำนวนผู้ป่วยแยกแพทย์และคลินิกจากระบบโรงพยาบาลทุก 30 นาที และทุก 5 นาทีขณะเปิดหน้านี้ไว้ กด "อัปเดตเดี๋ยวนี้" ถ้าต้องการทันที'],
    ['คีย์หัตถการ', 'กด + / − หรือพิมพ์ตัวเลข ระบบบันทึกเองภายในไม่กี่วินาที (มุมการ์ดขึ้น "บันทึกแล้ว") ไม่มีหัตถการเลย ให้ติ๊ก "วันนี้ไม่มีหัตถการ"'],
    ['ผู้ป่วยส่งต่อ', 'กด "+ เพิ่ม" ในการ์ดผู้ป่วยส่งต่อ ใส่ชื่อ HN อายุ DX และ Ward/หน่วยงาน จำนวน Admit/Consult/Night OPD จะปรับตามรายชื่อให้เอง'],
    ['เจ้าหน้าที่', 'ดึงจากตารางเวร SMC Duty อัตโนมัติ แก้ชื่อ ใส่คลินิก เพิ่ม/ลบได้ กด "ซิงก์ตารางเวร" เมื่อมีการแก้ตารางเวรภายหลัง'],
    ['ส่งรายงาน', 'ปุ่มข้อความไลน์ · ภาพรายงาน · พิมพ์ A4 ในแถบแดงด้านบน เลือกได้ว่าจะแสดงรายชื่อเจ้าหน้าที่และข้อมูลผู้ป่วยหรือไม่'],
    ['ย้อนหลัง', 'เปลี่ยนวันด้วยปุ่ม ‹ › หรือช่องวันที่ หรือเปิดจากเมนูปฏิทินย้อนหลัง ทุกการแก้ไขมีประวัติ']]],
  cal: ['ปฏิทินย้อนหลัง', [
    ['ดูภาพรวมทั้งเดือน', 'แต่ละวันบอกยอดผู้ป่วย และสถานะการคีย์หัตถการ: ครบ / ยังไม่คีย์'],
    ['คีย์ย้อนหลัง', 'กดวันที่ ระบบพาไปหน้ารายงานประจำวันของวันนั้น คีย์ได้ตามปกติ'],
    ['สีแถบล่าง', 'ความหนาแน่นของผู้ป่วยในวันนั้น สีเข้ม = ผู้ป่วยมาก']]],
  rep: ['รายงาน', [
    ['เลือกช่วงเวลา', 'วัน · เดือน · ไตรมาส · ปีงบประมาณ (ต.ค.–ก.ย.) · กำหนดเอง'],
    ['ตัวกรอง', 'เลือกประเภทวัน กลุ่มคลินิก คลินิก หรือแพทย์ได้หลายรายการ พิมพ์ค้นหาในช่องได้ ทุกตัวเลข กราฟ และตารางเปลี่ยนตามทันที'],
    ['ดูตาม', 'สลับมุมมองเป็นกลุ่มคลินิก / คลินิก / แพทย์ กดแถวในตารางหรือชิ้นในกราฟวงกลมเพื่อกรองต่อ'],
    ['หัตถการและยอดอื่น ๆ', 'คีย์เป็นยอดรวมทั้งคลินิกพิเศษ จึงไม่แยกตามคลินิกหรือแพทย์ (มีป้ายบอกเมื่อใช้ตัวกรอง)'],
    ['ส่งออก', 'ส่งออก Excel · พิมพ์ · สรุปส่งไลน์ ใช้ตัวกรองที่เลือกอยู่']]],
  dash: ['แดชบอร์ด', [
    ['ตัวกรองเดียวกับหน้ารายงาน', 'เลือกช่วงเวลา ประเภทวัน กลุ่มคลินิก คลินิก แพทย์ แล้วทุกกราฟเปลี่ยนตาม'],
    ['ตัวเลขบนกราฟ', 'เปิด/ปิดได้ที่สวิตช์ "ตัวเลขบนกราฟ" ระบบจำค่าที่เลือกไว้'],
    ['ชี้หรือแตะ', 'ชี้ที่แท่งกราฟ ชิ้นวงกลม หรือช่องปฏิทินเพื่อดูตัวเลข กดเพื่อกรองต่อ'],
    ['ปฏิทินความหนาแน่น', 'แถว = วันในสัปดาห์ คอลัมน์ = สัปดาห์ สีเข้มขึ้น = ผู้ป่วยมากขึ้น ช่วงตัวเลขของแต่ละสีอยู่ใต้ปฏิทิน (คำนวณจากข้อมูลจริง)']]],
  set: ['ตั้งค่า (แอดมิน)', [
    ['คลินิก', 'เปิด/ปิดการนับ ตั้งชื่อย่อ ลำดับ (ปิด = ไม่แสดงและไม่นับทุกหน้า)'],
    ['กลุ่มคลินิก', 'สร้างกลุ่ม ตั้งชื่อ เลือกสี แล้วเลือกกลุ่มให้แต่ละคลินิก ใช้กรองและสรุปในรายงาน/แดชบอร์ด'],
    ['หัตถการ · ตำแหน่ง', 'เปิด/ปิด เปลี่ยนชื่อ เรียงลำดับ'],
    ['ผู้ใช้', 'เพิ่มผู้ใช้ ระบบให้รหัสชั่วคราวครั้งเดียว ส่งให้เจ้าตัวทางช่องทางส่วนตัว · ลืมรหัสกด "ตั้งรหัสใหม่"'],
    ['การเชื่อมต่อ', 'API โรงพยาบาล · SMC Duty · ข้อความท้ายระบบ · ลิงก์คู่มือ']]]
};
function openHelp(page) {
  var h = HELP[page] || HELP.today;
  $$('.helpdrawer').forEach(function (x) { x.remove(); });
  var d = document.createElement('div'); d.className = 'helpdrawer'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'วิธีใช้');
  d.innerHTML = '<div class="hd-in"><div class="hd-h"><div><div class="eyebrow">วิธีใช้หน้านี้</div><h3>' + esc(h[0]) + '</h3></div><button class="iconbtn" data-hclose aria-label="ปิด">' + IC.x + '</button></div>' +
    '<ol class="hsteps">' + h[1].map(function (x) { return '<li><b>' + esc(x[0]) + '</b><span>' + esc(x[1]) + '</span></li>'; }).join('') + '</ol>' +
    '<a class="btn btn-brand" href="' + esc(manualUrl()) + '" target="_blank" rel="noopener">' + IC.help + 'เปิดคู่มือฉบับเต็ม</a>' +
    '<p class="xs muted" style="margin:0">ติดต่อประสานงาน: ' + esc((S.boot && S.boot.texts.contact) || ORG.contact) + '</p></div>';
  var close = function () { d.remove(); document.removeEventListener('keydown', key); };
  var key = function (e) { if (e.key === 'Escape') close(); };
  d.addEventListener('click', function (e) { if (e.target === d || e.target.closest('[data-hclose]')) close(); });
  document.addEventListener('keydown', key);
  document.body.appendChild(d); $('[data-hclose]', d).focus();
}
/** ประเภทวัน (ตรงกับหลังบ้าน): W วันทำการ · S เสาร์–อาทิตย์ · H นักขัตฤกษ์/ชดเชย · C ปิดคลินิก */
function dayTypeOf(iso) {
  var c = ((S.boot && S.boot.calendar) || {})[iso], w = pd(iso).getDay(), we = w === 0 || w === 6;
  if (c) { var t = String(c[0] || ''); if (t === 'ปิดคลินิก') return 'C'; if (t === 'วันหยุด' || t === 'วันหยุดชดเชย') return we ? 'S' : 'H'; if (t === 'วันทำการ') return 'W'; }
  return we ? 'S' : 'W';
}

/* ---------------- เริ่มทำงาน ---------------- */
function boot() {
  if (IS_DEMO && typeof DEMO_SEEDED === 'undefined') { window.DEMO_SEEDED = DEMO.seed(); }
  var t = IS_DEMO ? null : store('token'), b = store('boot');
  if (!t) return renderLogin();
  S.token = t;
  if (b) { applyBoot(b); startApp(); }
  else $('#app').innerHTML = '<div class="empty" style="padding-top:30vh">' + IC.spin + 'กำลังโหลด…</div>';
  api('bootstrap', {}).then(function (nb) {
    var changed = !b || JSON.stringify(nb) !== JSON.stringify(b);
    applyBoot(nb); if (!b) startApp(); else if (changed) { renderShell(); go(S.page, true); }
    if (nb.me.mustChange) changePassword(true);
  }).catch(function (e) { if (!S.token) return; if (!b) renderLogin(e.message); });
}
document.addEventListener('DOMContentLoaded', boot);
