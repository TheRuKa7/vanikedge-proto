// What the console decides for VanikGPT and for knowledge: how the app reaches a model, web search and its credits,
// knowledge bases (draft or published, which apps may use each, the embedding model), and teams.
// The chat side of web search (the question before it is switched on) is here too. Server side: gpt_setup.js.
import { S, $, esc, icon, info, chip, api, load, refresh, rerender, acts, ins, toast, modal, confirmBox, accessDrafts } from './core.js';

export const LINK0 = { mode: 'gateway', url: '', model: '', keySet: false }, WEB0 = { on: false, credits: 200 };
const GS = () => S.boot.gptSetup || { follows: false, web: { ...WEB0, left: 0, used: 0 }, apps: [], embedModel: null };
let D = null, changed = () => {};
export const bindSetup = (draft, onChange) => { D = draft; changed = onChange; };

// ---------- Setup: how VanikGPT reaches a model
const FIXED = [['Search over documents', 'The embedding model is chosen once, on the Knowledge page, for every app.'], ['Sign-in secret', 'Made at install and kept in the vault. Never shown, never typed.'], ['Privacy switches', 'Usage reporting to outside is always off.'], ['Other model servers', 'Only the one address above is called.'], ['Trusted proxy and web origin', 'Set to the appliance itself. An extra origin is under Advanced.']];
export function linkCard(c, B) {
  const g = GS(), custom = c.link.mode === 'custom', serving = B.models.filter(m => m.kind === 'chat' && m.status === 'serving');
  return `<div class="card"><div class="card-head"><h3>Model</h3>${info('How VanikGPT reaches a model. Through the gateway, the address and a key for this app are filled in on every deploy.')}<a class="link small right" href="#/os/models">Model Hub</a></div>
    <div class="seg"><button class="${custom ? '' : 'on'}" data-act="gs-link" data-v="gateway">Vanik API gateway</button><button class="${custom ? 'on' : ''}" data-act="gs-link" data-v="custom">Custom endpoint</button></div>
    ${custom ? `<div class="banner warn" style="margin-top:12px">${icon('info_outline')}<span>VanikGPT will call this server directly. You lose three things the gateway gives: usage on the API gateway page, a key made and changed for you, and chat following a model when it moves.</span></div>
      <div class="stack" style="gap:12px;margin-top:12px">
        <label class="field"><span>Address of the model server ${info('Where an OpenAI style server answers, ending in /v1.')}</span><input class="input mono" id="gs-url" placeholder="http://10.0.0.12:9000/v1" value="${esc(c.link.url)}" data-on="gs-url"></label>
        <label class="field"><span>Model name ${info('The name that server gives the model. Many servers call it /model.')}</span><input class="input mono" id="gs-model" placeholder="/model" value="${esc(c.link.model)}" data-on="gs-model"></label>
        <label class="field"><span>Key ${info('Only if that server asks for one. It is kept in the vault and never shown again.')}</span><input class="input" id="gs-key" type="password" autocomplete="off" placeholder="${c.link.keySet ? 'A key is kept. Type a new one to replace it' : 'Leave empty if the server needs none'}" data-on="gs-key"></label>
        <div class="row"><button class="btn ghost" data-act="gs-test">Test</button><span class="small muted" id="gs-test-out"></span></div>
      </div>
      <details class="adv"><summary>${icon('chevron_right')}What is not asked for here</summary><div>${FIXED.map(f => `<div class="set-row"><div class="grow"><div class="lbl">${f[0]}</div><div class="small muted" style="white-space:normal">${f[1]}</div></div>${chip('Set by Vanik Edge', 'line', false)}</div>`).join('')}</div></details>`
    : g.follows ? `<p class="small muted" style="margin:12px 0 10px">Every chat model that is serving in Model Hub is offered in chat. Nothing is picked a second time here.</p>
      ${serving.length ? `<div class="stack" style="gap:8px">${serving.map(m => `<div class="set-row"><span class="avatar sq">${esc(m.id.slice(0, 2).toUpperCase())}</span><div class="grow"><div class="lbl">${esc(m.id)}</div><div class="small muted">${m.memGb} GB${m.note ? ' · ' + esc(m.note) : ''}</div></div><button class="tag ${c.defaultModel === m.id ? 'on' : ''}" data-act="cfg-default" data-id="${esc(m.id)}">${c.defaultModel === m.id ? 'Default' : 'Make default'}</button></div>`).join('')}</div>`
        : `<div class="banner warn">${icon('warning_amber')}<span>No chat model is serving. <a class="link" href="#/os/models">Serve one in Model Hub</a>, and it shows here and in chat.</span></div>`}` : ''}</div>`;
}
acts['gs-link'] = el => { if (D.link.mode === el.dataset.v) return; D.link.mode = el.dataset.v; rerender(); };
ins['gs-url'] = el => { D.link.url = el.value.trim(); changed(); };
ins['gs-model'] = el => { D.link.model = el.value.trim(); changed(); };
ins['gs-key'] = el => { D.link.key = el.value; changed(); };
acts['gs-test'] = async () => { const out = $('#gs-test-out'); try { const r = await api('POST', '/api/app/link/test', { url: D.link.url, model: D.link.model }); out.textContent = r.note; } catch (e) { out.textContent = e.message; } };

