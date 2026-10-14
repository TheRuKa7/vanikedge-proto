'use strict';
// Vanik Sense as a product that stands alone: a first run that asks how a person works, a checklist until they are set up,
// the company's reporting lines (from a sheet or from the HR system), the rule for what a manager may see of the calls below
// them, and the controls a product admin holds. The same controls are shown in the Vanik Edge console when no product admin
// is named. Loaded by sense.js. Stand-ins: an HR system 'connection' loads sample people; nothing is called.
module.exports = function build({ db, S, err, uid, now, audit, roleOf, mailOf, TYPES, MVP }) {
  const DEPTS = ['Sales', 'Customer support', 'Operations', 'Procurement', 'HR and people', 'Finance', 'IT', 'Engineering', 'Product', 'Marketing', 'Legal', 'Leadership', 'Other'];
  const LEVELS = ['Individual contributor', 'Manager', 'Senior leader'];
  const GOALS = ['Capture actions and who owns them', 'Stop taking notes by hand', 'Catch up on meetings I missed', 'Understand customer calls', 'See patterns across many meetings', 'Draft follow-ups', 'Share minutes with my team'];
  const CAPTURE = ['teams', 'upload', 'desktop', 'mic'];
  const SYSTEMS = ['Keka', 'Darwinbox', 'Zoho People', 'greytHR', 'HROne', 'FlexiEle', 'SAP SuccessFactors', 'Workday', 'BambooHR', 'Microsoft Entra ID', 'Google Workspace'];
  const DEFAULTS = { team: { reach: 'off', detail: 'minutes', dotted: false, never: ['One to one', 'Hiring interview'] }, notice: true, skip: [], upload: true, external: false, exportOn: true, keepDays: 0, score: true,
    sources: { teams: true, outlook: true, gcal: true, slack: true, zoom: false, mic: true, autoMic: false }, adminAdvanced: false, storage: { store: 'st_db', kind: 'db', gb: 50 },
    avail: { teams: true, outlook: true, gcal: !MVP, slack: !MVP, zoom: false, upload: true, mic: !MVP, autoMic: false } /* the MVP release: Teams, Outlook, and notes or transcripts by hand */, join: 'all', recap: 'company' };
  S.profile = S.profile || {}; S.org = S.org || { people: [], source: '', at: '', by: '' };
  S.policy = { ...DEFAULTS, ...(S.policy || {}), team: { ...DEFAULTS.team, ...((S.policy || {}).team || {}) }, sources: { ...DEFAULTS.sources, ...((S.policy || {}).sources || {}) }, avail: { ...DEFAULTS.avail, ...((S.policy || {}).avail || {}) }, storage: { ...DEFAULTS.storage, ...((S.policy || {}).storage || {}) } };
  const P = () => S.policy, isAdmin = u => u.role !== 'user' || roleOf(u, 'sense') === 'Sense admin', guard = u => { if (!isAdmin(u)) throw err(403, 'Only a Vanik Sense admin can change this.'); };
  // Advanced: what a manager can see, reporting lines, how long meetings are kept, sending outside, the score. A console admin always has it; an app admin only when the console gives it.
  const ADV = ['team', 'keepDays', 'external', 'exportOn', 'score'], top = u => u.role !== 'user', hasAdv = u => top(u) || (isAdmin(u) && P().adminAdvanced), guardAdv = u => { guard(u); if (!hasAdv(u)) throw err(403, 'These settings are kept in the console for this workspace.'); };
  const guardTop = u => { if (!top(u)) throw err(403, 'Reporting lines are set in the Vanik Edge console.'); };
  // A way in works when the console has made it available and the app's settings have it switched on.
  const JOIN = ['all', 'host', 'team', 'manual'], RECAP = ['all', 'company', 'me'], wayOn = k => !!P().avail[k] && (k === 'upload' ? !!P().upload : !!P().sources[k]);
  const admins = () => db.users.filter(u => u.role === 'user' && roleOf(u, 'sense') === 'Sense admin').map(u => u.name);

  // ---------- the reporting lines
  const HEAD = { employee_id: ['employee_id', 'employee id', 'emp id', 'id', 'employee code'], name: ['name', 'full name', 'employee name'], email: ['work_email', 'work email', 'email', 'email id', 'official email'], title: ['title', 'designation', 'job title'],
    dept: ['department', 'dept', 'function'], team: ['team', 'sub department'], bu: ['business_unit', 'business unit', 'bu', 'entity'], location: ['location', 'office', 'city'],
    manager: ['manager_email', 'manager email', 'reports to', 'reporting manager', 'manager', 'manager_id', 'manager id', 'reporting manager email'], dotted: ['dotted_line_managers', 'dotted line managers', 'dotted line', 'functional manager', 'matrix manager'], status: ['status', 'employment status'] };
  const TEMPLATE = ['employee_id,name,work_email,title,department,team,business_unit,location,manager_email,dotted_line_managers,status',
    'E001,Anita Rao,anita.rao@yourcompany.com,Managing Director,Leadership,,India,Mumbai,,,Active', 'E014,Vivek Shah,vivek.shah@yourcompany.com,Head of Sales,Sales,,India,Mumbai,anita.rao@yourcompany.com,,Active',
    'E052,Priya Nair,priya.nair@yourcompany.com,Regional Sales Manager,Sales,West,India,Pune,vivek.shah@yourcompany.com,,Active', 'E131,Arif Khan,arif.khan@yourcompany.com,Account Manager,Sales,West,India,Pune,priya.nair@yourcompany.com,anita.rao@yourcompany.com,Active'].join('\n');
  function cells(text) { // a sheet saved as CSV: quoted cells, commas inside quotes, either kind of line end
    const rows = []; let row = [], cur = '', q = false; const t = String(text || '').replace(/^﻿/, '');
    for (let i = 0; i < t.length; i++) { const c = t[i];
      if (q) { if (c === '"' && t[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; continue; }
      if (c === '"') q = true; else if (c === ',') { row.push(cur); cur = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(x => x.trim())) rows.push(row); row = []; } else cur += c; }
    row.push(cur); if (row.some(x => x.trim())) rows.push(row); return rows;
  }
  function readOrg(text) {
    const rows = cells(text), errors = [], warnings = []; if (rows.length < 2) return { people: [], errors: [{ row: 1, text: 'The file has no people in it. Keep the first row as the headings and put one person on each row below.' }], warnings };
    if (rows.length > 20001) return { people: [], errors: [{ row: 1, text: 'The file has more than 20,000 people. Split it by business unit and upload each part.' }], warnings };
    const head = rows[0].map(h => h.trim().toLowerCase()), col = {}; Object.entries(HEAD).forEach(([k, names]) => { col[k] = head.findIndex(h => names.includes(h)); });
    if (col.email < 0) return { people: [], errors: [{ row: 1, text: "There is no 'work_email' column. Download the template and keep its headings." }], warnings };
    const get = (r, k) => (col[k] < 0 ? '' : String(r[col[k]] || '').trim()), bad = (n, t) => errors.push({ row: n, text: t }), people = [], seen = {}, ids = {}; let left = 0;
    rows.slice(1).forEach((r, i) => { const n = i + 2, email = get(r, 'email').toLowerCase(), id = get(r, 'employee_id');
      if (/^(inactive|terminated|left|resigned|exited)$/i.test(get(r, 'status'))) { left++; return; }
      if (!email) return bad(n, 'No work email.'); if (!/^[\w.+-]+@[\w-]+\.[\w.]+$/.test(email)) return bad(n, `'${email}' is not an email address.`);
      if (seen[email]) return bad(n, `${email} is also on row ${seen[email]}.`); if (id && ids[id]) return bad(n, `Employee ID ${id} is also on row ${ids[id]}.`);
      seen[email] = n; if (id) ids[id] = n;
      people.push({ row: n, id, name: get(r, 'name') || email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), email, title: get(r, 'title'), dept: get(r, 'dept'), team: get(r, 'team'), bu: get(r, 'bu'), location: get(r, 'location'), mgr: get(r, 'manager').toLowerCase(), dot: get(r, 'dotted').toLowerCase().split(/[;|]/).map(x => x.trim()).filter(Boolean) }); });
    const byEmail = {}, byId = {}; people.forEach(p => { byEmail[p.email] = p; if (p.id) byId[p.id.toLowerCase()] = p; });
    const find = ref => byEmail[ref] || byId[ref];
    people.forEach(p => { const m = p.mgr ? find(p.mgr) : null;
      if (p.mgr && !m) bad(p.row, `Manager '${p.mgr}' is not in the file. Add them, or use their work email or employee ID exactly.`); else if (m === p) bad(p.row, 'A person cannot be their own manager.');
      p.managerEmail = m && m !== p ? m.email : ''; p.dotted = [];
      p.dot.forEach(d => { const x = find(d); if (!x) bad(p.row, `Dotted-line manager '${d}' is not in the file.`); else if (x !== p) p.dotted.push(x.email); }); });
    people.forEach(p => { const walk = new Set([p.email]); let m = byEmail[p.managerEmail]; while (m) { if (walk.has(m.email)) { bad(p.row, `The reporting line loops back on itself through ${m.name}.`); break; } walk.add(m.email); m = byEmail[m.managerEmail]; } });
    const tops = people.filter(p => !p.managerEmail).length, known = new Set(db.users.map(u => mailOf(u).toLowerCase()));
    if (tops > 1) warnings.push(`${tops} people have no manager. That is fine for heads of separate businesses; check it is meant.`);
    if (left) warnings.push(`${left} people marked as left were skipped.`);
    const out = people.filter(p => !known.has(p.email)).length; if (out) warnings.push(`${out} people have no Vanik Sense account yet. They appear in the reporting lines and get access when they are invited.`);
    return { people: people.map(p => ({ id: p.id, name: p.name, email: p.email, title: p.title, dept: p.dept, team: p.team, bu: p.bu, location: p.location, managerEmail: p.managerEmail, dotted: p.dotted })), errors: errors.sort((a, b) => a.row - b.row), warnings, rows };
  }
  const kids = (email, dotted) => S.org.people.filter(p => p.managerEmail === email || (dotted && p.dotted.includes(email)));
  function below(email, reach = P().team.reach, dotted = P().team.dotted) { // everyone a manager may look at, by the admin's rule
    const out = new Set(); if (reach === 'off' || !email) return out;
    const max = reach === 'direct' ? 1 : reach === 'two' ? 2 : 99; let level = [email.toLowerCase()];
    for (let d = 0; d < max && level.length; d++) { const next = []; level.forEach(e => kids(e, dotted).forEach(p => { if (!out.has(p.email) && p.email !== email.toLowerCase()) { out.add(p.email); next.push(p.email); } })); level = next; }
    return out;
  }
  const depth = () => { const d = e => { const p = S.org.people.find(x => x.email === e); let n = 1, m = p && p.managerEmail; const seen = new Set(); while (m && !seen.has(m)) { seen.add(m); n++; m = (S.org.people.find(x => x.email === m) || {}).managerEmail; } return n; }; return S.org.people.reduce((a, p) => Math.max(a, d(p.email)), 0); };
  const orgView = () => ({ count: S.org.people.length, managers: new Set(S.org.people.map(p => p.managerEmail).filter(Boolean)).size, levels: depth(), source: S.org.source, at: S.org.at, by: S.org.by, noAccount: S.org.people.filter(p => !db.users.some(u => mailOf(u).toLowerCase() === p.email)).length });
  function tree() { const rows = [], seen = new Set(), walk = (p, lvl) => { if (seen.has(p.email)) return; seen.add(p.email); const r = kids(p.email, false); rows.push({ name: p.name, email: p.email, title: p.title, dept: p.dept, team: p.team, level: lvl, reports: r.length, dotted: p.dotted.map(e => (S.org.people.find(x => x.email === e) || { name: e }).name), account: db.users.some(u => mailOf(u).toLowerCase() === p.email) }); r.sort((a, b) => a.name.localeCompare(b.name)).forEach(c => walk(c, lvl + 1)); };
    S.org.people.filter(p => !p.managerEmail).sort((a, b) => a.name.localeCompare(b.name)).forEach(p => walk(p, 0)); return rows; }
  const setOrg = (u, people, source) => { S.org = { people, source, at: now(), by: u.name }; audit(u, 'Updated the reporting lines', source, `${people.length} people · Vanik Sense`); };
  const teamIds = u => { const e = below(mailOf(u)); return new Set(db.users.filter(x => e.has(mailOf(x).toLowerCase())).map(x => x.id)); };
  const managerOf = u => { const me = S.org.people.find(p => p.email === mailOf(u).toLowerCase()), m = me && S.org.people.find(p => p.email === me.managerEmail); return m ? m.name : ''; };
  // who above this person can see their calls under the present rule: shown to the person, so nothing is hidden from them
  function watchers(u) { const me = mailOf(u).toLowerCase(), t = P().team; if (t.reach === 'off') return []; return S.org.people.filter(p => p.email !== me && below(p.email).has(me)).map(p => p.name); }

  const cleanPolicy = b => { const p = P(), t = b.team || {};
    if (t.reach !== undefined) { if (!['off', 'direct', 'two', 'all'].includes(t.reach)) throw err(400, 'Pick how far down a manager may see.'); p.team.reach = t.reach; }
    if (t.detail !== undefined) { if (!['actions', 'minutes', 'transcript'].includes(t.detail)) throw err(400, 'Pick what a manager may see.'); p.team.detail = t.detail; }
    if (t.dotted !== undefined) p.team.dotted = !!t.dotted;
    if (Array.isArray(t.never)) p.team.never = t.never.filter(x => TYPES.includes(x));
    ['notice', 'upload', 'external', 'exportOn', 'score', 'adminAdvanced'].forEach(k => { if (b[k] !== undefined) p[k] = !!b[k]; });
    if (b.sources) Object.keys(DEFAULTS.sources).forEach(k => { if (b.sources[k] !== undefined) p.sources[k] = !!b.sources[k]; });
    if (b.avail) Object.keys(DEFAULTS.avail).forEach(k => { if (b.avail[k] !== undefined) p.avail[k] = !!b.avail[k]; });
    if (b.join !== undefined) { if (!JOIN.includes(b.join)) throw err(400, 'Pick which meetings are read.'); p.join = b.join; }
    if (b.recap !== undefined) { if (!RECAP.includes(b.recap)) throw err(400, 'Pick who gets the recap.'); p.recap = b.recap; }
    if (b.keepDays !== undefined) { if (![0, 90, 180, 365].includes(+b.keepDays)) throw err(400, 'Pick how long meetings are kept.'); p.keepDays = +b.keepDays; }
    if (Array.isArray(b.skip)) p.skip = [...new Set(b.skip.map(x => String(x).trim().toLowerCase()).filter(Boolean))].slice(0, 30);
    return p; };
  const skipped = m => P().skip.some(k => m.title.toLowerCase().includes(k));
  const expired = m => P().keepDays > 0 && Date.now() - new Date(m.at).getTime() > P().keepDays * 864e5;

  function routes(on, need, helpers) {
    on('GET', '/api/sense/profile', ({ u }) => { need(u, 'sense'); return { ...(S.profile[u.id] || { done: false, dept: '', level: '', goals: [], capture: '' }), depts: DEPTS, levels: LEVELS, goalList: GOALS }; });
    on('PUT', '/api/sense/profile', ({ u, body }) => { need(u, 'sense'); const p = S.profile[u.id] = S.profile[u.id] || { done: false, dept: '', level: '', goals: [], capture: '' };
      if (body.dept !== undefined) { if (!DEPTS.includes(body.dept)) throw err(400, 'Pick the work that fits best.'); p.dept = body.dept; }
      if (body.level !== undefined) { if (!LEVELS.includes(body.level)) throw err(400, 'Pick your role.'); p.level = body.level; }
      if (Array.isArray(body.goals)) p.goals = body.goals.filter(g => GOALS.includes(g));
      if (body.capture !== undefined) { if (!CAPTURE.includes(body.capture)) throw err(400, 'Pick how your meetings reach Vanik Sense.'); p.capture = body.capture; }
      if (body.basics) p.basics = true; ['transcribe', 'mic', 'desktopNotify'].forEach(k => { if (body[k] !== undefined) p[k] = !!body[k]; }); if (body.done) { if (!p.dept || !p.level) throw err(400, 'Two answers are still missing.'); p.done = true; }
      return p; });
    on('GET', '/api/sense/setup', ({ u }) => { need(u, 'sense'); const p = S.profile[u.id] || {}, c = helpers.connOf(u), mine = helpers.count(u), adm = isAdmin(u), cap = p.capture || 'teams';
      const steps = [{ key: 'profile', label: 'Tell Vanik Sense how you work', done: !!p.done, href: '#/app/sense/welcome', cta: 'Start' }, { key: 'calendar', label: 'Connect your calendar', done: c.some(x => (x.key === 'calendar' || x.key === 'gcal') && x.on), href: '#/app/sense/settings', cta: 'Connect' },
        // the step that makes capture work, by the way the person chose: Teams needs transcription switched on before the meeting
        ...(cap === 'teams' ? [{ key: 'transcribe', label: 'Switch on transcription in Teams', done: !!p.transcribe || mine > 0, act: 'ss-guide', cta: 'Show me' }] : cap === 'mic' ? [{ key: 'mic', label: 'Let this browser use the microphone', done: !!p.mic, act: 'ss-mic', cta: 'Allow' }] : cap === 'desktop' ? [{ key: 'desktop', label: 'Desktop app: get told when it is ready', done: !!p.desktopNotify, act: 'ss-desktop', cta: 'Open' }] : []),
        { key: 'first', label: 'Get your first meeting in', done: mine > 0, href: '#/app/sense/meetings', cta: 'Add one' }, { key: 'basics', label: 'Learn the basics in one minute', done: !!p.basics, act: 'ss-basics', cta: 'Show me' },
        ...(adm ? [{ key: 'org', label: 'Load your reporting lines', done: S.org.people.length > 0, href: admins().length ? '#/app/sense/admin' : '#/os/apps/sense/setup', cta: 'Open', admin: true }] : [])];
      return { steps, left: steps.filter(s => !s.done).length, dept: p.dept || '', level: p.level || '', capture: p.capture || '', transcribe: !!p.transcribe, mic: !!p.mic, sources: Object.fromEntries(Object.keys(DEFAULTS.sources).map(k => [k, wayOn(k)])), byHand: wayOn('upload'), runBy: admins(), canAdmin: isAdmin(u), tenantAdmin: top(u), role: roleOf(u, 'sense'), calendar: c.some(x => (x.key === 'calendar' || x.key === 'gcal') && x.on), meetings: mine, orgLoaded: S.org.people.length > 0, manager: managerOf(u), watchers: watchers(u), team: teamIds(u).size, rule: { reach: P().team.reach, detail: P().team.detail, never: P().team.never } }; });
    on('GET', '/api/sense/admin', ({ u }) => { need(u, 'sense'); guard(u); return { policy: P(), org: orgView(), admins: admins(), managed: admins().length > 0, advanced: hasAdv(u), systems: SYSTEMS, types: TYPES, tenantAdmin: top(u), storage: { ...P().storage, meetings: S.meetings.length }, stores: top(u) ? (db.stores || []).map(x => ({ id: x.id, name: x.name })) : undefined,
      people: top(u) ? db.users.filter(x => x.role === 'user').map(x => ({ id: x.id, name: x.name, admin: roleOf(x, 'sense') === 'Sense admin' })) : undefined }; });
    on('PUT', '/api/sense/admin', ({ u, body }) => { need(u, 'sense'); guard(u); const b = body || {};
      if (!top(u) && (b.adminAdvanced !== undefined || b.avail !== undefined)) throw err(403, 'Only a console admin decides this.');
      if (!hasAdv(u) && ADV.some(k => b[k] !== undefined)) throw err(403, 'These settings are kept in the console for this workspace.');
      const p = cleanPolicy(b); audit(u, 'Changed Vanik Sense settings', Object.keys(body || {}).join(', '), 'Vanik Sense'); return { policy: p }; });
    const was0 = () => ({ store: P().storage.kind === 'local' ? 'st_disk' : 'st_db', ...P().storage });
    on('PUT', '/api/sense/storage', ({ u, body }) => { need(u, 'sense'); if (!top(u)) throw err(403, 'Only a console admin decides where meetings are kept.');
      const list = db.stores || [], st = list.find(x => x.id === body.store), id = st ? st.id : body.kind === 'local' ? 'st_disk' : body.kind === 'db' ? 'st_db' : was0().store, kind = (list.find(x => x.id === id) || { kind: 'postgres' }).kind === 'postgres' ? 'db' : 'local';
      const was = was0(), to = { store: id, kind, gb: Math.max(1, Math.min(4000, Math.round(+body.gb || was.gb))) };
      if (to.store === was.store && to.gb === was.gb) return { storage: was, removed: 0 };
      const removed = S.meetings.length; S.meetings.length = 0; P().storage = to;
      audit(u, 'Changed where meetings are kept', `${(list.find(x => x.id === to.store) || { name: 'Appliance database' }).name}, ${to.gb} GB`, `Removed ${removed} meetings · Vanik Sense`); return { storage: to, removed }; });
    on('GET', '/api/sense/org', ({ u }) => { need(u, 'sense'); guard(u); return { ...orgView(), rows: tree() }; });
    on('GET', '/api/sense/org/template', ({ u }) => { need(u, 'sense'); return { name: 'vanik-sense-reporting-lines-template.csv', csv: TEMPLATE, columns: [['work_email', 'Needed. One row per person.'], ['manager_email', "Their manager's work email, or their employee ID. Leave empty for the person at the top."], ['dotted_line_managers', 'Any second manager. Several are separated by a semicolon.'], ['employee_id, name, title, department, team, business_unit, location', 'Helpful, not needed.'], ['status', "Rows marked Inactive, Left or Terminated are skipped."]] }; });
    on('POST', '/api/sense/org/upload', ({ u, body }) => { need(u, 'sense'); guardTop(u); const r = readOrg(String(body.text || '').slice(0, 6e6));
      const report = r.errors.length ? [['row', 'problem'].join(','), ...r.errors.map(e => `${e.row},"${e.text.replace(/"/g, '""')}"`)].join('\n') : '';
      if (!r.errors.length && r.people.length && !body.check) setOrg(u, r.people, 'Sheet: ' + String(body.name || 'uploaded file').slice(0, 80));
      return { ok: !r.errors.length && r.people.length > 0, applied: !r.errors.length && r.people.length > 0 && !body.check, people: r.people.length, managers: new Set(r.people.map(p => p.managerEmail).filter(Boolean)).size, errors: r.errors.slice(0, 200), errorCount: r.errors.length, warnings: r.warnings, report }; });
    on('POST', '/api/sense/org/connect', ({ u, body }) => { need(u, 'sense'); guardTop(u); if (!SYSTEMS.includes(body.system)) throw err(400, 'Pick a system from the list.'); const r = readOrg(sampleCsv()); setOrg(u, r.people, body.system); return { ok: true, people: r.people.length, system: body.system }; });
    on('DELETE', '/api/sense/org', ({ u }) => { need(u, 'sense'); guardTop(u); setOrg(u, [], ''); S.org.at = ''; return { ok: true }; });
  }
  // the sample company: the five people of the sample workspace and four who have no account yet
  function sampleCsv() { const by = n => db.users.find(x => x.name.startsWith(n)), o = db.users.find(x => x.role === 'owner'), m = x => (x ? mailOf(x) : ''), row = (id, x, name, mail, title, dept, team, mgr, dot = '') => [id, x ? x.name : name, x ? m(x) : mail, title, dept, team, 'India', 'Pune', mgr, dot, 'Active'].join(',');
    return [TEMPLATE.split('\n')[0], row('E001', o, '', '', 'Managing Director', 'Leadership', '', ''), row('E004', by('Asha'), '', '', 'Head of Finance and Procurement', 'Finance', '', m(o)), row('E011', by('Rohan'), '', '', 'Procurement Manager', 'Procurement', 'Direct materials', m(by('Asha'))),
      row('E015', by('Neha'), '', '', 'HR Business Partner', 'HR and people', '', m(by('Asha')), m(o)), row('E027', by('Imran'), '', '', 'Buyer', 'Procurement', 'Direct materials', m(by('Rohan'))), row('E006', null, 'Kiran Desai', 'kiran.desai@example.com', 'Plant Head', 'Operations', 'Pune plant', m(o)),
      row('E031', null, 'Meena Pillai', 'meena.pillai@example.com', 'Accounts Executive', 'Finance', 'Payables', m(by('Asha'))), row('E033', null, 'Sunil Joshi', 'sunil.joshi@example.com', 'Shift Supervisor', 'Operations', 'Pune plant', 'kiran.desai@example.com'), row('E040', null, 'Tara Bose', 'tara.bose@example.com', 'Buyer', 'Procurement', 'Indirect', m(by('Rohan')))].join('\n'); }
  function sample(u) { const r = readOrg(sampleCsv()); S.org = { people: r.people, source: 'Sheet: reporting-lines.csv', at: now(), by: u.name }; S.policy.team.reach = 'direct'; }
  return { routes, sample, isAdmin, wayOn, teamIds, skipped, expired, policy: P, watchers, managerOf, readOrg, DEPTS };
};
