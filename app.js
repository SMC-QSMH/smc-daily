/* =====================================================================
   app.js — แกนหน้าเว็บ SMC Daily: เรียกหลังบ้าน แคช ล็อกอิน โครงหน้า กราฟ
   ===================================================================== */
'use strict';
var IS_DEMO = (typeof API_URL !== 'undefined' && API_URL === 'demo');

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
  inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1.5 2.5h5L16 13h5"/></svg>'
};

/* ---------------- เรียกหลังบ้าน ----------------
 * ไม่ตั้ง Content-Type (text/plain) → ไม่มี preflight · อ่าน = ลองซ้ำ 3 ครั้ง · เขียน = ส่งเลขคำขอ (_rid) ลองซ้ำได้ไม่บันทึกซ้ำ
 * แคช 2 ชั้น (หน่วยความจำ + เครื่อง) → เปิดหน้าเห็นข้อมูลเดิมทันที แล้วอัปเดตตาม */
var S = { token: null, me: null, boot: null, page: 'today', date: null };
var NET = { active: 0, queue: [], MAX: 4, busy: 0 };
function netSlot() { return new Promise(function (res) { if (NET.active < NET.MAX) { NET.active++; res(); } else NET.queue.push(res); }); }
function netDone() { var n = NET.queue.shift(); if (n) n(); else NET.active = Math.max(0, NET.active - 1); }
function netBar(d) { NET.busy += d; var b = $('#netbar'); if (b) b.hidden = NET.busy <= 0; }
function isRead(a) { return /^(get|bootstrap|ping|login)/.test(a); }
function fetchOnce(action, payload) {
  if (IS_DEMO) return new Promise(function (res) { setTimeout(function () { res(JSON.parse(JSON.stringify(DEMO_BACKEND.rpc(action, S.token, JSON.parse(JSON.stringify(payload || {})))))); }, 120 + Math.random() * 260); });
  return fetch(API_URL, { method: 'POST', redirect: 'follow', credentials: 'omit', cache: 'no-store', body: JSON.stringify({ action: action, token: S.token, payload: payload || {} }) })
    .then(function (r) { return r.text(); })
    .then(function (t) { if (String(t).trim().charAt(0) === '<') { var e = new Error('เซิร์ฟเวอร์ Google ไม่ว่างชั่วคราว'); e.retry = true; throw e; } return JSON.parse(t); });
}
function rawCall(action, payload) {
  var waits = [700, 1600, 3200], tries = 0, canRetry = isRead(action) || (payload && payload._rid);
  netBar(1);
  var attempt = function () {
    return netSlot().then(function () { return fetchOnce(action, payload); })
      .then(function (x) { netDone(); return x; }, function (e) {
        netDone();
        if (canRetry && tries < waits.length) { var w = waits[tries++]; return new Promise(function (r) { setTimeout(r, w); }).then(attempt); }
        throw new Error(e && e.message && !/Failed to fetch|NetworkError|Load failed/.test(e.message) ? e.message : 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่');
      });
  };
  return attempt().then(function (x) { netBar(-1); return x; }, function (e) { netBar(-1); throw e; });
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
  m.innerHTML = '<div class="box ' + (cls || '') + '"><div class="mh"><h3>' + title + '</h3><button class="iconbtn" data-close aria-label="ปิด">' + IC.x + '</button></div><div class="mb">' + body + '</div>' + (foot ? '<div class="mf">' + foot + '</div>' : '') + '</div>';
  var close = function () { m.remove(); document.removeEventListener('keydown', key); };
  var key = function (e) { if (e.key === 'Escape') close(); };
  m.addEventListener('click', function (e) { if (e.target === m || e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', key);
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
/** แท่ง: data [{label, v, ghost, color, tip}] */
function barChart(data, o) {
  o = o || {};
  var W = o.w || 760, H = o.h || 230, L = 42, B = 26, T = 10, R = 6;
  var max = Math.max(1, Math.max.apply(null, data.map(function (d) { return Math.max(d.v || 0, d.ghost || 0); })));
  var step = niceStep(max), top = Math.ceil(max / step) * step, iw = W - L - R, ih = H - T - B, bw = iw / Math.max(1, data.length), gap = Math.min(5, bw * 0.28);
  var g = '';
  for (var v = 0; v <= top + 1e-9; v += step) { var y = T + ih - v / top * ih; g += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '"/><text x="' + (L - 7) + '" y="' + (y + 4) + '" text-anchor="end">' + fmt(v, 0) + '</text>'; }
  var every = Math.ceil(data.length / (o.maxLabels || 16)), bars = '';
  data.forEach(function (d, i) {
    var x = L + i * bw + gap / 2, w = Math.max(1.5, bw - gap), h = (d.v || 0) / top * ih, y = T + ih - h, r = Math.min(4, w / 2, h);
    var path = h > 0 ? 'M' + x + ',' + (T + ih) + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + (T + ih) + 'Z' : '';
    var gh = d.ghost ? '<rect class="ghost" x="' + (x - 1) + '" y="' + (T + ih - d.ghost / top * ih) + '" width="' + (w + 2) + '" height="' + (d.ghost / top * ih) + '" rx="3"/>' : '';
    bars += '<g data-tip="' + esc(d.tip || '') + '"><rect class="hit" x="' + (L + i * bw) + '" y="' + T + '" width="' + bw + '" height="' + ih + '"/>' + gh +
      (path ? '<path class="bar" style="animation-delay:' + Math.min(0.6, i * 0.012).toFixed(3) + 's" d="' + path + '" fill="' + (d.color || 'var(--brand)') + '"/>' : '') +
      (i % every === 0 ? '<text x="' + (L + i * bw + bw / 2) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(d.label) + '</text>' : '') + '</g>';
  });
  return '<div class="chart"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.aria || '') + '"><line class="axis" x1="' + L + '" x2="' + (W - R) + '" y1="' + (T + ih) + '" y2="' + (T + ih) + '"/>' + g + bars + '</svg></div>';
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
  return list.map(function (x, i) { return '<div class="hbar"><span class="nm" title="' + esc(x[2] || x[0]) + '"><span class="rank">' + (i + 1) + '</span>' + x[0] + '</span><span class="tr"><span class="fl" style="width:' + (max ? x[1] / max * 100 : 0).toFixed(1) + '%;display:block;animation-delay:' + (i * 0.05).toFixed(2) + 's"></span></span><span class="num">' + fmt(x[1], 0) + '</span></div>'; }).join('') || '<div class="empty">' + IC.inbox + 'ยังไม่มีข้อมูล</div>';
}
function heatColor(v, max) { if (v == null) return 'var(--line-2)'; if (!v) return 'var(--heat-0)'; var k = v / (max || 1); return 'var(--heat-' + (k < .2 ? 1 : k < .4 ? 2 : k < .6 ? 3 : k < .85 ? 4 : 5) + ')'; }

/* ---------------- ล็อกอิน / โครงหน้า ---------------- */
var ROLE_TH = { nurse: 'พยาบาล', exec: 'ผู้บริหาร', admin: 'แอดมิน' };
function canEdit() { return S.me && (S.me.role === 'nurse' || S.me.role === 'admin'); }
function logout(expired) {
  S.token = null; S.me = null; S.boot = null; cacheClear(); store('token', null);
  renderLogin(expired ? 'หมดเวลาการเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่' : '');
}
function renderLogin(msg) {
  document.title = 'SMC Daily · เข้าสู่ระบบ';
  var ecg = 'M0,70 L140,70 L160,70 L172,52 L184,70 L206,70 L218,18 L232,118 L246,70 L270,70 L290,60 L312,70 L470,70 L490,70 L502,52 L514,70 L536,70 L548,18 L562,118 L576,70 L600,70 L620,60 L642,70 L800,70';
  $('#app').innerHTML = '<div class="login">' +
    '<section class="art"><div class="brand" style="padding:0"><div class="mark">' + IC.logo + '</div><div><b style="color:#fff">SMC Daily</b><span style="color:rgba(255,255,255,.75)">คลินิกพิเศษเฉพาะทางนอกเวลา</span></div></div>' +
    '<div><h1>รายงานประจำวัน<br>ไม่ต้องคัดลอกลงกระดาษ<span>ยอดผู้ป่วยขึ้นเองจากระบบโรงพยาบาล คีย์เฉพาะหัตถการ ส่งไลน์ได้ในคลิกเดียว</span></h1>' +
    '<svg class="monitor" viewBox="0 0 800 140" preserveAspectRatio="none" aria-hidden="true"><path class="base" d="' + ecg + '"/><path d="' + ecg + '"/></svg></div>' +
    '<div class="feats"><div class="feat d1"><b>ยอดจาก API</b>อัปเดตทุก 5 นาที</div><div class="feat d2"><b>คีย์ 2 นาที</b>หัตถการ 27 รายการ</div><div class="feat d3"><b>รายงาน · แดชบอร์ด</b>วัน เดือน ไตรมาส ปีงบ</div></div></section>' +
    '<section class="formside"><form id="lf" autocomplete="on"><div><div class="eyebrow">' + esc(IS_DEMO ? 'โหมดทดลองใช้' : 'โรงพยาบาลสมเด็จพระบรมราชเทวี ณ ศรีราชา') + '</div><h2>เข้าสู่ระบบ</h2></div>' +
    (msg ? '<div class="banner warn">' + esc(msg) + '</div>' : '') +
    (IS_DEMO ? '<div class="demo"><b>บัญชีทดลอง</b> รหัสผ่าน <b>demo1234</b> ทุกบัญชี<div class="row"><button type="button" class="btn btn-sm" data-u="nurse.smc">พยาบาล</button><button type="button" class="btn btn-sm" data-u="exec">ผู้บริหาร</button><button type="button" class="btn btn-sm" data-u="admin">แอดมิน</button></div></div>' : '') +
    '<label class="field" for="lu">ชื่อผู้ใช้<input id="lu" name="username" type="text" autocomplete="username" autocapitalize="none" required></label>' +
    '<label class="field" for="lp">รหัสผ่าน<input id="lp" name="password" type="password" autocomplete="current-password" required></label>' +
    '<label class="row small" for="lr"><input id="lr" type="checkbox" checked> จำการเข้าสู่ระบบ 30 วัน (เครื่องเคาน์เตอร์)</label>' +
    '<button class="btn btn-brand btn-lg" id="lb" type="submit" style="justify-content:center">เข้าสู่ระบบ</button>' +
    '<p class="xs muted" style="margin:0">ลืมรหัสผ่าน ติดต่อแอดมินของระบบ · ' + esc(typeof APP_ORG !== 'undefined' ? APP_ORG : '') + '</p></form></section></div>';
  $$('[data-u]').forEach(function (b) { b.onclick = function () { $('#lu').value = b.getAttribute('data-u'); $('#lp').value = 'demo1234'; $('#lb').click(); }; });
  $('#lf').onsubmit = function (e) {
    e.preventDefault();
    var btn = $('#lb'); btn.disabled = true; btn.innerHTML = IC.spin + ' กำลังเข้าสู่ระบบ…';
    var today = ds(new Date()), first = { action: 'getDay', payload: { date: today } };
    api('login', { username: $('#lu').value, password: $('#lp').value, remember: $('#lr').checked, withBoot: true, first: first }).then(function (r) {
      S.token = r.token; if (!IS_DEMO) store('token', r.token); applyBoot(r.boot);
      if (r.first) { var k = mkey('getDay', r.first.payload); MEMO[k] = r.first.data; MEMO_T[k] = Date.now(); }
      S.date = today; startApp();
      if (r.mustChange) changePassword(true);
    }).catch(function (err) { btn.disabled = false; btn.textContent = 'เข้าสู่ระบบ'; toast(err.message, true); });
  };
  setTimeout(function () { var u = $('#lu'); if (u) u.focus(); }, 50);
}
function applyBoot(b) { S.boot = b; S.me = b.me; store('boot', b); }
function changePassword(forced) {
  var m = modal(forced ? 'ตั้งรหัสผ่านใหม่ก่อนใช้งาน' : 'เปลี่ยนรหัสผ่าน', '<form id="cpf" style="display:flex;flex-direction:column;gap:12px">' +
    (forced ? '<p class="small muted" style="margin:0">รหัสผ่านที่ได้รับเป็นรหัสชั่วคราว กรุณาตั้งรหัสใหม่อย่างน้อย 8 ตัว</p>' : '') +
    '<label class="field" for="cp0">รหัสผ่านเดิม<input id="cp0" type="password" autocomplete="current-password" required></label>' +
    '<label class="field" for="cp1">รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)<input id="cp1" type="password" autocomplete="new-password" minlength="8" required></label>' +
    '<label class="field" for="cp2">ยืนยันรหัสผ่านใหม่<input id="cp2" type="password" autocomplete="new-password" minlength="8" required></label>' +
    '<button class="btn btn-brand" type="submit" style="align-self:flex-end">บันทึกรหัสผ่าน</button></form>', '', 'sm');
  if (forced) { var x = $('[data-close]', m); if (x) x.remove(); }
  $('#cpf', m).onsubmit = function (e) {
    e.preventDefault();
    if ($('#cp1', m).value !== $('#cp2', m).value) return toast('รหัสผ่านใหม่ 2 ช่องไม่ตรงกัน', true);
    api('changePassword', { oldPassword: $('#cp0', m).value, newPassword: $('#cp1', m).value, remember: true, _rid: rid() }).then(function (r) {
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
    '<aside class="side"><div class="brand"><div class="mark">' + IC.logo + '</div><div><b>SMC Daily</b><span>รายงานประจำวัน<br>คลินิกพิเศษเฉพาะทางนอกเวลา</span></div></div>' +
    '<nav class="nav" aria-label="เมนูหลัก">' + nav.map(function (n) { return '<button data-go="' + n[0] + '">' + IC[n[2]] + n[1] + '</button>'; }).join('') + '</nav>' +
    '<div class="who"><div class="avatar">' + esc(initials(me.name)) + '</div><div style="min-width:0"><b>' + esc(me.name) + '</b><span class="r">' + ROLE_TH[me.role] + (me.role === 'exec' ? ' · ดูอย่างเดียว' : '') + '</span></div>' +
    '<div class="tools"><button id="bpw" title="เปลี่ยนรหัสผ่าน" aria-label="เปลี่ยนรหัสผ่าน">' + IC.key + '</button><button id="bout" title="ออกจากระบบ" aria-label="ออกจากระบบ">' + IC.logout + '</button></div></div>' +
    '<div class="ver"><span class="livedot"></span>' + esc(b.app.short) + ' ' + esc(b.app.version) + ' · build ' + esc(b.app.build) + '</div></aside>' +
    '<header class="topbar"><div class="brand" style="padding:0"><div class="mark">' + IC.logo + '</div><b>SMC Daily</b></div><select id="mnav" aria-label="เมนู">' + nav.map(function (n) { return '<option value="' + n[0] + '">' + n[1] + '</option>'; }).join('') + '<option value="__pw">เปลี่ยนรหัสผ่าน</option><option value="__out">ออกจากระบบ</option></select></header>' +
    '<main class="main" id="main" tabindex="-1"></main></div><div id="printArea"></div>';
  $$('[data-go]').forEach(function (bt) { bt.onclick = function () { go(bt.getAttribute('data-go')); }; });
  $('#mnav').onchange = function (e) { var v = e.target.value; if (v === '__pw') { changePassword(); e.target.value = S.page; } else if (v === '__out') logout(); else go(v); };
  $('#bout').onclick = function () { logout(); };
  $('#bpw').onclick = function () { changePassword(); };
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
