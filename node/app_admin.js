// Who runs VanikGPT, and where its chats are kept (13 Oct 2026).
//   - Nobody named: the console admins run it, and every option is on the console's Setup page.
//   - An app admin named: web search, guardrails and safety move inside VanikGPT; the console's Setup page keeps
//     the model, the knowledge and the storage, and shows the rest read-only. Advanced goes with them only if the console says so.
//   - Storage: a database or files on the appliance, with space set aside. Changing either removes the chats kept so far.
// Rules are written out in prds/PRD-APP-ADMIN-AND-GUIDES.md. Client side: public/app_admin.js. Vanik Sense has the same idea in sense_setup.js.
module.exports = function install({ db, on, err, audit, isAdmin, needGpt, call }) {
  const ADMIN0 = { users: [], advanced: false }, STORE0 = { kind: 'db', gb: 20 };
  const cfg = () => db.app.config, adminOf = () => ({ ...ADMIN0, ...(cfg().admin || {}) }), storeOf = () => ({ ...STORE0, ...(cfg().storage || {}) });
  const cleanAdmin = a => { const users = [...new Set(((a && a.users) || []).map(String))].filter(id => db.users.some(u => u.id === id && u.role === 'user')).slice(0, 10); return { users, advanced: !!(a && a.advanced) && users.length > 0 }; };
  const cleanStore = s => ({ kind: s && s.kind === 'local' ? 'local' : 'db', gb: Math.max(1, Math.min(2000, Math.round(+(s && s.gb) || STORE0.gb))) });
  const isAppAdmin = u => adminOf().users.includes(u.id);
  const managed = () => adminOf().users.length > 0;
  const files = () => db.documents.filter(d => String(d.collectionId).startsWith('chat:'));
  const used = () => ({ chats: db.chats.length, files: files().length, bytes: Buffer.byteLength(JSON.stringify(db.chats)) + files().reduce((n, d) => n + (d.size || 0), 0) });
  // the chats and the files attached to them go when the place or the space changes; knowledge bases are not touched
  function wipe(u, was, to) {
    const n = used(); db.chats = []; db.documents = db.documents.filter(d => !String(d.collectionId).startsWith('chat:')); db.folders = [];
    audit(u, 'Changed where chats are kept', `${to.kind === 'db' ? 'Database' : 'Files on disk'}, ${to.gb} GB`, `Was ${was.kind === 'db' ? 'database' : 'files on disk'}, ${was.gb} GB. Removed ${n.chats} chats and ${n.files} files`);
    return { chats: n.chats, files: n.files };
  }
  // what an app admin may change from inside VanikGPT; the rest of the set-up is carried over untouched
  const SAFE = ['pii', 'uploads', 'blockedTopics', 'maskDocuments', 'voice'], ADV = ['dailyLimit', 'retentionDays', 'adminChats'];
  on('PUT', '/api/gpt/manage', async ({ u, body }) => {
    needGpt(u);
    if (!managed()) throw err(409, 'VanikGPT is run from the console. Nobody is named as its admin.');
    if (!isAdmin(u) && !isAppAdmin(u)) throw err(403, 'Only a VanikGPT admin can change this.');
    const c = cfg(), adv = isAdmin(u) || adminOf().advanced, b = body || {}, safety = { ...c.safety };
    [...SAFE, ...(adv ? ADV : [])].forEach(k => { if (b.safety && b.safety[k] !== undefined) safety[k] = b.safety[k]; });
    // without the advanced settings, anything sent for them is left as it was
    const next = { ...c, web: b.web ? { ...c.web, ...b.web } : c.web, instructions: b.instructions !== undefined ? b.instructions : c.instructions, safety, advanced: adv && b.advanced ? { ...c.advanced, ...b.advanced } : c.advanced };
    const r = await call(u, 'PUT', '/api/app/config', { config: next, note: 'Changed inside VanikGPT' });
    if (!r.unchanged && db.app.status === 'running') db.app.deployedVersion = r.v; // these take effect at once; nothing is redeployed
    return r;
  });
  const boot = u => ({ managed: managed(), can: managed() && (isAdmin(u) || isAppAdmin(u)), advanced: isAdmin(u) || adminOf().advanced, names: adminOf().users.map(id => (db.users.find(x => x.id === id) || {}).name).filter(Boolean), storage: { ...storeOf(), ...used() } });
  return { ADMIN0, STORE0, cleanAdmin, cleanStore, storeOf, wipe, boot, isAppAdmin };
};