// ---------- Setup: knowledge is chosen on each knowledge base, not here
export const appNames = c => { const all = GS().apps; return !c.apps || c.apps === 'all' ? 'Every app' : c.apps.length ? c.apps.map(id => (all.find(a => a.id === id) || { name: id }).name).join(', ') : 'No app'; };
export const usedBy = (c, id) => c.state !== 'draft' && (!c.apps || c.apps === 'all' || c.apps.includes(id));
export function knowledgeCard(B) {
  const mine = B.collections.filter(c => usedBy(c, 'vanikgpt')), g = GS();
  return `<div class="card"><div class="card-head"><h3>Knowledge</h3>${info('Each knowledge base says which apps may use it. People still only get answers from the ones they are allowed.')}<a class="link small right" href="#/os/knowledge">Manage knowledge</a></div>
    ${mine.length ? mine.map(c => `<a class="set-row" style="text-decoration:none" href="#/os/knowledge/${c.id}">${icon('library_books')}<div class="grow"><div class="lbl">${esc(c.name)}</div><div class="small muted">${c.docCount} ${c.docCount === 1 ? 'document' : 'documents'}</div></div>${icon('chevron_right')}</a>`).join('') : `<p class="small muted">No published knowledge base is open to VanikGPT yet. <a class="link" href="#/os/knowledge">Make one</a></p>`}
    ${g.embedModel ? `<p class="small faint" style="margin-top:10px">Search by meaning uses ${esc(g.embedModel)}.</p>` : ''}</div>`;
}

// ---------- Setup: web search
export function webCard(c) {
  const w = GS().web;
  return `<div class="card"><div class="card-head"><h3>Web search</h3>${info('Off: VanikGPT never goes to the internet and nobody is asked. On: when a question needs the web in a chat where it is off, the person is told VanikGPT will switch it on and that it may use browsing credits.')}</div>
    <div class="set-row"><div class="grow"><div class="lbl">Let chats search the web</div><div class="small muted" style="white-space:normal">${c.web.on ? 'The question that is searched leaves your network. Your documents do not.' : 'Nothing leaves your network.'}</div></div><button class="switch ${c.web.on ? 'on' : ''}" role="switch" aria-checked="${c.web.on}" data-act="gs-web"></button></div>
    ${c.web.on ? `<div class="set-row"><div class="grow"><div class="lbl">Browsing credits a month ${info('One search is one credit. When they run out, chats answer without the web until the next month.')}</div><div class="small muted">${w.used} used this month</div></div><input class="input" style="width:110px" type="number" min="0" max="100000" value="${c.web.credits}" data-on="gs-credits"></div>` : ''}</div>`;
}
acts['gs-web'] = () => { D.web.on = !D.web.on; if (D.web.on) D.advanced.offline = false; rerender(); };
ins['gs-credits'] = el => { D.web.credits = Math.max(0, Math.round(+el.value || 0)); changed(); };

