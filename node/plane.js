'use strict';
// The control plane as people use it, rebuilt after the audit of the real console (CURRENT_VANIK_OS.md, Oct 2026):
// more than one device with a register flow, document sources (Google Drive, SharePoint, Confluence) beside the folder source,
// API keys with a scope, a daily limit and an end date, usage across apps, notifications, a training request,
// and what a person who is not an admin needs on their own home. Loaded by server.js.
const crypto = require('crypto');
module.exports = function install(ctx) {
  const { db, on, err, uid, now, audit, isAdmin, A, byId, allowed, DEMO } = ctx;
  const P = db.plane = db.plane || {};
  P.devices = P.devices || []; P.sources = P.sources || []; P.train = P.train || []; P.seen = P.seen || {};
  const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
  const host = () => (db.edge && db.edge.network && (db.edge.network.domain || db.edge.network.local)) || 'vanik.local';

  // ---------- devices: the one this console runs on, and others registered with a one-time code
  const serving = () => db.models.filter(m => m.status === 'serving').length;
  const primary = () => ({ id: db.device.id, name: db.device.name, primary: true, status: db.device.online ? 'online' : 'offline', address: db.device.ip, agent: db.device.agent, memGb: db.device.memGb, usedGb: ctx.usedGb(), diskTb: db.device.diskTb || 3.6, apps: (db.app.status === 'not_installed' ? 0 : 1) + ctx.suiteApps().length, models: serving(), slots: db.device.slots, seenAt: db.device.online ? now() : db.device.offlineAt || null });
  const dView = d => ({ id: d.id, name: d.name, hostname: d.hostname, primary: false, status: 'waiting', createdAt: d.createdAt, by: d.by, tokenAt: d.tokenAt });
  const command = (d, raw) => `curl -fsSL https://${host()}/agent/install.sh | sudo VANIK_PLANE=https://${host()} VANIK_TOKEN=${raw} sh`;
  const newToken = d => { const raw = 'vnk-reg-' + crypto.randomBytes(12).toString('hex'); d.tokenHash = sha(raw); d.tokenAt = now(); return raw; };
  on('GET', '/api/plane/devices', () => [primary(), ...P.devices.map(dView)], A);
  on('POST', '/api/plane/devices', ({ u, body }) => {
    const name = String(body.name || '').trim().replace(/\s+/g, ' ').slice(0, 40); if (name.length < 2) throw err(400, 'Give the device a name, for example Plant 2 server.');
    if (name === db.device.name || P.devices.some(d => d.name.toLowerCase() === name.toLowerCase())) throw err(409, 'A device already has that name.');
    const d = { id: uid('dev'), name, hostname: String(body.hostname || '').trim().slice(0, 80), createdAt: now(), by: u.name }; const raw = newToken(d); P.devices.push(d);
    audit(u, 'Registered a device', name, 'Waiting for it to check in'); return { device: dView(d), token: raw, command: command(d, raw) };
  }, A);
  on('POST', '/api/plane/devices/:id/token', ({ u, p }) => { const d = byId(P.devices, p.id, 'Device'), raw = newToken(d); audit(u, 'Made a new install command for a device', d.name, 'Commands copied earlier no longer work'); return { device: dView(d), token: raw, command: command(d, raw) }; }, A);
  on('PATCH', '/api/plane/devices/:id', ({ u, p, body }) => { const name = String(body.name || '').trim().slice(0, 40); if (name.length < 2) throw err(400, 'A device needs a name.'); if (p.id === db.device.id) { db.device.name = name; audit(u, 'Renamed the appliance', name); return primary(); } const d = byId(P.devices, p.id, 'Device'); d.name = name; if (body.hostname !== undefined) d.hostname = String(body.hostname).trim().slice(0, 80); audit(u, 'Changed a device', name); return dView(d); }, A);
  on('GET', '/api/plane/devices/:id/impact', ({ p }) => p.id === db.device.id ? { canDelete: false, why: 'This console runs on it. To retire it, move the plane first.' } : { canDelete: true, apps: 0, models: 0, why: 'Nothing is installed on it yet.' }, A);
  on('DELETE', '/api/plane/devices/:id', ({ u, p }) => { if (p.id === db.device.id) throw err(409, 'This console runs on that device, so it cannot be deleted from here.'); const d = byId(P.devices, p.id, 'Device'); P.devices = P.devices.filter(x => x !== d); audit(u, 'Deleted a device', d.name); return { ok: true }; }, A);

  // ---------- document sources that fill a collection. The word "sample" in place of a credential uses stored sample files.
  const KINDS = {
    drive: { name: 'Google Drive', unit: 'shared drives and folders', need: [['keyFile', 'Service-account key']], secret: ['keyFile'], sample: 'keyFile' },
    sharepoint: { name: 'SharePoint', unit: 'document libraries', need: [['tenantId', 'Directory (tenant) id'], ['clientId', 'Application (client) id'], ['clientSecret', 'Client secret']], secret: ['clientSecret'], sample: 'clientSecret' },
    confluence: { name: 'Confluence', unit: 'spaces and pages', need: [['baseUrl', 'Confluence address'], ['email', 'Account email'], ['token', 'API token']], secret: ['token'], sample: 'token' },
  };
  const EVERY = { hour: 'Every hour', six: 'Every 6 hours', day: 'Every day', week: 'Every week', manual: 'Only when you press Sync now' };
  const FILES = {
    drive: [['Travel desk FAQ.md', '# Travel desk FAQ (sample from Google Drive)\n\nBook flights at least 7 days ahead through the travel desk. A cab to the airport is covered up to 1,500 rupees each way. Keep the boarding pass for the claim.'], ['Vendor onboarding checklist.md', '# Vendor onboarding checklist (sample from Google Drive)\n\nCollect the GST certificate, the PAN card, a cancelled cheque and a bank letter. A vendor is active only after Finance verifies the bank account with a one rupee transfer.']],
    sharepoint: [['Quality manual extract.md', '# Quality manual, section 7 (sample from SharePoint)\n\nEvery incoming lot of fasteners is sampled at 2 percent. A lot fails if more than one piece in the sample is outside tolerance. Failed lots are returned within 5 working days.'], ['Plant safety rules.md', '# Plant safety rules (sample from SharePoint)\n\nHelmets and safety shoes are required on the shop floor. Report a near miss the same shift, to the shift in-charge.']],
    confluence: [['Engineering onboarding.md', '# Engineering onboarding (sample from Confluence)\n\nNew joiners get a laptop on day one and repository access by day two. The first week ends with a walkthrough of the deployment pipeline.'], ['Release checklist.md', '# Release checklist (sample from Confluence)\n\nFreeze the branch on Tuesday. Run the regression suite. Two approvals are needed before a release on Thursday.']],
  };
  const isSample = (kind, cfg) => String(cfg[KINDS[kind].sample] || '').trim().toLowerCase() === 'sample';
  const clean = (kind, c) => { const K = KINDS[kind], out = {}; [...K.need.map(n => n[0]), 'siteUrl', 'actAs', 'hosting'].forEach(k => { if (c && c[k] !== undefined) out[k] = String(c[k]).trim().slice(0, k === 'keyFile' ? 6000 : 300); }); return out; };
  const missing = (kind, c) => KINDS[kind].need.filter(([k]) => !c[k]).map(n => n[1]);
  const sView = s => { const K = KINDS[s.kind], col = db.collections.find(c => c.id === s.collectionId); return { id: s.id, kind: s.kind, kindName: K.name, name: s.name, collectionId: s.collectionId, collection: col ? col.name : 'Deleted collection', every: s.every, everyLabel: EVERY[s.every], paused: !!s.paused, state: s.paused ? 'paused' : s.error ? 'failed' : s.syncedAt ? 'connected' : 'waiting', error: s.error || '', syncedAt: s.syncedAt || null, stats: s.stats || { added: 0, same: 0 }, by: s.by, createdAt: s.createdAt, settings: Object.fromEntries(Object.entries(s.config).map(([k, v]) => [k, K.secret.includes(k) ? 'Stored. Never shown again.' : v])) }; };
  function test(kind, cfg) {
    const K = KINDS[kind]; if (!K) throw err(400, 'Unknown kind of source.'); const miss = missing(kind, cfg); if (miss.length) return { ok: false, detail: 'Fill in first: ' + miss.join(', ') + '.' };
    if (kind === 'confluence' && !isSample(kind, cfg) && !/^https:\/\//.test(cfg.baseUrl)) return { ok: false, detail: 'The Confluence address starts with https://.' };
    if (kind === 'drive' && !isSample(kind, cfg)) { try { const j = JSON.parse(cfg.keyFile); if (j.type !== 'service_account') return { ok: false, detail: 'That is not a service-account key file.' }; } catch { return { ok: false, detail: 'That is not a service-account key file.' }; } }
    return isSample(kind, cfg) ? { ok: true, detail: `Reached the sample ${K.name}. ${FILES[kind].length} files can be read.` } : { ok: false, detail: `This build cannot reach ${K.name}. On the appliance the check runs from the plane with what you entered.` };
  }
  function sync(u, s) {
    const col = db.collections.find(c => c.id === s.collectionId); if (!col) { s.error = 'Its collection was deleted.'; return s; }
    if (!isSample(s.kind, s.config)) { s.error = `Could not reach ${KINDS[s.kind].name} from this build.`; return s; }
    let added = 0, same = 0; for (const [name, text] of FILES[s.kind]) { if (db.documents.some(d => d.collectionId === col.id && d.name === name)) { same++; continue; } ctx.addDocument(u, col.id, { name, type: 'md', size: text.length, pages: [text], paged: false, purpose: 'From ' + KINDS[s.kind].name }, true); added++; }
    s.error = ''; s.syncedAt = now(); s.stats = { added: (s.stats ? s.stats.added : 0) + added, same }; return s;
  }
  on('GET', '/api/plane/sources', () => ({ sources: P.sources.map(sView), kinds: Object.entries(KINDS).map(([id, k]) => ({ id, name: k.name, unit: k.unit })), every: EVERY }), A);
  on('POST', '/api/plane/sources/test', ({ body }) => test(body.kind, clean(body.kind in KINDS ? body.kind : 'drive', body.config)), A);
  on('POST', '/api/plane/sources', ({ u, body }) => {
    const K = KINDS[body.kind]; if (!K) throw err(400, 'Unknown kind of source.'); const cfg = clean(body.kind, body.config), miss = missing(body.kind, cfg); if (miss.length) throw err(400, 'Fill in first: ' + miss.join(', ') + '.');
    const col = byId(db.collections, body.collectionId, 'Collection'), s = { id: uid('src'), kind: body.kind, name: String(body.name || K.name).trim().slice(0, 60) || K.name, config: cfg, collectionId: col.id, every: EVERY[body.every] ? body.every : 'day', by: u.name, createdAt: now() };
    P.sources.push(s); sync(u, s); audit(u, 'Connected a document source', `${K.name} into ${col.name}`, s.error || `${s.stats.added} files copied`); return sView(s);
  }, A);
  const src = id => byId(P.sources, id, 'Source');
  on('POST', '/api/plane/sources/:id/sync', ({ u, p }) => { const s = src(p.id); if (s.paused) throw err(409, 'This source is paused. Resume it first.'); sync(u, s); return sView(s); }, A);
  on('PATCH', '/api/plane/sources/:id', ({ u, p, body }) => { const s = src(p.id); if (body.paused !== undefined) { s.paused = !!body.paused; audit(u, s.paused ? 'Paused a document source' : 'Resumed a document source', s.name); } if (EVERY[body.every]) s.every = body.every; return sView(s); }, A);
  on('DELETE', '/api/plane/sources/:id', ({ u, p }) => { const s = src(p.id); P.sources = P.sources.filter(x => x !== s); audit(u, 'Disconnected a document source', s.name, 'Documents already copied stay in the collection'); return { ok: true }; }, A);

  // ---------- API keys with a scope, a daily limit and an end date (checked in the gateway)
  on('POST', '/api/plane/keys', ({ u, body }) => {
    const name = String(body.name || '').trim().slice(0, 40); if (!name) throw err(400, 'Name the key for where it will be used.');
    const { k, raw } = ctx.issueKey(name, u.name); k.knowledge = body.knowledge === 'all' ? 'all' : Array.isArray(body.knowledge) ? body.knowledge.filter(id => db.collections.some(c => c.id === id)) : 'none';
    k.models = Array.isArray(body.models) ? body.models.filter(id => db.models.some(m => m.id === id)).slice(0, 20) : []; k.dailyLimit = Math.max(0, Math.min(1e6, Math.round(+body.dailyLimit || 0)));
    k.expiresOn = /^\d{4}-\d{2}-\d{2}$/.test(body.expiresOn || '') ? body.expiresOn : ''; if (k.expiresOn && k.expiresOn < now().slice(0, 10)) throw err(400, 'The end date is in the past.');
    audit(u, 'Created an API key', name, [k.models.length ? k.models.length + ' models' : 'Every model', k.dailyLimit ? k.dailyLimit + ' requests a day' : 'No daily limit', k.expiresOn ? 'ends ' + k.expiresOn : 'no end date'].join(', '));
    return { id: k.id, name: k.name, last4: k.last4, key: raw };
  }, A);
  // called by the gateway for every request made with a key; returns a reason to refuse, or nothing
  function keyGate(k, model) {
    const today = now().slice(0, 10);
    if (k.expiresOn && k.expiresOn < today) return [401, 'key_expired', 'This API key ended on ' + k.expiresOn + '.'];
    if (model && k.models && k.models.length && !k.models.includes(model)) return [403, 'model_not_allowed', `This key cannot call "${model}". It is limited to: ${k.models.join(', ')}.`];
    if (k.dailyLimit) { if (!k.day || k.day.d !== today) k.day = { d: today, n: 0 }; if (k.day.n >= k.dailyLimit) return [429, 'daily_limit_reached', `This key is limited to ${k.dailyLimit} requests a day.`]; k.day.n++; }
    return null;
  }

  // ---------- activity: who used what. Chats by day; keys and apps as totals, because that is all that is recorded.
  const APP_OF = [[/^Read a document|^Approved a document|^Exported approved|^Reopened a document/, 'Document processing'], [/request$|^Logged a request|Desk settings/, 'Vanik Desk'], [/meeting|transcript/, 'Vanik Echo'], [/resume|hiring|shortlist|job/i, 'Vanik Scout'], [/quantity|drawing set|bill of quantities/, 'Vanik MeasureBook']];
  on('GET', '/api/plane/activity', ({ q }) => {
    const days = [1, 7, 30, 90].includes(+(q && q.get('days'))) ? +q.get('days') : 7, since = new Date(Date.now() - days * 864e5).toISOString(), per = {}, byDay = {};
    for (let i = Math.min(days, 30) - 1; i >= 0; i--) byDay[new Date(Date.now() - i * 864e5).toISOString().slice(0, 10)] = 0;
    let questions = 0, tokens = 0;
    for (const c of db.chats) for (const m of c.messages) { if (m.at < since) continue; if (m.role === 'user') { questions++; if (byDay[m.at.slice(0, 10)] !== undefined) byDay[m.at.slice(0, 10)]++; const x = per[c.userId] || (per[c.userId] = { questions: 0, actions: 0, last: m.at }); x.questions++; if (m.at > x.last) x.last = m.at; } else tokens += (m.tokensIn || 0) + (m.tokensOut || 0); }
    const apps = { VanikGPT: questions };
    for (const e of db.audit) { if (e.at < since) continue; const hit = APP_OF.find(([re]) => re.test(e.action)); if (!hit) continue; apps[hit[1]] = (apps[hit[1]] || 0) + 1; const x = per[e.userId] || (per[e.userId] = { questions: 0, actions: 0, last: e.at }); x.actions++; if (e.at > x.last) x.last = e.at; }
    const keys = db.keys.filter(k => !k.revokedAt).map(k => ({ name: k.name, by: k.createdBy, requests: k.requests || 0, tokens: k.tokens || 0, lastUsedAt: k.lastUsedAt, system: !!k.system }));
    const people = Object.entries(per).map(([id, x]) => ({ name: (db.users.find(u => u.id === id) || { name: 'Someone who has left' }).name, ...x })).sort((a, b) => b.questions + b.actions - a.questions - a.actions);
    const csv = ['Person,Questions in VanikGPT,Actions in other apps,Last active', ...people.map(p => `"${p.name}",${p.questions},${p.actions},${p.last}`)].join('\n');
    return { days, questions, tokens, activePeople: people.length, people, apps: Object.entries(apps).map(([name, n]) => ({ name, n })).filter(a => a.n).sort((a, b) => b.n - a.n), byDay: Object.entries(byDay).map(([day, n]) => ({ day, n })), keys, apiRequests: keys.reduce((a, k) => a + k.requests, 0), csv };
  }, A);
  on('GET', '/api/plane/apps/:id/activity', ({ p }) => { const names = { vanikgpt: 'VanikGPT', ...Object.fromEntries(ctx.suiteApps().map(a => [a.id, a.name])) }, name = names[p.id]; if (!name) throw err(404, 'App not found'); const verbs = APP_OF.find(x => x[1] === name); return db.audit.filter(e => e.target.includes(name) || e.action.includes(name) || (verbs && verbs[0].test(e.action))).slice(0, 40).map(e => ({ at: e.at, who: e.userName, what: e.action, on: e.target, detail: e.detail })); }, A);

  // ---------- notifications: what needs someone now, then what changed recently
  const NOTE = /^(Installed|Uninstalled|Stopped|Started) an app|Rolled|Opened the appliance|Closed the appliance|Connected|Disconnected|Revoked|Removed|Restarted|Shut|support session|recovery key|outside model|Registered a device|Deleted a device|Finished set-up|Changed who can|factory reset|Invited/;
  on('GET', '/api/plane/notifications', ({ u }) => { const seen = P.seen[u.id] || '', recent = db.audit.filter(e => NOTE.test(e.action)).slice(0, 20).map(e => ({ at: e.at, text: `${e.userName}: ${e.action.charAt(0).toLowerCase() + e.action.slice(1)}${e.target ? ' (' + e.target + ')' : ''}`, fresh: e.at > seen && e.userId !== u.id })); return { now: ctx.attention(), recent, unseen: ctx.attention().length + recent.filter(r => r.fresh).length }; }, A);
  on('POST', '/api/plane/notifications/seen', ({ u }) => { P.seen[u.id] = now(); return { ok: true }; }, A);

  // ---------- a request to train a model on the tenant's own data. It is a request to Vanik, not a job that runs here.
  on('GET', '/api/plane/train', () => P.train, A);
  on('POST', '/api/plane/train', ({ u, body }) => { const goal = String(body.goal || '').trim().slice(0, 400); if (goal.length < 10) throw err(400, 'Say in a sentence what the model should do.'); const r = { id: uid('tr'), goal, data: ['Documents', 'Support tickets', 'Code', 'Chat logs', 'Structured data', 'Not sure yet'].includes(body.data) ? body.data : 'Not sure yet', size: ['Under 10,000 documents', '10,000 to 100,000 documents', 'Over 100,000 documents'].includes(body.size) ? body.size : 'Under 10,000 documents', base: db.models.some(m => m.id === body.base) ? body.base : '', by: u.name, at: now(), status: 'Sent to Vanik' }; P.train.unshift(r); audit(u, 'Asked for a quote to train a model', r.data, goal.slice(0, 80)); return r; }, A);

  // ---------- what a person who is not an admin sees first: their apps, their documents, who to ask
  on('GET', '/api/me/home', ({ u }) => ({
    apps: [...(ctx.canUseGpt(u) ? [{ id: 'vanikgpt', name: 'VanikGPT', what: 'Ask questions and get answers from your company documents.', icon: 'forum', href: '#/gpt' }] : []), ...ctx.suiteBoot(u).apps.filter(a => a.canUse).map(a => ({ id: a.id, name: a.name, what: a.what, icon: a.icon, href: '#/app/' + a.id }))],
    collections: db.collections.filter(c => allowed(c.access, u)).map(c => ({ id: c.id, name: c.name, description: c.description || '', documents: db.documents.filter(d => d.collectionId === c.id).length, canAdd: ctx.canWrite(u, c) })),
    keysAllowed: !!(db.edge && db.edge.userKeys) || isAdmin(u), admins: db.users.filter(isAdmin).map(x => ({ name: x.name, email: x.email })), tasks: ctx.openTasks(u), appliance: { name: db.device.name, online: db.device.online },
  }));

  // sample: a second device waiting to check in, and one connected source
  function sample() {
    if (P.sampled || !DEMO) return; P.sampled = true; const owner = db.users.find(x => x.role === 'owner');
    if (!P.devices.length) { const d = { id: uid('dev'), name: 'Plant 2 server', hostname: 'plant2-ai', createdAt: new Date(Date.now() - 2 * 864e5).toISOString(), by: owner.name }; newToken(d); P.devices.push(d); }
    const hr = db.collections.find(c => /HR/.test(c.name)); if (hr && !P.sources.length) { const s = { id: uid('src'), kind: 'drive', name: 'HR shared drive', config: { keyFile: 'sample' }, collectionId: hr.id, every: 'day', by: owner.name, createdAt: now() }; P.sources.push(s); sync(owner, s); }
  }
  return { keyGate, sample };
};
