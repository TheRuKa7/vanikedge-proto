// Vanik OS console pages that VanikGPT touches: Apps, the VanikGPT manage page, Knowledge base, Model Hub, People, Settings.
import { hint } from './hints.js';
import { ADMIN0, STORE0, FEAT0, DATA0, crow, sw, runByDd, accessDd, storageRow, storesBody } from './app_admin.js';
import { LINK0, WEB0, bindSetup, embedCard, stateChip, publishBar, appsCard, appNames, usedBy, teamsCard } from './gpt_setup.js';
import { inScope, later } from './scope.js';
import { navToggle, S, $, esc, icon, info, chip, initials, LOGO, go, bytes, ago, when, api, load, refresh, rerender, acts, ins, toast, modal, confirmBox, menu, themeButton, userButton, ROLE, accessDrafts, accessChanged, accessPicker, accessLabel, extractFile, pickFiles, downloadText } from './core.js';

const NAV = [['home', 'Home', 'home'], ['apps', 'Apps', 'apps'], ['knowledge', 'Knowledge', 'library_books'], ['models', 'Models', 'memory'], ['people', 'People', 'group'], ['activity', 'Activity', 'insights'], ['devices', 'Appliance', 'dns']];
// which place an older page key belongs to, and the tabs each place shows on its top-level pages
const PLACE = { home: 'home', apps: 'apps', knowledge: 'knowledge', connectors: 'knowledge', models: 'models', 'api-gateway': 'models', train: 'models', people: 'people', access: 'people', activity: 'activity', devices: 'devices', settings: 'devices', stores: 'devices' };
const TABS = {
  apps: [['#/os/apps', 'Apps'], ['#/os/connectors/systems', 'Connected systems']],
  knowledge: [['#/os/knowledge', 'Collections'], ['#/os/connectors', 'Sources']],
  models: [['#/os/models', 'On this appliance'], ['#/os/models/outside', 'Outside your network'], ['#/os/api-gateway/keys', 'API keys'], ['#/os/api-gateway/playground', 'Playground'], ['#/os/api-gateway/webhooks', 'Webhooks'], ['#/os/train', 'Train']],
  people: [['#/os/people', 'People'], ['#/os/access', 'Access']],
  activity: [['#/os/activity', 'Usage'], ['#/os/activity/audit', 'Audit log'], ['#/os/access/evidence', 'Evidence']],
  devices: [['#/os/devices', 'Overview'], ['#/os/stores', 'Data stores'], ['#/os/devices/network', 'Network'], ['#/os/devices/storage', 'Storage'], ['#/os/settings', 'Updates'], ['#/os/devices/monitoring', 'Monitoring'], ['#/os/devices/support', 'Support'], ['#/os/devices/advanced', 'Advanced']],
};
const ALIAS = { '#/os/api-gateway': '#/os/api-gateway/keys', '#/os': '#/os/home' };
const OTHER_APPS = [['Intelligent Document Processing', 'Extract structured data from any document, on your own hardware.', 'description'], ['Vanik Desk', 'Customer support with tickets, SLAs and AI assistance, on your own fleet.', 'support_agent'], ['Vanik Echo', 'Live meeting transcription with speaker labels, on your own Vanik Appliance.', 'graphic_eq'], ['Vanik MeasureBook', 'Turn tender drawings into a bid-ready BOQ, with every quantity traceable.', 'straighten'], ['Vanik Scout', 'Rank a backlog of resumes against an ideal job profile, with its reasoning shown.', 'person_search']];
const LIVE_OS = 'https://os.vanikedge.ai/';
const cache = { key: '', usage: null, audit: null, docs: {}, doc: null };
export const osRouteChanged = () => { cache.key = ''; };
function ensure(key, loader) { if (cache.key === key) return; cache.key = key; loader().then(rerender).catch(e => toast(e.message, 'err')); }

export function osShell(active, crumb, content) {
  const B = S.boot, raw = (location.hash || '#/os/home').replace(/\/$/, ''), hash = ALIAS[raw] || raw;
  const place = hash === '#/os/access/evidence' ? 'activity' : hash === '#/os/connectors/systems' ? 'apps' : /^#\/os\/(help|notifications)/.test(hash) ? '' : PLACE[active] || 'home', tabs = (TABS[place] || []).filter(t => inScope(t[0])), on = tabs.find(t => t[0] === hash);
  const installed = (B.app.status === 'not_installed' ? 0 : 1) + ((B.suite || { apps: [] }).apps.filter(x => x.status !== 'not_installed').length);
  return `<div class="shell"><aside class="console-nav">
    <a class="brand" href="#/os/home">${LOGO}<span class="vk-brand"><small>Vanik Edge</small><b>Console</b></span></a>
    <button class="nav-search" data-act="palette">${icon('search')}Search everything<kbd>Ctrl K</kbd></button>
    ${NAV.map(n => `<a class="nav-item ${place === n[0] ? 'is-active' : ''}" href="#/os/${n[0]}">${icon(n[2])}<span>${n[1]}</span>${n[0] === 'apps' ? `<span class="count">${installed}</span>` : ''}</a>`).join('')}
    <span class="grow"></span><a class="nav-item" href="#/me">${icon('person')}<span>My apps</span></a><a class="nav-item ${hash === '#/os/help' ? 'is-active' : ''}" href="#/os/help">${icon('help_outline')}<span>Help</span></a>
  </aside><div class="main"><header class="topbar">${navToggle()}<span class="crumb">${esc(B.tenant.name)} / <b>${crumb}</b></span>${hint({ apps: 'console-apps', people: 'console-access', knowledge: 'console-knowledge' }[PLACE[active] || active] || '')}<span class="right"></span>
    <span class="pill ${B.device.online ? '' : 'off'} tip-down" data-tip="${B.device.online ? 'Reaching ' + esc(B.device.name) : 'The appliance is offline. Apps and models are stopped.'}"><i></i>Vanik Appliance ${B.device.online ? 'online' : 'offline'}</span>
    <button class="icon-btn bordered tip-down bell" data-act="notif" data-tip="Notifications" aria-label="Notifications">${icon('notifications_none')}${B.attention.length ? '<i></i>' : ''}</button>${themeButton()}${userButton()}</header>
    ${on && tabs.length > 1 ? `<nav class="subnav">${tabs.map(t => `<a class="${t === on ? 'on' : ''}" href="${t[0]}">${t[1]}</a>`).join('')}</nav>` : ''}
    <div class="scroll" id="scroll"><div class="page">${content}</div></div></div></div>`;
}

// ---------- app status
function appStatus() {
  const a = S.boot.app;
  if (a.status !== 'not_installed' && !S.boot.device.online) return ['Offline', 'err'];
  return { not_installed: ['Not installed', ''], needs_setup: ['Needs setup', 'warn'], deploying: ['Deploying', 'warn'], running: ['Running', 'ok'], stopped: ['Stopped', ''] }[a.status];
}
const pendingDeploy = () => { const a = S.boot.app; return a.latestVersion && a.latestVersion !== a.deployedVersion && a.status !== 'deploying'; };

// ---------- Apps
function pageApps() {
  const B = S.boot, a = B.app, installed = a.status !== 'not_installed', st = appStatus();
  const suite = (B.suite || { apps: [] }).apps, sIn = suite.filter(x => x.status !== 'not_installed'), sOut = suite.filter(x => x.status === 'not_installed'), count = (installed ? 1 : 0) + sIn.length;
  const sCard = x => x.status === 'not_installed' ? `<div class="card app-card flat"><div class="row"><span class="app-ico">${icon(x.icon)}</span></div><h3>${esc(x.name)}</h3><p class="muted small">${esc(x.what)}</p><div class="foot"><span class="mono grow">Needs ${x.needsGb} GB</span><button class="btn" data-act="suite-install" data-id="${x.id}">Install</button></div></div>`
    : `<div class="card app-card"><div class="row"><span class="app-ico">${icon(x.icon)}</span><span class="right">${x.status === 'running' ? chip(B.device.online ? 'Running' : 'Offline', B.device.online ? 'ok' : 'err') : chip('Stopped', '')}</span></div><h3>${esc(x.name)}</h3><p class="muted small">${esc(x.what)}</p><div class="foot"><span class="mono ellipsis grow">${esc(B.device.name)} · ${x.port}</span>${x.canUse ? `<a class="btn" href="#/app/${x.id}">Open</a>` : ''}<a class="btn ${x.canUse ? 'ghost' : ''}" href="#/os/apps/${x.id}">Manage</a></div></div>`;
  const gptCard = installed ? `<div class="card app-card">
      <div class="row"><span class="app-ico">${icon('forum')}</span><span class="right">${chip(st[0], st[1])}</span></div>
      <h3>VanikGPT</h3><p class="muted small">Chat with the models running on your own Vanik Appliance.</p>
      <div class="foot"><span class="mono ellipsis grow">${esc(B.device.name)} · ${a.port}</span>
        ${a.status === 'running' && B.device.online ? `<a class="btn" href="#/gpt">Open</a>` : ''}
        <a class="btn ${a.status === 'running' ? 'ghost' : ''}" href="#/os/apps/vanikgpt/${a.status === 'needs_setup' ? 'setup' : 'overview'}">${a.status === 'needs_setup' ? 'Finish setup' : 'Manage'}</a>
        <button class="icon-btn sm" data-act="app-menu" aria-label="More">${icon('more_vert')}</button></div></div>` : '';
  const avail = (installed ? '' : `<div class="card app-card flat"><div class="row"><span class="app-ico">${icon('forum')}</span></div><h3>VanikGPT</h3><p class="muted small">Chat with the models running on your own Vanik Appliance.</p>
      <div class="foot"><span class="mono grow">Needs ${a.needsGb} GB</span><button class="btn" data-act="app-install">Install</button></div></div>`)
    + sOut.map(sCard).join('');
  return osShell('apps', 'Apps', `
    <div class="page-head"><div><h1>Apps</h1><p class="sub">What is installed and what can be added. ${1 + suite.length} apps · ${count} installed · ${1 + suite.length - count} available</p></div></div>
    <div class="section-title"><h2>On your Vanik Appliance</h2><span class="mono">${count} installed</span></div>
    ${count ? `<div class="grid">${gptCard}${sIn.map(sCard).join('')}</div>` : `<div class="empty">${icon('apps')}Nothing installed yet. Pick one below to put it on a device.</div>`}
    ${avail ? `<div class="section-title"><h2>Available to install</h2></div><div class="grid">${avail}</div>` : ''}`);
}
acts['app-install'] = () => {
  const B = S.boot;
  modal({ title: 'Install VanikGPT', text: `Reserves ${B.app.needsGb} GB on ${B.device.name}. ${B.device.freeGb} GB is free.`, actions: [{ label: 'Install', run: async () => { await api('POST', '/api/app/install'); await load(); toast('VanikGPT installed. Finish setup to turn it on.'); go('#/os/apps/vanikgpt/setup'); } }] });
};
acts['app-menu'] = el => {
  const a = S.boot.app;
  menu(el, [
    { label: 'Manage', icon: 'tune', run: () => go('#/os/apps/vanikgpt/overview') },
    a.status === 'running' && { label: 'Stop', icon: 'stop_circle', run: () => confirmBox('Stop VanikGPT?', 'People will not be able to chat until you start it again. Chats are kept.', 'Stop', async () => { await api('POST', '/api/app/stop'); await refresh(); }) },
    a.status === 'stopped' && { label: 'Start', icon: 'play_circle', run: async () => { await api('POST', '/api/app/start'); await refresh(); watchDeploy(); } },
    '-',
    { label: 'Uninstall', icon: 'delete_outline', danger: true, run: () => confirmBox('Uninstall VanikGPT?', 'The app is removed from the device and its setup is cleared. Chats and agents are kept if you install it again.', 'Uninstall', async () => { await api('DELETE', '/api/app'); draft = null; await load(); go('#/os/apps'); }) },
  ]);
};