// ---------- Knowledge: one embedding model for every knowledge base
export function embedCard(B) {
  const g = GS(), list = B.models.filter(m => m.kind === 'embedding'), cur = list.find(m => m.id === g.embedModel);
  if (!list.length) return '';
  return `<div class="card" style="margin-bottom:18px"><div class="row wrap"><div class="grow"><div class="lbl">Search by meaning ${info('The embedding model reads every passage so a question can find one that uses different words. One model is used for every knowledge base and every app.')}</div><div class="small muted">${cur && cur.status === 'serving' ? 'Ready.' : 'This model is not serving, so search uses keywords only until it is.'} ${cur && cur.status !== 'serving' ? `<a class="link" href="#/os/models">Serve it in Model Hub</a>` : ''}</div></div>
    <select class="input" style="width:260px" data-change="kb-embed" aria-label="Embedding model">${list.map(m => `<option value="${esc(m.id)}" ${m.id === g.embedModel ? 'selected' : ''}>${esc(m.id)}${m.status === 'serving' ? '' : ' (not serving)'}</option>`).join('')}</select></div></div>`;
}
ins['kb-embed'] = el => { const to = el.value, was = GS().embedModel;
  confirmBox(`Use ${to} for search by meaning?`, 'Passages read by the old model cannot be compared with the new one. Every knowledge base goes back to keyword search until you press Build on it.', 'Change', async () => { const r = await api('PUT', '/api/knowledge/embed', { model: to }); toast(r.cleared ? `Changed. ${r.cleared} passages will be read again when you build.` : 'Changed.'); await refresh(); });
  el.value = was; };

// ---------- Knowledge: draft or published, and which apps may use a knowledge base
export const stateChip = c => c.state === 'draft' ? chip('Draft', 'warn') : chip('Published', 'ok');
export function publishBar(c) {
  return c.state === 'draft'
    ? `<div class="banner warn" style="margin-bottom:16px">${icon('edit_note')}<span class="grow"><b>Draft.</b> Only admins see it. Add documents, choose who and which apps may use it, then publish.</span><button class="btn" data-act="kb-publish" data-id="${c.id}" ${c.docCount ? '' : 'disabled'}>Publish</button></div>`
    : `<div class="banner plain" style="margin-bottom:16px">${icon('check_circle')}<span class="grow"><b>Published</b>${c.publishedAt ? ` by ${esc(c.publishedBy || '')}` : ''}. Documents you add or remove are live at once.</span><button class="btn text" data-act="kb-unpublish" data-id="${c.id}">Back to draft</button></div>`;
}
acts['kb-publish'] = async el => { await api('POST', `/api/collections/${el.dataset.id}/publish`); toast('Published. The apps and people you chose can use it now.'); await refresh(); };
acts['kb-unpublish'] = el => confirmBox('Take it back to draft?', 'Apps stop answering from it straight away. Nothing is deleted.', 'Back to draft', async () => { await api('POST', `/api/collections/${el.dataset.id}/unpublish`); await refresh(); });
export function appsCard(c) {
  const all = GS().apps, every = !c.apps || c.apps === 'all', on = id => every || c.apps.includes(id);
  return `<div class="card"><div class="card-head"><h3>Apps that can use it</h3>${info('An app that is not ticked never searches this knowledge base, whoever asks.')}</div>
    <div class="stack" style="gap:8px">${all.map(a => `<div class="check ${on(a.id) ? 'on' : ''}" role="checkbox" aria-checked="${on(a.id)}" tabindex="0" data-act="kb-app" data-id="${c.id}" data-app="${a.id}"><span class="box">${icon('check')}</span><span class="grow"><b>${esc(a.name)}</b></span></div>`).join('')}</div></div>`;
}
acts['kb-app'] = async el => { const c = S.boot.collections.find(x => x.id === el.dataset.id), all = GS().apps.map(a => a.id), cur = !c.apps || c.apps === 'all' ? [...all] : [...c.apps], i = cur.indexOf(el.dataset.app);
  if (i < 0) cur.push(el.dataset.app); else cur.splice(i, 1);
  await api('PATCH', '/api/collections/' + c.id, { apps: all.every(a => cur.includes(a)) ? 'all' : cur }); await refresh(); };

