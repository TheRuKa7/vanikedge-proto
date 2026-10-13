// Who runs an app, and where it keeps what it stores. With an app admin named, the app options are inside the app only.
// One set of cards for VanikGPT (console, Apps, VanikGPT, Setup) and Vanik Sense (console, Apps, Vanik Sense, Setup).
// The caller passes the names of its own actions, so VanikGPT can keep its changes in a draft and Vanik Sense can save at once.
import { esc, icon, info, chip, bytes } from './core.js';

export const ADMIN0 = { users: [], advanced: false }, STORE0 = { kind: 'db', gb: 20 };
export const openApp = {}; // 'An app admin' was pressed but nobody is picked yet

// ---------- the first card on a Setup page
// p: the action prefix. options: the words for what moves into the app. keeps: what stays on this page.
export function whoRuns({ p, app, name, people, picked, advanced, options, keeps, href }) {
  const mode = picked.length || openApp[app] ? 'app' : 'console';
  return `<div class="card who"><div class="card-head"><h3>Who runs ${name}</h3>${info(`Console admins: every option for ${name} is on this page. An app admin: ${options} are changed inside ${name} and are not on this page.`)}</div>
    <div class="seg"><button class="${mode === 'console' ? 'on' : ''}" data-act="${p}-mode" data-v="console">Console admins</button><button class="${mode === 'app' ? 'on' : ''}" data-act="${p}-mode" data-v="app">An app admin</button></div>
    ${mode === 'console' ? `<p class="small muted" style="margin-top:10px">Every option for ${name} is on this page.</p>` : `
      <div class="row wrap" style="gap:6px;margin-top:14px">${people.length ? people.map(u => `<button class="tag ${picked.includes(u.id) ? 'on' : ''}" data-act="${p}-pick" data-v="${u.id}">${esc(u.name)}</button>`).join('') : `<span class="small muted">No app users yet. <a class="link" href="#/os/people">Invite someone</a></span>`}</div>
      ${picked.length ? `<p class="small muted" style="margin-top:10px">They change ${options} inside ${name}, not here. This page keeps ${keeps}. <a class="link" href="${href}">Open ${name} admin</a></p>
        <div class="set-row" style="margin-top:6px"><div class="grow"><div class="lbl">Also give them the advanced settings ${info('Off: the advanced settings stay on this page and only console admins change them. On: they are inside the app too, and leave this page.')}</div></div><button class="switch ${advanced ? 'on' : ''}" role="switch" aria-checked="${!!advanced}" aria-label="Advanced settings" data-act="${p}-adv"></button></div>`
      : `<p class="small muted" style="margin-top:10px">Pick who runs ${name}. Until someone is picked, the console admins do.</p>`}`}</div>`;
}

// ---------- where an app keeps what it stores. Changing the place or the space starts empty, so the card says what goes.
export function storageCard({ p, store, saved, used, things, lost }) {
  const moved = store.kind !== saved.kind || store.gb !== saved.gb, pct = Math.min(100, Math.round(100 * (used.bytes || 0) / (saved.gb * 1073741824)));
  return `<div class="card"><div class="card-head"><h3>Storage</h3>${info(`Where ${things} are kept on the appliance, and how much space is set aside for them.`)}</div>
    <div class="set-row"><div class="grow"><div class="lbl">Kept in</div><div class="small muted" style="white-space:normal">${store.kind === 'db' ? 'The appliance database. Best for search and for many people.' : 'Files on the appliance disk. Simple to copy and back up.'}</div></div><div class="seg"><button class="${store.kind === 'db' ? 'on' : ''}" data-act="${p}-kind" data-v="db">Database</button><button class="${store.kind === 'local' ? 'on' : ''}" data-act="${p}-kind" data-v="local">Files on disk</button></div></div>
    <div class="set-row"><div class="grow"><div class="lbl">Space set aside</div><div class="small muted">${used.bytes !== undefined ? `${bytes(used.bytes)} used · ` : ''}${lost}</div>${used.bytes !== undefined ? `<div class="meter" style="margin-top:8px;max-width:260px"><i style="width:${pct}%"></i></div>` : ''}</div><input class="input" style="width:90px" type="number" min="1" max="4000" value="${store.gb}" data-change="${p}-gb" aria-label="Space in GB"><span class="small muted">GB</span></div>
    ${moved ? `<div class="banner warn" style="margin-top:12px">${icon('warning_amber')}<span class="grow">A new place or a new size starts empty. Saving this removes ${lost}. Knowledge bases are not touched.</span>${p === 'sa-store' ? `<button class="btn" data-act="sa-store-save">Apply</button>` : ''}</div>` : ''}</div>`;
}