// ---------- VanikGPT manage page
let draft = null, draftBase = '', advOpen = false, allModels = false, actTab = 'versions', pollT = null;
function ensureDraft() { const cfg = S.boot.app.config, base = JSON.stringify({ ...cfg, link: cfg.link || LINK0, web: cfg.web || WEB0, admin: cfg.admin || ADMIN0, storage: { ...STORE0, ...(cfg.storage || {}) }, features: cfg.features || FEAT0, data: cfg.data || DATA0, access: { ...cfg.access, deny: (cfg.access || {}).deny || [] } }); /* the picker adds an empty block list; without it here the page opens as 'unsaved' */ if (!draft || draftBase !== base) { draft = JSON.parse(base); draftBase = base; } accessDrafts.app = draft.access; accessChanged.app = saveBar; bindSetup(draft, saveBar); }
const dirty = () => !!draft && JSON.stringify(draft) !== draftBase;

function deployBox() {
  const a = S.boot.app, d = a.deploy;
  if (a.status === 'deploying' && d) return `<div class="card" style="margin-bottom:20px"><div class="card-head"><h3>Deploying config v${d.v}</h3><span class="mono">${esc(d.note || '')}</span><button class="btn ghost right" data-act="deploy-cancel">Cancel</button></div>
    <div class="steps">${d.steps.map(s => `<div class="step ${s.state}"><span class="dot">${s.state === 'done' ? icon('check') : ''}</span>${s.label}</div>`).join('')}</div></div>`;
  if (d && d.result === 'failed' && a.deployedVersion !== d.v) return `<div class="banner err">${icon('error_outline')}<span><b>Deploy of config v${d.v} did not finish.</b> ${esc(d.reason)}</span><button class="btn" data-act="deploy">Deploy again</button></div>`;
  if (pendingDeploy() && !dirty()) return `<div class="banner">${icon('info_outline')}<span>Setup is saved as config v${a.latestVersion} but is not live yet.</span><button class="btn" data-act="deploy">Deploy</button></div>`;
  return '';
}
export function watchDeploy() {
  if (pollT || !S.boot || S.boot.app.status !== 'deploying') return;
  pollT = setInterval(async () => {
    try { await load(); } catch { return; }
    const a = S.boot.app, box = $('#deploy-box');
    if (a.status === 'deploying') { if (box) box.innerHTML = deployBox(); return; }
    clearInterval(pollT); pollT = null; cache.key = '';
    const d = a.deploy;
    if (d && d.result === 'ok') toast('VanikGPT is running on config v' + d.v + '.'); else if (d && d.result === 'failed') toast('Deploy did not finish.', 'err');
    if (location.hash.startsWith('#/os/')) rerender();
  }, 600);
}
acts.deploy = async () => { await api('POST', '/api/app/deploy'); await refresh(); watchDeploy(); };
acts['deploy-cancel'] = async () => { await api('POST', '/api/app/deploy/cancel'); await refresh(); };

function healthRows() {
  const B = S.boot, a = B.app, c = a.config, st = appStatus();
  const chosen = c.models.map(id => B.models.find(m => m.id === id)).filter(Boolean), serving = chosen.filter(m => m.status === 'serving');
  const cols = B.collections.filter(x => c.collections === 'all' || c.collections.includes(x.id)), docs = cols.reduce((n, x) => n + x.docCount, 0);
  const users = B.users.filter(u => u.role !== 'user' || c.access.mode === 'everyone' || c.access.users.includes(u.id) || (u.teams || []).some(t => c.access.teams.includes(t))).length;
  const row = (ok, label, detail, action = '') => `<div class="set-row"><span class="material-icons mi" style="color:var(--vnk-${ok === true ? 'ok' : ok === false ? 'warn' : 'ink-3'})">${ok === true ? 'check_circle' : ok === false ? 'error_outline' : 'radio_button_unchecked'}</span><div class="grow"><div class="lbl">${label}</div><div class="small muted">${detail}</div></div>${action}</div>`;
  const lastOk = (a.deploys || []).find(d => d.result === 'ok');
  return row(a.status === 'running' && B.device.online, 'App', a.status === 'running' ? (B.device.online ? `Running on ${esc(B.device.name)}, port ${a.port}${lastOk ? ' · live since ' + ago(lastOk.endedAt) : ''}` : 'The appliance is offline, so nobody can reach VanikGPT.') : a.status === 'deploying' ? 'Deploying now.' : a.status === 'stopped' ? 'Stopped. People cannot chat.' : 'Not deployed yet.', chip(st[0], st[1]))
    + row(serving.length > 0, 'Model', !chosen.length ? 'No model chosen yet.' : serving.length ? `Serving: ${serving.map(m => esc(m.id)).join(', ')}` : 'None of the chosen models is serving.', !chosen.length ? `<a class="btn ghost" href="#/os/apps/vanikgpt/setup">Choose</a>` : serving.length ? '' : `<a class="btn ghost" href="#/os/models">Model Hub</a>`)
    + row(B.gateway.ok, `Model gateway ${info('VanikGPT reaches models through the Vanik API gateway. The key is created and rotated for you.')}`, B.gateway.ok ? 'Reachable.' : 'Not reachable. Until it is, answers are built from your documents only.', `<button class="btn ghost" data-act="gw-check">Check again</button>`)
    + row(docs > 0 ? true : null, 'Knowledge', docs ? `${cols.length} ${cols.length === 1 ? 'collection' : 'collections'} · ${docs} ${docs === 1 ? 'document' : 'documents'} can be searched.` : 'No documents yet. Answers will not cite your files.', `<a class="btn ghost" href="#/os/knowledge">Knowledge base</a>`)
    + row(true, 'People', `${accessLabel(c.access)} · ${users} of ${B.users.length} can open it.`, `<a class="btn ghost" href="#/os/people">People</a>`)
    + row(c.safety.pii !== 'off', 'Personal data', { mask: 'Aadhaar, PAN, GSTIN, IFSC, phone and email are masked before a question reaches the model.', flag: 'Questions with personal data are flagged but sent as typed.', off: 'Questions are not checked for personal data.' }[c.safety.pii]);
}
acts['gw-check'] = async el => { el.disabled = true; const r = await api('POST', '/api/app/check'); await refresh(); toast(r.ok ? 'Model gateway is reachable.' : 'Model gateway is still not reachable.', r.ok ? '' : 'err'); };

const stat = (k, v, tip) => `<div class="card flat stat"><span class="k">${k}${tip ? info(tip) : ''}</span><b>${v}</b></div>`;
function tabOverview() {
  const a = S.boot.app, u = cache.usage, wk = u ? u.days.reduce((n, d) => n + d.questions, 0) : '—';
  return `<div class="grid four" style="margin-bottom:20px">${stat('Questions, 7 days', wk)}${stat('People asking', u ? u.activeUsers : '—')}${stat('Average answer time', u ? (u.avgMs ? (u.avgMs / 1000).toFixed(1) + ' s' : '—') : '—')}${stat('Helpful answers', u ? (u.up + u.down ? Math.round(100 * u.up / (u.up + u.down)) + '%' : '—') : '—', 'Share of rated answers that got a thumbs up.')}</div>
    <div class="card"><div class="card-head"><h3>Health</h3>${a.status === 'needs_setup' && !a.latestVersion ? `<a class="btn right" href="#/os/apps/vanikgpt/setup">Finish setup</a>` : ''}</div>${healthRows()}</div>`;
}