// ---------- teams: made by name with their people, from People or from any "who can use it" picker
const teamForm = (was, key) => { const people = S.boot.users, inTeam = u => !!was && (u.teams || []).includes(was);
  const m = modal({ title: was ? 'Team ' + was : 'New team', body: `<div class="stack"><label class="field"><span>Name</span><input class="input" id="f-team" maxlength="40" placeholder="Finance" value="${esc(was || '')}"></label>
    <div><div class="small" style="font-weight:600;margin-bottom:8px">People</div><div class="row wrap" style="gap:6px" id="f-members">${people.map(u => `<button class="tag ${inTeam(u) ? 'on' : ''}" data-v="${u.id}">${esc(u.name)}</button>`).join('')}</div></div></div>`,
    actions: [{ label: was ? 'Save' : 'Create team', run: async o => { const r = await api('POST', '/api/teams', { name: $('#f-team', o).value, was, members: [...o.querySelectorAll('#f-members .on')].map(b => b.dataset.v) });
      if (key && accessDrafts[key] && !accessDrafts[key].teams.includes(r.name)) { accessDrafts[key].mode = 'restricted'; accessDrafts[key].teams.push(r.name); }
      toast(was ? 'Team saved.' : `Team ${r.name} created.`); await load(); rerender(); } }] });
  $('#f-members', m.el).onclick = e => { const b = e.target.closest('button'); if (b) b.classList.toggle('on'); }; };
acts['team-new'] = el => teamForm('', el.dataset.key || '');
acts['team-edit'] = el => teamForm(el.dataset.v, '');
acts['team-del'] = el => confirmBox(`Remove the team ${el.dataset.v}?`, 'Its people stay. Anything shared with the team is no longer shared with them through it.', 'Remove', async () => { await api('DELETE', '/api/teams/' + encodeURIComponent(el.dataset.v)); await refresh(); });
export function teamsCard(B) {
  const count = t => B.users.filter(u => (u.teams || []).includes(t)).length;
  return `<div class="card" style="margin-top:18px"><div class="card-head"><h3>Teams</h3>${info('Give a team an app or a knowledge base in one go, instead of person by person.')}<button class="btn ghost right" data-act="team-new">New team</button></div>
    ${B.teams.length ? `<table class="list">${B.teams.map(t => `<tr><td><b>${esc(t)}</b></td><td class="muted">${count(t)} ${count(t) === 1 ? 'person' : 'people'}</td><td class="act"><button class="icon-btn sm" data-act="team-edit" data-v="${esc(t)}" data-tip="Name and people" aria-label="Edit team">${icon('edit')}</button><button class="icon-btn sm" data-act="team-del" data-v="${esc(t)}" data-tip="Remove" aria-label="Remove team">${icon('delete_outline')}</button></td></tr>`).join('')}</table>` : `<p class="small muted">No teams yet.</p>`}</div>`;
}

// ---------- chat: the question before web search is switched on
// Returns true when the message may go now. When the web is wanted and off for this chat, it shows the card and returns false.
export const webAsk = { text: '', info: null };
export async function webGate(text, chat) {
  if (!GS().web.on) return true; // off in the console: nobody is asked, nothing is searched
  let r; try { r = await api('POST', '/api/gpt/web/check', { text, chatId: chat ? chat.id : null }); } catch { return true; }
  if (!r.ask) return true;
  webAsk.text = text; webAsk.info = r; return false;
}
export const webAskCard = () => !webAsk.info ? '' : `<div class="card gate web-ask"><div class="row" style="align-items:flex-start">${icon('travel_explore')}<div class="grow"><b>This needs the web</b><div class="small muted" style="white-space:normal">${esc(webAsk.info.reason)} VanikGPT will switch on web search for this chat. It may use browsing credits: ${webAsk.info.left} of ${webAsk.info.of} left this month.</div></div></div>
  <div class="row wrap" style="margin-top:12px"><button class="btn" data-act="web-yes">Switch on and search</button><button class="btn ghost" data-act="web-no">Answer without the web</button></div></div>`;
export const webNote = m => !m.web || m.web.spent ? '' : `<div class="row wrap small faint" style="gap:6px;margin-bottom:6px">${icon('travel_explore')}<span>Searched the web for "${esc(m.web.query)}" · 1 credit · ${m.web.left} of ${m.web.of} left</span></div>`;
