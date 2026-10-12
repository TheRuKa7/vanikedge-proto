// The MVP release, in one place: what can be reached. Screens and controls outside it stay in the code for later
// releases and cannot be opened. To bring one back, take its line out of here.
const OUT = [
  // console: document sources, connected systems, training, outside models, playground, webhooks, evidence pack, deep appliance pages, bell
  /^#\/os\/(connectors|train|notifications)(\/|$)/, /^#\/os\/models\/outside/, /^#\/os\/api-gateway\/(playground|webhooks)/, /^#\/os\/access\/evidence/, /^#\/os\/devices\/(storage|monitoring|support|advanced)/,
  // VanikGPT: agents, workflows, routines, tasks, calendar, notes, saved prompts, memory, workspace, playground, the carried-over admin and settings
  /^#\/gpt\/(assistants|flows|routines|automations|tasks|calendar|library|saved|notes|workspace|playground|admin)(\/|$)/, /^#\/gpt\/new\//, /^#\/gpt\/settings\/(all|api)/,
  // app users: personal API keys
  /^#\/me\/keys/,
];
// buttons that start something outside the MVP
const ACTS = ['temp-toggle', 'mic', 'kb-note', 'doc-tasks', 'notif', 'st-archived', 'me-archive-all', 'my-key-new'];
// menu entries that do the same
const MENU = ['Admin', 'Instructions for this chat', 'Archive', 'Use an agent', 'Saved prompts', 'Make tasks from this', 'Save as a note', 'Read aloud', 'Turn into a routine', 'Save as a prompt', 'Remember this'];

export const inScope = hash => !OUT.some(r => r.test(hash || ''));
export const scopeHome = hash => ((hash || '').startsWith('#/gpt') ? '#/gpt' : (hash || '').startsWith('#/me') ? '#/me' : '#/os/home');
export const menuInScope = items => {
  const kept = items.filter(i => i && !(typeof i === 'object' && MENU.includes(i.label)));
  return kept.filter((i, n) => i !== '-' || (n > 0 && n < kept.length - 1 && kept[n - 1] !== '-')); // no divider first, last or doubled
};

const SEL = ACTS.map(a => `[data-act="${a}"]`).join(',');
export function prune(root) {
  if (!root || !root.querySelectorAll) return;
  if (root.matches('a[href^="#/"], [data-h^="#/"]') ? !inScope(root.getAttribute('href') || root.dataset.h) : root.matches(SEL)) return root.remove();
  root.querySelectorAll('a[href^="#/"], [data-h^="#/"]').forEach(a => { if (!inScope(a.getAttribute('href') || a.dataset.h)) a.remove(); });
  root.querySelectorAll(SEL).forEach(b => b.remove());
}
// everything drawn after this point is checked, so a link added by a later screen cannot slip through
new MutationObserver(list => { for (const m of list) for (const n of m.addedNodes) if (n.nodeType === 1) prune(n); }).observe(document.documentElement, { childList: true, subtree: true });