function saveBar() {
  const el = $('#savebar'); if (!el) return;
  const a = S.boot.app, d = dirty();
  if (location.hash.startsWith('#/gpt/manage')) { el.innerHTML = `<span class="grow muted">${d ? 'You have unsaved changes.' : 'Everything is saved.'}</span>${d ? `<button class="btn text" data-act="cfg-discard">Discard</button><button class="btn" data-act="mg-save">Save</button>` : ''}`; return; }
  el.innerHTML = `<span class="grow muted">${d ? 'You have unsaved changes.' : pendingDeploy() ? `Saved as config v${a.latestVersion}. Not live yet.` : a.deployedVersion ? `Config v${a.deployedVersion} is live.` : 'Choose a model, then save and deploy.'}</span>
    ${d ? `<button class="btn text" data-act="cfg-discard">Discard</button><button class="btn ghost" data-act="cfg-save">Save</button><button class="btn" data-act="cfg-save" data-deploy="1">Save and deploy</button>` : pendingDeploy() || (a.status === 'needs_setup' && a.latestVersion) ? `<button class="btn" data-act="deploy">Deploy</button>` : a.status === 'needs_setup' ? `<button class="btn" data-act="cfg-save" data-deploy="1" ${draft.models.length || draft.link.mode === 'custom' ? '' : 'disabled'}>Save and deploy</button>` : ''}`;
}
// ---------- Setup for VanikGPT. What the console sets is one compact card. The app options are one card too, shown here
// when the console admins run VanikGPT, or inside VanikGPT when an app admin does. Both are drawn from the one draft.
let guardMode = 'prompt';
// how VanikGPT reaches a model: with the console admins it is set here, with an app admin inside VanikGPT
function modelRows(c, B) {
  const custom = c.link.mode === 'custom', serving = B.models.filter(m => m.kind === 'chat' && m.status === 'serving'), follows = B.gptSetup && B.gptSetup.follows;
  return `${crow('Model', 'Vanik API gateway: the address and a key are filled in on every deploy, and every chat model serving in Model Hub is offered in chat. Custom endpoint: VanikGPT calls one server directly, so there is no usage on the API gateway page, no key made for it, and nothing follows the model if it moves.',
      `<select class="input" style="width:auto" data-change="cfg-link" aria-label="How VanikGPT reaches a model"><option value="gateway" ${custom ? '' : 'selected'}>Vanik API gateway</option><option value="custom" ${custom ? 'selected' : ''}>Custom endpoint</option></select>${!custom && follows ? (serving.length ? `<select class="input" style="width:auto;max-width:200px" data-change="cfg-default-sel" aria-label="Default model">${serving.map(m => `<option value="${esc(m.id)}" ${c.defaultModel === m.id ? 'selected' : ''}>${esc(m.id)}${c.defaultModel === m.id ? ' (default)' : ''}</option>`).join('')}</select>` : `<a class="link small" href="#/os/models">Serve a chat model</a>`) : ''}`)}
    ${custom ? `${crow('Address', 'Where an OpenAI style server answers, ending in /v1.', `<input class="input mono" style="width:300px" placeholder="http://10.0.0.12:9000/v1" value="${esc(c.link.url)}" data-on="gs-url" aria-label="Address of the model server">`)}
      ${crow('Model name', 'The name that server gives the model. Many servers call it /model.', `<input class="input mono" style="width:300px" placeholder="/model" value="${esc(c.link.model)}" data-on="gs-model" aria-label="Model name">`)}
      ${crow('Key', 'Only if that server asks for one. Kept in the vault and never shown again.', `<span class="small muted" id="gs-test-out"></span><button class="btn ghost" data-act="gs-test">Test</button><input class="input" style="width:210px" type="password" autocomplete="off" placeholder="${c.link.keySet ? 'Kept. Type to replace' : 'None needed'}" data-on="gs-key" aria-label="Key">`)}` : ''}`;
}
function optionsCard(c, o) {
  const air = c.advanced.offline, w = (S.boot.gptSetup || { web: {} }).web, f = c.features, d = c.data, gated = chipOff => (air ? chip('Air-gapped', '', false) : chipOff);
  return `<div class="card setc"><div class="card-head"><h3>App options</h3></div>
    ${o.model ? `<div class="cap">Model</div>${modelRows(c, S.boot)}` : ''}
    ${['web-search', 'connectors', 'images', 'video'].every(later) ? '' : '<div class="cap">Abilities</div>'}
    ${later('web-search') ? '' : crow('Web search', 'Lets a chat search the internet. When a question needs the web in a chat where it is off, the person is told VanikGPT will switch it on and that it may use credits. One search is one credit.', `${gated(c.web.on ? `<span class="small muted">${w.used || 0} used of</span><input class="input" style="width:84px" type="number" min="0" max="100000" value="${c.web.credits}" data-on="gs-credits" aria-label="Browsing credits a month"><span class="small muted">credits a month</span>` : '')}${sw('gs-web', c.web.on && !air, '', air)}`)}
    ${later('connectors') ? '' : crow('Connectors', 'Lets a chat read from, and act in, connected systems such as mail, a drive or the ERP. The systems themselves are connected in the console.', `${gated('')}${sw('cfg-feat', f.connectors && !air, 'connectors', air)}`)}
    ${later('images') ? '' : crow('Images', 'Lets a chat make a picture. Needs an image model serving in Model Hub.', sw('cfg-feat', f.images, 'images'))}
    ${later('video') ? '' : crow('Video', 'Lets a chat make a short video. Needs a video model serving in Model Hub.', sw('cfg-feat', f.video, 'video'))}
    <div class="cap">People's data</div>
    ${crow('Uploads', 'Lets people attach their own files to a chat.', sw('cfg-switch', c.safety.uploads, 'safety.uploads'))}
    ${c.safety.uploads ? `${later('personal-storage') ? '' : crow('Personal storage', 'On: a file a person uploads is kept in their own space, so they can use it again in later chats. Off: it lives only in the chat it was added to.', sw('cfg-data', d.personal, 'personal'))}
      ${crow('Space per person', 'How much one person may keep in files. A file that would go over is refused, with a message that says why.', `<input class="input" style="width:96px" type="number" min="10" max="100000" value="${d.quotaMb}" data-on="cfg-quota" aria-label="Space per person in MB"><span class="small muted">MB</span>`)}` : ''}
    ${crow('Temporary chats', 'On: a person\'s chats, and the files in them, are removed when they start a new session. It keeps storage small. Off: chats stay until the person deletes them.', sw('cfg-data', d.tempChats, 'tempChats'))}
    <div class="cap">Guardrail</div>
    ${crow('Guardrail', 'Prompt: plain instructions every chat follows, such as the tone to use or what never to advise on. Keywords: a question that names one of these words is not answered and is not sent to the model. Both apply.', `<div class="seg"><button class="${guardMode === 'prompt' ? 'on' : ''}" data-act="cfg-guard" data-v="prompt">Prompt</button><button class="${guardMode === 'words' ? 'on' : ''}" data-act="cfg-guard" data-v="words">Keywords${(c.safety.blockedTopics || []).length ? ` <span class="mono">${c.safety.blockedTopics.length}</span>` : ''}</button></div>`)}
    ${guardMode === 'prompt' ? `<textarea class="input" rows="3" maxlength="4000" placeholder="Answer in plain English. Quote amounts in rupees. Never give legal advice as final." data-on="cfg-rules" aria-label="Guardrail prompt">${esc(c.instructions || '')}</textarea>`
      : `<div class="row wrap" style="gap:6px">${(c.safety.blockedTopics || []).map(t => `<span class="tag">${esc(t)}<button data-act="cfg-topic-del" data-v="${esc(t)}" aria-label="Remove ${esc(t)}">${icon('close')}</button></span>`).join('')}<input class="input" id="topic-in" style="width:230px;height:32px" placeholder="Add a keyword, press Enter" aria-label="Add a keyword"></div>`}
    ${o.adv ? advancedRows(c) : ''}</div>`;
}
const advancedRows = c => `<div class="cap">Advanced</div>
    ${crow('Daily questions', 'For each person, each day. It stops one person from using all the capacity. 0 means no limit.', `<input class="input" style="width:96px" type="number" min="0" max="10000" value="${c.safety.dailyLimit}" data-on="cfg-limit" aria-label="Questions per person per day">`)}
    ${later('air-gapped') ? '' : crow('Air-gapped', 'Yes: VanikGPT never reaches the internet. Web search and connectors switch off by themselves and cannot be switched on.', sw('cfg-air', c.advanced.offline))}`;
