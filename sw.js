/* sw.js : ให้ติดตั้งเป็นแอปบนโทรศัพท์/คอมพิวเตอร์ได้ (10 พ.ย. 69)
 * ไม่เก็บแคชไฟล์ใด ๆ — ทุกครั้งโหลดจากเซิร์ฟเวอร์ (ไม่มีปัญหาหน้าเว็บค้างรุ่นเก่า)
 * ออฟไลน์: แสดงข้อความแจ้งให้ต่ออินเทอร์เน็ต */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function (e) {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(function () {
    return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:sans-serif;padding:40px 20px;text-align:center;color:#333"><h2>ไม่มีการเชื่อมต่ออินเทอร์เน็ต</h2><p>กรุณาเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่</p><button onclick="location.reload()" style="padding:10px 20px;font-size:16px">ลองใหม่</button></body>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }));
});
