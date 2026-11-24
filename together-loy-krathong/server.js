// Together Loy Krathong - server (Express + Socket.IO, server-authoritative)
const express = require('express');
const http = require('http');
const crypto = require('crypto');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: process.env.CORS_ORIGIN || '*' } });
app.use(express.static('public'));
app.get('/health', (_, r) => r.json({ ok: true }));

const W = 1600, H = 1200;
const PIER = { x1: 600, x2: 900, y1: 880 }; // float zone
const rooms = new Map();
const clean = (s, n) => String(s || '').replace(/[<>]/g, '').trim().slice(0, n);
const num = (v, a, b) => Math.min(b, Math.max(a, Number(v) || 0));
const cleanAvatar = (a = {}) => ({
  gender: a.gender === 'female' ? 'female' : 'male',
  hairColor: /^#[0-9a-f]{6}$/i.test(a.hairColor) ? a.hairColor : '#3b2a20',
  hairStyle: a.hairStyle === 'long' ? 'long' : 'short',
  shirt: /^#[0-9a-f]{6}$/i.test(a.shirt) ? a.shirt : '#d9534f',
});
const cleanKr = (k) => k ? {
  type: num(k.type, 0, 6) | 0, color: /^#[0-9a-f]{6}$/i.test(k.color) ? k.color : '#ffb347',
  flower: num(k.flower, 0, 3) | 0, candle: num(k.candle, 0, 2) | 0,
  incense: !!k.incense, deco: num(k.deco, 0, 3) | 0,
} : null;

