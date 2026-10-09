// The rest of the suite. In Vanik OS: the five other apps (install, health, access), first-run set-up and the recovery key,
// the plan, the evidence pack. As apps of their own at #/app/...: Document processing, Desk, Echo, Scout and MeasureBook.
import { S, $, esc, icon, info, chip, go, ago, when, api, refresh, rerender, acts, ins, toast, modal, confirmBox, menu, navToggle, downloadText, accessPicker, accessDrafts, accessLabel, extractFile, pickFiles, themeButton, userButton, LOGO } from './core.js';
import { osShell } from './os.js';
import { scoutPage, mbPage, mbotPage, echoPage } from './real.js';

const X = { s: null, key: '', ev: null, evKey: '' }, P = {};
export const suiteRouteChanged = () => { X.key = ''; X.evKey = ''; Object.keys(P).forEach(k => { if (k.endsWith('Key')) P[k] = ''; }); };
export const suiteNeed = () => need();
const need = () => { if (X.key !== 'suite') { X.key = 'suite'; api('GET', '/api/suite').then(d => { X.s = d; rerender(); }).catch(() => {}); } return X.s; };
const setSuite = async (method, path, body) => { X.s = await api(method, path, body); await refresh(); };
const get = (slot, key, path) => { if (P[slot + 'Key'] !== key) { P[slot + 'Key'] = key; P[slot] = null; api('GET', path).then(d => { if (P[slot + 'Key'] === key) { P[slot] = d; rerender(); } }).catch(e => toast(e.message, 'err')); } return P[slot]; };
const put = async (slot, method, path, body) => { try { P[slot] = await api(method, path, body); rerender(); return P[slot]; } catch (e) { toast(e.message, 'err'); return null; } };
const copy = t => `<button class="icon-btn sm" data-act="copy" data-text="${esc(t)}" data-tip="Copy" aria-label="Copy">${icon('content_copy')}</button>`;
const rupees = n => n == null ? '' : '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const DOT = { ok: 'ok', warn: 'warn', err: 'err' }, dot = st => `<span class="hdot ${DOT[st] || ''}"></span>`;
const stat = a => a.status === 'running' ? (S.boot.device.online ? ['Running', 'ok'] : ['Offline', 'err']) : a.status === 'stopped' ? ['Stopped', ''] : ['Not installed', ''];
const head = (title, sub, right = '') => `<div class="page-head"><div class="grow"><h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div>${right}</div>`;
const readFiles = async () => { const out = []; for (const f of await pickFiles(true)) { try { const x = await extractFile(f, t => toast(t)); out.push({ name: f.name, text: (x.pages || []).join('\n\n') }); } catch (e) { toast(e.message, 'err'); } } return out; };