function tabSetup() {
  ensureDraft();
  const B = S.boot, c = draft, chat = B.models.filter(m => m.kind === 'chat'), live = B.app.config, managed = c.admin.users.length > 0, g = B.gptAdmin || { names: [], storage: {} };
  const mStatus = m => m.status === 'serving' ? chip('Serving', 'ok') : m.status === 'parked' ? chip('Parked', '') : chip('Not on device', '');
  const people = B.users.filter(u => u.role === 'user'), kbs = B.collections.filter(x => usedBy(x, 'vanikgpt')), custom = c.link.mode === 'custom';
  const lost = `the ${g.storage.chats || 0} ${g.storage.chats === 1 ? 'chat' : 'chats'} and ${g.storage.files || 0} ${g.storage.files === 1 ? 'file' : 'files'} kept so far`;
  return `<div class="stack" style="gap:16px;max-width:820px">
    <div class="card setc"><div class="card-head"><h3>Set in the console</h3></div>
      ${crow('Run by', 'Console admins: the app options are on this page. An app admin: the model and the app options are inside VanikGPT and leave this page.', `${managed ? `<span class="small muted">Advanced too</span>${info('Off: the advanced options stay on this page. On: the app admin has them, and they leave this page.')}${sw('cfg-admin-adv', c.admin.advanced)}` : ''}${runByDd({ key: 'gpt-run', p: 'cfg-admin', people, picked: c.admin.users })}`)}
      ${managed ? crow('Model', 'Chosen inside VanikGPT by its admin.', `<span class="muted">${custom ? `Custom endpoint · ${esc(c.link.model)}` : `Vanik API gateway${c.defaultModel ? ' · ' + esc(c.defaultModel) : ''}`}</span><a class="btn text" href="#/gpt/manage">Open</a>`) : modelRows(c, B)}
      ${crow('Knowledge', 'Each knowledge base says which apps may use it. People still get answers only from the ones they are allowed.', `<span class="muted">${kbs.length ? `${kbs.length} ${kbs.length === 1 ? 'knowledge base' : 'knowledge bases'}` : 'None open to VanikGPT yet'}</span><a class="btn text" href="#/os/knowledge">Manage</a>`)}
      ${storageRow({ p: 'cfg-store', store: c.storage, saved: { ...STORE0, ...(live.storage || {}) }, stores: g.stores, lost })}
      ${crow('People', 'Who can use VanikGPT.', accessDd({ key: 'gpt-acc', p: 'cfg-acc', access: c.access, teams: B.teams, people }))}
    </div>
    ${B.gptSetup && (B.gptSetup.follows || c.link.mode === 'custom') ? '' : `<div class="card"><div class="card-head"><h3>Models</h3>${info('People pick from these in chat. A model has to be serving in Model Hub to answer.')}<a class="link small right" href="#/os/models">Model Hub</a></div>
      <div class="stack" style="gap:8px">${chat.filter(m => allModels || m.status !== 'available' || c.models.includes(m.id)).map(m => { const on = c.models.includes(m.id); return `<div class="check ${on ? 'on' : ''}" role="checkbox" aria-checked="${on}" tabindex="0" data-act="cfg-model" data-id="${esc(m.id)}"><span class="box">${icon('check')}</span><span class="grow"><b>${esc(m.id)}</b> <span class="mono">${m.memGb} GB${m.note ? ' · ' + esc(m.note) : ''}</span></span>${on ? `<button class="tag ${c.defaultModel === m.id ? 'on' : ''}" data-act="cfg-default" data-id="${esc(m.id)}" data-stop>${c.defaultModel === m.id ? 'Default' : 'Make default'}</button>` : ''}${mStatus(m)}</div>`; }).join('')}</div>${chat.some(m => m.status === 'available' && !c.models.includes(m.id)) ? `<button class="btn text" style="margin-top:10px" data-act="cfg-allmodels">${icon(allModels ? 'expand_less' : 'expand_more')}${allModels ? 'Show fewer' : `Show ${chat.filter(m => m.status === 'available' && !c.models.includes(m.id)).length} more that are not on the device`}</button>` : ''}</div>`}
    ${managed ? (c.admin.advanced ? '' : `<div class="card setc"><div class="card-head"><h3>Advanced</h3>${chip('Kept in the console', '', false)}</div>${advancedRows(c).replace('<div class="cap">Advanced</div>', '')}</div>`) : optionsCard(c, { adv: true, model: false })}
    <div class="savebar" id="savebar"></div></div>`;
}
// the model and the options inside VanikGPT, for the app admin
export function gptOptionsPage() {
  ensureDraft(); const g = S.boot.gptAdmin; queueMicrotask(saveBar);
  return `<div class="stack" style="gap:16px;max-width:820px">${optionsCard(draft, { adv: g.advanced, model: true })}${g.advanced ? '' : `<p class="small muted">${icon('lock')} ${later('air-gapped') ? 'Daily questions are' : 'Daily questions and Air-gapped are'} kept in the Vanik Edge console.</p>`}<div class="savebar" id="savebar"></div></div>`;
}
acts['cfg-admin-none'] = () => { draft.admin = { users: [], advanced: false }; rerender(); };
acts['cfg-admin-pick'] = el => { toggle(draft.admin.users, el.dataset.v); if (!draft.admin.users.length) draft.admin.advanced = false; rerender(); };
acts['cfg-admin-adv'] = () => { draft.admin.advanced = !draft.admin.advanced; rerender(); };
const accFix = () => { const a = draft.access; a.mode = a.teams.length + a.users.length ? 'restricted' : 'everyone'; rerender(); };
acts['cfg-acc-all'] = () => { draft.access.teams = []; draft.access.users = []; accFix(); };
acts['cfg-acc-team'] = el => { toggle(draft.access.teams, el.dataset.v); accFix(); };
acts['cfg-acc-user'] = el => { toggle(draft.access.users, el.dataset.v); accFix(); };
ins['cfg-link'] = el => { draft.link.mode = el.value; rerender(); };
ins['cfg-default-sel'] = el => { draft.defaultModel = el.value; rerender(); };
ins['cfg-store'] = el => { draft.storage.store = el.value; rerender(); };
ins['cfg-store-gb'] = el => { draft.storage.gb = Math.max(1, Math.min(4000, Math.round(+el.value || 20))); rerender(); };
acts['cfg-feat'] = el => { draft.features[el.dataset.k] = !draft.features[el.dataset.k]; rerender(); };
acts['cfg-data'] = el => { draft.data[el.dataset.k] = !draft.data[el.dataset.k]; rerender(); };
ins['cfg-quota'] = el => { draft.data.quotaMb = Math.max(10, Math.round(+el.value || 500)); saveBar(); };
acts['cfg-guard'] = el => { guardMode = el.dataset.v; rerender(); };
// air-gapped: nothing that needs the internet stays on
acts['cfg-air'] = () => { const on = !draft.advanced.offline; draft.advanced.offline = on; if (on) { draft.web.on = false; draft.features.connectors = false; } rerender(); };
acts['mg-save'] = async () => { const d = draft; try { await api('PUT', '/api/gpt/manage', { link: d.link, web: d.web, features: d.features, data: d.data, instructions: d.instructions, safety: d.safety, advanced: d.advanced }); } catch (e) { return toast(e.message, 'err'); } draft = null; cache.key = ''; await load(); toast('Saved. It applies to every chat from now.'); rerender(); };
const toggle = (l, v) => { const i = l.indexOf(v); if (i < 0) l.push(v); else l.splice(i, 1); };
acts['cfg-model'] = el => { toggle(draft.models, el.dataset.id); if (!draft.models.includes(draft.defaultModel)) draft.defaultModel = draft.models[0] || null; rerender(); };
acts['cfg-default'] = el => { draft.defaultModel = el.dataset.id; rerender(); };
acts['cfg-cols'] = el => { draft.collections = el.dataset.v === 'all' ? 'all' : (Array.isArray(draft.collections) ? draft.collections : []); rerender(); };
acts['cfg-col'] = el => { toggle(draft.collections, el.dataset.id); rerender(); };
acts['cfg-pii'] = el => { draft.safety.pii = el.dataset.v; rerender(); };
acts['cfg-switch'] = el => { const [a, b] = el.dataset.k.split('.'); draft[a][b] = !draft[a][b]; if (el.dataset.k === 'advanced.offline' && draft.advanced.offline) draft.web.on = false; /* offline means no web search */ rerender(); };
acts['cfg-allmodels'] = () => { allModels = !allModels; rerender(); };
acts['cfg-adv'] = () => { advOpen = !advOpen; };
acts['cfg-discard'] = () => { draft = null; rerender(); };
ins['cfg-keep'] = el => { draft.safety.retentionDays = +el.value; saveBar(); };
acts['cfg-plugin'] = el => { toggle(draft.tools.enabled, el.dataset.id); rerender(); };
acts['cfg-bmode'] = el => { draft.tools.browserMode = el.dataset.v; rerender(); };
acts['cfg-signin-del'] = el => { draft.tools.signins.splice(+el.dataset.i, 1); rerender(); };
acts['cfg-signin-add'] = () => modal({ title: 'Add a sign-in', body: `<div class="stack"><label class="field"><span>Site</span><input class="input" id="f-host" placeholder="portal.supplier.com"></label>
  <label class="field"><span>How it signs in ${info('Company SSO: the site has a "Sign in with" button and the appliance browser holds your company session. Saved account: a shared service account whose password is typed once on the appliance and kept in its vault. This build keeps no passwords, so saved accounts work on the sample portal only.')}</span><select class="input" id="f-kind"><option value="sso">Company SSO</option><option value="vault">Saved account</option></select></label>
  <label class="field"><span>Account</span><input class="input" id="f-acct" placeholder="buyer@company.com"></label></div>`,
  actions: [{ label: 'Add', run: o => { const host = $('#f-host', o).value.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0]; if (!/^[a-z0-9.-]+\.[a-z0-9-]+$/.test(host)) { toast('Enter the site, for example portal.supplier.com.', 'err'); return false; } draft.tools.signins = [...(draft.tools.signins || []).filter(x => x.host !== host), { host, kind: $('#f-kind', o).value, account: $('#f-acct', o).value.trim() }]; if (draft.tools.browserMode === 'allowed' && !draft.tools.sites.includes(host)) draft.tools.sites.push(host); rerender(); } }] });
acts['cfg-site-del'] = el => { draft.tools.sites = draft.tools.sites.filter(t => t !== el.dataset.v); rerender(); };
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'site-in') { const v = e.target.value.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0]; if (/^[a-z0-9.-]+$/.test(v) && !draft.tools.sites.includes(v)) draft.tools.sites.push(v); rerender(); setTimeout(() => { const i = $('#site-in'); if (i) i.focus(); }, 0); } });
ins['cfg-limit'] = el => { draft.safety.dailyLimit = Math.max(0, +el.value || 0); saveBar(); };
acts['cfg-topic-del'] = el => { draft.safety.blockedTopics = draft.safety.blockedTopics.filter(t => t !== el.dataset.v); rerender(); };
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'topic-in') { const v = e.target.value.trim().toLowerCase(); if (v && !draft.safety.blockedTopics.includes(v)) draft.safety.blockedTopics.push(v); rerender(); setTimeout(() => { const i = $('#topic-in'); if (i) i.focus(); }, 0); } });
ins['cfg-port'] = el => { draft.advanced.port = +el.value || 9016; saveBar(); };
ins['cfg-rules'] = el => { draft.instructions = el.value.trim(); saveBar(); };
ins['cfg-cors'] = el => { draft.advanced.corsOrigin = el.value.trim(); saveBar(); };
acts['cfg-save'] = async el => {
  const deploy = !!el.dataset.deploy;
  if (deploy && !draft.models.length && draft.link.mode !== 'custom') throw new Error(S.boot.gptSetup && S.boot.gptSetup.follows ? 'Serve a chat model in Model Hub before you deploy.' : 'Pick at least one model before you deploy.');
  const st0 = { ...STORE0, ...(S.boot.app.config.storage || {}) }, g = S.boot.gptAdmin || { storage: {} }, moved = draft.storage.store !== st0.store || draft.storage.gb !== st0.gb;
  if (moved && !el.dataset.sure && (g.storage.chats || g.storage.files)) return confirmBox('Change the storage?', `A new store or a new size starts empty. ${g.storage.chats} chats and ${g.storage.files} files kept so far are removed for everyone. Knowledge bases are not touched. This cannot be undone.`, 'Remove and save', () => acts['cfg-save']({ dataset: { deploy: deploy ? '1' : '', sure: '1' } }));
  await api('PUT', '/api/app/config', { config: draft, deploy });
  draft = null; cache.key = ''; await load();
  if (deploy) { toast('Saved. Deploying now.'); go('#/os/apps/vanikgpt/overview'); watchDeploy(); } else { toast('Setup saved.'); rerender(); }
};

function tabUsage() {
  const u = cache.usage;
  if (!u) return `<p class="muted">Loading…</p>`;
  if (!u.questions) return `<div class="empty">${icon('insights')}No questions asked yet. Numbers show up here once people start chatting.</div>`;
  const max = Math.max(1, ...u.days.map(d => d.questions)), answers = u.modes.model + u.modes.documents + u.modes.unavailable + (u.modes.tool || 0) + (u.modes.search || 0) || 1;
  const share = (n, label, tip) => `<div class="set-row"><div class="grow"><div class="lbl">${label} ${info(tip)}</div><div class="meter" style="margin-top:8px"><i style="width:${Math.round(100 * n / answers)}%"></i></div></div><b>${n}</b></div>`;
  return `<div class="grid four" style="margin-bottom:16px">${stat('Questions, all time', u.questions)}${stat('People asking', u.activeUsers)}${stat('Average answer time', u.avgMs ? (u.avgMs / 1000).toFixed(1) + ' s' : '—')}${stat('Tokens', u.tokens.toLocaleString(), 'Input and output combined. Estimated when the model does not report it.')}</div>
    <div class="grid two">
      <div class="card"><div class="card-head"><h3>Questions per day</h3><span class="mono">last 7 days</span></div><div class="bars">${u.days.map(d => `<div><span class="mono">${d.questions || ''}</span><i style="height:${Math.round(100 * d.questions / max)}%"></i><span class="mono">${new Date(d.day).toLocaleDateString(undefined, { weekday: 'short' })}</span></div>`).join('')}</div></div>
      <div class="card"><div class="card-head"><h3>How answers were made</h3></div>${share(u.modes.model, 'By the model', 'The model wrote the answer, using your documents when they matched.')}${share(u.modes.documents, 'From documents only', 'The model could not be reached, so the answer was built from matching passages.')}${share(u.modes.unavailable, 'No answer', 'The model could not be reached and no document matched.')}${share((u.modes.tool || 0) + (u.modes.search || 0), 'By an ability or search', 'An exact plugin result, a browser run, or passages only.')}</div>
      <div class="card"><div class="card-head"><h3>Feedback</h3><span class="right row">${chip(u.up + ' helpful', 'ok', false)}${chip(u.down + ' not helpful', u.down ? 'warn' : '', false)}</span></div>
        ${Object.keys(u.reasons).length ? Object.entries(u.reasons).map(([r, n]) => `<div class="set-row"><span class="grow">${esc(r)}</span><b>${n}</b></div>`).join('') : `<p class="small muted">No thumbs down yet.</p>`}
        ${u.notes.length ? `<div style="margin-top:14px" class="stack">${u.notes.map(n => `<div class="small"><span class="faint">${esc(n.userName)} · ${when(n.at)} · ${esc(n.reason)}</span><br>${esc(n.note)}</div>`).join('')}</div>` : ''}
        <p class="small faint" style="margin-top:14px">Admins see ratings and notes. Chat content stays with the person who wrote it.</p></div>
      <div class="card"><div class="card-head"><h3>Collections cited</h3></div>${u.collections.length ? u.collections.map(c => `<div class="set-row"><span class="grow">${esc(c.name)}</span><b>${c.n}</b></div>`).join('') : `<p class="small muted">No answer has cited a document yet.</p>`}</div>
    </div>
    <div class="card" style="margin-top:16px"><div class="card-head"><h3>People</h3></div><table class="list"><tr><th>Name</th><th>Questions</th><th>Last asked</th></tr>${u.people.map(p => `<tr><td>${esc(p.name)}</td><td>${p.questions}</td><td class="muted">${ago(p.last)}</td></tr>`).join('')}</table></div>`;
}

