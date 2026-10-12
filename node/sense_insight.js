'use strict';
// Vanik Sense after the MVP: what kind of call a meeting was, what that kind of call is read for, and the roll-up of many
// calls of one kind. Everything is worked out by plain rules from the transcript, so each figure can show the line it came
// from. A real build would use a model for the reading; the shape of what comes back stays the same. Loaded by sense.js.
module.exports = function build({ db, day }) {
  const TYPES = ['Customer sales call', 'Vendor or supplier call', 'Hiring interview', 'Stakeholder update', 'Leadership review', 'Team sync', 'One to one'];
  const TOPICS = { Price: ['price', 'cost', 'quote', 'discount', 'rate', 'budget'], Delivery: ['deliver', 'lead time', 'dispatch', 'on time', 'stock'], Quality: ['quality', 'test certificate', 'defect', 'audit', 'inspection'],
    Payment: ['payment', 'invoice', 'credit', 'terms'], Timeline: ['timeline', 'deadline', 'go live', 'start date', 'joining', 'by next', 'this quarter'], Support: ['support', 'service', 'training', 'onboarding'],
    Systems: ['erp', 'sap', 'system', 'integrat', 'portal'], People: ['hire', 'hiring', 'candidate', 'offer', 'shortlist'], Contract: ['contract', 'agreement', 'renewal', 'approved vendor'] };
  const RX = { need: /\b(we need|we would need|we require|need to|needs to|must|looking for|we want|has to|should be able|require)\b/i, worry: /\b(concern|worried|too high|expensive|not sure|risk|problem|issue|cannot accept|higher than|delay)\b/i,
    yes: /\b(sounds good|works for us|happy with|we like|go ahead|looks good|impressed|that helps|makes sense)\b/i, when: /\b(by (next|this|the end of) \w+|from (next|this) \w+|go live|start(ing)? (in|from|by)|this quarter|next quarter|before \w+)\b/i,
    money: /\b(budget|price|quote|cost|rate|discount|rupees)\b/i, rival: /\b(?:currently (?:use|buy from)|buying from|quote from|offer from|compared (?:to|with)|versus)\s+([A-Z][\w&]+(?:\s[A-Z][\w&]+)?)/,
    num: /(\d[\d,.]*\s?(%|percent|lakh|crore|rupees|days|weeks|orders|people|offers|hours)|\b(ninety|eighty|seventy|sixty|fifty|forty|thirty|twenty|eleven|twelve|ten|two|three|four|five)\b[\w ]{0,14}\b(percent|of twelve|orders|offers|findings|invoices|weeks|days))/i,
    block: /\b(blocked|waiting on|stuck|depends on|on hold|held)\b/i, risk: /\b(risk|late|delay|slip|findings?|escalat|overdue|on hold|pushes)\b/i, did: /\b(I led|I built|I managed|I reduced|I saved|I handled|I set up|I negotiated|years)\b/, will: /\b(i will|i'll|we will|we can)\b/i };
  // Customer confidence: where it starts, what moves it, and by how much. PRD-VANIK-SENSE-INSIGHTS.md gives the reason for each line.
  const SCORE = { start: 30, yes: 10, yesMax: 20, decider: 15, noDecider: -10, next: 15, noNext: -15, money: 10, when: 10, worry: -8, worryMax: 3, rival: -8, overdue: -10, high: 70, medium: 45, minLines: 3 };
  const SKILLS = [['Excel', 'excel'], ['SAP', 'sap'], ['Negotiation', 'negotiat'], ['Vendor management', 'vendor'], ['Analysis', 'analys'], ['SQL', 'sql'], ['GST', 'gst'], ['Purchase orders', 'purchase order'], ['Costing', 'costing'], ['Reporting', 'reporting']];
  const sents = m => m.transcript.flatMap(l => l.text.split(/(?<=[.!?])\s+/).map(s => ({ who: l.who, t: l.t, text: s.trim() }))).filter(s => s.text);
  const hit = (k, text) => TOPICS[k].some(w => text.toLowerCase().includes(w));
  const outside = m => m.participants.filter(p => !p.userId), isOut = (m, who) => outside(m).some(p => p.name === who);
  const persona = t => { const s = String(t || '').toLowerCase(); return !s ? 'Role not stated' : /candidate/.test(s) ? 'Candidate' : /director|head|vp\b|chief|owner|managing|general manager|founder/.test(s) ? 'Decision maker' : /financ|cfo|accounts|controller/.test(s) ? 'Budget holder' : /procure|purchas|buyer|sourcing/.test(s) ? 'Buyer' : /engineer|quality|technical|plant|it\b/.test(s) ? 'Technical evaluator' : 'User'; };
  const company = p => p.company || (p.email.split('@')[1] || '').split('.')[0].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const account = m => { const o = outside(m).filter(p => persona(p.title) !== 'Candidate'); return o.length ? company(o[0]) : ''; };
  const q = s => ({ text: s.text, who: s.who, t: s.t });
  const dedupe = list => list.filter((x, i) => list.findIndex(y => y.text === x.text) === i);

  // the type of a call: a guess with its reason; the host can change it
  function guess(m) {
    const t = m.title.toLowerCase(), o = outside(m), all = m.transcript.map(l => l.text).join(' ');
    if (/interview/.test(t) || o.some(p => persona(p.title) === 'Candidate')) return { type: 'Hiring interview', why: 'A candidate was in the call' };
    if (o.length && /vendor|supplier/.test(t)) return { type: 'Vendor or supplier call', why: 'People from a supplier were in the call' };
    if (o.length) return { type: 'Customer sales call', why: `People from ${account(m) || 'outside the company'} were in the call` + (RX.money.test(all) ? ', and price came up' : '') };
    if (/leadership|board|business review|quarterly review|weekly review/.test(t)) return { type: 'Leadership review', why: 'The title says it is a leadership review' };
    if (/stakeholder|steering|update|status|rollout/.test(t)) return { type: 'Stakeholder update', why: 'The title says it is an update to stakeholders' };
    if (m.participants.length === 2 && /1:1|one to one|catch ?up/.test(t)) return { type: 'One to one', why: 'Two people, and the title says so' };
    return { type: 'Team sync', why: 'Everyone was from the company and no other kind fits' };
  }
  const typeOf = m => { if (!m.type) { const g = guess(m); m.type = g.type; m.typeWhy = g.why; m.typeBy = ''; } return m.type; };

  function people(m, S) {
    const words = {}; m.transcript.forEach(l => { words[l.who] = (words[l.who] || 0) + l.text.split(/\s+/).length; });
    const total = Object.values(words).reduce((a, b) => a + b, 0) || 1;
    return m.participants.map(p => ({ name: p.name, title: p.title || '', company: p.userId ? '' : company(p), outside: !p.userId, persona: p.userId ? 'Our team' : persona(p.title), share: Math.round(100 * (words[p.name] || 0) / total),
      questions: S.filter(s => s.who === p.name && /\?$/.test(s.text)).map(s => s.text).slice(0, 3), topics: Object.keys(TOPICS).filter(k => S.some(s => s.who === p.name && hit(k, s.text))) }));
  }
  const topicsOf = S => Object.keys(TOPICS).map(k => { const h = S.filter(s => hit(k, s.text)); return { topic: k, count: h.length, by: [...new Set(h.map(s => s.who))] }; }).filter(t => t.count).sort((a, b) => b.count - a.count);

  // ---- a customer call
  function sales(m, S, P) {
    const them = S.filter(s => isOut(m, s.who)), reqs = dedupe(them.filter(s => RX.need.test(s.text))).map(q), worries = dedupe(them.filter(s => RX.worry.test(s.text) && !RX.need.test(s.text))).map(q);
    const rivals = [...new Set(S.map(s => (s.text.match(RX.rival) || [])[1]).filter(Boolean))], why = [], add = (n, text, s) => why.push({ n, text, quote: s ? s.text : '', who: s ? s.who : '', t: s ? s.t || '' : '' });
    const pos = them.filter(s => RX.yes.test(s.text)), dm = P.find(p => p.outside && p.persona === 'Decision maker'), next = m.actions.find(a => a.due && a.status === 'open'), ours = m.actions.filter(a => a.ownerId && a.status === 'open' && a.due && a.due < day());
    if (pos.length) add(Math.min(SCORE.yesMax, SCORE.yes * pos.length), 'They said yes to something', pos[0]);
    add(dm ? SCORE.decider : SCORE.noDecider, dm ? `${dm.name}, who decides, was in the call` : 'Nobody who decides was in the call');
    add(next ? SCORE.next : SCORE.noNext, next ? 'A dated next step was agreed' : 'No dated next step was agreed', next ? { text: next.task, who: next.owner || 'No owner', t: '' } : null);
    if (them.some(s => RX.money.test(s.text))) add(SCORE.money, 'Price or budget was discussed', them.find(s => RX.money.test(s.text)));
    if (them.some(s => RX.when.test(s.text))) add(SCORE.when, 'They gave a timeline', them.find(s => RX.when.test(s.text)));
    worries.slice(0, SCORE.worryMax).forEach(w => add(SCORE.worry, 'A concern is still open', w));
    if (rivals.length) add(SCORE.rival, 'Another supplier is in the picture: ' + rivals.join(', '));
    if (ours.length) add(SCORE.overdue, `${ours.length} of our promises to them ${ours.length === 1 ? 'is' : 'are'} overdue`);
    const enough = them.length >= SCORE.minLines, score = enough ? Math.max(0, Math.min(100, SCORE.start + why.reduce((a, w) => a + w.n, 0))) : null, band = !enough ? 'Not scored' : score >= SCORE.high ? 'High' : score >= SCORE.medium ? 'Medium' : 'Low';
    const short = t => t.replace(/^(and|but|so|also)\s+/i, '').replace(/[.]$/, ''), buyers = P.filter(p => p.outside);
    const recs = [!next && 'Agree a next step with a date before the call ends.', !dm && 'Bring in the person who decides.', ...worries.slice(0, 2).map(w => `Send proof that answers ${w.who.split(' ')[0]}'s concern: "${short(w.text)}".`), rivals.length && `Prepare a short comparison with ${rivals.join(' and ')}.`, ours.length && 'Close our overdue promises first.',
      next && `Keep the date: ${short(next.task)}.`].filter(Boolean);
    const pitch = [reqs.length ? `Open with what they asked for: ${reqs.slice(0, 2).map(r => `"${short(r.text)}"`).join(' and ')}.` : 'Open by asking what they need. No requirement was stated on this call.',
      ...buyers.filter(p => p.topics.length).slice(0, 3).map(p => `For ${p.name}${p.title ? ` (${p.title})` : ''}: speak to ${p.topics.slice(0, 2).join(' and ').toLowerCase()}.`),
      worries.length ? `Answer the open concern early: "${short(worries[0].text)}".` : 'No concern was raised. Ask if anything would stop them.', `Close by asking for ${next ? 'the step already agreed, on its date' : 'a dated next step'}.`];
    return { score, band, why, reqs, worries, rivals, pitch, recs, blocks: [
      enough ? { kind: 'score', title: 'Customer confidence', tip: `Starts at ${SCORE.start} and moves with what was said. Every reason is listed with its line. A guide, not a forecast.`, score, band, why } : { kind: 'list', title: 'Customer confidence', items: ['Not scored. The customer said too little on this call to go on.'] },
      { kind: 'quotes', title: 'What they asked for', items: reqs, none: 'No requirement was stated.' },
      { kind: 'people', title: 'Who was interested in what', items: buyers },
      { kind: 'quotes', title: 'Concerns raised', items: worries, none: 'No concern was raised.' },
      ...(rivals.length ? [{ kind: 'list', title: 'Other suppliers named', items: rivals }] : []),
      { kind: 'list', title: 'Pitch for the next call', items: pitch, save: { kind: 'Pitch', title: 'Pitch: ' + (account(m) || m.title) } },
      { kind: 'list', title: 'What to do next', items: recs.length ? recs : ['Nothing stands out. Keep the next step.'] }] };
  }
  function vendor(m, S) {
    const them = S.filter(s => isOut(m, s.who));
    return { blocks: [{ kind: 'quotes', title: 'What they promised', items: dedupe(them.filter(s => RX.will.test(s.text))).map(q), none: 'They promised nothing on this call.' },
      { kind: 'list', title: 'What we promised', items: m.actions.filter(a => a.ownerId).map(a => `${a.owner}: ${a.task}${a.due ? ' (by ' + a.due + ')' : ''}`), none: 'We promised nothing on this call.' },
      { kind: 'quotes', title: 'Terms that came up', items: dedupe(S.filter(s => hit('Price', s.text) || hit('Payment', s.text) || hit('Delivery', s.text))).slice(0, 5).map(q), none: 'Price, payment and delivery did not come up.' },
      { kind: 'quotes', title: 'Risks', items: dedupe(S.filter(s => RX.risk.test(s.text))).slice(0, 4).map(q), none: 'No risk was raised.' }] };
  }
  function interview(m, S, P) {
    const c = P.find(p => p.persona === 'Candidate') || P.find(p => p.outside), mine = S.filter(s => c && s.who === c.name), panel = S.filter(s => !c || s.who !== c.name), all = S.map(s => s.text).join(' ').toLowerCase();
    const covered = SKILLS.filter(k => all.includes(k[1])).map(k => k[0]), left = SKILLS.map(k => k[0]).filter(k => !covered.includes(k)).slice(0, 4);
    return { candidate: c ? c.name : '', covered, blocks: [{ kind: 'people', title: 'Who spoke', items: P },
      { kind: 'list', title: 'Skills that came up', items: covered, none: 'No skill from the list came up.' },
      { kind: 'quotes', title: 'What the candidate has done', items: dedupe(mine.filter(s => RX.did.test(s.text))).map(q), none: 'Nothing was stated.' },
      { kind: 'quotes', title: 'Questions the panel asked', items: panel.filter(s => /\?$/.test(s.text)).map(q), none: 'No question was asked.' },
      { kind: 'quotes', title: 'Concerns from the panel', items: dedupe(panel.filter(s => RX.worry.test(s.text))).map(q), none: 'No concern was raised.' },
      { kind: 'list', title: 'Ask in the next round', items: left.map(k => `Ask about ${k}. It did not come up.`), save: { kind: 'Question list', title: 'Next round: ' + (c ? c.name : m.title) } },
      { kind: 'list', title: 'How this is used', items: ['No score is given to a candidate. People decide.'] }] };
  }
  function mom(m) {
    const d = new Date(m.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }), s = m.summary;
    return [`Minutes of meeting: ${m.title}`, `Date: ${d}. Length: ${m.mins} minutes.`, `Present: ${m.participants.map(p => p.name).join(', ')}.`, '', 'Discussed', ...(s.points.length ? s.points.map((p, i) => `${i + 1}. ${p}`) : ['Nothing recorded.']), '', 'Decided',
      ...(s.decisions.length ? s.decisions.map((p, i) => `${i + 1}. ${p}`) : ['No decision was taken.']), '', 'Actions', ...(m.actions.length ? m.actions.map((a, i) => `${i + 1}. ${a.task} Owner: ${a.owner || 'not set'}. Due: ${a.due || 'not set'}.`) : ['No action came out of it.'])].join('\n');
  }
  function stakeholder(m, S, P) {
    const stood = P.map(p => { const mine = S.filter(s => s.who === p.name); return mine.some(s => RX.worry.test(s.text)) ? `${p.name} raised a concern.` : mine.some(s => RX.yes.test(s.text) || /\b(agreed|approved)\b/i.test(s.text)) ? `${p.name} agreed.` : `${p.name} gave an update.`; });
    return { blocks: [{ kind: 'text', title: 'Minutes of meeting', text: mom(m), save: { kind: 'Minutes', title: 'Minutes: ' + m.title } }, { kind: 'list', title: 'Where people stood', items: stood },
      { kind: 'quotes', title: 'Risks raised', items: dedupe(S.filter(s => RX.risk.test(s.text))).slice(0, 5).map(q), none: 'No risk was raised.' }] };
  }
  function leadership(m, S, ctx) {
    const by = {}; m.actions.forEach(a => { const k = a.owner || 'No owner'; by[k] = by[k] || [0, 0]; by[k][a.status === 'done' ? 1 : 0]++; });
    const earlier = (ctx.earlier || []).flatMap(x => x.actions.filter(a => a.status === 'open').map(a => `${a.owner || 'No owner'}: ${a.task}`));
    return { blocks: [{ kind: 'quotes', title: 'Numbers that were said', items: dedupe(S.filter(s => RX.num.test(s.text))).slice(0, 6).map(q), none: 'No number was said.' },
      { kind: 'list', title: 'Decisions', items: m.summary.decisions, none: 'No decision was taken.' }, { kind: 'quotes', title: 'Risks and escalations', items: dedupe(S.filter(s => RX.risk.test(s.text))).slice(0, 5).map(q), none: 'No risk was raised.' },
      { kind: 'list', title: 'Actions by person', items: Object.entries(by).map(([k, v]) => `${k}: ${v[0]} open, ${v[1]} done`), none: 'No action came out of it.' },
      ...(earlier.length ? [{ kind: 'list', title: 'Still open from earlier reviews', items: earlier }] : [])] };
  }
  const sync = (m, S) => ({ blocks: [{ kind: 'quotes', title: 'Blockers', items: dedupe(S.filter(s => RX.block.test(s.text))).map(q), none: 'Nobody said they were blocked.' }, { kind: 'list', title: 'Decisions', items: m.summary.decisions, none: 'This meeting ended without a decision.' }] });

  function insight(m, ctx = {}) {
    const S = sents(m), P = people(m, S), type = typeOf(m);
    const r = type === 'Customer sales call' ? sales(m, S, P) : type === 'Vendor or supplier call' ? vendor(m, S) : type === 'Hiring interview' ? interview(m, S, P) : type === 'Stakeholder update' ? stakeholder(m, S, P) : type === 'Leadership review' ? leadership(m, S, ctx)
      : type === 'One to one' ? { blocks: [{ kind: 'list', title: 'Kept private', items: ['A one to one is not read for anything beyond its minutes and your own actions.'] }] } : sync(m, S);
    return { type, why: m.typeBy ? `Set by ${m.typeBy}` : m.typeWhy || guess(m).why, account: account(m), people: P, topics: topicsOf(S), questions: S.filter(s => /\?$/.test(s.text)).length, ...r };
  }

  // ---- many calls of one kind
  const count = list => { const n = {}; list.forEach(x => { n[x] = (n[x] || 0) + 1; }); return Object.entries(n).sort((a, b) => b[1] - a[1]).map(([text, k]) => ({ text, n: k })); };
  function rollup(ms, type) {
    const all = ms, set = type ? all.filter(m => typeOf(m) === type) : all, acts = set.flatMap(m => m.actions), open = acts.filter(a => a.status === 'open'), late = open.filter(a => a.due && a.due < day());
    const hours = Math.round(set.reduce((a, m) => a + m.mins, 0) / 6) / 10, types = TYPES.map(t => ({ type: t, n: all.filter(m => typeOf(m) === t).length })).filter(t => t.n);
    const out = { type: type || '', types, cards: [{ label: 'Calls', value: set.length }, { label: 'Hours', value: hours }, { label: 'Promises made', value: acts.length }, { label: 'Kept', value: acts.length - open.length }, { label: 'Overdue', value: late.length }], tables: [], lists: [] };
    const I = set.map(m => ({ m, i: insight(m) }));
    if (!type) out.tables.push({ title: 'By kind of call', cols: ['Kind of call', 'Calls', 'Hours', 'Decisions', 'Open actions'], rows: types.map(t => { const s = all.filter(m => typeOf(m) === t.type); return [t.type, s.length, Math.round(s.reduce((a, m) => a + m.mins, 0) / 6) / 10, s.reduce((a, m) => a + m.summary.decisions.length, 0), s.reduce((a, m) => a + m.actions.filter(x => x.status === 'open').length, 0)]; }) });
    if (type === 'Customer sales call' || type === 'Vendor or supplier call') {
      const acc = {}; I.forEach(x => { const k = x.i.account || 'Not known'; (acc[k] = acc[k] || []).push(x); });
      const rows = Object.entries(acc).map(([k, L]) => { const last = L.slice().sort((a, b) => (a.m.at < b.m.at ? 1 : -1))[0], A = L.flatMap(x => x.m.actions.filter(a => a.status === 'open')), next = A.filter(a => a.due).sort((a, b) => (a.due < b.due ? -1 : 1))[0];
        return [k, L.length, last.m.at.slice(0, 10), ...(type === 'Customer sales call' ? [last.i.score === null ? 'Not scored' : `${last.i.score} ${last.i.band}`] : []), A.filter(a => a.ownerId).length, A.filter(a => !a.ownerId && a.owner).length, next ? `${next.task.slice(0, 70)} (${next.due})` : 'None set']; });
      out.tables.push({ title: type === 'Customer sales call' ? 'Customers' : 'Suppliers', cols: [type === 'Customer sales call' ? 'Customer' : 'Supplier', 'Calls', 'Last call', ...(type === 'Customer sales call' ? ['Confidence'] : []), 'We owe', 'They owe', 'Next step'], rows });
      if (type === 'Customer sales call') { const sc = I.map(x => x.i.score).filter(x => x !== null); out.cards.splice(1, 0, { label: 'Customers', value: rows.length }, { label: 'Average confidence', value: sc.length ? Math.round(sc.reduce((a, b) => a + b, 0) / sc.length) : 0 });
        out.lists.push({ title: 'Asked for most', items: count(I.flatMap(x => x.i.reqs.flatMap(r => Object.keys(TOPICS).filter(k => hit(k, r.text))))) }, { title: 'Concerns raised most', items: count(I.flatMap(x => x.i.worries.flatMap(r => Object.keys(TOPICS).filter(k => hit(k, r.text))))) }, { title: 'Other suppliers named', items: count(I.flatMap(x => x.i.rivals)) }); }
    }
    if (type === 'Hiring interview') out.tables.push({ title: 'Interviews', cols: ['Candidate', 'Interview', 'Date', 'Skills that came up', 'Panel'], rows: I.map(x => [x.i.candidate || 'Not known', x.m.title, x.m.at.slice(0, 10), x.i.covered.join(', ') || 'None', x.m.participants.filter(p => p.userId).map(p => p.name).join(', ')]) });
    if (type === 'Leadership review' || type === 'Stakeholder update' || type === 'Team sync') {
      const by = {}; set.forEach(m => m.actions.forEach(a => { const k = a.owner || 'No owner'; by[k] = by[k] || [0, 0, 0]; by[k][0]++; if (a.status === 'done') by[k][1]++; else if (a.due && a.due < day()) by[k][2]++; }));
      out.tables.push({ title: 'Promises by person', cols: ['Person', 'Made', 'Kept', 'Overdue'], rows: Object.entries(by).map(([k, v]) => [k, ...v]) });
      out.lists.push({ title: 'Decisions', items: set.flatMap(m => m.summary.decisions).slice(0, 8).map(text => ({ text })) }, { title: 'Calls that ended without a decision', items: set.filter(m => !m.summary.decisions.length).map(m => ({ text: `${m.title}, ${m.at.slice(0, 10)}` })) });
    }
    out.lists.push({ title: 'Talked about most', items: count(I.flatMap(x => x.i.topics.map(t => t.topic))).slice(0, 6) });
    return out;
  }

  // ---- getting ready for the next call with a customer or a supplier
  function prep(ms, name, library) {
    const L = ms.filter(m => account(m) === name).sort((a, b) => (a.at < b.at ? 1 : -1)); if (!L.length) return null;
    const last = L[0], i = insight(last), open = L.flatMap(m => m.actions.filter(a => a.status === 'open').map(a => ({ a, m })));
    return { account: name, calls: L.length, last: { id: last.id, title: last.title, at: last.at, type: i.type }, blocks: [
      { kind: 'list', title: 'Where things stand', items: [last.summary.overall, ...(i.score !== undefined && i.score !== null ? [`Customer confidence after the last call: ${i.score}, ${i.band}.`] : [])] },
      { kind: 'list', title: 'We still owe them', items: open.filter(x => x.a.ownerId).map(x => `${x.a.owner}: ${x.a.task}${x.a.due ? ' (by ' + x.a.due + ')' : ''}`), none: 'Nothing is open on our side.' },
      { kind: 'list', title: 'They still owe us', items: open.filter(x => !x.a.ownerId && x.a.owner).map(x => `${x.a.owner}: ${x.a.task}`), none: 'Nothing is open on their side.' },
      ...(i.reqs ? [{ kind: 'quotes', title: 'What they asked for', items: i.reqs, none: 'No requirement was stated.' }, { kind: 'quotes', title: 'Concerns to answer', items: i.worries, none: 'No concern was raised.' }, { kind: 'list', title: 'Pitch', items: i.pitch }] : []),
      { kind: 'people', title: 'Who will be there', items: i.people.filter(p => p.outside) },
      { kind: 'list', title: 'From your library', items: library.map(r => `${r.kind}: ${r.title}`), none: 'Nothing saved for this kind of call yet.' }] };
  }
  // ---- the first screen: a few numbers, and what to do next, each with the place to do it
  function pulse(ms, u, upcoming) {
    const acts = ms.flatMap(m => m.actions.map(a => ({ a, m }))), late = x => x.a.status === 'open' && x.a.due && x.a.due < day(), mine = acts.filter(x => x.a.ownerId === u.id), since = new Date(Date.now() - 7 * 864e5).toISOString(), week = ms.filter(m => m.at >= since);
    const kept = l => (l.length ? Math.round(100 * l.filter(x => x.a.status === 'done').length / l.length) : null), P = [], add = (rank, tone, text, sub, href, cta) => P.push({ rank, tone, text, sub, href, cta });
    const cust = ms.filter(m => typeOf(m) === 'Customer sales call').map(m => ({ m, i: insight(m) }));
    cust.forEach(x => { const owed = x.m.actions.filter(a => a.ownerId && a.status === 'open' && a.due && a.due < day()); if (owed.length) add(1, 'err', `${x.i.account} is waiting on us`, owed[0].task, '#/app/sense/meetings/' + x.m.id, 'Open'); });
    const myLate = mine.filter(late); if (myLate.length) add(2, 'err', `${myLate.length} of your promises ${myLate.length === 1 ? 'is' : 'are'} overdue`, myLate[0].a.task, '#/app/sense/actions/overdue', 'See them');
    upcoming.filter(e => e.known && new Date(e.at).getTime() - Date.now() < 2 * 864e5).forEach(e => { const c = cust.filter(x => x.i.account === e.account).sort((a, b) => (a.m.at < b.m.at ? 1 : -1))[0]; add(3, 'warn', `Soon: ${e.title}`, c && c.i.score !== null ? `Confidence after the last call: ${c.i.score}, ${c.i.band}` : 'A brief is ready from your earlier calls', '#/app/sense/library/' + encodeURIComponent(e.account), 'Get ready'); });
    const unset = ms.filter(m => m.organizerId === u.id).map(m => ({ m, n: m.actions.filter(a => a.status === 'open' && ((!a.ownerId && !a.owner) || !a.due)).length })).filter(x => x.n);
    if (unset.length === 1) add(4, 'warn', `${unset[0].m.title}: ${unset[0].n} action${unset[0].n === 1 ? ' has' : 's have'} no owner or no date`, 'You hosted it, so you can set them', '#/app/sense/meetings/' + unset[0].m.id, 'Fix');
    else if (unset.length) add(4, 'warn', `${unset.reduce((a, x) => a + x.n, 0)} actions in ${unset.length} meetings you hosted have no owner or no date`, unset.map(x => x.m.title).slice(0, 3).join(', '), '#/app/sense/actions/missing', 'Fix');
    const owedMe = acts.filter(x => late(x) && x.a.ownerId && x.a.ownerId !== u.id && x.m.organizerId === u.id); if (owedMe.length) add(5, 'info', `${owedMe.length} promise${owedMe.length === 1 ? '' : 's'} made in your meetings ${owedMe.length === 1 ? 'is' : 'are'} overdue`, `${owedMe[0].a.owner}: ${owedMe[0].a.task}`, '#/app/sense/actions/waiting', 'Remind');
    cust.filter(x => x.i.score !== null && x.i.band === 'Low').forEach(x => add(6, 'warn', `${x.i.account}: confidence is low`, (x.i.why.find(w => w.n < 0) || {}).text || '', '#/app/sense/meetings/' + x.m.id, 'See why'));
    week.filter(m => m.organizerId === u.id && !m.summary.decisions.length && typeOf(m) !== 'One to one').forEach(m => add(7, 'info', `${m.title} ended without a decision`, 'Worth a line to the people who were there', '#/app/sense/meetings/' + m.id, 'Open'));
    return { kept: { mine: kept(mine), all: kept(acts), made: acts.length }, week: { calls: week.length, hours: Math.round(week.reduce((a, m) => a + m.mins, 0) / 6) / 10 }, kinds: TYPES.map(t => ({ type: t, n: ms.filter(m => typeOf(m) === t).length })).filter(t => t.n),
      customers: cust.map(x => ({ account: x.i.account, score: x.i.score, band: x.i.band, id: x.m.id })).slice(0, 4), pointers: P.sort((a, b) => a.rank - b.rank).slice(0, 5) };
  }
  return { TYPES, SCORE, guess, typeOf, insight, rollup, prep, account, mom, pulse };
};
