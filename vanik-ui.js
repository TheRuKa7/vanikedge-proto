/* Vanik UI 1.0, hints. A hint is a "?" tag that opens a small moving picture: a few steps on a line, lit one after another,
   with one sentence each. It explains one thing, so nobody has to open a manual. No dependencies.

   VanikUI.hint.define('how-it-works', { title: 'How it works', steps: [{ label: 'Ask', text: 'Type a question.', icon: '' }, ...] });
   <button class="vk-hint" data-vk-hint="how-it-works" aria-label="How it works"></button>      or      VanikUI.hint.tag('how-it-works')  */
(function () {
  const defs = {}, KEY = 'vk-hints-seen';
  let open = null, timer = 0;
  const seen = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } };
  const still = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function close() { clearInterval(timer); if (open) { open.pop.remove(); open.btn.setAttribute('aria-expanded', 'false'); open = null; } }
  function show(btn) {
    const id = btn.dataset.vkHint, d = defs[id]; if (!d) return;
    if (open && open.btn === btn) return close();
    close();
    const pop = document.createElement('div'); pop.className = 'vk-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', d.title);
    pop.innerHTML = `<h4>${esc(d.title)}</h4><div class="vk-flow"><i class="vk-run"></i>${d.steps.map((s, i) => `<div class="vk-node" title="${esc(s.label)}"><span>${s.icon || i + 1}</span></div>`).join('')}</div><div class="vk-text"></div><div class="vk-foot">${d.steps.map(() => '<i class="vk-pip"></i>').join('')}<span style="flex:1"></span><button class="btn ghost" style="height:28px;padding:0 12px" data-vk-close>Got it</button></div>`;
    document.body.appendChild(pop);
    const r = btn.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    pop.style.left = Math.max(12, Math.min(innerWidth - w - 12, r.left + r.width / 2 - w / 2)) + 'px';
    pop.style.top = (r.bottom + h + 16 > innerHeight && r.top - h - 10 > 0 ? r.top - h - 10 : r.bottom + 10) + 'px';
    btn.setAttribute('aria-expanded', 'true'); btn.classList.remove('is-new');
    try { localStorage.setItem(KEY, JSON.stringify([...new Set([...seen(), id])])); } catch (e) { /* private window */ }
    const nodes = [...pop.querySelectorAll('.vk-node')], pips = [...pop.querySelectorAll('.vk-pip')], text = pop.querySelector('.vk-text'), run = pop.querySelector('.vk-run');
    let i = -1;
    const step = () => {
      i = (i + 1) % d.steps.length;
      if (i === 0) { run.style.transition = 'none'; run.style.setProperty('--p', 0); void run.offsetWidth; run.style.transition = ''; }
      nodes.forEach((n, k) => { n.classList.toggle('on', k === i); n.classList.toggle('done', k < i); });
      pips.forEach((p, k) => p.classList.toggle('on', k === i));
      text.innerHTML = `<b>${i + 1}. ${esc(d.steps[i].label)}</b>${esc(d.steps[i].text)}`;
      run.style.setProperty('--p', d.steps.length > 1 ? Math.min(1, (i + 1) / (d.steps.length - 1)) : 0);
    };
    step();
    if (still()) text.innerHTML = d.steps.map((s, k) => `<b>${k + 1}. ${esc(s.label)}</b>${esc(s.text)}<br>`).join('');
    else timer = setInterval(step, d.stepMs || 2600);
    nodes.forEach((n, k) => n.addEventListener('click', () => { clearInterval(timer); i = k - 1; step(); }));
    open = { btn, pop };
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-vk-hint]');
    if (b) { e.preventDefault(); e.stopPropagation(); return show(b); }
    if (open && (e.target.closest('[data-vk-close]') || !e.target.closest('.vk-pop'))) close();
  }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  addEventListener('hashchange', close); addEventListener('resize', close);

  window.VanikUI = {
    version: '1.0.0',
    hint: {
      define(id, def) { defs[id] = def; },
      // the tag as HTML, pulsing until the person has opened it once
      tag(id, label) { const d = defs[id]; return d ? `<button class="vk-hint ${seen().includes(id) ? '' : 'is-new'}" data-vk-hint="${id}" aria-label="${esc(label || d.title)}" aria-expanded="false"></button>` : ''; },
      close,
    },
  };
})();