function diff(a, b) {
  if (!b) return ['First setup'];
  const out = [], names = ids => ids === 'all' ? 'all collections' : ids.length + ' chosen';
  if (a.models.join() !== b.models.join()) out.push('Models: ' + (a.models.join(', ') || 'none'));
  if (a.defaultModel !== b.defaultModel) out.push('Default model: ' + (a.defaultModel || 'none'));
  if (JSON.stringify(a.collections) !== JSON.stringify(b.collections)) out.push('Knowledge: ' + names(a.collections));
  if (JSON.stringify(a.access) !== JSON.stringify(b.access)) out.push('People: ' + accessLabel(a.access));
  if (a.safety.pii !== b.safety.pii) out.push('Personal data: ' + a.safety.pii);
  if (a.safety.retentionDays !== b.safety.retentionDays) out.push('Keep chats: ' + (a.safety.retentionDays ? a.safety.retentionDays + ' days' : 'forever'));
  if (a.safety.uploads !== b.safety.uploads) out.push('File uploads: ' + (a.safety.uploads ? 'on' : 'off'));
  if (!!a.safety.maskDocuments !== !!b.safety.maskDocuments) out.push('Mask documents: ' + (a.safety.maskDocuments ? 'on' : 'off'));
  if ((a.safety.blockedTopics || []).join() !== (b.safety.blockedTopics || []).join()) out.push('Blocked topics: ' + ((a.safety.blockedTopics || []).length || 'none'));
  if ((a.safety.dailyLimit || 0) !== (b.safety.dailyLimit || 0)) out.push('Daily limit: ' + (a.safety.dailyLimit || 'none'));
  if (!!a.safety.voice !== !!b.safety.voice) out.push('Voice typing: ' + (a.safety.voice ? 'on' : 'off'));
  if (a.tools && b.tools && a.tools.enabled.join() !== b.tools.enabled.join()) out.push('Plugins: ' + (a.tools.enabled.length || 'none'));
  if (a.tools && b.tools && (a.tools.browserMode !== b.tools.browserMode || a.tools.sites.join() !== b.tools.sites.join())) out.push('Browser sites: ' + (a.tools.browserMode === 'any' ? 'any' : a.tools.sites.length));
  if (JSON.stringify(a.advanced) !== JSON.stringify(b.advanced)) out.push('Advanced settings');
  return out.length ? out : ['No setting changed'];
}
function tabActivity() {
  const a = S.boot.app;
  const seg = `<div class="seg" style="margin-bottom:18px"><button class="${actTab === 'versions' ? 'on' : ''}" data-act="act-tab" data-v="versions">Versions and deploys</button><button class="${actTab === 'audit' ? 'on' : ''}" data-act="act-tab" data-v="audit">Audit log</button></div>`;
  if (actTab === 'audit') {
    const rows = cache.audit || [];
    return seg + `<div class="card"><div class="card-head"><h3>Audit log</h3>${info('Every change by your team, with who and when. Question and answer text is never written here.')}<span class="right"></span><input class="input" style="width:200px;height:34px" placeholder="Filter" data-on="audit-filter" aria-label="Filter the log"><button class="btn ghost tip-left" data-act="audit-verify" data-tip="Each entry carries a fingerprint of the one before it. Verify re-checks the whole chain.">Verify</button><button class="btn ghost" data-act="audit-export">Export</button></div>
      <table class="list"><tr><th>When</th><th>Who</th><th>What</th><th>On</th><th>Detail</th></tr><tbody id="audit-rows">${auditRows(rows, '')}</tbody></table></div>`;
  }
  const items = [...a.versions.map((v, i) => ({ t: v.at, kind: 'v', v, prev: a.versions[i + 1] })), ...a.deploys.map(d => ({ t: d.startedAt, kind: 'd', d }))].sort((x, y) => y.t.localeCompare(x.t));
  if (!items.length) return seg + `<div class="empty">${icon('history')}Nothing yet. Saved setups and deploys show up here.</div>`;
  const dchip = d => d.result === 'ok' ? chip('Went live', 'ok') : d.result === 'failed' ? chip('Did not finish', 'err') : d.result === 'cancelled' ? chip('Cancelled', '') : chip('In progress', 'warn');
  return seg + `<div class="card"><div class="timeline">${items.map(it => it.kind === 'v' ? `<div class="tl"><span class="ico">${icon('tune')}</span><div class="grow"><div class="row wrap"><b>config v${it.v.v}</b>${it.v.v === a.deployedVersion ? chip('Live', 'ok') : ''}${it.v.v === a.latestVersion && it.v.v !== a.deployedVersion ? chip('Not live', 'warn') : ''}</div>
        <div class="small muted">${when(it.v.at)} · ${esc(it.v.by)}${it.v.note ? ' · ' + esc(it.v.note) : ''}</div><div class="row wrap" style="gap:6px;margin-top:8px">${diff(it.v.config, it.prev && it.prev.config).map(x => `<span class="tag">${esc(x)}</span>`).join('')}</div></div>
        ${it.v.v !== a.latestVersion && a.status !== 'deploying' ? `<button class="btn ghost" data-act="rollback" data-v="${it.v.v}">Roll back</button>` : ''}</div>`
    : `<div class="tl"><span class="ico">${icon('rocket_launch')}</span><div class="grow"><div class="row wrap"><b>Deploy of config v${it.d.v}</b>${dchip(it.d)}</div>
        <div class="small muted">${when(it.d.startedAt)} · ${esc(it.d.by)}${it.d.endedAt ? ' · took ' + Math.max(1, Math.round((new Date(it.d.endedAt) - new Date(it.d.startedAt)) / 1000)) + ' s' : ''}${it.d.note ? ' · ' + esc(it.d.note) : ''}</div>${it.d.reason && it.d.result !== 'ok' ? `<div class="small" style="margin-top:6px;color:var(--vnk-err)">${esc(it.d.reason)}</div>` : ''}</div></div>`).join('')}</div></div>`;
}
const auditRows = (rows, f) => { const q = f.toLowerCase(); const r = rows.filter(x => !q || (x.userName + x.action + x.target + x.detail).toLowerCase().includes(q)); return r.length ? r.map(x => `<tr><td class="muted" style="white-space:nowrap">${when(x.at)}</td><td>${esc(x.userName)}</td><td>${esc(x.action)}</td><td>${esc(x.target)}</td><td class="muted">${esc(x.detail)}</td></tr>`).join('') : `<tr><td colspan="5" class="muted">Nothing matches.</td></tr>`; };
ins['audit-filter'] = el => { $('#audit-rows').innerHTML = auditRows(cache.audit || [], el.value); };
acts['audit-verify'] = async () => { const r = await api('GET', '/api/admin/audit/verify'); toast(r.ok ? `The log is intact. ${r.checked} entries checked.` : `Entry ${r.brokenAt} was changed or removed.`, r.ok ? '' : 'err'); };
acts['audit-export'] = async () => { const r = await api('GET', '/api/admin/audit/export'); downloadText(r.name + '.csv', r.csv, 'text/csv'); };
acts['act-tab'] = el => { actTab = el.dataset.v; rerender(); };
acts.rollback = el => confirmBox(`Roll back to config v${el.dataset.v}?`, 'A new config with those settings is saved and deployed. The current one stays in the list.', 'Roll back', async () => { await api('POST', '/api/app/rollback', { v: +el.dataset.v }); cache.key = ''; await refresh(); watchDeploy(); }, false);

function pageManage(tab) {
  const B = S.boot, a = B.app;
  if (a.status === 'not_installed') return osShell('apps', 'Apps', `<a class="back" href="#/os/apps">${icon('arrow_back')}Apps</a><div class="empty">${icon('forum')}VanikGPT is not installed on this appliance.<br><button class="btn" data-act="app-install">Install</button></div>`);
  const st = appStatus(), tabs = [['overview', 'Overview'], ['setup', 'Setup'], ['usage', 'Usage'], ['activity', 'Activity']];
  if (!tabs.some(t => t[0] === tab)) tab = 'overview';
  ensureDraft();
  ensure('manage:' + tab, async () => { if (tab === 'activity') cache.audit = await api('GET', '/api/admin/audit'); else cache.usage = await api('GET', '/api/admin/usage'); });
  watchDeploy();
  const html = osShell('apps', `<a href="#/os/apps">Apps</a> / VanikGPT`, `
    <a class="back" href="#/os/apps">${icon('arrow_back')}Apps</a>
    <div class="page-head"><span class="app-ico" style="width:48px;height:48px;border-radius:13px">${icon('forum')}</span>
      <div class="grow"><div class="row"><h1 style="font-size:28px">VanikGPT</h1>${chip(st[0], st[1])}</div><p class="mono" style="margin-top:9px">${esc(B.device.name)} · port ${a.port}${a.deployedVersion ? ' · config v' + a.deployedVersion : ''} · ${esc(a.image)}</p></div>
      ${a.status === 'running' && B.device.online ? `<a class="btn lg" href="#/gpt">Open VanikGPT</a>` : ''}<button class="icon-btn bordered" data-act="app-menu" aria-label="More">${icon('more_vert')}</button></div>
    <div id="deploy-box">${deployBox()}</div>
    <nav class="tabs">${tabs.map(t => `<a class="${t[0] === tab ? 'on' : ''}" href="#/os/apps/vanikgpt/${t[0]}">${t[1]}</a>`).join('')}</nav>
    ${{ overview: tabOverview, setup: tabSetup, usage: tabUsage, activity: tabActivity }[tab]()}`);
  if (tab === 'setup') queueMicrotask(saveBar);
  return html;
}