// ================= Vanik OS =================
acts['suite-install'] = el => { const a = S.boot.suite.apps.find(x => x.id === el.dataset.id); modal({ title: 'Install ' + a.name, text: `Reserves ${a.needsGb} GB on ${S.boot.device.name}. ${S.boot.device.freeGb} GB is free. Vanik OS issues its gateway key.`, actions: [{ label: 'Install', run: async () => { await setSuite('POST', `/api/suite/apps/${a.id}/install`); toast(a.name + ' is running.'); go('#/os/apps/' + a.id); } }] }); };
acts['suite-menu'] = el => { const a = X.s.apps.find(x => x.id === el.dataset.id); menu(el, [a.status === 'running' ? { label: 'Stop', icon: 'stop_circle', run: () => confirmBox(`Stop ${a.name}?`, 'People cannot open it until you start it again. Its data is kept.', 'Stop', () => setSuite('POST', `/api/suite/apps/${a.id}/stop`)) } : { label: 'Start', icon: 'play_circle', run: () => setSuite('POST', `/api/suite/apps/${a.id}/start`).catch(e => toast(e.message, 'err')) }, '-', { label: 'Uninstall', icon: 'delete_outline', danger: true, run: () => confirmBox(`Uninstall ${a.name}?`, 'The app is removed from the device and its gateway key stops working. What people made in it is kept on the appliance.', 'Uninstall', async () => { await setSuite('DELETE', `/api/suite/apps/${a.id}`); go('#/os/apps'); }) }]); };
acts['suite-access'] = el => { const a = X.s.apps.find(x => x.id === el.dataset.id), c = a.access; accessDrafts.sx = { mode: c.mode, teams: [...c.teams], users: [...c.users], deny: [...(c.deny || [])] }; modal({ title: 'Who can use ' + a.name, wide: true, body: accessPicker('sx'), actions: [{ label: 'Save', run: async () => { await setSuite('PUT', `/api/suite/apps/${a.id}/access`, { access: accessDrafts.sx }); toast('Access saved.'); } }] }); };
ins['suite-role'] = async el => { const a = X.s.apps.find(x => x.id === el.dataset.id), roles = { ...a.roles, [el.dataset.key]: el.value }; await setSuite('PUT', `/api/suite/apps/${a.id}/access`, { roles }); toast('Role saved.'); };
acts['suite-req'] = async el => { await setSuite('POST', `/api/suite/apps/${el.dataset.id}/requests/${el.dataset.uid}`, { allow: !!el.dataset.v }); toast(el.dataset.v ? 'Access given.' : 'Request declined.'); };
acts['suite-ask'] = async el => { await api('POST', `/api/suite/apps/${el.dataset.id}/request`); toast('Sent. An admin will see your request.'); };
const ATABS = [['', 'Overview'], ['setup', 'Setup'], ['people', 'People'], ['activity', 'Activity']];
function appManage(id, tab = '') {
  const s = need(), a = s && s.apps.find(x => x.id === id);
  if (!a) return osShell('apps', 'Apps', '<p class="muted">Loading…</p>');
  if (a.status === 'not_installed') return osShell('apps', 'Apps', `<a class="back" href="#/os/apps">${icon('arrow_back')}Apps</a><div class="empty">${icon(a.icon)}${esc(a.name)} is not installed on this device.<br><button class="btn" data-act="suite-install" data-id="${a.id}">Install</button></div>`);
  if (!ATABS.some(t => t[0] === tab)) tab = '';
  const st = stat(a), H = k => a.health.find(h => h.name === k), row = (label, sub, right = '') => `<div class="set-row"><div class="grow"><div class="lbl">${label}</div><div class="small muted" style="white-space:normal">${sub}</div></div>${right}</div>`;
  let body = '';
  if (tab === '') body = `<div class="card"><div class="card-head"><h3>Health</h3>${info('Six checks, tested from this console.')}</div>${a.health.map(h => `<div class="set-row">${dot(h.state)}<div class="grow"><div class="lbl">${esc(h.name)}</div><div class="small muted">${esc(h.detail)}</div></div></div>`).join('')}</div>
      <div class="card"><dl class="kv"><dt>Device</dt><dd>${esc(S.boot.device.name)}</dd><dt>Port</dt><dd class="mono">${a.port}</dd><dt>Memory reserved</dt><dd>${a.needsGb} GB</dd><dt>Installed</dt><dd>${when(a.installedAt)} by ${esc(a.by)}</dd></dl></div>`;
  if (tab === 'setup') body = `<div class="card"><div class="card-head"><h3>Filled in by Vanik OS</h3>${info('These are wired for the app when it is installed and again on every start. Nobody types an address, a key or a password.')}</div>
        ${row('Model', esc(H('Model').detail), dot(H('Model').state))}${row('Gateway key', esc(H('Gateway key').detail), dot(H('Gateway key').state))}${row('Where its data is kept', 'On this appliance. It stays when the app is uninstalled and is picked up again on reinstall.', dot('ok'))}</div>
      <div class="card"><div class="card-head"><h3>Settings for this app</h3></div>${row(esc(H('Data').name === 'Data' ? 'What it has' : ''), esc(H('Data').detail), a.canUse ? `<a class="btn ghost" href="#/app/${a.id}">Open the app</a>` : '')}<p class="small faint" style="margin-top:10px">Anything else is set inside the app by the people who use it. There is nothing to configure by hand.</p></div>`;
  if (tab === 'people') {
    const first = a.roleList[0][0], can = u => u.role !== 'user' || (!(a.access.deny || []).includes(u.id) && (a.access.mode === 'everyone' || a.access.users.includes(u.id) || (u.teams || []).some(t => a.access.teams.includes(t))));
    const pick = (key, cur) => `<select class="input" style="width:auto" data-change="suite-role" data-id="${a.id}" data-key="${esc(key)}" aria-label="Role">${a.roleList.map(r => `<option value="${esc(r[0])}" ${r[0] === cur ? 'selected' : ''}>${esc(r[0])}</option>`).join('')}</select>`;
    const teams = a.access.mode === 'everyone' ? S.boot.teams : a.access.teams, top = a.roleList.find(r => / admin$/i.test(r[0])) || a.roleList[0];
    body = `${a.requests.length ? `<div class="card next"><div class="card-head"><h3>Asked for this app</h3></div>${a.requests.map(r => `<div class="set-row"><div class="grow"><div class="lbl">${esc(r.name)}</div><div class="small muted">${ago(r.at)}</div></div><button class="btn ghost" data-act="suite-req" data-id="${a.id}" data-uid="${r.userId}" data-v="">Decline</button><button class="btn" data-act="suite-req" data-id="${a.id}" data-uid="${r.userId}" data-v="1">Allow</button></div>`).join('')}</div>` : ''}
      <div class="card">${row('Who can open it', `${esc(accessLabel(a.access))}${(a.access.deny || []).length ? ` · ${a.access.deny.length} blocked` : ''}`, `<button class="btn ghost" data-act="suite-access" data-id="${a.id}">Change</button>`)}</div>
      <div class="card"><div class="card-head"><h3>What they can do in it</h3>${info('Each app names its own roles. A person without one gets ' + first + '. A role on a person wins over a role on their team.')}</div>
        ${a.roleList.map(r => `<div class="row small" style="gap:8px;margin-bottom:4px"><b style="flex:0 0 150px">${esc(r[0])}</b><span class="muted">${esc(r[1])}</span></div>`).join('')}
        ${teams.length ? `<div class="cap" style="margin:14px 0 4px">Teams</div>${teams.map(t => `<div class="set-row"><div class="grow lbl">${esc(t)}</div>${pick('t:' + t, a.roles['t:' + t] || first)}</div>`).join('')}` : ''}
        <div class="cap" style="margin:14px 0 4px">People</div>${S.boot.users.filter(can).map(u => `<div class="set-row"><div class="grow"><div class="lbl">${esc(u.name)}</div><div class="small muted">${u.role === 'user' ? ((u.teams || []).join(', ') || 'No team') : 'Admin of this appliance'}</div></div>${pick('u:' + u.id, a.roles['u:' + u.id] || (u.teams || []).map(t => a.roles['t:' + t]).find(Boolean) || (u.role === 'user' ? first : top[0]))}</div>`).join('')}</div>`;
  }
  if (tab === 'activity') { const L = get('appAct', id, `/api/plane/apps/${id}/activity`); body = `<div class="card"><div class="card-head"><h3>What was done in and to this app</h3></div>${!L ? '<p class="muted">Loading…</p>' : L.length ? L.map(e => `<div class="set-row"><div class="grow"><div class="lbl" style="white-space:normal">${esc(e.what)}${e.on ? ': ' + esc(e.on) : ''}</div><div class="small muted">${esc(e.who)}${e.detail ? ' · ' + esc(e.detail) : ''}</div></div><span class="small faint">${ago(e.at)}</span></div>`).join('') : '<p class="muted">Nothing recorded yet.</p>'}</div>`; }
  return osShell('apps', `<a href="#/os/apps">Apps</a> / ${esc(a.name)}`, `<a class="back" href="#/os/apps">${icon('arrow_back')}Apps</a>
    <div class="page-head"><span class="app-ico">${icon(a.icon)}</span><div class="grow"><h1>${esc(a.name)} ${chip(st[0], st[1])}</h1><p class="sub">${esc(a.what)}</p></div>${a.canUse ? `<a class="btn" href="#/app/${a.id}">Open</a>` : ''}<button class="icon-btn" data-act="suite-menu" data-id="${a.id}" aria-label="More">${icon('more_vert')}</button></div>
    <nav class="tabs">${ATABS.map(t => `<a class="${t[0] === tab ? 'on' : ''}" href="#/os/apps/${a.id}${t[0] ? '/' + t[0] : ''}">${t[1]}</a>`).join('')}</nav><div class="stack" style="max-width:820px;gap:16px">${body}</div>`);
}
export function appsCard() {
  const B = S.boot, s = X.s, rows = [];
  if (B.app.status !== 'not_installed') rows.push(['forum', 'VanikGPT', B.app.status === 'running' && B.device.online ? 'ok' : B.app.status === 'running' ? 'err' : 'warn', { running: B.device.online ? 'Running' : 'Stopped with the appliance', needs_setup: 'Needs setup', deploying: 'Deploying', stopped: 'Stopped' }[B.app.status] || '', '#/os/apps/vanikgpt/overview']);
  (s ? s.apps : []).filter(a => a.status !== 'not_installed').forEach(a => { const bad = a.health.filter(h => h.state === 'err').length, warn = a.health.filter(h => h.state === 'warn').length; rows.push([a.icon, a.name, bad ? 'err' : warn ? 'warn' : 'ok', bad ? a.health.find(h => h.state === 'err').detail : warn ? a.health.find(h => h.state === 'warn').detail : 'All six checks pass', '#/os/apps/' + a.id]); });
  if (!rows.length) return '';
  return `<div class="card" style="margin-bottom:16px"><div class="card-head"><h3>Apps</h3><a class="btn ghost right" href="#/os/apps">All apps</a></div>${rows.map(r => `<a class="set-row" href="${r[4]}" style="text-decoration:none;color:inherit">${dot(r[2])}<span class="avatar sq">${icon(r[0])}</span><div class="grow"><div class="lbl">${esc(r[1])}</div><div class="small muted">${esc(r[3])}</div></div>${icon('chevron_right')}</a>`).join('')}</div>`;
}
export const setupBanner = () => S.boot.suite && !S.boot.suite.setupDone ? `<div class="banner" style="margin-bottom:16px">${icon('rocket_launch')}<span class="grow">Finish setting up this appliance: a name, a first model and a recovery key.</span><a class="btn" href="#/os/welcome">Set up</a></div>` : '';

