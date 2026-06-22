import jwt from 'jsonwebtoken';
import dotenv from 'dotenv'; dotenv.config();
const SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const API = 'http://localhost:3001';
const ownerLogin = await (await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'demo@aisdr.dev', password: 'demo1234' }) })).json();
const OH = { Authorization: 'Bearer ' + ownerLogin.token, 'Content-Type': 'application/json' };
const { PrismaClient } = await import('@prisma/client'); const p = new PrismaClient();
const m = await p.user.findFirst({ where: { email: 'member@aisdr.dev' }, select: { id: true, orgId: true, email: true, role: true, tokenVersion: true } });
const memberToken = jwt.sign({ userId: m.id, orgId: m.orgId, email: m.email, role: m.role, tv: m.tokenVersion }, SECRET, { expiresIn: '7d' });
const MH = { Authorization: 'Bearer ' + memberToken, 'Content-Type': 'application/json' };

const views = await (await fetch(API + '/api/views?objectKey=deals', { headers: OH })).json();
const pipeline = views.views.find((v) => v.name === 'Pipeline');
const defaultView = await p.view.findFirst({ where: { orgId: m.orgId, isDefault: true, object: { key: 'deals' } }, select: { id: true, name: true } });
console.log('pipeline view:', pipeline?.id, '· default(system) view:', defaultView?.id, defaultView?.name);

// MEMBER read OK
const gv = await fetch(API + '/api/views?objectKey=deals', { headers: MH }); console.log('MEMBER GET /views:', gv.status, '(200 = can read/apply)');
// MEMBER create → 403
const mc = await fetch(API + '/api/views', { method: 'POST', headers: MH, body: JSON.stringify({ objectKey: 'deals', name: '__member_try__', type: 'table' }) }); console.log('MEMBER POST /views:', mc.status, (await mc.json()).code);
// MEMBER update → 403
const mu = await fetch(API + '/api/views/' + pipeline.id, { method: 'PATCH', headers: MH, body: JSON.stringify({ name: 'Hacked' }) }); console.log('MEMBER PATCH /views/pipeline:', mu.status, (await mu.json()).code);
// MEMBER delete → 403
const md = await fetch(API + '/api/views/' + pipeline.id, { method: 'DELETE', headers: MH }); console.log('MEMBER DELETE /views/pipeline:', md.status, (await md.json()).code);
// OWNER edit system view → 403
const os = await fetch(API + '/api/views/' + defaultView.id, { method: 'PATCH', headers: OH, body: JSON.stringify({ name: 'Renamed system' }) }); console.log('OWNER PATCH system view:', os.status, (await os.json()).code);
const od = await fetch(API + '/api/views/' + defaultView.id, { method: 'DELETE', headers: OH }); console.log('OWNER DELETE system view:', od.status, (await od.json()).code);
// OWNER full CRUD on a temp view → 200 + audit
const c = await (await fetch(API + '/api/views', { method: 'POST', headers: OH, body: JSON.stringify({ objectKey: 'deals', name: '__v3_tmp__', type: 'table' }) })).json(); console.log('OWNER create:', c.id ? '201 ' + c.id : JSON.stringify(c));
const u = await fetch(API + '/api/views/' + c.id, { method: 'PATCH', headers: OH, body: JSON.stringify({ name: '__v3_tmp2__' }) }); console.log('OWNER update:', u.status);
const d = await fetch(API + '/api/views/' + c.id, { method: 'DELETE', headers: OH }); console.log('OWNER delete:', d.status);
// verify pipeline intact after member attempts
const after = await (await fetch(API + '/api/views?objectKey=deals', { headers: OH })).json();
const pl = after.views.find((v) => v.id === pipeline.id);
console.log('Pipeline intact after MEMBER attempts:', pl ? 'yes name=' + pl.name : 'MISSING');
// audit events
const acts = await p.activity.findMany({ where: { orgId: m.orgId, type: { in: ['VIEW_CREATED', 'VIEW_UPDATED', 'VIEW_DELETED'] } }, orderBy: { createdAt: 'desc' }, take: 5, select: { type: true, title: true } });
console.log('recent VIEW_* audit:', JSON.stringify(acts));
await p.$disconnect();