// ---------- Knowledge base
const usedByGpt = id => { const a = S.boot.app, c = S.boot.collections.find(x => x.id === id); return a.status !== 'not_installed' && !!c && usedBy(c, 'vanikgpt') && (a.config.collections === 'all' || a.config.collections.includes(id)); };
function pageKnowledge() {
  const B = S.boot, docs = B.collections.reduce((n, c) => n + c.docCount, 0), size = B.collections.reduce((n, c) => n + c.bytes, 0);
  return osShell('knowledge', 'Knowledge base', `
    <div class="page-head"><div class="grow"><h1>Knowledge bases</h1><p class="sub">The documents your apps search. Everything stays on the appliance.</p></div><button class="btn lg" data-act="col-new">New knowledge base</button></div>
    ${embedCard(B)}
    ${B.collections.length ? `<div class="grid">${B.collections.map(c => `<a class="card app-card" href="#/os/knowledge/${c.id}">
      <div class="row"><span class="avatar sq">${esc(initials(c.name))}</span><div class="grow"><h3 class="ellipsis">${esc(c.name)}</h3><span class="mono">${c.docCount} ${c.docCount === 1 ? 'document' : 'documents'} · ${bytes(c.bytes)}</span></div><button class="icon-btn sm" data-act="col-menu" data-id="${c.id}" data-stop aria-label="More">${icon('more_vert')}</button></div>
      <div class="row wrap" style="gap:6px">${stateChip(c)}${chip(accessLabel(c.access), 'line', false)}${chip(appNames(c), 'line', false)}</div>
      <div class="foot"><span class="small faint grow">Updated ${ago(c.updatedAt)}</span><span class="small" style="font-weight:600">${c.docCount ? 'Open' : 'Add documents'} →</span></div></a>`).join('')}</div>
      <p class="mono" style="margin-top:18px">${B.collections.length} ${B.collections.length === 1 ? 'knowledge base' : 'knowledge bases'} · ${docs} ${docs === 1 ? 'document' : 'documents'} · ${bytes(size)}</p>`
    : `<div class="empty">${icon('library_books')}No knowledge bases yet. A knowledge base is a set of documents your apps can search.<br><button class="btn" data-act="col-new">New knowledge base</button></div>`}`);
}
acts['col-new'] = () => modal({ title: 'New knowledge base', text: 'It starts as a draft that only admins see. Publish it when it is ready.', body: `<div class="stack"><label class="field"><span>Name</span><input class="input" id="f-name" maxlength="80" placeholder="HR policies"></label><label class="field"><span>What is in it ${info('Shown to people when they choose where answers come from.')}</span><input class="input" id="f-desc" maxlength="140" placeholder="Leave, travel and expense rules"></label></div>`,
  actions: [{ label: 'Create', run: async o => { const c = await api('POST', '/api/collections', { name: $('#f-name', o).value, description: $('#f-desc', o).value, state: 'draft' }); await load(); go('#/os/knowledge/' + c.id); } }] });
const colDelete = c => confirmBox(`Delete "${c.name}"?`, `Its ${c.docCount} ${c.docCount === 1 ? 'document is' : 'documents are'} removed from the appliance. Answers will stop citing them. This cannot be undone.`, 'Delete', async () => { await api('DELETE', '/api/collections/' + c.id); await load(); go('#/os/knowledge'); });
const colRename = c => modal({ title: 'Rename knowledge base', body: `<div class="stack"><label class="field"><span>Name</span><input class="input" id="f-name" maxlength="80" value="${esc(c.name)}"></label><label class="field"><span>What is in it</span><input class="input" id="f-desc" maxlength="140" value="${esc(c.description)}"></label></div>`, actions: [{ label: 'Save', run: async o => { await api('PATCH', '/api/collections/' + c.id, { name: $('#f-name', o).value, description: $('#f-desc', o).value }); await refresh(); } }] });
acts['col-menu'] = el => { const c = S.boot.collections.find(x => x.id === el.dataset.id); menu(el, [{ label: 'Rename', icon: 'edit', run: () => colRename(c) }, '-', { label: 'Delete', icon: 'delete_outline', danger: true, run: () => colDelete(c) }]); };

export async function uploadFiles(url, files, extra = {}) {
  let ok = 0; const bad = [];
  for (const f of files) {
    const say = t => { const box = $('#uploads'); if (box) box.innerHTML = `<div class="banner plain">${icon('upload_file')}<span>${esc(t)}</span></div>`; };
    say(`Reading ${f.name} (${ok + bad.length + 1} of ${files.length})…`);
    try { await api('POST', url, { ...(await extractFile(f, say)), ...extra }); ok++; } catch (e) { bad.push(e.message); }
  }
  const box = $('#uploads'); if (box) box.innerHTML = '';
  if (ok) toast(`${ok} ${ok === 1 ? 'document' : 'documents'} added.`);
  bad.forEach(m => toast(m, 'err'));
  return ok;
}
let colAccessFor = '';
function pageCollection(id) {
  const B = S.boot, c = B.collections.find(x => x.id === id);
  if (!c) return osShell('knowledge', 'Knowledge base', `<a class="back" href="#/os/knowledge">${icon('arrow_back')}Knowledge base</a><div class="empty">This knowledge base no longer exists.</div>`);
  ensure('col:' + id, async () => { cache.docs[id] = await api('GET', `/api/collections/${id}/documents`); });
  if (colAccessFor !== id + JSON.stringify(c.access)) { colAccessFor = id + JSON.stringify(c.access); accessDrafts.col = JSON.parse(JSON.stringify(c.access)); }
  accessChanged.col = () => { const b = $('#acc-save'); if (b) b.classList.toggle('hidden', JSON.stringify(accessDrafts.col) === JSON.stringify(c.access)); };
  const docs = cache.docs[id];
  return osShell('knowledge', `<a href="#/os/knowledge">Knowledge base</a> / ${esc(c.name)}`, `
    <a class="back" href="#/os/knowledge">${icon('arrow_back')}Knowledge base</a>
    <div class="page-head"><span class="avatar sq" style="width:48px;height:48px;font-size:15px">${esc(initials(c.name))}</span><div class="grow"><h1 style="font-size:28px">${esc(c.name)}</h1><p class="sub">${esc(c.description || 'No description')} · ${c.docCount} ${c.docCount === 1 ? 'document' : 'documents'} · ${bytes(c.bytes)}</p></div>
      <button class="btn lg" data-act="doc-add" data-id="${id}">${icon('add')}Add documents</button><button class="icon-btn bordered" data-act="col-menu" data-id="${id}" aria-label="More">${icon('more_vert')}</button></div>
    <div id="uploads"></div>
    ${publishBar(c)}
    <div class="grid two" style="align-items:start;grid-template-columns:minmax(0,1.7fr) minmax(0,1fr)">
      <div class="card"><div class="card-head"><h3>Documents</h3></div>
        ${!docs ? `<p class="muted">Loading…</p>` : docs.length ? `<table class="list"><tr><th>Name</th><th>Size</th><th>Added</th><th></th></tr>${docs.map(d => `<tr><td><a class="link" href="#/gpt/source/${d.id}/-/os">${esc(d.name)}</a><div class="mono">${d.paged ? d.pages + ' pages · ' : ''}${d.chunks} passages</div>
          <div class="row wrap" style="gap:5px;margin-top:5px">${[d.purpose && 'For: ' + d.purpose, d.expiresOn && 'Keep until ' + d.expiresOn, d.restrict.length && 'Only ' + d.restrict.join(', '), d.pii.length && 'Masked: ' + d.pii.join(', '), d.ocr && 'Read from a scan', d.synced && 'From a folder', d.note && 'Note from chat', d.transcribed && 'Recording with transcript', d.waiting && 'Waiting for a transcript'].filter(Boolean).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div></td><td class="muted">${bytes(d.size)}</td><td class="muted">${ago(d.uploadedAt)}<div class="small faint">${esc(d.uploadedBy)}</div></td><td class="act">${d.waiting ? `<button class="icon-btn sm" data-act="doc-transcript" data-id="${d.id}" data-name="${esc(d.name)}" data-tip="Add the transcript" aria-label="Add the transcript">${icon('subtitles')}</button>` : ''}<button class="icon-btn sm" data-act="doc-edit" data-id="${d.id}" data-col="${id}" data-tip="Purpose, keep until, teams" aria-label="Document rules">${icon('tune')}</button><button class="icon-btn sm" data-act="doc-del" data-id="${d.id}" data-name="${esc(d.name)}" data-tip="Remove" aria-label="Remove">${icon('delete_outline')}</button></td></tr>`).join('')}</table>` : ''}
        <div class="drop" data-drop="${id}" style="margin-top:${docs && docs.length ? 16 : 0}px">${icon('upload_file')} Drop files here, or <button class="link" data-act="doc-add" data-id="${id}">choose files</button><div class="small faint" style="margin-top:6px">PDF, Word, Excel, text, code, CSV, HTML, images of scans and recordings. Files are read and stored on the appliance.</div></div></div>
      <div class="stack" style="gap:16px">
        <div class="card"><div class="card-head"><h3>Who can use it</h3>${info('Only these people get answers from this knowledge base, in any app.')}</div>${accessPicker('col', 'Everyone on this tenant')}<button class="btn hidden" id="acc-save" style="margin-top:14px" data-act="col-access" data-id="${id}">Save</button></div>
        <div class="card"><div class="card-head"><h3>Search</h3>${info('Keyword search always works. Meaning-based search is added when an embedding model is serving, so a question can find a passage that uses different words.')}</div>
          <div class="row">${chip('Keyword', 'ok')}${c.embedded ? chip(`Meaning: ${c.embedded} of ${c.passages} passages`, c.embedded === c.passages ? 'ok' : 'warn') : chip('Meaning: off', '')}<span class="grow"></span>${B.embeddingReady && c.embedded < c.passages ? `<button class="btn ghost" data-act="col-reindex" data-id="${id}">Build</button>` : ''}</div>
          ${!B.embeddingReady && !c.embedded ? `<p class="small muted" style="margin-top:10px">Meaning-based search turns on when an embedding model is serving in <a class="link" href="#/os/models">Model Hub</a> and the model gateway is reachable.</p>` : ''}</div>
        <div class="card"><div class="card-head"><h3>Try a search</h3>${info('Shows the passages an app would get for a question.')}</div><input class="input" id="try-q" placeholder="Type a question and press Enter" data-id="${id}"><div id="try-res" class="stack" style="margin-top:12px;gap:10px"></div></div>
        ${appsCard(c)}
      </div></div>`);
}
acts['doc-add'] = async el => { const files = await pickFiles(); if (!files.length) return; await uploadFiles(`/api/collections/${el.dataset.id}/documents`, files); cache.key = ''; await refresh(); };
acts['col-reindex'] = async el => { el.disabled = true; el.textContent = 'Building…'; await api('POST', `/api/collections/${el.dataset.id}/reindex`); toast('Meaning-based search is ready for this collection.'); await refresh(); };
acts['doc-edit'] = el => {
  const d = (cache.docs[el.dataset.col] || []).find(x => x.id === el.dataset.id), teams = S.boot.teams; if (!d) return;
  const m = modal({ title: 'Rules for this document', text: d.name, body: `<div class="stack"><label class="field"><span>What it is for ${info('The purpose this document may be used for. Shown to admins and kept in the audit log.')}</span><input class="input" id="f-purpose" maxlength="120" value="${esc(d.purpose)}" placeholder="Vendor onboarding"></label>
    <label class="field"><span>Keep until ${info('After this date the document is no longer searched and is removed from the appliance.')}</span><input class="input" id="f-exp" type="date" value="${esc(d.expiresOn)}"></label>
    <div><div class="small" style="font-weight:600;margin-bottom:8px">Only these teams ${info('Leave empty to follow the collection. Owners and admins always have access.')}</div><div class="row wrap" style="gap:6px" id="f-teams">${teams.length ? teams.map(t => `<button class="tag ${d.restrict.includes(t) ? 'on' : ''}" data-v="${esc(t)}">${esc(t)}</button>`).join('') : '<span class="small muted">No teams yet. Add them on the People page.</span>'}</div></div></div>`,
    actions: [{ label: 'Save', run: async o => { await api('PATCH', '/api/documents/' + d.id, { purpose: $('#f-purpose', o).value, expiresOn: $('#f-exp', o).value, restrict: [...o.querySelectorAll('#f-teams .on')].map(b => b.dataset.v) }); cache.key = ''; await refresh(); } }] });
  $('#f-teams', m.el).onclick = e => { const b = e.target.closest('button'); if (b) b.classList.toggle('on'); };
};
acts['doc-transcript'] = el => modal({ title: 'Transcript for ' + el.dataset.name, wide: true, text: 'A recording is transcribed on the appliance when a speech model is serving. None is serving now, so paste the transcript here to make it searchable.', body: `<textarea class="input" id="f-tr" rows="10" placeholder="Speaker: what was said…"></textarea>`,
  actions: [{ label: 'Save', run: async o => { await api('POST', `/api/documents/${el.dataset.id}/transcript`, { text: $('#f-tr', o).value }); cache.key = ''; toast('Transcript added. The recording can now be searched.'); await refresh(); } }] });