// ---------- set-up and recovery
const showKey = (key, then) => { modal({ title: 'Save your recovery key', text: 'It is the only way back in if every owner is locked out. It is shown once and never again.', cancel: '', body: `<div class="row" style="margin-bottom:14px"><span class="mono grow" style="font-size:15px;color:var(--vnk-ink);overflow-wrap:anywhere">${esc(key)}</span>${copy(key)}</div><label class="row" style="gap:8px;cursor:pointer"><input type="checkbox" id="rk-ok"> <span>I have saved it somewhere safe</span></label>`, actions: [{ label: 'Done', run: o => { if (!$('#rk-ok', o).checked) throw new Error('Tick the box once the key is saved.'); if (then) then(); } }] }); const g = document.querySelector('.overlay:last-child .actions .btn.ghost'); if (g) g.remove(); };
acts['setup-go'] = async () => { try { const r = await api('POST', '/api/suite/setup', { name: $('#su-name').value, domain: $('#su-domain').value, modelId: $('#su-model').value }); X.s = r.suite; await refresh(); showKey(r.recoveryKey, () => go('#/os/home')); } catch (e) { toast(e.message, 'err'); } };
acts['rk-new'] = () => confirmBox('Make a new recovery key?', 'The key you have now stops working.', 'Make a new key', async () => { const r = await api('POST', '/api/suite/recovery'); X.s = r.suite; rerender(); showKey(r.recoveryKey); }, false);
acts['rk-check'] = () => modal({ title: 'Check a recovery key', text: 'Type the key you saved to make sure it is the right one.', body: `<input class="input mono" id="rk-in" autocomplete="off" placeholder="VNK-XXXX-XXXX-XXXX-XXXX-XXXX">`, actions: [{ label: 'Check', run: async o => { const r = await api('POST', '/api/suite/recovery/check', { key: $('#rk-in', o).value }); toast(r.ok ? 'That key is correct.' : 'That is not the current key.', r.ok ? '' : 'err'); } }] });
function setupPage() {
  const B = S.boot, d = B.device, chat = B.models.filter(m => m.kind === 'chat').sort((a, b) => a.memGb - b.memGb), serving = chat.find(m => m.status === 'serving');
  return osShell('home', 'Set up', `<div style="max-width:560px;margin:0 auto">${head('Set up this appliance', 'Three things, then it is ready for people.')}
    <div class="card stack" style="gap:18px">
      <label class="field"><span>What should people call it</span><input class="input" id="su-name" maxlength="40" value="${esc(d.name)}"></label>
      <label class="field"><span>First model ${info('The model people chat with first. You can serve others later in the Model Hub.')}</span><select class="input" id="su-model">${chat.map(m => `<option value="${esc(m.id)}" ${serving ? (m.id === serving.id ? 'selected' : '') : ''} ${m.status !== 'serving' && m.memGb > d.freeGb ? 'disabled' : ''}>${esc(m.id)} · ${m.memGb} GB${m.status === 'serving' ? ' · serving now' : m.memGb > d.freeGb ? ' · too big for the free memory' : ''}</option>`).join('')}</select></label>
      <details class="adv"><summary class="small">A company address (optional)</summary><label class="field" style="margin-top:10px"><span>Company domain ${info('A name you own, such as ai.yourcompany.com. Your network team points it at the appliance. You can add it later under Devices.')}</span><input class="input" id="su-domain" placeholder="ai.yourcompany.com" value="${esc((B.network || {}).domain || '')}"></label></details>
      <div class="row"><span class="small muted grow">You get a recovery key on the next step.</span><button class="btn lg" data-act="setup-go">Finish set-up</button></div></div></div>`);
}
function settingsCards() {
  const s = X.s; if (!s) return '';
  const p = s.plan, r = s.recovery;
  return `<div class="stack" style="max-width:820px;gap:16px;margin-bottom:16px">
    <div class="card"><div class="row"><div class="grow"><h3>${esc(p.tier)} plan</h3><p class="small muted">${p.used} of ${p.people} people · ${esc(p.hardware)} · renews ${esc(new Date(p.renewsOn).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }))}</p></div>${p.over ? chip('Over the plan', 'err') : ''}</div><div class="meter" style="margin-top:10px"><i style="width:${Math.min(100, Math.max(1, 100 * p.used / p.people)).toFixed(1)}%"></i></div><p class="small faint" style="margin-top:10px">Every app in the store is included. To add people or change the device, talk to Vanik.</p></div>
    <div class="card"><div class="row"><div class="grow"><h3>Recovery key</h3><p class="small muted">${r ? `Made ${ago(r.createdAt)} by ${esc(r.by)}. Only its fingerprint is kept here.` : 'None yet. Without one, a locked-out owner cannot get back in.'}</p></div>${r ? `<button class="btn ghost" data-act="rk-check">Check a key</button>` : ''}<button class="btn ${r ? 'ghost' : ''}" data-act="rk-new">${r ? 'Make a new key' : 'Make a key'}</button></div>
      <div class="set-row" style="margin-top:12px"><div class="grow"><div class="lbl">Set-up</div><div class="small muted">${s.setup ? 'Finished ' + ago(s.setup.doneAt) + ' by ' + esc(s.setup.by) : 'Not finished'}</div></div><a class="btn ghost" href="#/os/welcome">${s.setup ? 'Run again' : 'Set up'}</a></div></div></div>`;
}

