// Who runs VanikGPT, what it may do, and where its chats are kept (13 Oct 2026, reshaped the same day after Rushil's review).
//   - Nobody named: the console admins run it, and every option is on the console's Setup page.
//   - An app admin named: the app options, and the custom endpoint, are inside VanikGPT only. The console keeps who runs it,
//     knowledge, storage and who can use it. Advanced goes with the app admin only if the console says so.
//   - Data stores are set once for the whole console (an appliance database, a disk, an S3 bucket, another PostgreSQL), because
//     a site can have several appliances and its own storage. An app's Setup only picks one from that list and sets the space.
//     A new store or a new size starts empty.
// Rules are written out in prds/PRD-APP-ADMIN-AND-GUIDES.md. Client side: public/app_admin.js. Vanik Sense has the same idea in sense_setup.js.
module.exports = function install({ db, on, err, audit, isAdmin, needGpt, call, A, uid, now }) {
  const ADMIN0 = { users: [], advanced: false }, STORE0 = { store: 'st_db', kind: 'db', gb: 20 };
  const FEAT0 = { connectors: false, images: false, video: false }, DATA0 = { personal: true, quotaMb: 500, tempChats: false };
  const cfg = () => db.app.config, adminOf = () => ({ ...ADMIN0, ...(cfg().admin || {}) });

  // ---------- data stores, for every app on this console
  const KINDS = { postgres: 'PostgreSQL database', s3: 'S3 bucket', disk: 'Disk', nfs: 'Network share' };
  const stores = () => { if (!db.stores) db.stores = [{ id: 'st_db', name: 'Appliance database', kind: 'postgres', where: db.device.name, builtin: true, at: now() }, { id: 'st_disk', name: 'Appliance disk', kind: 'disk', where: db.device.name, builtin: true, at: now() }]; return db.stores; };
  const usedBy = id => [cfg() && db.app.status !== 'not_installed' && cleanStore(cfg().storage).store === id && 'VanikGPT', db.sense && db.sense.policy && db.sense.policy.storage && (db.sense.policy.storage.store || 'st_db') === id && 'Vanik Sense'].filter(Boolean);
  const storeView = s => ({ ...s, kindName: KINDS[s.kind], usedBy: usedBy(s.id) });
  on('GET', '/api/stores', () => ({ stores: stores().map(storeView), kinds: Object.entries(KINDS) }), A);
  on('POST', '/api/stores', ({ u, body }) => {
    const name = String(body.name || '').trim().slice(0, 60), kind = KINDS[body.kind] ? body.kind : '', where = String(body.where || '').trim().slice(0, 120);
    if (!name) throw err(400, 'Give the store a name.');
    if (!kind) throw err(400, 'Pick what kind of store it is.');
    if (!where) throw err(400, kind === 's3' ? 'Type the bucket address.' : kind === 'disk' ? 'Type the appliance and the folder.' : 'Type the address of the server.');
    if (stores().some(s => s.name.toLowerCase() === name.toLowerCase())) throw err(409, 'A store with that name already exists.');
    const s = { id: uid('st'), name, kind, where, keySet: !!String(body.key || '').trim(), by: u.name, at: now() }; // a key is never kept by this build, only that one was given
    stores().push(s); audit(u, 'Added a data store', name, `${KINDS[kind]} · ${where}`); return storeView(s);
  }, A);
  on('DELETE', '/api/stores/:id', ({ u, p }) => {
    const s = stores().find(x => x.id === p.id); if (!s) throw err(404, 'That store is no longer here.');
    if (s.builtin) throw err(400, 'The appliance\'s own stores cannot be removed.');
    if (usedBy(s.id).length) throw err(409, `${usedBy(s.id).join(' and ')} keeps its data there. Move it to another store first.`);
    db.stores = stores().filter(x => x.id !== s.id); audit(u, 'Removed a data store', s.name); return { ok: true };
  }, A);
  const kindOf = id => { const s = stores().find(x => x.id === id); return !s || s.kind === 'postgres' ? 'db' : 'local'; };
  // An app's choice: a store from the list and the space set aside. "kind" is kept for the first shape of this setting (db or local).
  function cleanStore(s) {
    const id = s && stores().some(x => x.id === s.store) ? s.store : s && s.kind === 'local' ? 'st_disk' : 'st_db';
    return { store: id, kind: kindOf(id), gb: Math.max(1, Math.min(4000, Math.round(+(s && s.gb) || STORE0.gb))) };
  }
  const storeOf = () => cleanStore(cfg().storage);
  const storeName = id => (stores().find(x => x.id === id) || { name: 'Appliance database' }).name;

  // ---------- who runs VanikGPT
  const cleanAdmin = a => { const users = [...new Set(((a && a.users) || []).map(String))].filter(id => db.users.some(u => u.id === id && u.role === 'user')).slice(0, 10); return { users, advanced: !!(a && a.advanced) && users.length > 0 }; };
  const isAppAdmin = u => adminOf().users.includes(u.id);
  const managed = () => adminOf().users.length > 0;

  // ---------- what it may do, and what it keeps for each person
  const cleanFeatures = f => ({ connectors: !!(f && f.connectors), images: !!(f && f.images), video: !!(f && f.video) });
  const cleanData = d => ({ personal: !(d && d.personal === false), quotaMb: Math.max(10, Math.min(100000, Math.round(+(d && d.quotaMb) || DATA0.quotaMb))), tempChats: !!(d && d.tempChats) });
  const dataOf = () => ({ ...DATA0, ...(cfg().data || {}) });
  const files = () => db.documents.filter(d => String(d.collectionId).startsWith('chat:'));
  const mine = u => { const ids = new Set(db.chats.filter(c => c.userId === u.id).map(c => 'chat:' + c.id)); return files().filter(d => ids.has(d.collectionId)); };
  // the space one person may fill with files of their own
  function quota(u, size) {
    const cap = dataOf().quotaMb * 1048576, have = mine(u).reduce((n, d) => n + (d.size || 0), 0);
    if (have + (+size || 0) > cap) throw err(413, `That would go over your ${dataOf().quotaMb} MB of space. Remove a file from an earlier chat, or ask your admin for more.`);
  }
  // Temporary chats: when a person starts a new session, what they had before is removed. Their space is theirs again.
  on('POST', '/api/gpt/session', ({ u }) => {
    needGpt(u); if (!dataOf().tempChats) return { removed: 0 };
    const gone = db.chats.filter(c => c.userId === u.id), ids = new Set(gone.map(c => 'chat:' + c.id));
    db.chats = db.chats.filter(c => c.userId !== u.id); db.documents = db.documents.filter(d => !ids.has(d.collectionId)); db.folders = (db.folders || []).filter(f => f.userId !== u.id);
    if (gone.length) audit(u, 'Chats removed at the start of a session', `${gone.length} ${gone.length === 1 ? 'chat' : 'chats'}`, 'Temporary chats are on');
    return { removed: gone.length };
  });

  // ---------- storage for the app as a whole
  const used = () => ({ chats: db.chats.length, files: files().length, bytes: JSON.stringify(db.chats).length + files().reduce((n, d) => n + (d.size || 0), 0) });
  // the chats and the files attached to them go when the store or the space changes; knowledge bases are not touched
  function wipe(u, was, to) {
    const n = used(); db.chats = []; db.documents = db.documents.filter(d => !String(d.collectionId).startsWith('chat:')); db.folders = [];
    audit(u, 'Changed where chats are kept', `${storeName(to.store)}, ${to.gb} GB`, `Was ${storeName(was.store)}, ${was.gb} GB. Removed ${n.chats} chats and ${n.files} files`);
    return { chats: n.chats, files: n.files };
  }

  // ---------- what an app admin may change from inside VanikGPT; the rest of the set-up is carried over untouched
  const SAFE = ['uploads', 'blockedTopics'], ADV = ['dailyLimit'];
  on('PUT', '/api/gpt/manage', async ({ u, body }) => {
    needGpt(u);
    if (!managed()) throw err(409, 'VanikGPT is run from the console. Nobody is named as its admin.');
    if (!isAdmin(u) && !isAppAdmin(u)) throw err(403, 'Only a VanikGPT admin can change this.');
    const c = cfg(), adv = isAdmin(u) || adminOf().advanced, b = body || {}, safety = { ...c.safety };
    [...SAFE, ...(adv ? ADV : [])].forEach(k => { if (b.safety && b.safety[k] !== undefined) safety[k] = b.safety[k]; });
    // without the advanced settings, anything sent for them is left as it was
    const next = { ...c, link: b.link || c.link, web: b.web ? { ...c.web, ...b.web } : c.web, features: b.features ? { ...c.features, ...b.features } : c.features, data: b.data ? { ...c.data, ...b.data } : c.data,
      instructions: b.instructions !== undefined ? b.instructions : c.instructions, safety, advanced: adv && b.advanced && b.advanced.offline !== undefined ? { ...c.advanced, offline: !!b.advanced.offline } : c.advanced };
    const r = await call(u, 'PUT', '/api/app/config', { config: next, note: 'Changed inside VanikGPT' });
    if (!r.unchanged && db.app.status === 'running') db.app.deployedVersion = r.v; // these take effect at once; nothing is redeployed
    return r;
  });
  const boot = u => ({ managed: managed(), can: managed() && (isAdmin(u) || isAppAdmin(u)), advanced: isAdmin(u) || adminOf().advanced, names: adminOf().users.map(id => (db.users.find(x => x.id === id) || {}).name).filter(Boolean),
    storage: { ...storeOf(), name: storeName(storeOf().store), ...used() }, stores: isAdmin(u) ? stores().map(s => ({ id: s.id, name: s.name, kindName: KINDS[s.kind], where: s.where })) : undefined, mineMb: Math.round(mine(u).reduce((n, d) => n + (d.size || 0), 0) / 10485.76) / 100 });
  return { ADMIN0, STORE0, FEAT0, DATA0, cleanAdmin, cleanStore, cleanFeatures, cleanData, storeOf, storeName, stores, wipe, quota, boot, isAppAdmin };
};
