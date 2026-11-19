import './style.css';
import { initScene } from './scene.js';
import { h } from './dom.js';
import { ARROW, CONSOLES, createDemo } from './demo.js';
import { availableTypes, matchesCheat } from './filters.js';

const canvas = document.getElementById('bg');
let scene = { setAccent() {}, pulse() {} };
try {
  scene = initScene(canvas);
} catch {
  canvas.classList.add('scene-fallback');
}
const player = document.getElementById('demo-player');
let stopPlayer = () => {};

function openPlayer(cheat) {
  stopPlayer();
  const { view, stop } = createDemo(cheat, true);
  stopPlayer = stop;
  player.style.setProperty('--c', color(cheat.category));
  document.getElementById('demo-title').textContent = cheat.title;
  document.getElementById('demo-body').replaceChildren(view);
  if (!player.open) player.showModal();
  player.scrollTop = 0;
}
player.addEventListener('close', () => stopPlayer());
player.addEventListener('click', event => {
  if (event.target !== player) return;
  const box = player.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right ||
      event.clientY < box.top || event.clientY > box.bottom) player.close();
});
const $ = (s) => document.querySelector(s);
const state = { cheats: [], q: '', category: new Set(), sub: new Set(), status: new Set() };

const STATUS = [['discovered', 'Discovered'], ['undiscovered', 'Not Yet Discovered']];

