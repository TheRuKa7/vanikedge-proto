// Shared pieces of an app's Setup page in the console, for VanikGPT and Vanik Sense: a compact row, a dropdown that holds a
// list (who runs the app, who can use it, which ways in are available), the storage row, and the console's list of data stores.
// With an app admin named, the app options are inside the app only.
import { esc, icon, info, api, rerender, acts, toast, modal, confirmBox, ago } from './core.js';
import { later } from './scope.js';

export const ADMIN0 = { users: [], advanced: false }, STORE0 = { store: 'st_db', kind: 'db', gb: 20 }, FEAT0 = { connectors: false, images: false, video: false }, DATA0 = { personal: true, quotaMb: 500, tempChats: false };

// ---------- one line of a compact card: a one or two word title, its explanation behind the i, and the control
export const crow = (title, tip, right) => `<div class="crow"><div class="crow-t">${title}${tip ? info(tip) : ''}</div><div class="crow-v">${right}</div></div>`;
export const sw = (act, on, k = '', off = false) => `<button class="switch ${on ? 'on' : ''}" role="switch" aria-checked="${!!on}" data-act="${act}" ${k ? `data-k="${k}"` : ''} ${on ? 'data-on="1"' : ''} ${off ? 'disabled' : ''}></button>`;

// ---------- a dropdown that holds a list. It stays open while several are ticked, and closes on a click outside.
const open = {};
export const dd = (key, label, items) => `<details class="dd" data-dd="${key}" ${open[key] ? 'open' : ''}><summary><span class="ellipsis">${label}</span>${icon('expand_more')}</summary><div class="dd-list">${items.map(i => i.head ? `<div class="cap">${i.head}</div>` : `<button class="dd-i ${i.on ? 'on' : ''}" data-act="${i.act}" data-v="${esc(i.v === undefined ? '' : i.v)}">${icon('check')}<span class="grow">${esc(i.label)}</span></button>`).join('')}</div></details>`;
document.addEventListener('toggle', e => { const d = e.target; if (d && d.matches && d.matches('details.dd')) open[d.dataset.dd] = d.open; }, true);
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('details.dd')) return; document.querySelectorAll('details.dd[open]').forEach(d => { d.open = false; open[d.dataset.dd] = false; }); });

// who runs the app: the console admins, or the app users ticked
export const runByDd = ({ key, p, people, picked }) => dd(key, picked.length ? esc(people.filter(u => picked.includes(u.id)).map(u => u.name).join(', ')) : 'Console admins',
  [{ label: 'Console admins', on: !picked.length, act: p + '-none' }, { head: 'An app admin' }, ...people.map(u => ({ label: u.name, on: picked.includes(u.id), act: p + '-pick', v: u.id }))]);
// who can use the app: everyone, or the teams and people ticked
export const accessDd = ({ key, p, access, teams, people }) => { const a = access || { mode: 'everyone', teams: [], users: [] }, n = a.teams.length + a.users.length;
  return dd(key, a.mode === 'everyone' || !n ? 'Everyone' : [a.teams.length ? `${a.teams.length} ${a.teams.length === 1 ? 'team' : 'teams'}` : '', a.users.length ? `${a.users.length} ${a.users.length === 1 ? 'person' : 'people'}` : ''].filter(Boolean).join(', '),
    [{ label: 'Everyone', on: a.mode === 'everyone' || !n, act: p + '-all' }, ...(teams.length ? [{ head: 'Teams' }, ...teams.map(t => ({ label: t, on: a.mode !== 'everyone' && a.teams.includes(t), act: p + '-team', v: t }))] : []), ...(people.length ? [{ head: 'People' }, ...people.map(u => ({ label: u.name, on: a.mode !== 'everyone' && a.users.includes(u.id), act: p + '-user', v: u.id }))] : [])]); };