// ---------- model from a file
acts['model-import'] = async () => {
  const f = (await pickFiles(false))[0]; if (!f) return;
  let m; try { m = JSON.parse(await f.text()); } catch { return toast('That file is not a model package.', 'err'); }
  modal({ title: 'Add ' + (m.id || 'this model') + '?', text: `${m.kind || 'Unknown kind'} · needs ${m.memGb || '?'} GB. It is added to the Model Hub, not served. This build checks that the package is complete and signed; it does not verify the signature.`, actions: [{ label: 'Add', run: async () => { await api('POST', '/api/suite/models/import', { manifest: m }); toast(m.id + ' is in the Model Hub.'); await refresh(); } }] });
};

// ---------- evidence pack
const evMd = e => [`# Evidence pack: ${e.appliance}`, `Made ${new Date(e.at).toLocaleString('en-IN')} · Vanik OS ${e.os}`, '', '## Where data goes', ...e.leaves.map(l => `- ${l.what}: ${l.on ? 'YES' : 'no'}. ${l.detail}`), '', '## How long things are kept', ...e.kept.map(k => `- ${k.what}: ${k.rule}`), '', '## What is hidden', ...e.hidden.map(k => `- ${k.what}: ${k.rule}`), '', '## Who may use what', ...e.access.map(a => `- ${a.what}: ${a.total} in all, ${a.limited} limited to chosen people`), `- People: ${e.people.total}, of whom ${e.people.admins} are owners or admins`, '', '## The record', `- ${e.log.entries} entries in the audit log${e.log.first ? `, from ${e.log.first.slice(0, 10)} to ${e.log.last.slice(0, 10)}` : ''}. Each entry carries the fingerprint of the one before it, so a change or a gap shows.`, '- The full log is in the file audit-log.csv that comes with this pack.'].join('\n');
acts['ev-download'] = async () => { const e = await api('GET', '/api/suite/evidence?download=1'), log = await api('GET', '/api/admin/audit/export'); downloadText('vanik-evidence-' + e.at.slice(0, 10) + '.md', evMd(e), 'text/markdown'); downloadText(log.name + '.csv', log.csv, 'text/csv'); toast('Two files saved: the pack and the audit log.'); };
function evidencePage() {
  if (X.evKey !== 'ev') { X.evKey = 'ev'; api('GET', '/api/suite/evidence').then(e => { X.ev = e; rerender(); }).catch(e => toast(e.message, 'err')); }
  const e = X.ev, card = (title, tip, rows) => `<div class="card"><div class="card-head"><h3>${title}</h3>${info(tip)}</div>${rows}</div>`;
  return osShell('activity', 'Evidence', `${head('Evidence pack', 'What an auditor asks: where data goes, how long it is kept, what is hidden, who may use what. Read from the live settings.', e ? `<button class="btn" data-act="ev-download">${icon('download')}Download</button>` : '')}
    ${!e ? '<p class="muted">Loading…</p>' : `<div class="stack" style="max-width:860px;gap:16px">
      ${card('Where data goes', 'Each line is read from a setting on this appliance. Nothing here is typed by hand.', e.leaves.map(l => `<div class="set-row">${dot(l.on ? 'warn' : 'ok')}<div class="grow"><div class="lbl">${esc(l.what)}</div><div class="small muted">${esc(l.detail)}</div></div>${chip(l.on ? 'Yes' : 'No', l.on ? 'warn' : 'ok', false)}</div>`).join(''))}
      ${card('How long things are kept', 'Change these in VanikGPT setup and under Devices, Storage.', e.kept.map(k => `<div class="set-row"><div class="grow lbl">${esc(k.what)}</div><span class="muted">${esc(k.rule)}</span></div>`).join(''))}
      ${card('What is hidden', 'Change these in VanikGPT setup, Safety.', e.hidden.map(k => `<div class="set-row"><div class="grow lbl">${esc(k.what)}</div><span class="muted">${esc(k.rule)}</span></div>`).join(''))}
      ${card('Who may use what', 'Change these on the Access page.', e.access.map(a => `<div class="set-row"><div class="grow lbl">${esc(a.what)}</div><span class="muted">${a.total} in all · ${a.limited} limited to chosen people</span></div>`).join('') + `<div class="set-row"><div class="grow lbl">People</div><span class="muted">${e.people.total} · ${e.people.admins} owners or admins${e.people.fromDirectory ? ` · ${e.people.fromDirectory} from the directory` : ''}</span></div>`)}
      ${card('The record', 'Each entry carries the fingerprint of the one before it, so a change or a gap shows.', `<div class="set-row"><div class="grow lbl">Audit log</div><span class="muted">${e.log.entries} entries${e.log.first ? ' since ' + new Date(e.log.first).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</span></div>`)}</div>`}`);
}
function accessCard() {
  const s = X.s; if (!s) return '';
  const rows = s.apps.filter(a => a.status !== 'not_installed');
  return `${rows.length ? `<div class="card" style="margin-bottom:16px;max-width:860px"><div class="card-head"><h3>Apps</h3>${info('Who can open each app. VanikGPT is set in its own setup.')}</div>${rows.map(a => `<div class="set-row"><span class="avatar sq">${icon(a.icon)}</span><div class="grow"><div class="lbl">${esc(a.name)}</div><div class="small muted">${esc(accessLabel(a.access))}${(a.access.deny || []).length ? ` · ${a.access.deny.length} blocked` : ''}</div></div><button class="btn ghost" data-act="suite-access" data-id="${a.id}">Change</button></div>`).join('')}</div>` : ''}`;
}
export function suiteOsPage(parts) {
  if (!S.boot.admin) return undefined;
  const [p, a] = parts;
  if (p === 'apps' && S.boot.suite.apps.some(x => x.id === a)) return appManage(a, parts[2]);
  if (p === 'welcome') return setupPage();
  if (p === 'access' && a === 'evidence') return evidencePage();
  return undefined;
}
export function suiteDecorate(parts, html) {
  if (!S.boot || !S.boot.admin || typeof html !== 'string') return html;
  const [p, a] = parts, after = add => html.replace(/(<div class="page-head">.*)/, m => m + add);
  if (p === 'access' && !a) { need(); return after(accessCard()); }
  if (p === 'people' && S.boot.suite.plan && S.boot.suite.plan.over) return after(`<div class="banner" style="margin-bottom:16px">${icon('group_add')}<span class="grow">${S.boot.suite.plan.used} people are on a plan for ${S.boot.suite.plan.people}. Talk to Vanik to add more.</span></div>`);
  return html;
}

