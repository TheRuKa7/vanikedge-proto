// What the Vanik Edge console decides for VanikGPT, and for knowledge as a whole (13 Oct 2026):
//   - how VanikGPT reaches a model: through the Vanik API gateway (the platform fills everything in) or a custom endpoint (three fields)
//   - models: every chat model that is serving in Model Hub is offered in chat; nothing is picked a second time for the app
//   - web search: on or off for the workspace, with browsing credits for the month; a chat is asked before it is switched on
//   - knowledge bases: draft or published, which apps may use each one, one embedding model for all of them
//   - teams, made by name with their people
// Rules and numbers are written out in prds/PRD-VANIKGPT-SETUP.md. Client side: public/gpt_setup.js.
module.exports = function install({ db, on, err, now, audit, A, byId, MVP, save, suiteApps, needGpt }) {
  const cfg = () => db.app.config;
  const month = () => now().slice(0, 7);

  // ---------- models follow Model Hub
  const follows = () => cfg().followHub === true || (cfg().followHub === undefined && MVP);
  const custom = () => !!cfg().link && cfg().link.mode === 'custom';
  const served = () => db.models.filter(m => m.kind === 'chat' && m.status === 'serving').map(m => m.id);
  function follow() {
    if (db.app.status === 'not_installed' || custom() || !follows()) return;
    const c = cfg(), list = served();
    if (JSON.stringify(c.models) === JSON.stringify(list) && (c.defaultModel === null ? !list.length : list.includes(c.defaultModel))) return;
    c.models = list; if (!list.includes(c.defaultModel)) c.defaultModel = list[0] || null;
  }

  // ---------- how VanikGPT reaches a model. A key is never kept by this build: it remembers only that one was given.
  const cleanUrl = v => { const s = String(v || '').trim().replace(/\/+$/, ''); return /^https?:\/\/[a-z0-9.-]+(:\d{2,5})?(\/[\w./-]*)?$/i.test(s) ? s : ''; };
  function cleanLink(l, was) {
    if (!l || l.mode !== 'custom') return { mode: 'gateway', url: '', model: '', keySet: false };
    const url = cleanUrl(l.url), model = String(l.model || '').trim().slice(0, 120);
    if (!url) throw err(400, 'Type the address of the model server, for example http://10.0.0.12:9000/v1.');
    if (!model) throw err(400, 'Type the name the model server gives the model.');
    return { mode: 'custom', url, model, keySet: !!String(l.key || '').trim() || !!(was && was.mode === 'custom' && was.keySet && l.keySet !== false) };
  }
  on('POST', '/api/app/link/test', ({ body }) => {
    const url = cleanUrl(body.url);
    if (!url) throw err(400, 'That is not an address a model server can have. It starts with http:// or https://.');
    if (!String(body.model || '').trim()) throw err(400, 'Type the model name first.');
    return { ok: true, formOnly: true, note: 'The address and the name are well formed. This prototype does not call the server; on an appliance one test question is sent and the answer time is shown.' };
  }, A);

  // ---------- web search: off for the workspace, or on with credits for the month
  const WEB = { on: false, credits: 200 };
  const webCfg = () => ({ ...WEB, ...(cfg().web || {}) });
  const cleanWeb = w => !w ? { ...WEB } : { on: !!w.on, credits: Math.max(0, Math.min(100000, Math.round(+w.credits || 0))) };
  const use = () => { if (!db.webUse || db.webUse.month !== month()) db.webUse = { month: month(), used: 0, by: {} }; return db.webUse; };
  const left = () => Math.max(0, webCfg().credits - use().used);
  // A question wants the web when it asks for a search, names a web address, or asks for something that changes by the day.
  // It does not when it is a slash command or points at the company's own papers.
  const ASKS = /\b(search|look ?up|find|check|browse)\b[^.?!]{0,40}\b(web|internet|online|google)\b|\bgoogle\b|\bon the (web|internet)\b/i;
  const LINK = /\bhttps?:\/\/\S+|\bwww\.[a-z0-9-]+\.[a-z]{2,}/i;
  const FRESH = /\b(latest|today'?s?|tonight|right now|currently|this (week|month)|breaking|news|weather|forecast|stock price|share price|exchange rate|live score|trending)\b/i;
  const OWN = /\b(our|my|the company'?s?|attached|uploaded|this) (document|documents|policy|policies|contract|file|files|sheet|report|handbook|knowledge)\b/i;
  const why = t => { const s = String(t || ''); if (/^\//.test(s.trim()) || OWN.test(s)) return ''; return ASKS.test(s) ? 'You asked for a search.' : LINK.test(s) ? 'It names a web page.' : FRESH.test(s) ? 'It asks for something that changes by the day.' : ''; };
  const myChat = (u, id) => db.chats.find(c => c.id === id && c.userId === u.id);
  on('POST', '/api/gpt/web/check', ({ u, body }) => {
    needGpt(u);
    const w = webCfg(), c = body.chatId ? myChat(u, body.chatId) : null, reason = why(body.text);
    if (!w.on || !reason) return { ask: false };
    if (c && c.web) return { ask: false, on: true };
    if (!left()) return { ask: false, spent: true };
    return { ask: true, reason, left: left(), of: w.credits };
  });
  on('PUT', '/api/chats/:id/web', ({ u, p, body }) => {
    needGpt(u); const c = myChat(u, p.id); if (!c) throw err(404, 'That chat is no longer here.');
    if (body.on && !webCfg().on) throw err(403, 'Web search is switched off for this workspace.');
    c.web = !!body.on; save(); return { web: c.web };
  });
  // Called by the chat before the model: a search is run, and a credit used, only when the chat has web search on and the question wants the web.
  function search(u, c, text) {
    const w = webCfg(), reason = why(text);
    if (!w.on || !c.web || !reason) return null;
    if (!left()) return { spent: true, of: w.credits };
    const x = use(); x.used++; x.by[u.id] = (x.by[u.id] || 0) + 1;
    audit(u, 'Searched the web', String(text).replace(/\s+/g, ' ').slice(0, 80), `1 browsing credit, ${left()} left this month`);
    return { query: String(text).replace(/\s+/g, ' ').slice(0, 160), reason, left: left(), of: w.credits };
  }

  // ---------- knowledge bases: draft or published, and which apps may use each one
  const apps = () => [{ id: 'vanikgpt', name: 'VanikGPT' }, ...suiteApps().map(a => ({ id: a.id, name: a.name }))];
  const cleanApps = v => v === undefined || v === 'all' || !Array.isArray(v) ? 'all' : [...new Set(v.map(String))].filter(id => apps().some(a => a.id === id));
  const published = c => c.state !== 'draft';
  const usable = (c, appId) => published(c) && (c.apps === undefined || c.apps === 'all' || c.apps.includes(appId));
  on('POST', '/api/collections/:id/publish', ({ u, p }) => {
    const c = byId(db.collections, p.id, 'Knowledge base'), n = db.documents.filter(d => d.collectionId === c.id).length;
    if (!n) throw err(400, 'Add at least one document before you publish.');
    c.state = 'published'; c.publishedAt = now(); c.publishedBy = u.name; c.updatedAt = now();
    audit(u, 'Published a knowledge base', c.name, `${n} ${n === 1 ? 'document' : 'documents'}`); return { ok: true };
  }, A);
  on('POST', '/api/collections/:id/unpublish', ({ u, p }) => {
    const c = byId(db.collections, p.id, 'Knowledge base');
    c.state = 'draft'; c.updatedAt = now(); audit(u, 'Took a knowledge base back to draft', c.name); return { ok: true };
  }, A);
  // one embedding model for every knowledge base, chosen in the console; one is always preselected
  const embedders = () => db.models.filter(m => m.kind === 'embedding');
  const embedModel = () => { const k = db.knowledge || {}, l = embedders(); return l.some(m => m.id === k.embedModel) ? k.embedModel : (l.find(m => m.status === 'serving') || l[0] || {}).id || null; };
  on('PUT', '/api/knowledge/embed', ({ u, body }) => {
    const m = embedders().find(x => x.id === body.model);
    if (!m) throw err(400, 'Pick one of the embedding models in Model Hub.');
    if (m.id === embedModel()) return { model: m.id, cleared: 0 };
    let cleared = 0; // passages read by the old model cannot be compared with the new one, so they are read again
    db.documents.forEach(d => d.chunks.forEach(k => { if (k.v) { delete k.v; cleared++; } }));
    db.knowledge = { ...(db.knowledge || {}), embedModel: m.id, changedAt: now(), changedBy: u.name };
    audit(u, 'Changed the embedding model', m.id, cleared ? `${cleared} passages to read again` : ''); return { model: m.id, cleared };
  }, A);

  // ---------- teams
  const teams = () => [...new Set([...(db.teams || []), ...db.users.flatMap(x => x.teams || [])])].sort((a, b) => a.localeCompare(b));
  const teamName = v => String(v || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  on('POST', '/api/teams', ({ u, body }) => {
    const name = teamName(body.name), was = teamName(body.was), ids = new Set((body.members || []).map(String));
    if (!name || /,/.test(name)) throw err(400, 'Give the team a name, without a comma.');
    if (!was && teams().some(t => t.toLowerCase() === name.toLowerCase())) throw err(409, 'A team with that name already exists.');
    db.teams = [...new Set([...(db.teams || []).filter(t => t !== was), name])];
    db.users.forEach(x => { const l = (x.teams || []).filter(t => t !== name && t !== was); x.teams = ids.has(x.id) ? [...l, name] : l; });
    if (was && was !== name) { // the team keeps what it could reach under its new name
      const swap = a => { if (a && Array.isArray(a.teams)) a.teams = a.teams.map(t => t === was ? name : t); };
      db.collections.forEach(c => swap(c.access)); swap(db.app.config && db.app.config.access);
      db.documents.forEach(d => { if (Array.isArray(d.restrict)) d.restrict = d.restrict.map(t => t === was ? name : t); });
    }
    audit(u, was ? 'Changed a team' : 'Created a team', name, `${ids.size} ${ids.size === 1 ? 'person' : 'people'}`); return { name, members: ids.size };
  }, A);
  on('DELETE', '/api/teams/:name', ({ u, p }) => {
    const name = decodeURIComponent(p.name);
    if (!teams().includes(name)) throw err(404, 'That team is no longer here.');
    db.teams = (db.teams || []).filter(t => t !== name); db.users.forEach(x => { x.teams = (x.teams || []).filter(t => t !== name); });
    db.collections.forEach(c => { if (c.access && Array.isArray(c.access.teams)) c.access.teams = c.access.teams.filter(t => t !== name); });
    audit(u, 'Removed a team', name); return { ok: true };
  }, A);

  const boot = admin => ({ follows: follows(), custom: custom(), web: { ...webCfg(), left: left(), used: use().used }, embedModel: embedModel(), apps: apps(), webByPerson: admin ? use().by : undefined });
  return { follow, follows, custom, served, cleanLink, cleanWeb, webCfg, search, why, cleanApps, published, usable, embedModel, teams, boot };
};