// ---------- storage: a store from the console's list, and the space set aside. A new store or a new size starts empty.
const gbx = n => (n >= 1024 ? (n / 1024).toFixed(n % 1024 ? 1 : 0) + ' TB' : n + ' GB');
export const storageRow = ({ p, store, saved, stores, lost, apply }) => { const moved = store.store !== saved.store || store.gb !== saved.gb, s = (stores || []).find(x => x.id === store.store) || {};
  const free = s.freeGb === null || s.freeGb === undefined ? null : s.freeGb + (saved.store === store.store ? saved.gb : 0), over = free !== null && store.gb > free;
  return `${crow('Storage', 'Where this app keeps what it stores, picked from the data stores of this console, and the space set aside for it. A new store or a new size starts empty.', `<select class="input" style="width:auto;max-width:220px" data-change="${p}" aria-label="Data store">${(stores || []).map(s => `<option value="${s.id}" ${s.id === store.store ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select><input class="input" style="width:76px" type="number" min="1" max="4000" value="${store.gb}" data-change="${p}-gb" aria-label="Space in GB"><span class="small muted">GB</span><a class="btn text" href="#/os/stores">Stores</a>`)}
    ${s.capacityGb ? `<div class="crow-sub ${over ? 'warn' : ''}">${icon(over ? 'warning_amber' : 'storage')}<span><b>${esc(s.name)}</b>: ${gbx(free)} free for this app, of ${gbx(s.capacityGb)}. ${gbx(s.systemGb)} is used by the appliance and ${gbx(s.setAsideGb)} is set aside for apps. ${esc(s.what)}${over ? ' <b>More than is free.</b>' : ''}</span></div>` : s.id ? `<div class="crow-sub">${icon('storage')}<span>${esc(s.name)} does not report its size.</span></div>` : ''}
    ${moved ? `<div class="banner warn" style="margin:4px 0 8px">${icon('warning_amber')}<span class="grow">A new store or a new size starts empty. Saving removes ${lost}.</span>${apply ? `<button class="btn" data-act="${apply}">Apply</button>` : ''}</div>` : ''}`; };

// ---------- the console's data stores: set once, picked by every app
let ST = null;
const WHERE = { postgres: 'db.company.internal:5432/vanik', s3: 's3://company-vanik/chats', disk: 'DGX-02:/data/vanik', nfs: 'nas01:/export/vanik' };
export function storesBody() {
  if (!ST) { api('GET', '/api/stores').then(d => { ST = d; rerender(); }).catch(e => toast(e.message, 'err')); return '<p class="muted">Loading…</p>'; }
  return `<div class="page-head"><div class="grow"><h1>Data stores</h1><p class="sub">Where apps may keep what they store. Set here once; each app picks one on its Setup page.</p></div>${later('add-store') ? '' : `<button class="btn lg" data-act="store-new">${icon('add')}Add a store</button>`}</div>
    <div class="card" style="padding:0;overflow:auto"><table class="list"><tr><th>Store</th><th>Kind</th><th>Where</th><th>Size</th><th>Free</th><th>Used by</th><th></th></tr>${ST.stores.map(s => `<tr><td><b>${esc(s.name)}</b>${s.builtin ? '' : `<div class="small faint">Added ${ago(s.at)} by ${esc(s.by || '')}</div>`}</td><td>${esc(s.kindName)}</td><td class="mono small">${esc(s.where)}</td><td>${s.capacityGb ? gbx(s.capacityGb) : '<span class="muted">Not reported</span>'}</td><td>${s.capacityGb ? `<b>${gbx(s.freeGb)}</b><div class="meter" style="margin-top:6px;width:110px" data-tip="Appliance ${gbx(s.systemGb)} · apps ${gbx(s.setAsideGb)} · free ${gbx(s.freeGb)}"><i style="width:${Math.round(100 * (s.capacityGb - s.freeGb) / s.capacityGb)}%"></i></div>` : ''}</td><td class="muted">${s.usedBy.length ? esc(s.usedBy.join(', ')) : 'No app yet'}</td>
      <td class="act">${s.builtin ? '<span class="small faint">On the appliance</span>' : `<button class="icon-btn sm" data-act="store-del" data-id="${s.id}" data-name="${esc(s.name)}" data-tip="Remove" aria-label="Remove">${icon('delete_outline')}</button>`}</td></tr>`).join('')}</table></div>
    <div class="grid two" style="margin-top:16px">${ST.stores.filter(s => s.what).map(s => `<div class="card flat"><div class="row">${icon(s.kind === 'postgres' ? 'database' : 'hard_drive')}<b>${esc(s.name)}</b></div><p class="small muted" style="margin-top:6px">${esc(s.what)}</p></div>`).join('')}</div>
    <p class="small muted" style="margin-top:14px">${icon('info_outline')} Sizes are the sample appliance's. ${later('add-store') ? 'Adding your own PostgreSQL, S3 bucket or network share comes in a later release.' : 'With several appliances joined together, add each one\'s database or disk here, or one shared PostgreSQL or S3 bucket for all of them.'}</p>`;
}
acts['store-new'] = () => { const m = modal({ title: 'Add a data store', body: `<div class="stack"><label class="field"><span>Name</span><input class="input" id="st-n" maxlength="60" placeholder="Company PostgreSQL"></label>
    <label class="field"><span>Kind</span><select class="input" id="st-k">${ST.kinds.map(k => `<option value="${k[0]}">${esc(k[1])}</option>`).join('')}</select></label>
    <label class="field"><span>Where ${info('The address of the server, the bucket, or the appliance and folder.')}</span><input class="input mono" id="st-w" placeholder="${WHERE.postgres}"></label>
    <label class="field"><span>Key or password ${info('Only if the store asks for one. Kept in the vault, never shown again.')}</span><input class="input" id="st-p" type="password" autocomplete="off" placeholder="Leave empty if none is needed"></label></div>`,
  actions: [{ label: 'Add', run: async o => { await api('POST', '/api/stores', { name: o.querySelector('#st-n').value, kind: o.querySelector('#st-k').value, where: o.querySelector('#st-w').value, key: o.querySelector('#st-p').value }); ST = null; toast('Store added. Apps can pick it on their Setup page.'); rerender(); } }] });
  m.el.querySelector('#st-k').onchange = e => { m.el.querySelector('#st-w').placeholder = WHERE[e.target.value]; }; };
acts['store-del'] = el => confirmBox(`Remove ${el.dataset.name}?`, 'Apps can no longer pick it. Nothing kept in it is touched.', 'Remove', async () => { await api('DELETE', '/api/stores/' + el.dataset.id); ST = null; rerender(); });
export const storesChanged = () => { ST = null; };