const color = (cat) => {
  let n = 0;
  for (const c of cat) n = (n * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${n}, 70%, 62%)`;
};
const uniq = (a) => [...new Set(a)];
const keys = (input) => h('span', { className: 'keys' }, input.map((k) => h('kbd', { textContent: ARROW[k] || k })));

async function api(path, opts) {
  const res = await fetch('/api' + path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// Filters are multi-select: values inside a group are OR'd, groups are AND'd.
function toggleFilter(key, v) {
  const set = state[key];
  if (set.has(v)) set.delete(v); else set.add(v);
  if (key === 'category') {
    // Drop selected types that no longer belong to a selected category.
    const valid = new Set(availableTypes(state.cheats, state.category));
    state.sub = new Set([...state.sub].filter((x) => valid.has(x)));
  }
  drawFilters();
  render();
}

function clearFilters() {
  state.category = new Set();
  state.sub = new Set();
  state.status = new Set();
  drawFilters();
  render();
}

function chips(el, options, key) {
  el.replaceChildren(
    ...options.map(([v, label]) =>
      h('button', {
        className: 'chip' + (state[key].has(v) ? ' on' : ''),
        textContent: label,
        ariaPressed: String(state[key].has(v)),
        onclick: () => toggleFilter(key, v),
      })
    )
  );
}

function drawFilters() {
  const all = state.cheats;
  const cats = uniq(all.map((c) => c.category));
  chips($('#cats'), cats.map((c) => [c, `${c} · ${all.filter((x) => x.category === c).length}`]), 'category');
  const subs = availableTypes(all, state.category);
  $('#subs-row').hidden = !subs.length;
  chips($('#subs'), subs.map((x) => [x, x]), 'sub');
  chips($('#status'), STATUS, 'status');

  // Filter button badge + removable chips for whatever is active
  const active = ['category', 'sub', 'status'].flatMap((key) => [...state[key]].map((v) => [key, v]));
  $('#fcount').hidden = !active.length;
  $('#fcount').textContent = active.length;
  $('#active').replaceChildren(
    ...active.map(([key, v]) =>
      h('button', {
        className: 'chip on',
        textContent: `${key === 'status' ? STATUS.find(([x]) => x === v)[1] : v} ×`,
        onclick: () => toggleFilter(key, v),
      })
    )
  );
}

function render() {
  const list = state.cheats.filter(cheat => matchesCheat(cheat, state));
  $('#results').textContent = `${list.length} cheat${list.length === 1 ? '' : 's'}`;
  $('#grid').replaceChildren(
    ...(list.length ? list.map(card) : [h('p', { className: 'empty', textContent: 'No cheats match.' })])
  );
}

function card(c) {
  const col = color(c.category);
  const el = h('article', { className: 'card' + (c.discovered ? '' : ' locked'), tabIndex: 0 },
    h('div', { className: 'top' },
      h('span', { className: 'tag', textContent: c.category }),
      h('span', { className: 'subtag', textContent: c.subcategory })),
    h('h3', { textContent: c.title }),
    c.discovered ? keys(c.input) : h('p', { className: 'undisc', textContent: 'Not yet discovered' }),
    h('p', { className: 'desc', textContent: c.description }),
    h('p', { className: 'unlock', textContent: `Unlock: ${c.unlock}` }),
    c.discovered
      ? h('div', { className: 'card-foot' },
          h('button', { className: 'ctl', type: 'button', textContent: '▶  Watch demo', ariaLabel: 'Watch demo for ' + c.title, onclick: (e) => { e.stopPropagation(); openPlayer(c); } }))
      : null
  );
  el.style.setProperty('--c', col);
  el.onpointerenter = () => { scene.setAccent(col); scene.pulse(); };
  el.onpointerleave = () => scene.setAccent();
  el.onclick = () => openDrawer(c);
  el.onkeydown = (e) => e.target === el && e.key === 'Enter' && openDrawer(c);
  return el;
}

function closeDrawer() {
  $('#drawer').classList.remove('open');
  $('#backdrop').classList.remove('open');
  $('#drawer').inert = true;
  drawerTrigger?.focus();
  drawerTrigger = null;
}

let drawerTrigger = null;
function openDrawer(c) {
  drawerTrigger = document.activeElement;
  const col = color(c.category);
  scene.setAccent(col);
  scene.pulse();

  const list = h('div', { className: 'comments' });
  const msg = h('p', { className: 'msg' });
  const author = h('input', { placeholder: 'Name (optional)', ariaLabel: 'Name (optional)', maxLength: 40 });
  const body = h('textarea', { placeholder: 'Share a tip…', ariaLabel: 'Comment', maxLength: 1000, required: true });
  const hp = h('input', { className: 'hp', name: 'website', tabIndex: -1, autocomplete: 'off' });
  const form = h('form', { className: 'cform' }, author, body, hp, h('button', { textContent: 'Post comment' }), msg);

  const showComments = (items) =>
    list.replaceChildren(
      ...(items.length
        ? items.map((m) =>
            h('div', { className: 'comment' },
              h('b', { textContent: m.author }),
              h('time', { textContent: new Date(m.createdAt).toLocaleString() }),
              h('p', { textContent: m.body }))
          )
        : [h('p', { className: 'empty', textContent: 'No comments yet. Be the first.' })])
    );
  const path = `/cheats/${encodeURIComponent(c.id)}/comments`;
  api(path).then(showComments).catch((e) => { msg.textContent = e.message; });

  const submit = form.querySelector('button');
  form.onsubmit = async (e) => {
    e.preventDefault();
    msg.textContent = '';
    submit.disabled = true;
    try {
      const res = await api(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author: author.value, body: body.value, website: hp.value }),
      });
      body.value = '';
      if (res.status === 'pending approval') msg.textContent = 'Thanks! Your comment is awaiting approval.';
      else showComments(Array.isArray(res) ? res : await api(path));
    } catch (err) {
      msg.textContent = err.message;
    } finally {
      submit.disabled = false;
    }
  };

  const how = c.discovered
    ? h('div', { className: 'how' },
        h('p', { className: 'hint', textContent: 'Press Up on the D-pad to open your phone, then:' }),
        CONSOLES.map(([name, hold]) =>
          h('div', { className: 'console' },
            h('div', {}, h('b', { textContent: name }), h('span', { textContent: ` · Hold ${hold}, then` })),
            keys(c.input))),
        h('button', { className: 'ctl watch', type: 'button', textContent: 'Watch demo', onclick: () => openPlayer(c) }))
    : h('p', { className: 'undisc', textContent: 'Not yet discovered. Nobody has found this input yet.' });

  $('#drawer').style.setProperty('--c', col);
  $('#drawer').replaceChildren(
    h('button', { className: 'close', textContent: '×', ariaLabel: 'Close', onclick: closeDrawer }),
    h('div', { className: 'top' },
      h('span', { className: 'tag', textContent: c.category }),
      h('span', { className: 'subtag', textContent: c.subcategory })),
    h('h2', { textContent: c.title }),
    h('p', { textContent: c.description }),
    h('p', { className: 'unlock', textContent: `Unlock: ${c.unlock}` }),
    how,
    h('h4', { textContent: 'Comments' }),
    list,
    form
  );
  $('#drawer').inert = false;
  $('#drawer').classList.add('open');
  $('#drawer .close').focus();
  $('#backdrop').classList.add('open');
}

async function init() {
  let t;
  $('#q').oninput = (e) => {
    clearTimeout(t);
    t = setTimeout(() => { state.q = e.target.value; render(); }, 120);
  };
  const panel = $('#filters'), fbtn = $('#filter-btn');
  const setPanel = (open) => { panel.hidden = !open; fbtn.setAttribute('aria-expanded', String(open)); };
  fbtn.onclick = () => setPanel(panel.hidden);
  $('#clear').onclick = clearFilters;
  // composedPath is fixed at dispatch time, so this still works after a chip re-render removes the clicked node.
  document.addEventListener('click', (e) => {
    if (!e.composedPath().includes($('.filter-wrap'))) setPanel(false);
  });
  $('#backdrop').onclick = closeDrawer;
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !player.open) { closeDrawer(); setPanel(false); }
  });

  try {
    state.cheats = JSON.parse($('#cheat-data').textContent);
    const found = state.cheats.filter((c) => c.discovered).length;
    $('#count').textContent = `${found} of ${state.cheats.length} have reported codes.`;
    drawFilters();
    render();
  } catch (e) {
    $('#grid').replaceChildren(
      h('p', { className: 'empty', textContent: 'Could not load the cheat directory.' })
    );
  }
}
init();