acts['doc-del'] = el => confirmBox(`Remove "${el.dataset.name}"?`, 'Answers will stop citing this document.', 'Remove', async () => { await api('DELETE', '/api/documents/' + el.dataset.id); cache.key = ''; await refresh(); });
acts['col-access'] = async el => { await api('PATCH', '/api/collections/' + el.dataset.id, { access: accessDrafts.col }); toast('Access saved.'); await refresh(); };
document.addEventListener('keydown', async e => {
  if (e.key !== 'Enter' || e.target.id !== 'try-q') return;
  const res = $('#try-res'), hits = await api('POST', '/api/search', { q: e.target.value, collectionId: e.target.dataset.id });
  res.innerHTML = hits.length ? hits.map(h => `<a class="card flat" style="padding:12px" href="#/gpt/source/${h.docId}/${h.chunkId}/os"><div class="small faint ellipsis">${esc(h.docName)}${h.page ? ' · page ' + h.page : ''} · matched by ${h.via === 'both' ? 'keyword and meaning' : h.via}</div><div class="small" style="margin-top:4px">${esc(h.text.slice(0, 220))}${h.text.length > 220 ? '…' : ''}</div></a>`).join('') : `<p class="small muted">Nothing in this knowledge base matches.</p>`;
});
for (const ev of ['dragover', 'dragleave', 'drop']) document.addEventListener(ev, async e => {
  const z = e.target.closest && e.target.closest('[data-drop]'); if (!z) return;
  e.preventDefault(); z.classList.toggle('over', ev === 'dragover');
  if (ev === 'drop' && e.dataTransfer.files.length) { await uploadFiles(`/api/collections/${z.dataset.drop}/documents`, [...e.dataTransfer.files]); cache.key = ''; await refresh(); }
});

// ---------- Model Hub
const GOOD = [[/embedding|bge/i, 'Search over your documents'], [/vl|vision/i, 'Reading drawings and images'], [/ocr/i, 'Reading scanned pages'], [/rumik|indic/i, 'Indian languages'], [/2\db|30b|20b|70b|120b/i, 'Answers from documents and longer reasoning'], [/./, 'Quick, short answers']];
const goodFor = id => GOOD.find(g => g[0].test(id))[1];
function pageModels() {
  const B = S.boot, d = B.device, used = id => B.app.status !== 'not_installed' && B.app.config.models.includes(id);
  watchModels();
  const order = { serving: 0, starting: 0, parked: 1, available: 2 }, list = [...B.models].sort((a, b) => order[a.status] - order[b.status] || a.memGb - b.memGb);
  return osShell('models', 'On this appliance', `
    <div class="page-head"><div class="grow"><h1>Models on this appliance</h1><p class="sub">${B.models.length} models · ${d.serving} serving. Serve one to use it; park it to free its memory.</p></div></div>
    <div class="card" style="margin-bottom:18px"><div class="row"><div class="grow"><div class="stat"><span class="k">GPU memory ${info('Memory in use by serving models and installed apps.')}</span></div><div class="row" style="margin-top:8px"><b style="font-size:22px">${d.usedGb}</b><span class="muted">/ ${d.memGb} GB</span><span class="right muted small">${d.freeGb} GB free · ${d.serving} of ${d.slots} model slots in use</span></div><div class="meter" style="margin-top:10px"><i style="width:${Math.min(100, Math.round(100 * d.usedGb / d.memGb))}%"></i></div></div></div></div>
    <div class="card"><table class="list"><tr><th>Model</th><th>Type</th><th>Memory</th><th>Context</th><th>Status</th><th></th></tr>
    ${list.map(m => `<tr><td><div class="row"><span class="avatar sq">${esc(m.id.slice(0, 2).toUpperCase())}</span><div><b>${esc(m.id)}</b>${B.app.status !== 'not_installed' && B.app.config.defaultModel === m.id ? ' ' + chip('Default for chat', 'line', false) : ''}<div class="small muted">${goodFor(m.id)}</div>${m.note && !/indic|drawings/i.test(m.note) ? `<div class="small faint">${esc(m.note)}</div>` : ''}${used(m.id) ? `<div class="small faint">Used by VanikGPT</div>` : ''}</div></div></td>
      <td>${{ chat: 'Chat and documents', embedding: 'Search', vision: 'Drawings and images', speech: 'Speech' }[m.kind] || esc(m.kind)}</td><td>${m.memGb} GB</td><td class="muted">${m.context ? m.context.toLocaleString() : '—'}</td>
      <td>${m.status === 'serving' ? chip('Serving', 'ok') + ` <span class="mono">port ${m.port}</span>` : m.status === 'starting' ? chip('Starting', 'warn') : m.status === 'parked' ? chip('Parked', '') : chip('Not on device', '')}${m.status === 'serving' || m.status === 'starting' ? '' : ' ' + (d.serving >= d.slots ? chip('No free slot', 'err', false) : m.memGb > d.freeGb ? chip('Too big now', 'err', false) : m.memGb > d.freeGb * 0.85 ? chip('Tight', 'warn', false) : chip('Fits', 'ok', false))}${m.testedAt && m.status === 'serving' ? `<div class="small faint">Test question passed ${ago(m.testedAt)}</div>` : ''}</td>
      <td class="act">${m.status === 'serving' ? `<button class="btn ghost" data-act="model-park" data-id="${esc(m.id)}">Park</button>` : m.status === 'starting' ? `<button class="btn ghost" data-act="model-cancel" data-id="${esc(m.id)}">Cancel</button>` : `<button class="btn" data-act="model-serve" data-id="${esc(m.id)}">Serve</button>`}</td></tr>`).join('')}</table></div>`);
}
let modelT = null;
function watchModels() {
  if (modelT || !S.boot.models.some(m => m.status === 'starting')) return;
  const ids = S.boot.models.filter(m => m.status === 'starting').map(m => m.id);
  modelT = setInterval(async () => {
    try { await load(); } catch { return; }
    if (S.boot.models.some(m => m.status === 'starting')) return;
    clearInterval(modelT); modelT = null;
    ids.forEach(id => { const m = S.boot.models.find(x => x.id === id); toast(m.status === 'serving' ? id + ' is serving.' : id + ' did not start. See Devices for the reason.', m.status === 'serving' ? '' : 'err'); });
    if (location.hash.startsWith('#/os/')) rerender();
  }, 500);
}
acts['model-serve'] = async el => { el.disabled = true; await api('POST', `/api/models/${encodeURIComponent(el.dataset.id)}/serve`); await refresh(); };
acts['model-cancel'] = async el => { await api('POST', `/api/models/${encodeURIComponent(el.dataset.id)}/park`); clearInterval(modelT); modelT = null; await refresh(); };
acts['model-park'] = el => {
  const B = S.boot, id = el.dataset.id, park = async () => { await api('POST', `/api/models/${encodeURIComponent(id)}/park`); toast(id + ' is parked. Its memory is free.'); await refresh(); };
  const cfg = B.app.config, last = B.app.status !== 'not_installed' && cfg.models.includes(id) && !cfg.models.some(x => x !== id && B.models.some(m => m.id === x && m.status === 'serving'));
  return last ? confirmBox(`Park ${id}?`, 'VanikGPT has no other serving model. Until you serve one, answers are built from documents only.', 'Park', park) : park();
};

