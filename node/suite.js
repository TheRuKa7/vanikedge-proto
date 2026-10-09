'use strict';
// The rest of the Vanik Edge suite, from the master roadmap (Oct 2026): the five other apps in the store with install, health, access and a
// gateway key from the platform; a first working slice of each app; first-run set-up with a recovery key; the plan the appliance was sold on;
// models brought in from a file; and an evidence pack built from what the appliance is really set to do. Loaded by server.js.
const crypto = require('crypto');
module.exports = function install(ctx) {
  const { db, on, err, uid, now, audit, isAdmin, A, byId, allowed, cleanAccess, search, DEMO } = ctx;
  const S = db.suite = db.suite || {};
  S.apps = S.apps || {}; S.idp = S.idp || { docs: [] }; S.desk = S.desk || { tickets: [], seq: 1000, collectionId: '', firstHours: 4, resolveHours: 24 };
  S.echo = S.echo || { meetings: [] }; S.scout = S.scout || { jobs: [] }; S.mb = S.mb || { sets: [] };
  S.plan = S.plan || { tier: 'Department', people: 200, hardware: 'One GPU, 96 GB', renewsOn: new Date(Date.now() + 300 * 864e5).toISOString().slice(0, 10), offline: false };
  if (S.setup === undefined) S.setup = DEMO || db.users.length > 1 ? { doneAt: now(), by: 'Vanik' } : null;
  const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
  const person = id => db.users.find(u => u.id === id);
  const label = a => !a || a.mode === 'everyone' ? 'Everyone' : (a.teams.length + a.users.length ? [...a.teams, ...a.users.map(i => (person(i) || { name: 'Someone' }).name)].join(', ') : 'Admins only');

  // ---------- the apps: what each is, what it needs, how it is doing
  const APPS = {
    idp: { name: 'Document processing', what: 'Pull chosen fields from invoices, orders and forms into a table, check them, and send them on.', icon: 'description', needsGb: 4, port: 9008, model: 'chat', noModel: 'No chat model serving. Documents written as label and value still work.', data: () => [S.idp.docs.length > 0, `${S.idp.docs.length} documents read, ${S.idp.docs.filter(d => d.status === 'review').length} waiting for a person`] },
    desk: { name: 'Vanik Desk', what: 'One queue for requests, with timers and a reply drafted from your knowledge base.', icon: 'support_agent', needsGb: 3, port: 9015, model: 'chat', noModel: 'No chat model serving. Drafts are built from passages as they are written.', data: () => { const c = db.collections.find(x => x.id === S.desk.collectionId); return [!!c, c ? 'Drafts from ' + c.name : 'No collection chosen to draft from']; } },
    echo: { name: 'Vanik Echo', what: 'Live meeting transcription with speaker labels, on your own Vanik Appliance.', icon: 'graphic_eq', needsGb: 4, port: 9014, model: 'speech', noModel: 'No speech model in the Model Hub. Meetings play the stored sample.', data: () => [true, `${R().echo.meetings.length} meetings kept on this appliance`] },
    mbot: { name: 'Vanik mBot', what: 'Teams meeting summaries, action items and a chat assistant over every meeting.', icon: 'smart_toy', needsGb: 2, port: 9018, model: 'chat', noModel: 'No chat model serving. Summaries are picked out by plain rules.', data: () => [true, `${R().mbot.meetings.length} meetings, ${R().mbot.meetings.reduce((a, m) => a + m.actions.filter(x => x.status === 'open').length, 0)} open actions`] },
    scout: { name: 'Vanik Scout', what: 'Rank a backlog of resumes against an ideal job profile, with its reasoning shown.', icon: 'person_search', needsGb: 3, port: 9007, model: 'chat', noModel: 'No chat model serving. Profiles are read by plain rules, not a model.', data: () => [true, `${R().scout.docs.length} resumes indexed in ${R().scout.collections.length} collections`] },
    measurebook: { name: 'Vanik MeasureBook', what: 'Turn tender drawings into a bid-ready BOQ, with every quantity traceable.', icon: 'straighten', needsGb: 9, port: 9013, model: 'vision', noModel: 'No drawing model serving. Takeoffs come from the stored sample sheets.', data: () => [true, `${Object.keys(R().mb.jobs).length} takeoffs run`] },
  };
  const R = () => db.real || { echo: { meetings: [] }, mbot: { meetings: [] }, scout: { docs: [], collections: [] }, mb: { jobs: {} } };
  const CAT = { idp: 'Document AI', desk: 'Customer Support', echo: 'Meetings', mbot: 'Meetings', scout: 'HR and Recruiting', measurebook: 'Document AI' };
  // the roles each app declares. The first is what a person gets when none is picked.
  const ROLES = {
    idp: [['Operator', 'Upload, correct fields, send for approval'], ['Approver', 'Approve or reject, export'], ['Template designer', 'Change document types, fields and checks'], ['App admin', 'Queues, retention, keys'], ['Auditor', 'Read any history']],
    desk: [['Agent', 'Work requests, reply, note'], ['Team lead', 'Reassign, change priority, see reports'], ['Desk admin', 'Channels, targets, rules'], ['Collaborator', 'Read one request and add a note'], ['Auditor', 'Read any request']],
    echo: [['Member', 'Record and read their own meetings'], ['Echo admin', 'Languages, models, retention. Not transcripts'], ['Compliance reviewer', 'Open any meeting under a stated reason']],
    mbot: [['Member', 'Their own meetings and actions'], ['mBot admin', 'Settings and retention. Not transcripts']],
    scout: [['Recruiter', 'Upload, search, shortlist, reject, export'], ['Hiring manager', 'Read the shortlist for their own roles'], ['Scout admin', 'Models, index, collections, erasure'], ['Auditor', 'Read the decision record']],
    measurebook: [['Estimator', 'Upload, correct, measure, export'], ['Reviewer', 'Approve a bill'], ['Viewer', 'Read and download'], ['MeasureBook admin', 'Rate books, rules, the model']],
  };
  const TOP = { idp: 'App admin', desk: 'Desk admin', echo: 'Echo admin', mbot: 'mBot admin', scout: 'Scout admin', measurebook: 'MeasureBook admin' };
  const roleOf = (u, id) => { const a = S.apps[id], names = ROLES[id].map(r => r[0]); if (!a) return ''; const r = a.roles || {}, own = r['u:' + u.id], team = (u.teams || []).map(t => r['t:' + t]).find(Boolean); return names.includes(own) ? own : names.includes(team) ? team : isAdmin(u) ? TOP[id] : names[0]; };
  const cleanRoles = (id, v) => { const names = ROLES[id].map(r => r[0]), out = {}; for (const [k, r] of Object.entries(v || {})) if (/^[ut]:.{1,60}$/.test(k) && names.includes(r) && r !== names[0]) out[k] = r; return out; };
  const ORDER = Object.keys(APPS);
  const def = id => { if (!APPS[id]) throw err(404, 'App not found'); return APPS[id]; };
  const usedGb = () => ORDER.reduce((a, id) => a + (S.apps[id] && S.apps[id].status === 'running' ? APPS[id].needsGb : 0), 0);
  const canUse = (u, id) => !!S.apps[id] && S.apps[id].status === 'running' && db.device.online && allowed(S.apps[id].access, u);
  const need = (u, id) => { const a = S.apps[id], d = def(id); if (!a || a.status !== 'running') throw err(503, d.name + ' is not running.'); if (!db.device.online) throw err(503, 'The Vanik Appliance is offline.'); if (!allowed(a.access, u)) throw err(403, 'You do not have access to ' + d.name + '.'); };
  function health(id) {
    const a = S.apps[id], d = APPS[id], up = db.device.online, run = !!a && a.status === 'running', m = db.models.find(x => x.kind === d.model && x.status === 'serving'), key = db.keys.find(k => k.system && k.name === d.name && !k.revokedAt), dat = d.data();
    return [{ name: 'Device', state: up ? 'ok' : 'err', detail: up ? db.device.name + ' is online' : 'The appliance is offline' },
      { name: 'App', state: run && up ? 'ok' : 'err', detail: run ? (up ? 'Running on port ' + d.port : 'Stopped with the appliance') : 'Stopped' },
      { name: 'Model', state: m ? 'ok' : 'warn', detail: m ? 'Using ' + m.id : d.noModel },
      { name: 'Gateway key', state: key ? 'ok' : 'err', detail: key ? 'Issued by Vanik OS, ends …' + key.last4 : 'No key. Stop and start the app to issue one.' },
      { name: 'Access', state: 'ok', detail: label(a && a.access) },
      { name: 'Data', state: dat[0] ? 'ok' : 'warn', detail: dat[1] }];
  }
  const appView = (id, u, full) => { const a = S.apps[id], d = APPS[id]; return { id, name: d.name, what: d.what, icon: d.icon, cat: CAT[id], needsGb: d.needsGb, port: d.port, status: a ? a.status : 'not_installed', canUse: canUse(u, id), role: canUse(u, id) ? roleOf(u, id) : '', ...(full && a ? { installedAt: a.installedAt, by: a.by, access: a.access, roles: a.roles || {}, roleList: ROLES[id], requests: a.requests || [], health: health(id) } : {}) }; };
  const boot = u => ({ apps: ORDER.map(id => appView(id, u, false)).filter(a => isAdmin(u) || a.canUse), setupDone: !!S.setup, plan: isAdmin(u) ? planView() : null });
  const planView = () => ({ ...S.plan, hardware: db.device.memGb + ' GB of GPU memory', used: db.users.length, over: db.users.length > S.plan.people });
  const view = u => ({ apps: ORDER.map(id => appView(id, u, true)), setup: S.setup, recovery: S.recovery ? { createdAt: S.recovery.createdAt, by: S.recovery.by } : null, plan: planView() });
  on('GET', '/api/suite', ({ u }) => view(u), A);
  function installApp(u, id) {
    const d = def(id); if (S.apps[id]) throw err(409, d.name + ' is already installed.');
    if (d.needsGb > ctx.freeGb()) throw err(409, `${d.name} needs ${d.needsGb} GB and ${ctx.freeGb()} GB is free. Park a model first.`);
    S.apps[id] = { status: 'running', installedAt: now(), by: u.name, access: { mode: 'everyone', teams: [], users: [] } };
    ctx.issueKey(d.name, 'Vanik OS', true);
    if (id === 'measurebook' && !db.models.some(m => m.kind === 'vision')) db.models.push({ id: 'qwen3-vl-8b-instruct', kind: 'vision', memGb: 12, context: 32768, status: 'available', port: null, note: 'Reads drawings and images' });
    if (id === 'desk' && !S.desk.collectionId && db.collections[0]) S.desk.collectionId = db.collections[0].id;
    audit(u, 'Installed an app', d.name, 'Gateway key issued by Vanik OS');
  }
  on('POST', '/api/suite/apps/:id/install', ({ u, p }) => { installApp(u, p.id); return view(u); }, A);
  on('POST', '/api/suite/apps/:id/stop', ({ u, p }) => { const a = S.apps[p.id]; if (!a || a.status !== 'running') throw err(409, def(p.id).name + ' is not running.'); a.status = 'stopped'; audit(u, 'Stopped an app', def(p.id).name); return view(u); }, A);
  on('POST', '/api/suite/apps/:id/start', ({ u, p }) => { const a = S.apps[p.id], d = def(p.id); if (!a || a.status !== 'stopped') throw err(409, d.name + ' is not stopped.'); if (d.needsGb > ctx.freeGb()) throw err(409, `${d.name} needs ${d.needsGb} GB and ${ctx.freeGb()} GB is free.`); a.status = 'running'; if (!db.keys.some(k => k.system && k.name === d.name && !k.revokedAt)) ctx.issueKey(d.name, 'Vanik OS', true); audit(u, 'Started an app', d.name); return view(u); }, A);
  on('DELETE', '/api/suite/apps/:id', ({ u, p }) => { const d = def(p.id); if (!S.apps[p.id]) throw err(409, d.name + ' is not installed.'); delete S.apps[p.id]; ctx.revokeSystemKeys(d.name); audit(u, 'Uninstalled an app', d.name, 'Its data is kept on the appliance'); return view(u); }, A);
  on('PUT', '/api/suite/apps/:id/access', ({ u, p, body }) => { const a = S.apps[p.id], d = def(p.id); if (!a) throw err(409, d.name + ' is not installed.'); if (body.access) a.access = cleanAccess(body.access); if (body.roles) a.roles = cleanRoles(p.id, body.roles); audit(u, 'Changed who can use an app', d.name, label(a.access) + (Object.keys(a.roles || {}).length ? ` · ${Object.keys(a.roles).length} with a named role` : '')); return view(u); }, A);

  on('POST', '/api/suite/apps/:id/request', ({ u, p }) => { const d = def(p.id), a = S.apps[p.id]; if (!a) throw err(409, d.name + ' is not installed.'); if (allowed(a.access, u)) throw err(409, 'You already have ' + d.name + '.'); a.requests = (a.requests || []).filter(r => r.userId !== u.id); a.requests.push({ userId: u.id, name: u.name, at: now() }); audit(u, 'Asked for an app', d.name); return { ok: true }; });
  on('POST', '/api/suite/apps/:id/requests/:uid', ({ u, p, body }) => { const d = def(p.id), a = S.apps[p.id], r = a && (a.requests || []).find(x => x.userId === p.uid); if (!r) throw err(404, 'Request not found'); a.requests = a.requests.filter(x => x !== r); if (body.allow) { if (a.access.mode !== 'everyone' && !a.access.users.includes(r.userId)) a.access.users.push(r.userId); a.access.deny = (a.access.deny || []).filter(i => i !== r.userId); } audit(u, body.allow ? 'Gave an app to a person who asked' : 'Declined a request for an app', d.name, r.name); return view(u); }, A);

  // ---------- first-run set-up and the recovery key. The key is shown once; only its fingerprint is kept.
  const newKey = u => { const raw = 'VNK-' + crypto.randomBytes(10).toString('hex').toUpperCase().match(/.{4}/g).join('-'); S.recovery = { hash: sha(raw), createdAt: now(), by: u.name }; return raw; };
  on('POST', '/api/suite/setup', async ({ u, body }) => {
    const name = String(body.name || '').trim().replace(/\s+/g, ' ').slice(0, 40); if (name.length < 2) throw err(400, 'Give the appliance a name people will recognise.');
    const domain = String(body.domain || '').trim().toLowerCase(); if (domain && !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) throw err(400, 'Enter a name such as ai.yourcompany.com, or leave it empty.');
    db.device.name = name; if (db.edge && db.edge.network) db.edge.network.domain = domain;
    const m = db.models.find(x => x.id === body.modelId); if (m && m.status === 'available' || m && m.status === 'parked') { try { await ctx.call(u, 'POST', `/api/models/${encodeURIComponent(m.id)}/serve`); } catch (e) { throw err(409, e.message); } }
    S.setup = { doneAt: now(), by: u.name }; const recoveryKey = newKey(u); audit(u, 'Finished set-up', name, 'Recovery key created');
    return { recoveryKey, suite: view(u) };
  }, A);
  on('POST', '/api/suite/recovery', ({ u }) => { const recoveryKey = newKey(u); audit(u, 'Made a new recovery key', '', 'The old key no longer works'); return { recoveryKey, suite: view(u) }; }, A);
  on('POST', '/api/suite/recovery/check', ({ body }) => ({ ok: !!S.recovery && sha(String(body.key || '').trim().toUpperCase()) === S.recovery.hash }), A);

  // ---------- a model brought in from a file, for sites with no connection. This build checks the shape of the package, not its signature.
  on('POST', '/api/suite/models/import', ({ u, body }) => {
    const m = body.manifest || {}, id = String(m.id || '').trim();
    if (!/^[\w.:\-]{3,60}$/.test(id)) throw err(400, 'The package has no model id.'); if (db.models.some(x => x.id === id)) throw err(409, id + ' is already in the Model Hub.');
    if (!['chat', 'embedding', 'vision', 'speech'].includes(m.kind)) throw err(400, 'The package does not say what the model is for.');
    if (!(+m.memGb > 0 && +m.memGb < 2000)) throw err(400, 'The package does not say how much memory the model needs.');
    if (!/^[a-f0-9]{64}$/i.test(m.sha256 || '') || !String(m.signature || '').trim()) throw err(400, 'The package is not signed. Only signed packages can be added.');
    db.models.push({ id, kind: m.kind, memGb: +(+m.memGb).toFixed(1), context: +m.context || null, status: 'available', port: null, note: String(m.note || 'Added from a file').slice(0, 80), source: 'file' });
    audit(u, 'Added a model from a file', id, 'Checksum ' + String(m.sha256).slice(0, 12)); return { ok: true, id };
  }, A);

  // ---------- evidence: where data goes, how long it is kept, what is hidden, who may use what. Read from the live settings.
  on('GET', '/api/suite/evidence', ({ u, q }) => {
    const E = db.edge || {}, cfg = db.app.config, sf = cfg.safety || {}, out = Object.entries(E.outside || {}).filter(([, v]) => v.key && (v.models || []).length), host = x => { try { return new URL(x).host || x; } catch { return String(x); } };
    const leaves = [
      ['Reached from the internet', !!(E.network && E.network.publicOn), E.network && E.network.publicOn ? 'Open at ' + E.network.domain : 'Closed. Only the office network reaches the appliance.'],
      ['Questions sent to models outside', out.length > 0, out.length ? out.map(([k, v]) => `${k}: ${v.models.map(m => m.id).join(', ')}`).join('; ') : 'No outside model is switched on.'],
      ['Documents sent to models outside', !!E.outsideDocs && out.length > 0, E.outsideDocs ? 'Passages may be sent with a question.' : 'Never. Outside models get the question only.'],
      ['Tools in other systems', db.mcp.length > 0, db.mcp.length ? db.mcp.map(m => `${m.name} (${host(m.url)})`).join(', ') : 'None connected.'],
      ['Events sent to other systems', db.webhooks.some(w => !w.paused), db.webhooks.length ? db.webhooks.map(w => host(w.url)).join(', ') : 'None.'],
      ['Sites the browser may open', (cfg.tools && cfg.tools.sites || []).length > 0, (cfg.tools && cfg.tools.sites || []).join(', ') || 'None.'],
      ['Voice typing', !!sf.voice, sf.voice ? 'On. Speech is turned into text by the browser maker.' : 'Off.'],
      ['Vanik support access', (E.support || []).some(s => s.status === 'open' && new Date(s.endsAt) > new Date()), 'Opened by an admin for a set time. ' + (E.support || []).length + ' sessions so far.'],
    ].map(([what, on_, detail]) => ({ what, on: on_, detail }));
    const kept = [['Chats', sf.retentionDays ? `Removed after ${sf.retentionDays} days` : 'Kept until a person deletes them'], ['Audit log and delivery records', `Kept ${(E.retention || { logsDays: 30 }).logsDays} days`], ['Temporary chats', 'Never saved'], ['Recordings and transcripts in Echo', 'Kept until a person deletes them']].map(([what, rule]) => ({ what, rule }));
    const hidden = [['Indian IDs in questions (Aadhaar, PAN, GSTIN, phone)', { mask: 'Hidden before the model sees them', flag: 'Flagged to the person', off: 'Not checked' }[sf.pii] || 'Not checked'], ['Indian IDs in documents', sf.maskDocuments ? 'Hidden when a document is added' : 'Kept as written'], ['Admins reading people\'s chats', sf.adminChats ? 'Allowed, and every opening is recorded' : 'Not allowed']].map(([what, rule]) => ({ what, rule }));
    const restricted = l => l.filter(x => x.access && x.access.mode === 'restricted').length;
    const access = [['Collections', db.collections.length, restricted(db.collections)], ['Shared agents', db.assistants.filter(a => a.shared).length, restricted(db.assistants.filter(a => a.shared))], ['Apps', ORDER.filter(i => S.apps[i]).length + (db.app.status === 'not_installed' ? 0 : 1), restricted(ORDER.map(i => S.apps[i]).filter(Boolean)) + (cfg.access && cfg.access.mode === 'restricted' ? 1 : 0)]].map(([what, total, limited]) => ({ what, total, limited }));
    const people = { total: db.users.length, admins: db.users.filter(isAdmin).length, fromDirectory: db.users.filter(x => x.fromDirectory).length };
    if (q && q.get && q.get('download')) audit(u, 'Downloaded the evidence pack');
    return { at: now(), appliance: db.device.name, os: (E.updates || {}).version || db.device.agent, leaves, kept, hidden, access, people, log: { entries: db.audit.length, first: db.audit.length ? db.audit[db.audit.length - 1].at : null, last: db.audit.length ? db.audit[0].at : null } };
  }, A);

  // ---------- Document processing: fields by template, checks, a person corrects what is doubtful
  const C36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const gstinDigit = g => { let s = 0; for (let i = 0; i < 14; i++) { const p = C36.indexOf(g[i]) * (i % 2 ? 2 : 1); s += Math.floor(p / 36) + p % 36; } return C36[(36 - s % 36) % 36]; };
  const gstinOk = g => /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g) && gstinDigit(g) === g[14];
  const money = v => { const n = parseFloat(String(v).replace(/[^\d.\-]/g, '')); return isFinite(n) ? n : null; };
  const TPL = {
    gst_invoice: { name: 'GST invoice', hint: /tax invoice|invoice (no|number)/i, fields: [['invoice_no', 'Invoice number', ['invoice no', 'invoice number', 'invoice'], 'text', 1], ['invoice_date', 'Invoice date', ['invoice date', 'date'], 'date', 1], ['supplier', 'Supplier', ['supplier', 'seller', 'from'], 'text', 1], ['supplier_gstin', 'Supplier GSTIN', ['supplier gstin', 'seller gstin', 'gstin'], 'gstin', 1], ['buyer_gstin', 'Buyer GSTIN', ['buyer gstin', 'customer gstin', 'bill to gstin'], 'gstin', 0], ['po_number', 'Purchase order', ['po number', 'po no', 'purchase order'], 'text', 0], ['taxable', 'Taxable value', ['taxable value', 'taxable amount', 'subtotal'], 'money', 1], ['tax', 'GST', ['gst', 'igst', 'total gst', 'total tax', 'tax'], 'money', 1], ['total', 'Invoice total', ['invoice total', 'grand total', 'total', 'total amount'], 'money', 1]] },
    purchase_order: { name: 'Purchase order', hint: /purchase order/i, fields: [['po_number', 'PO number', ['po number', 'po no', 'purchase order'], 'text', 1], ['po_date', 'PO date', ['po date', 'date'], 'date', 1], ['supplier', 'Supplier', ['supplier', 'vendor', 'to'], 'text', 1], ['buyer_gstin', 'Buyer GSTIN', ['buyer gstin', 'gstin'], 'gstin', 0], ['deliver_by', 'Deliver by', ['deliver by', 'delivery date', 'due date'], 'date', 0], ['total', 'Order total', ['order total', 'total', 'total amount'], 'money', 1]] },
    eway_bill: { name: 'E-way bill', hint: /e-?way bill/i, fields: [['ewb_no', 'E-way bill number', ['e way bill no', 'eway bill no', 'ewb no', 'e way bill number'], 'ewb', 1], ['ewb_date', 'Generated on', ['generated on', 'date'], 'date', 1], ['from_gstin', 'From GSTIN', ['from gstin', 'supplier gstin'], 'gstin', 1], ['to_gstin', 'To GSTIN', ['to gstin', 'recipient gstin', 'buyer gstin'], 'gstin', 1], ['vehicle', 'Vehicle', ['vehicle no', 'vehicle number', 'vehicle'], 'text', 0], ['value', 'Value of goods', ['value of goods', 'total value', 'value'], 'money', 1]] },
  };
  const okDate = v => /^\d{1,2}[\/\-. ](\d{1,2}|[A-Za-z]{3,9})[\/\-. ]\d{2,4}$/.test(v) || /^\d{4}-\d{2}-\d{2}$/.test(v);
  const doubt = (kind, v) => !v ? 'Not found' : kind === 'gstin' && !gstinOk(v) ? 'Not a well-formed GSTIN' : kind === 'money' && money(v) === null ? 'Not an amount' : kind === 'date' && !okDate(v) ? 'Not a date' : kind === 'ewb' && !/^\d{12}$/.test(v.replace(/\s/g, '')) ? 'An e-way bill number has 12 digits' : '';
  function recheck(d) {
    const f = k => (d.fields.find(x => x.key === k) || {}).value || '', t = TPL[d.template];
    d.fields.forEach(x => { const kind = t.fields.find(y => y[0] === x.key)[3]; x.doubt = x.value || x.required ? doubt(kind, x.value) : ''; if (x.corrected && !x.doubt) x.conf = 1; });
    d.checks = [];
    if (d.template === 'gst_invoice') { const a = money(f('taxable')), b = money(f('tax')), c = money(f('total')); d.checks.push({ name: 'Taxable value plus GST equals the total', ok: a !== null && b !== null && c !== null && Math.abs(a + b - c) <= 1, detail: a !== null && b !== null && c !== null ? `${a.toLocaleString('en-IN')} + ${b.toLocaleString('en-IN')} = ${(a + b).toLocaleString('en-IN')}, document says ${c.toLocaleString('en-IN')}` : 'An amount is missing' }); }
    if (d.template === 'eway_bill') d.checks.push({ name: 'Sender and receiver are different', ok: !!f('from_gstin') && f('from_gstin') !== f('to_gstin'), detail: 'From and To GSTIN' });
    const ids = d.fields.filter(x => /gstin/.test(x.key) && x.value); if (ids.length) d.checks.push({ name: 'Every GSTIN is well formed', ok: ids.every(x => gstinOk(x.value)), detail: ids.map(x => x.value).join(', ') });
    const open = d.fields.filter(x => x.doubt || (x.value && x.conf < 0.8)).length + d.checks.filter(c => !c.ok).length;
    if (d.status !== 'approved') d.status = open ? 'review' : 'ready';
    d.open = open; return d;
  }
  function readDoc(u, name, text, template) {
    const tid = TPL[template] ? template : (Object.keys(TPL).find(k => TPL[k].hint.test(text)) || 'gst_invoice'), t = TPL[tid];
    const pairs = text.split(/\r?\n/).map(l => l.trim().match(/^([^:]{2,40}):\s*(.+)$/)).filter(Boolean).map(m => [m[1].toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(), m[2].trim()]), taken = new Set();
    const fields = t.fields.map(([key, lab, alias, , req]) => { let hit = pairs.findIndex((p, i) => !taken.has(i) && alias.includes(p[0])), conf = 0.96; if (hit < 0) { hit = pairs.findIndex((p, i) => !taken.has(i) && alias.some(a => a.length > 3 && p[0].includes(a))); conf = 0.7; } if (hit >= 0) taken.add(hit); return { key, label: lab, value: hit >= 0 ? pairs[hit][1].slice(0, 200) : '', conf: hit >= 0 ? conf : 0, required: !!req, corrected: false }; });
    return recheck({ id: uid('idp'), name: String(name).slice(0, 160), template: tid, text: text.slice(0, 20000), fields, checks: [], status: 'review', addedBy: u.name, addedAt: now(), history: [] });
  }
  const idpRow = d => ({ id: d.id, name: d.name, template: TPL[d.template].name, status: d.status, open: d.open, addedBy: d.addedBy, addedAt: d.addedAt, total: (d.fields.find(f => /total|value/.test(f.key)) || {}).value || '' });
  on('GET', '/api/idp', ({ u }) => { need(u, 'idp'); return { docs: S.idp.docs.map(idpRow), templates: Object.entries(TPL).map(([id, t]) => ({ id, name: t.name, fields: t.fields.map(f => f[1]) })) }; });
  on('POST', '/api/idp/docs', ({ u, body }) => { need(u, 'idp'); const text = String(body.text || ''); if (text.trim().length < 20) throw err(400, 'No readable text found in "' + (body.name || 'the file') + '".'); const d = readDoc(u, body.name || 'Document', text, body.template); S.idp.docs.unshift(d); audit(u, 'Read a document', d.name, TPL[d.template].name + (d.open ? `, ${d.open} to check` : ', nothing to check')); return d; });
  on('GET', '/api/idp/docs/:id', ({ u, p }) => { need(u, 'idp'); return byId(S.idp.docs, p.id, 'Document'); });
  on('PUT', '/api/idp/docs/:id', ({ u, p, body }) => { need(u, 'idp'); const d = byId(S.idp.docs, p.id, 'Document'), f = d.fields.find(x => x.key === body.key); if (!f) throw err(404, 'Field not found'); if (d.status === 'approved') throw err(409, 'This document is approved. Reopen it to change a field.'); const v = String(body.value || '').trim().slice(0, 200); if (v !== f.value) { d.history.unshift({ at: now(), by: u.name, field: f.label, was: f.value, now: v }); f.value = v; f.corrected = true; } else if (body.confirm) { f.corrected = true; f.conf = 1; } return recheck(d); });
  on('POST', '/api/idp/docs/:id/approve', ({ u, p, body }) => { need(u, 'idp'); const d = byId(S.idp.docs, p.id, 'Document'); if (body.reopen) { d.status = 'review'; d.approvedBy = ''; audit(u, 'Reopened a document', d.name); return recheck(d); } const missing = d.fields.filter(f => f.required && !f.value); if (missing.length) throw err(409, 'Fill in first: ' + missing.map(f => f.label).join(', ') + '.'); const failed = d.checks.filter(c => !c.ok).length; d.status = 'approved'; d.approvedBy = u.name; d.approvedAt = now(); d.open = 0; audit(u, 'Approved a document', d.name, failed ? `${failed} check not passed, accepted by a person` : 'All checks passed'); return d; });
  on('DELETE', '/api/idp/docs/:id', ({ u, p }) => { need(u, 'idp'); const d = byId(S.idp.docs, p.id, 'Document'); S.idp.docs = S.idp.docs.filter(x => x !== d); audit(u, 'Deleted a read document', d.name); return { ok: true }; });
  const csv = rows => rows.map(r => r.map(v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`).join(',')).join('\n');
  on('GET', '/api/idp/export', ({ u }) => { need(u, 'idp'); const done = S.idp.docs.filter(d => d.status === 'approved'), keys = [...new Set(done.flatMap(d => d.fields.map(f => f.label)))]; audit(u, 'Exported approved documents', done.length + ' documents'); return { name: 'approved-documents', count: done.length, csv: csv([['Document', 'Kind', 'Approved by', ...keys], ...done.map(d => [d.name, TPL[d.template].name, d.approvedBy, ...keys.map(k => (d.fields.find(f => f.label === k) || {}).value || '')])]), json: done.map(d => ({ document: d.name, kind: d.template, fields: Object.fromEntries(d.fields.map(f => [f.key, f.value])) })) }; });

  // ---------- Vanik Desk: one queue, timers, a reply drafted from the knowledge base with its source
  const dueAt = (t, h) => new Date(new Date(t.createdAt).getTime() + h * 36e5).toISOString();
  const tView = t => { const first = t.messages.find(m => m.who === 'agent'), fDue = dueAt(t, S.desk.firstHours), rDue = dueAt(t, S.desk.resolveHours), nowT = now(); return { ...t, firstDue: fDue, resolveDue: rDue, firstState: first ? (first.at <= fDue ? 'met' : 'missed') : nowT > fDue ? 'late' : 'running', resolveState: t.status === 'solved' ? (t.solvedAt <= rDue ? 'met' : 'missed') : nowT > rDue ? 'late' : 'running', assigneeName: (person(t.assignee) || { name: '' }).name }; };
  const deskDocs = u => { const c = db.collections.find(x => x.id === S.desk.collectionId); return c && allowed(c.access, u) ? db.documents.filter(d => d.collectionId === c.id && d.chunks.length) : []; };
  on('GET', '/api/desk', ({ u }) => { need(u, 'desk'); return { tickets: S.desk.tickets.map(tView).map(t => ({ ...t, messages: undefined, last: t.messages[t.messages.length - 1].at })), settings: { collectionId: S.desk.collectionId, firstHours: S.desk.firstHours, resolveHours: S.desk.resolveHours }, collections: db.collections.filter(c => allowed(c.access, u)).map(c => ({ id: c.id, name: c.name })), agents: db.users.filter(x => canUse(x, 'desk')).map(x => ({ id: x.id, name: x.name })) }; });
  function addTicket(u, b, at) { const subject = String(b.subject || '').trim().slice(0, 160), text = String(b.body || '').trim().slice(0, 6000), from = String(b.from || '').trim().slice(0, 80); if (!subject || !text || !from) throw err(400, 'A request needs who it is from, a subject and the message.'); const t = { id: uid('tk'), n: ++S.desk.seq, from, email: String(b.email || '').slice(0, 120), subject, channel: ['mail', 'form', 'chat'].includes(b.channel) ? b.channel : 'form', priority: ['low', 'normal', 'high'].includes(b.priority) ? b.priority : 'normal', status: 'open', assignee: '', createdAt: at || now(), messages: [{ at: at || now(), who: 'customer', by: from, text }] }; S.desk.tickets.unshift(t); return t; }
  on('POST', '/api/desk/tickets', ({ u, body }) => { need(u, 'desk'); const t = addTicket(u, body); audit(u, 'Logged a request', `#${t.n} ${t.subject}`); return tView(t); });
  on('GET', '/api/desk/tickets/:id', ({ u, p }) => { need(u, 'desk'); return tView(byId(S.desk.tickets, p.id, 'Request')); });
  async function draft(u, t) {
    const q = t.subject + ' ' + t.messages.filter(m => m.who === 'customer').map(m => m.text).join(' '), hits = await search(q, deskDocs(u), 3); if (!hits.length) return { text: '', sources: [] };
    const words = new Set(q.toLowerCase().match(/[a-z0-9]{4,}/g) || []), top = hits[0], sents = top.text.replace(/^#+\s.*$/gm, '').split(/(?<=[.!?])\s+|\n+/).map(s => s.replace(/^[-*]\s*/, '').trim()).filter(s => s.length > 25);
    const best = sents.map((s, i) => [i, (s.toLowerCase().match(/[a-z0-9]{4,}/g) || []).filter(w => words.has(w)).length]).sort((a, b) => b[1] - a[1]).slice(0, 3).filter(x => x[1] > 0).sort((a, b) => a[0] - b[0]).map(x => sents[x[0]]);
    return { text: `Hello ${t.from.split(' ')[0]},\n\n${(best.length ? best : sents.slice(0, 2)).join(' ')}\n\nRegards,\n${u.name}`, sources: hits.map(h => ({ docId: h.docId, docName: h.docName, page: h.page })) };
  }
  on('POST', '/api/desk/tickets/:id/draft', async ({ u, p }) => { need(u, 'desk'); return draft(u, byId(S.desk.tickets, p.id, 'Request')); });
  on('POST', '/api/desk/tickets/:id/reply', ({ u, p, body }) => { need(u, 'desk'); const t = byId(S.desk.tickets, p.id, 'Request'), text = String(body.text || '').trim().slice(0, 6000); if (!text) throw err(400, 'Write the reply first.'); t.messages.push({ at: now(), who: 'agent', by: u.name, text, sources: (Array.isArray(body.sources) ? body.sources : []).slice(0, 5).map(s => ({ docId: String(s.docId || ''), docName: String(s.docName || '').slice(0, 160), page: s.page || null })) }); if (!t.assignee) t.assignee = u.id; t.status = body.solve ? 'solved' : 'waiting'; if (body.solve) t.solvedAt = now(); audit(u, body.solve ? 'Answered and solved a request' : 'Answered a request', `#${t.n} ${t.subject}`); return tView(t); });
  on('PUT', '/api/desk/tickets/:id', ({ u, p, body }) => { need(u, 'desk'); const t = byId(S.desk.tickets, p.id, 'Request'); if (body.assignee !== undefined) t.assignee = person(body.assignee) ? body.assignee : ''; if (['low', 'normal', 'high'].includes(body.priority)) t.priority = body.priority; if (['open', 'waiting', 'solved'].includes(body.status)) { t.status = body.status; t.solvedAt = body.status === 'solved' ? now() : null; } return tView(t); });
  on('PUT', '/api/desk/settings', ({ u, body }) => { if (body.collectionId !== undefined) S.desk.collectionId = db.collections.some(c => c.id === body.collectionId) ? body.collectionId : ''; if (body.firstHours) S.desk.firstHours = Math.max(1, Math.min(72, +body.firstHours || 4)); if (body.resolveHours) S.desk.resolveHours = Math.max(1, Math.min(720, +body.resolveHours || 24)); audit(u, 'Changed Desk settings'); return { ok: true }; }, A);

  // ---------- sample content for the demo workspace, added once, through the same functions the routes use
  function sample() {
    if (S.sampled || !DEMO) return; const owner = db.users.find(x => x.role === 'owner'), by = n => db.users.find(x => x.name.startsWith(n)) || owner, ago = (d, h = 0) => new Date(Date.now() - d * 864e5 - h * 36e5).toISOString(); S.sampled = true;
    for (const id of ORDER) if (!S.apps[id] && APPS[id].needsGb <= ctx.freeGb()) installApp(owner, id);
    const hr = db.collections.find(c => /HR/.test(c.name)), g = b => b + gstinDigit(b), A1 = g('27AABCS1429B1Z'), B1 = g('29AAACM1234C1Z'), C1 = g('24AAECA7788D1Z');
    if (S.apps.scout) S.apps.scout.access = { mode: 'restricted', teams: ['HR'], users: [] };
    if (S.apps.idp) {
      S.idp.docs.unshift(readDoc(by('Asha'), 'INV-2291 Shree Fasteners.pdf', `TAX INVOICE\nInvoice No: SF/26-27/2291\nInvoice Date: 02-10-2026\nSupplier: Shree Fasteners Pvt Ltd\nSupplier GSTIN: ${A1}\nBuyer GSTIN: ${B1}\nPO Number: PO-7841\n\nHex bolt M12 x 50, HSN 7318, 4,000 nos\n\nTaxable Value: 1,84,000.00\nGST: 33,120.00\nInvoice Total: 2,17,120.00`));
      S.idp.docs.unshift(readDoc(by('Asha'), 'INV-0457 Apex Industrial.pdf', `TAX INVOICE\nInvoice No: AI/0457\nInvoice Date: 04-10-2026\nSupplier: Apex Industrial\nSupplier GSTIN: ${C1}\nBuyer GSTIN: ${B1}\nPO Number: PO-7902\n\nSafety gloves, HSN 4015, 1,200 pairs\n\nTaxable Value: 96,000.00\nGST: 17,280.00\nInvoice Total: 1,14,280.00`));
      S.idp.docs.unshift(readDoc(by('Rohan'), 'EWB Shree Fasteners.pdf', `E-WAY BILL\nE-Way Bill No: 3410 8827 5512\nGenerated On: 03-10-2026\nFrom GSTIN: ${A1}\nTo GSTIN: ${B1.slice(0, 14)}9\nVehicle No: MH12 KT 4471\nValue of Goods: 2,17,120.00`));
      const ok = S.idp.docs[2]; ok.status = 'approved'; ok.approvedBy = 'Asha Verma'; ok.approvedAt = ago(0, 5);
    }
    if (S.apps.desk && hr) {
      S.desk.collectionId = hr.id; const T = (b, d, h) => addTicket(owner, b, ago(d, h));
      const t1 = T({ from: 'Kavita Rao', email: 'kavita.rao@example.com', subject: 'How long do I have to submit a travel claim?', body: 'I came back from the Pune plant visit last week. By when do I have to submit the travel claim, and what do I attach?', channel: 'mail' }, 0, 1);
      T({ from: 'Arjun Nair', email: 'arjun.nair@example.com', subject: 'Carry forward of unused leave', body: 'How many days of earned leave can I carry forward into next year?', channel: 'form', priority: 'low' }, 0, 6);
      const t3 = T({ from: 'Meera Shah', email: 'meera.shah@example.com', subject: 'Hotel limit for Mumbai', body: 'What is the hotel limit per night when travelling to Mumbai for a supplier audit?', channel: 'mail', priority: 'high' }, 2, 3);
      t3.messages.push({ at: ago(2, 1), who: 'agent', by: by('Neha').name, text: 'Hello Meera,\n\nThe limit for metro cities is in the travel policy. I have attached the section.\n\nRegards,\nNeha', sources: [] }); t3.status = 'solved'; t3.assignee = by('Neha').id; t3.solvedAt = ago(2, 1); t1.assignee = by('Neha').id;
    }
  }

  return { usedGb, boot, sample, canUse, need, roleOf, requests: () => ORDER.flatMap(id => ((S.apps[id] || {}).requests || []).map(r => ({ ...r, appId: id, app: APPS[id].name }))), apps: () => ORDER.filter(id => S.apps[id]).map(id => ({ id, name: APPS[id].name, access: S.apps[id].access })) };
};