// ================= the apps =================
function appShell(id, crumb, content) {
  const B = S.boot, apps = B.suite.apps.filter(a => a.canUse), me = B.suite.apps.find(a => a.id === id) || {};
  return `<div class="shell"><aside class="console-nav"><a class="brand" href="#/app/${id}">${LOGO}<span>VANIK <em>${esc((me.name || '').replace(/^Vanik /, '').split(' ')[0].toUpperCase())}</em></span></a>
    <span class="nav-group-label">Apps</span>${B.canUseGpt ? `<a class="nav-item" href="#/gpt">${icon('forum')}<span>VanikGPT</span></a>` : ''}${apps.map(a => `<a class="nav-item ${a.id === id ? 'is-active' : ''}" href="#/app/${a.id}">${icon(a.icon)}<span>${esc(a.name)}</span></a>`).join('')}
    ${B.admin ? `<span class="nav-group-label">Admin</span><a class="nav-item" href="#/os/apps/${id}">${icon('tune')}<span>Manage in Vanik OS</span></a>` : ''}</aside>
    <div class="main"><header class="topbar">${navToggle()}<span class="crumb">${crumb}</span><span class="right"></span>${me.role ? `<span class="chip" data-tip="Your role in ${esc(me.name)}. An admin sets it in Vanik OS.">${esc(me.role)}</span>` : ''}${themeButton()}${userButton()}</header><div class="scroll" id="scroll"><div class="page">${content}</div></div></div></div>`;
}
const loading = '<p class="muted">Loading…</p>';