// ---------- People
function pagePeople() {
  const B = S.boot;
  return osShell('people', 'People', `
    <div class="page-head"><div class="grow"><h1>People</h1><p class="sub">Who can reach this tenant, and what they can do.</p></div><button class="btn lg" data-act="user-invite">Invite someone</button></div>
    <div class="card"><table class="list"><tr><th>Name</th><th>Email</th><th>Role ${info('Owners and admins run the appliance. App users only use the apps they are given.')}</th><th>Teams ${info('Use teams to give a group of people an app or a collection in one go.')}</th><th>Last active</th><th></th></tr>
    ${B.users.map(u => `<tr><td><div class="row"><span class="avatar">${esc(initials(u.name))}</span><b>${esc(u.name)}</b>${u.id === B.me.id ? `<span class="faint small">you</span>` : ''}</div></td><td class="muted">${esc(u.email)}</td>
      <td>${u.role === 'owner' ? ROLE.owner : `<select class="input" style="height:32px;width:130px" data-change="user-role" data-id="${u.id}"><option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option><option value="user" ${u.role === 'user' ? 'selected' : ''}>App user</option></select>`}</td>
      <td><div class="row wrap" style="gap:5px">${(u.teams || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}<button class="icon-btn sm" data-act="user-teams" data-id="${u.id}" data-tip="Edit teams" aria-label="Edit teams">${icon('edit')}</button></div></td>
      <td class="muted">${u.status === 'invited' ? chip('Invited', 'warn') : ago(u.lastActiveAt)}</td>
      <td class="act">${S.boot.app.config.safety.adminChats ? `<button class="icon-btn sm tip-left" data-act="user-chats" data-id="${u.id}" data-tip="Open their chats (recorded)" aria-label="Open their chats">${icon('forum')}</button>` : ''}<button class="icon-btn sm tip-left" data-act="user-erase" data-id="${u.id}" data-tip="Erase their chats and files" aria-label="Erase data">${icon('cleaning_services')}</button>${u.role === 'owner' ? '' : `<button class="icon-btn sm" data-act="user-remove" data-id="${u.id}" data-tip="Remove" aria-label="Remove">${icon('person_remove')}</button>`}</td></tr>`).join('')}</table></div>
    <p class="mono" style="margin-top:18px">${B.users.length} ${B.users.length === 1 ? 'user' : 'users'}</p>
    ${teamsCard(B)}`);
}
const teamsOf = v => v.split(',').map(s => s.trim()).filter(Boolean);
acts['user-invite'] = () => {
  let role = 'user';
  const m = modal({ title: 'Invite someone', body: `<div class="stack"><label class="field"><span>Name</span><input class="input" id="f-name" placeholder="Asha Verma"></label><label class="field"><span>Work email</span><input class="input" id="f-email" type="email" placeholder="asha@company.com"></label>
    <div class="field"><span class="row" style="gap:5px;font-size:12.5px;font-weight:600">Role</span><div style="margin-top:6px"><div class="seg" id="f-role"><button class="on" data-v="user">App user</button><button data-v="admin">Admin</button></div></div></div>
    <label class="field"><span>Teams ${info('Optional. Separate with commas.')}</span><input class="input" id="f-teams" placeholder="Finance, Legal"></label></div>`,
    actions: [{ label: 'Send invite', run: async o => { await api('POST', '/api/users', { name: $('#f-name', o).value, email: $('#f-email', o).value, role, teams: teamsOf($('#f-teams', o).value) }); toast('Invite sent.'); await refresh(); } }] });
  $('#f-role', m.el).onclick = e => { const b = e.target.closest('button'); if (!b) return; role = b.dataset.v; [...b.parentNode.children].forEach(x => x.classList.toggle('on', x === b)); };
};
ins['user-role'] = async el => { await api('PATCH', '/api/users/' + el.dataset.id, { role: el.value }); toast('Role changed.'); await refresh(); };
acts['user-teams'] = el => { const u = S.boot.users.find(x => x.id === el.dataset.id); modal({ title: 'Teams for ' + u.name, body: `<label class="field"><span>Teams ${info('Separate with commas.')}</span><input class="input" id="f-teams" value="${esc((u.teams || []).join(', '))}" placeholder="Finance, Legal"></label>`, actions: [{ label: 'Save', run: async o => { await api('PATCH', '/api/users/' + u.id, { teams: teamsOf($('#f-teams', o).value) }); await refresh(); } }] }); };
acts['user-erase'] = el => { const u = S.boot.users.find(x => x.id === el.dataset.id); confirmBox(`Erase ${u.name}'s data?`, 'Their chats, files attached in chats, saved prompts, private agents and feedback are removed for good. The account stays.', 'Erase', async () => { const r = await api('POST', `/api/users/${u.id}/erase`); const n = (c, w) => `${c} ${w}${c === 1 ? "" : "s"}`; toast(`Erased ${n(r.chats, "chat")}, ${n(r.files, "file")} and ${n(r.prompts, "prompt")}.`); await refresh(); }); };
acts['user-chats'] = async el => { const u = S.boot.users.find(x => x.id === el.dataset.id), l = await api('GET', `/api/admin/users/${u.id}/chats`); modal({ title: 'Chats of ' + u.name, wide: true, cancel: 'Close', text: 'Opening a chat is written to the audit log with your name.', body: l.length ? l.map(c => `<a class="set-row" style="text-decoration:none" href="#/gpt/shared/${c.id}"><div class="grow"><div class="lbl ellipsis">${esc(c.title)}</div><div class="small muted">${c.messages} messages · ${ago(c.updatedAt)}</div></div>${icon('chevron_right')}</a>`).join('') : '<p class="muted">No chats.</p>' }); };
acts['user-remove'] = el => { const u = S.boot.users.find(x => x.id === el.dataset.id); confirmBox(`Remove ${u.name}?`, 'They lose access to every app straight away. Their chats are deleted.', 'Remove', async () => { await api('DELETE', '/api/users/' + u.id); await refresh(); }); };

// ---------- Settings and unchanged pages
function pageSettings() {
  const d = S.boot.device;
  return osShell('settings', 'Settings', `
    <div class="page-head"><div><h1>Settings</h1><p class="sub">Tenant-wide configuration.</p></div></div>
    <div class="card" style="max-width:820px"><div class="row"><div class="grow"><h3>${d.online ? 'Take Vanik Appliance offline' : 'Bring Vanik Appliance online'}</h3><p class="small muted">${d.online ? 'Stops all running apps and model servers on ' + esc(d.name) + '.' : esc(d.name) + ' is offline. Apps and models are stopped.'}</p></div><button class="btn ${d.online ? 'danger' : ''}" data-act="device-toggle">${d.online ? 'Go offline' : 'Go online'}</button></div></div>
    <div class="banner plain" style="max-width:820px;margin-top:16px">${icon('info_outline')}<span>Tenant name, ports and agent updates work as they do in Vanik OS today.</span><a class="btn ghost" href="${LIVE_OS}settings" target="_blank" rel="noopener">Open in Vanik OS ${icon('open_in_new')}</a></div>`);
}
acts['device-toggle'] = () => { const on = S.boot.device.online, run = async () => { await api('POST', '/api/device/online', { online: !on }); await refresh(); }; return on ? confirmBox('Take the appliance offline?', 'Every app stops and nobody can chat until you bring it back.', 'Go offline', run) : run(); };
function pageSame(key) {
  const n = NAV.find(x => x[0] === key) || ['home', 'Home', 'home'];
  return osShell(n[0], n[1], `<div class="page-head"><div><h1>${n[1]}</h1></div></div><div class="empty" style="max-width:820px">${icon(n[2])}${n[1]} works as it does in Vanik OS today. VanikGPT does not change this page.<br><a class="btn ghost" href="${LIVE_OS}${n[0]}" target="_blank" rel="noopener">Open in Vanik OS ${icon('open_in_new')}</a></div>`);
}

// ---------- command palette
acts.palette = () => {
  const B = S.boot, items = [
    ...(B.admin ? NAV.filter(n => typeof n !== 'string').map(n => ({ label: n[1], icon: n[2], hash: '#/os/' + n[0] })) : []),
    ...(B.admin && B.app.status !== 'not_installed' ? [{ label: 'VanikGPT setup', icon: 'tune', hash: '#/os/apps/vanikgpt/setup' }] : []),
    ...(B.canUseGpt ? [{ label: 'New chat', icon: 'add_comment', hash: '#/gpt' }, { label: 'Agents', icon: 'smart_toy', hash: '#/gpt/assistants' }, { label: 'Workflows', icon: 'fact_check', hash: '#/gpt/flows' }] : []),
    ...(B.admin ? B.collections.map(c => ({ label: c.name, icon: 'library_books', hash: '#/os/knowledge/' + c.id, sub: 'Collection' })) : []),
    ...(B.canUseGpt ? B.chats.map(c => ({ label: c.title, icon: 'chat_bubble_outline', hash: '#/gpt/c/' + c.id, sub: 'Chat' })) : []),
  ];
  const o = document.createElement('div'); o.className = 'overlay'; o.style.placeItems = 'start center'; o.style.paddingTop = '12vh';
  o.innerHTML = `<div class="modal wide palette"><input placeholder="Search pages, collections and chats" aria-label="Search"><div class="res"></div></div>`;
  const inp = $('input', o), res = $('.res', o), close = () => o.remove();
  const draw = () => { const q = inp.value.toLowerCase(), r = items.filter(i => inScope(i.hash) && i.label.toLowerCase().includes(q)).slice(0, 12); res.innerHTML = r.length ? r.map((i, n) => `<button class="${n ? '' : 'sel'}" data-h="${esc(i.hash)}">${icon(i.icon)}<span class="grow ellipsis">${esc(i.label)}</span>${i.sub ? `<span class="mono">${i.sub}</span>` : ''}</button>`).join('') : `<p class="small muted" style="padding:10px">Nothing matches.</p>`; };
  inp.oninput = draw; res.onclick = e => { const b = e.target.closest('button'); if (b) { close(); go(b.dataset.h); } };
  o.onmousedown = e => { if (e.target === o) close(); };
  o.onkeydown = e => { if (e.key === 'Escape') close(); if (e.key === 'Enter') { const b = $('.res button', o); if (b) { close(); go(b.dataset.h); } } };
  document.body.appendChild(o); draw(); inp.focus();
};
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey || e.altKey) && e.key.toLowerCase() === 'k' && S.boot) { e.preventDefault(); if (!$('.palette')) acts.palette(); } });
// space/enter on role=checkbox rows
document.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && e.target.matches && e.target.matches('.check[tabindex]')) { e.preventDefault(); e.target.click(); } });

export function osPage(parts) {
  if (!S.boot.admin) return null;
  const [p, a, b] = parts;
  if (p === 'apps' && a === 'vanikgpt') return pageManage(b || 'overview');
  if (p === 'apps') return pageApps();
  if (p === 'knowledge') return a ? pageCollection(a) : pageKnowledge();
  if (p === 'models') return pageModels();
  if (p === 'people') return pagePeople();
  if (p === 'settings') return pageSettings();
  if (p === 'stores') return osShell('stores', 'Data stores', storesBody());
  return pageSame(p);
}