// Optional Supabase persistence (REST, no extra deps)
async function sb(code, room) {
  const { SUPABASE_URL: u, SUPABASE_SERVICE_KEY: k } = process.env;
  if (!u || !k) return;
  try {
    await fetch(`${u}/rest/v1/rooms`, {
      method: 'POST',
      headers: { apikey: k, Authorization: `Bearer ${k}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({
        code, players: Object.values(room.players).map(p => ({ name: p.name, avatar: p.avatar, krathong: p.kr })),
        floated: room.floated, updated_at: new Date().toISOString(),
      }),
    });
  } catch (e) { console.error('supabase', e.message); }
}

const pub = (p) => ({ id: p.id, name: p.name, avatar: p.avatar, x: p.x, y: p.y, dir: p.dir, connected: p.connected, kr: p.kr, pressed: p.pressed });
const snapshot = (room) => ({ code: room.code, floated: room.floated, players: Object.values(room.players).map(pub) });
const broadcast = (room) => io.to(room.code).emit('room', snapshot(room));
const genCode = () => { let c; do c = String(crypto.randomInt(0, 1000000)).padStart(6, '0'); while (rooms.has(c)); return c; };
const inZone = (p) => p.x >= PIER.x1 && p.x <= PIER.x2 && p.y >= PIER.y1;

function attach(sock, room, p) {
  p.sid = sock.id; p.connected = true;
  sock.data = { code: room.code, token: p.token };
  sock.join(room.code);
  sock.emit('joined', { code: room.code, token: p.token, id: p.id });
  broadcast(room);
}

io.on('connection', (sock) => {
  const ctx = () => { const r = rooms.get(sock.data?.code); const p = r?.players[sock.data?.token]; return r && p ? [r, p] : []; };

  sock.on('create', ({ name, avatar }, cb) => {
    name = clean(name, 12);
    if (!name) return cb?.({ error: 'กรุณาตั้งชื่อตัวละคร' });
    const code = genCode();
    const room = { code, players: {}, floated: false, countdown: false, lastSeen: Date.now() };
    const token = crypto.randomUUID();
    room.players[token] = { id: 1, token, name, avatar: cleanAvatar(avatar), x: 220, y: 240, dir: 'down', kr: null, pressed: false, t: Date.now() };
    rooms.set(code, room);
    attach(sock, room, room.players[token]);
    sb(code, room);
    cb?.({ ok: true });
  });

  sock.on('join', ({ code, name, avatar }, cb) => {
    const room = rooms.get(clean(code, 6));
    name = clean(name, 12);
    if (!name) return cb?.({ error: 'กรุณาตั้งชื่อตัวละคร' });
    if (!room) return cb?.({ error: 'ไม่พบห้องนี้' });
    if (Object.keys(room.players).length >= 2) return cb?.({ error: 'ห้องเต็มแล้ว' });
    const token = crypto.randomUUID();
    room.players[token] = { id: 2, token, name, avatar: cleanAvatar(avatar), x: 280, y: 240, dir: 'down', kr: null, pressed: false, t: Date.now() };
    attach(sock, room, room.players[token]);
    sb(room.code, room);
    cb?.({ ok: true });
  });

  // reconnect with secret token only (authorises room access)
  sock.on('rejoin', ({ code, token }, cb) => {
    const room = rooms.get(String(code));
    const p = room?.players[token];
    if (!p) return cb?.({ error: 'ไม่พบห้องหรือหมดเวลา' });
    attach(sock, room, p);
    cb?.({ ok: true });
  });

  sock.on('move', (m) => {
    const [r, p] = ctx(); if (!p || r.countdown) return;
    const now = Date.now(), dt = Math.min(1, (now - p.t) / 1000); p.t = now;
    let x = num(m.x, 0, W), y = num(m.y, 0, H);
    const maxD = 260 * dt + 24; // anti-teleport / speed clamp
    if (Math.hypot(x - p.x, y - p.y) > maxD) return sock.emit('snap', { x: p.x, y: p.y });
    p.x = x; p.y = y; p.dir = ['up', 'down', 'left', 'right'].includes(m.dir) ? m.dir : p.dir;
    sock.to(r.code).emit('p', { id: p.id, x, y, dir: p.dir, moving: !!m.moving });
  });

  sock.on('krathong', (k) => { const [r, p] = ctx(); if (!p) return; p.kr = cleanKr(k); broadcast(r); sb(r.code, r); });
  sock.on('chat', (t) => { const [r, p] = ctx(); if (!p) return; t = clean(t, 120); if (t) io.to(r.code).emit('chat', { id: p.id, name: p.name, text: t }); });
  sock.on('emote', (e) => {
    const [r, p] = ctx(); if (!p) return;
    if (['heart', 'smile', 'wave', 'sit', 'hold', 'call', 'pose'].includes(e)) io.to(r.code).emit('emote', { id: p.id, e });
  });

  sock.on('float:press', () => {
    const [r, p] = ctx(); if (!p || r.floated || r.countdown) return;
    if (!p.kr || !inZone(p)) return sock.emit('toast', 'ต้องถือกระทงและยืนที่ท่าเรือก่อน');
    p.pressed = true; broadcast(r);
    const all = Object.values(r.players);
    if (all.length === 2 && all.every(q => q.pressed && q.connected && q.kr && inZone(q))) {
      r.countdown = true;
      const now = Date.now();
      io.to(r.code).emit('float:start', { now, startAt: now + 3000 }); // clients delay by (startAt-now)
      setTimeout(() => { r.floated = true; r.countdown = false; all.forEach(q => q.pressed = false); broadcast(r); sb(r.code, r); }, 3500);
    }
  });
  sock.on('float:cancel', () => { const [r, p] = ctx(); if (p && !r.countdown) { p.pressed = false; broadcast(r); } });
  sock.on('float:again', () => { const [r] = ctx(); if (r) { r.floated = false; broadcast(r); } });
  sock.on('ping2', (cb) => cb?.(Date.now()));

  sock.on('disconnect', () => {
    const [r, p] = ctx(); if (!p || p.sid !== sock.id) return;
    p.connected = false; p.pressed = false; r.lastSeen = Date.now(); broadcast(r);
  });
});

// cleanup rooms abandoned for 30 minutes
setInterval(() => {
  for (const [c, r] of rooms) if (Object.values(r.players).every(p => !p.connected) && Date.now() - r.lastSeen > 30 * 60 * 1000) rooms.delete(c);
}, 60 * 1000);

server.listen(process.env.PORT || 3000, () => console.log('Together Loy Krathong on :' + (process.env.PORT || 3000)));