// ---------- Document processing
acts['idp-add'] = async () => { const files = await readFiles(); let last = null; for (const f of files) { try { last = await api('POST', '/api/idp/docs', f); } catch (e) { toast(e.message, 'err'); } } P.idpKey = ''; if (last && files.length === 1) go('#/app/idp/' + last.id); else rerender(); };
acts['idp-export'] = async () => { const r = await api('GET', '/api/idp/export'); if (!r.count) return toast('Nothing is approved yet.', 'err'); downloadText(r.name + '.csv', r.csv, 'text/csv'); downloadText(r.name + '.json', JSON.stringify(r.json, null, 2), 'application/json'); toast(`${r.count} approved documents saved as a sheet and as JSON.`); };
ins['idp-field'] = el => put('idpDoc', 'PUT', `/api/idp/docs/${el.dataset.id}`, { key: el.dataset.key, value: el.value });
acts['idp-confirm'] = el => put('idpDoc', 'PUT', `/api/idp/docs/${el.dataset.id}`, { key: el.dataset.key, value: el.dataset.v, confirm: true });
acts['idp-approve'] = async el => { const d = await put('idpDoc', 'POST', `/api/idp/docs/${el.dataset.id}/approve`, { reopen: el.dataset.re === '1' }); if (d) toast(d.status === 'approved' ? 'Approved. It is in the export now.' : 'Reopened.'); };
acts['idp-del'] = el => confirmBox('Delete this document?', 'The fields read from it are removed too.', 'Delete', async () => { await api('DELETE', '/api/idp/docs/' + el.dataset.id); go('#/app/idp'); });
const idpChip = d => d.status === 'approved' ? chip('Approved', 'ok') : d.open ? chip(d.open + ' to check', 'warn') : chip('Ready to approve', 'line');
function idpPage(id) {
  if (id) {
    const d = get('idpDoc', id, '/api/idp/docs/' + id); if (!d) return appShell('idp', 'Document processing', loading);
    const lock = d.status === 'approved';
    return appShell('idp', `<a href="#/app/idp">Document processing</a> / ${esc(d.name)}`, `<a class="back" href="#/app/idp">${icon('arrow_back')}All documents</a>
      ${head(esc(d.name), `${esc({ gst_invoice: 'GST invoice', purchase_order: 'Purchase order', eway_bill: 'E-way bill' }[d.template])} · added by ${esc(d.addedBy)} ${ago(d.addedAt)}${lock ? ` · approved by ${esc(d.approvedBy)}` : ''}`, `${idpChip(d)}<button class="btn ${lock ? 'ghost' : ''}" data-act="idp-approve" data-id="${d.id}" data-re="${lock ? 1 : 0}">${lock ? 'Reopen' : 'Approve'}</button><button class="icon-btn" data-act="idp-del" data-id="${d.id}" data-tip="Delete" aria-label="Delete">${icon('delete_outline')}</button>`)}
      <div class="grid two" style="grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);align-items:start">
        <div class="stack" style="gap:16px"><div class="card"><div class="card-head"><h3>Fields</h3>${info('A field marked to check was not found, did not pass its test, or was read with less certainty. Type the right value, or tick it if it is right.')}</div>
          ${d.fields.map(f => { const low = !f.doubt && f.value && f.conf < 0.8; return `<div class="set-row"><div style="flex:0 0 150px"><div class="lbl">${esc(f.label)}</div>${f.doubt ? `<div class="small" style="color:var(--vnk-warn)">${esc(f.doubt)}</div>` : low ? `<div class="small" style="color:var(--vnk-warn)">Check this</div>` : f.corrected ? `<div class="small faint">Checked by a person</div>` : ''}</div><input class="input grow ${f.doubt || low ? 'warn' : ''}" value="${esc(f.value)}" ${lock ? 'disabled' : ''} data-change="idp-field" data-id="${d.id}" data-key="${f.key}" aria-label="${esc(f.label)}">${low && !lock ? `<button class="icon-btn sm" data-act="idp-confirm" data-id="${d.id}" data-key="${f.key}" data-v="${esc(f.value)}" data-tip="It is right" aria-label="It is right">${icon('check')}</button>` : ''}</div>`; }).join('')}</div>
          ${d.history.length ? `<div class="card"><div class="card-head"><h3>Changes by people</h3></div>${d.history.map(h => `<div class="set-row"><div class="grow"><div class="lbl">${esc(h.field)}</div><div class="small muted">${esc(h.was || 'empty')} → ${esc(h.now || 'empty')}</div></div><span class="small faint">${esc(h.by)} · ${ago(h.at)}</span></div>`).join('')}</div>` : ''}</div>
        <div class="stack" style="gap:16px"><div class="card"><div class="card-head"><h3>Checks</h3></div>${d.checks.length ? d.checks.map(c => `<div class="set-row">${dot(c.ok ? 'ok' : 'err')}<div class="grow"><div class="lbl">${esc(c.name)}</div><div class="small muted">${esc(c.detail)}</div></div></div>`).join('') : '<p class="muted">No checks for this kind of document.</p>'}</div>
          <div class="card"><div class="card-head"><h3>The document</h3></div><pre class="code" style="white-space:pre-wrap;max-height:420px;overflow:auto">${esc(d.text)}</pre></div></div></div>`);
  }
  const l = get('idp', 'list', '/api/idp');
  return appShell('idp', 'Document processing', head('Document processing', 'Fields from invoices, orders and e-way bills, checked, then sent on as a sheet or JSON.', `<button class="btn ghost" data-act="idp-export">${icon('download')}Export approved</button><button class="btn" data-act="idp-add">${icon('upload_file')}Add documents</button>`)
    + (!l ? loading : !l.docs.length ? `<div class="empty">${icon('description')}No documents yet. Add a PDF, a scan or a sheet and the fields are read from it.</div>` : `<div class="card"><table class="list"><tr><th>Document</th><th>Kind</th><th>Total</th><th>State</th><th>Added</th></tr>${l.docs.map(d => `<tr><td><a href="#/app/idp/${d.id}"><b>${esc(d.name)}</b></a></td><td>${esc(d.template)}</td><td class="mono">${esc(d.total)}</td><td>${idpChip(d)}</td><td class="muted small">${esc(d.addedBy)} · ${ago(d.addedAt)}</td></tr>`).join('')}</table></div>`));
}

// ---------- Vanik Desk
const TIMER = { met: ['Met', 'ok'], missed: ['Missed', 'err'], late: ['Late', 'err'] };
const timer = (state, due) => state === 'running' ? chip('Due ' + new Date(due).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }), 'line', false) : chip(TIMER[state][0], TIMER[state][1]);
acts['desk-tab'] = el => { P.deskTab = el.dataset.v; rerender(); };
acts['desk-new'] = () => modal({ title: 'New request', wide: true, body: `<div class="stack" style="gap:12px"><div class="row" style="gap:12px"><label class="field grow"><span>From</span><input class="input" id="dk-from" placeholder="Name"></label><label class="field grow"><span>Email</span><input class="input" id="dk-mail" placeholder="name@company.com"></label></div><label class="field"><span>Subject</span><input class="input" id="dk-sub" maxlength="160"></label><label class="field"><span>Message</span><textarea class="input" id="dk-body" rows="5"></textarea></label></div>`, actions: [{ label: 'Add', run: async o => { const t = await api('POST', '/api/desk/tickets', { from: $('#dk-from', o).value, email: $('#dk-mail', o).value, subject: $('#dk-sub', o).value, body: $('#dk-body', o).value }); P.deskKey = ''; go('#/app/desk/' + t.id); } }] });
acts['desk-set'] = () => { const d = P.desk; modal({ title: 'Desk settings', body: `<div class="stack" style="gap:12px"><label class="field"><span>Draft replies from ${info('Replies are drafted from this collection, and show which document they came from.')}</span><select class="input" id="ds-col"><option value="">Nothing</option>${d.collections.map(c => `<option value="${c.id}" ${c.id === d.settings.collectionId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label><div class="row" style="gap:12px"><label class="field grow"><span>First reply within (hours)</span><input class="input" type="number" min="1" max="72" id="ds-f" value="${d.settings.firstHours}"></label><label class="field grow"><span>Solved within (hours)</span><input class="input" type="number" min="1" max="720" id="ds-r" value="${d.settings.resolveHours}"></label></div></div>`, actions: [{ label: 'Save', run: async o => { await api('PUT', '/api/desk/settings', { collectionId: $('#ds-col', o).value, firstHours: +$('#ds-f', o).value, resolveHours: +$('#ds-r', o).value }); P.deskKey = ''; toast('Saved.'); rerender(); } }] }); };
acts['desk-draft'] = async el => { el.disabled = true; try { const r = await api('POST', `/api/desk/tickets/${el.dataset.id}/draft`); if (!r.text) toast('Nothing in the knowledge base matches. Write the reply yourself.', 'err'); else { $('#dk-reply').value = r.text; P.deskSrc = r.sources; $('#dk-src').innerHTML = srcTags(r.sources); } } catch (e) { toast(e.message, 'err'); } el.disabled = false; };
const srcTags = s => { const names = [...new Set((s || []).map(x => x.docName))]; return names.length ? `<span class="small muted">Drafted from</span> ${names.map(n => `<span class="tag">${icon('description')}${esc(n)}</span>`).join(' ')}` : ''; };
acts['desk-send'] = async el => { const t = await put('deskT', 'POST', `/api/desk/tickets/${el.dataset.id}/reply`, { text: $('#dk-reply').value, solve: el.dataset.solve === '1', sources: P.deskSrc || [] }); if (t) { P.deskSrc = null; P.deskKey = ''; toast(el.dataset.solve === '1' ? 'Sent and solved.' : 'Sent.'); } };
ins['desk-edit'] = el => put('deskT', 'PUT', `/api/desk/tickets/${el.dataset.id}`, { [el.dataset.k]: el.value }).then(() => { P.deskKey = ''; });
function deskPage(id) {
  if (id) {
    const t = get('deskT', id, '/api/desk/tickets/' + id), d = get('desk', 'list', '/api/desk'); if (!t || !d) return appShell('desk', 'Vanik Desk', loading);
    return appShell('desk', `<a href="#/app/desk">Vanik Desk</a> / #${t.n}`, `<a class="back" href="#/app/desk">${icon('arrow_back')}All requests</a>${head(esc(t.subject), `#${t.n} · from ${esc(t.from)}${t.email ? ' · ' + esc(t.email) : ''} · ${ago(t.createdAt)}`, chip({ open: 'Open', waiting: 'Waiting on them', solved: 'Solved' }[t.status], t.status === 'solved' ? 'ok' : t.status === 'open' ? 'warn' : 'line'))}
      <div class="grid two" style="grid-template-columns:minmax(0,1fr) 280px;align-items:start"><div class="stack" style="gap:14px">
        ${t.messages.map(m => `<div class="card flat ${m.who === 'agent' ? 'mine' : ''}"><div class="row small muted" style="margin-bottom:6px"><b style="color:var(--vnk-ink)">${esc(m.by)}</b><span>${m.who === 'agent' ? 'replied' : 'wrote'} ${ago(m.at)}</span></div><div style="white-space:pre-wrap">${esc(m.text)}</div>${(m.sources || []).length ? `<div class="row wrap" style="gap:6px;margin-top:10px">${srcTags(m.sources)}</div>` : ''}</div>`).join('')}
        ${t.status === 'solved' ? '' : `<div class="card"><textarea class="input" id="dk-reply" rows="7" placeholder="Write a reply, or draft one from the knowledge base"></textarea><div class="row wrap" id="dk-src" style="gap:6px;margin-top:8px"></div><div class="row" style="margin-top:12px"><button class="btn ghost" data-act="desk-draft" data-id="${t.id}">${icon('auto_awesome')}Draft a reply</button><span class="grow"></span><button class="btn ghost" data-act="desk-send" data-id="${t.id}" data-solve="0">Send</button><button class="btn" data-act="desk-send" data-id="${t.id}" data-solve="1">Send and solve</button></div></div>`}</div>
        <div class="card stack" style="gap:14px"><div><div class="cap">First reply</div><div style="margin-top:6px">${timer(t.firstState, t.firstDue)}</div></div><div><div class="cap">Solved</div><div style="margin-top:6px">${timer(t.resolveState, t.resolveDue)}</div></div>
          <label class="field"><span>Looked after by</span><select class="input" data-change="desk-edit" data-id="${t.id}" data-k="assignee"><option value="">Nobody yet</option>${d.agents.map(a => `<option value="${a.id}" ${a.id === t.assignee ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
          <label class="field"><span>Priority</span><select class="input" data-change="desk-edit" data-id="${t.id}" data-k="priority">${['low', 'normal', 'high'].map(p => `<option value="${p}" ${p === t.priority ? 'selected' : ''}>${p[0].toUpperCase() + p.slice(1)}</option>`).join('')}</select></label>
          <label class="field"><span>State</span><select class="input" data-change="desk-edit" data-id="${t.id}" data-k="status">${[['open', 'Open'], ['waiting', 'Waiting on them'], ['solved', 'Solved']].map(p => `<option value="${p[0]}" ${p[0] === t.status ? 'selected' : ''}>${p[1]}</option>`).join('')}</select></label></div></div>`);
  }
  const d = get('desk', 'list', '/api/desk'), tab = P.deskTab || 'open';
  if (!d) return appShell('desk', 'Vanik Desk', head('Vanik Desk', '') + loading);
  const rows = d.tickets.filter(t => t.status === tab), n = s => d.tickets.filter(t => t.status === s).length;
  return appShell('desk', 'Vanik Desk', head('Vanik Desk', 'One queue for requests. Replies are drafted from your knowledge base and sent by a person.', `${S.boot.admin ? `<button class="icon-btn" data-act="desk-set" data-tip="Settings" aria-label="Settings">${icon('tune')}</button>` : ''}<button class="btn" data-act="desk-new">${icon('add')}New request</button>`)
    + `<nav class="tabs" style="margin-bottom:20px">${[['open', 'Open'], ['waiting', 'Waiting on them'], ['solved', 'Solved']].map(x => `<a class="${x[0] === tab ? 'on' : ''}" data-act="desk-tab" data-v="${x[0]}" style="cursor:pointer">${x[1]} <span class="mono">${n(x[0])}</span></a>`).join('')}</nav>`
    + (!rows.length ? `<div class="empty">${icon('inbox')}Nothing here.</div>` : `<div class="card"><table class="list"><tr><th>Request</th><th>From</th><th>Priority</th><th>First reply</th><th>Solved</th><th>Looked after by</th></tr>${rows.map(t => `<tr><td><a href="#/app/desk/${t.id}"><b>${esc(t.subject)}</b></a><div class="small faint">#${t.n} · ${ago(t.createdAt)}</div></td><td>${esc(t.from)}</td><td>${t.priority === 'high' ? chip('High', 'err', false) : t.priority === 'low' ? chip('Low', 'line', false) : chip('Normal', 'line', false)}</td><td>${timer(t.firstState, t.firstDue)}</td><td>${timer(t.resolveState, t.resolveDue)}</td><td class="muted">${esc(t.assigneeName || 'Nobody yet')}</td></tr>`).join('')}</table></div>`));
}

const PAGES = { idp: idpPage, desk: deskPage, echo: echoPage, mbot: mbotPage, scout: scoutPage, measurebook: mbPage };
export { appShell, get, put, P, readFiles };
export function suiteAppPage(parts) {
  const [id, sub] = parts, B = S.boot, a = B.suite && B.suite.apps.find(x => x.id === id);
  if (!a || !PAGES[id]) return null;
  if (!a.canUse) return `<div class="center-page"><div class="card" style="text-align:center;max-width:420px"><span class="app-ico" style="margin:0 auto 14px">${icon(a.icon)}</span><h2>${esc(a.name)} is not available</h2><p class="muted" style="margin:8px 0 18px">${a.status === 'running' ? (B.device.online ? 'You have not been given this app.' : 'The appliance is offline.') : 'It is not running on this appliance.'}</p>${!B.admin && a.status === 'running' && B.device.online ? `<button class="btn" data-act="suite-ask" data-id="${id}">Request access</button> ` : ''}<a class="btn ${B.admin ? '' : 'ghost'}" href="${B.admin ? '#/os/apps/' + id : '#/me'}">${B.admin ? 'Open in Vanik OS' : 'Back'}</a></div></div>`;
  return PAGES[id](sub, parts[2]);
}
