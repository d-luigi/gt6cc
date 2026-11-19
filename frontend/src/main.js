import './style.css';
import { initScene } from './scene.js';

const scene = initScene(document.getElementById('bg'));
const $ = (s) => document.querySelector(s);
const state = { cheats: [], q: '', category: '', sub: '', status: '' };

const ARROW = { Up: '↑', Down: '↓', Left: '←', Right: '→' };
const CONSOLES = [['PS5', 'L1 + R1'], ['Xbox', 'LB + RB']];
const STATUS = [['', 'All'], ['discovered', 'Discovered'], ['undiscovered', 'Not yet discovered']];

// Tiny DOM helper. Everything uses textContent, so comment text is never parsed as HTML.
const h = (tag, props = {}, ...kids) => {
  const el = Object.assign(document.createElement(tag), props);
  el.append(...kids.flat().filter(Boolean));
  return el;
};
const color = (cat) => {
  let n = 0;
  for (const c of cat) n = (n * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${n}, 70%, 62%)`;
};
let stopDemo = () => {};
const uniq = (a) => [...new Set(a)];
const keys = (input) => h('span', { className: 'keys' }, input.map((k) => h('kbd', { textContent: ARROW[k] || k })));

async function api(path, opts) {
  const res = await fetch('/api' + path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function chips(el, options, key) {
  el.replaceChildren(
    ...options.map(([v, label]) =>
      h('button', {
        className: 'chip' + (state[key] === v ? ' on' : ''),
        textContent: label,
        onclick: () => {
          state[key] = v;
          if (key === 'category') state.sub = '';
          drawFilters();
          render();
        },
      })
    )
  );
}

function drawFilters() {
  const all = state.cheats;
  const cats = uniq(all.map((c) => c.category));
  chips($('#cats'), [['', `All · ${all.length}`], ...cats.map((c) => [c, `${c} · ${all.filter((x) => x.category === c).length}`])], 'category');
  const inCat = all.filter((c) => c.category === state.category);
  const subs = uniq(inCat.map((c) => c.subcategory));
  $('#subs-row').hidden = !state.category;
  chips($('#subs'), [['', 'All'], ...subs.map((s) => [s, s])], 'sub');
  chips($('#status'), STATUS, 'status');
}

function matches(c) {
  const q = state.q.toLowerCase();
  return (
    (!state.category || c.category === state.category) &&
    (!state.sub || c.subcategory === state.sub) &&
    (!state.status || (state.status === 'discovered') === c.discovered) &&
    (!q || `${c.title} ${c.description} ${c.unlock}`.toLowerCase().includes(q))
  );
}

function render() {
  const list = state.cheats.filter(matches);
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
    h('p', { className: 'unlock', textContent: `Unlock: ${c.unlock}` })
  );
  el.style.setProperty('--c', col);
  el.onpointerenter = () => { scene.setAccent(col); scene.pulse(); };
  el.onpointerleave = () => scene.setAccent();
  el.onclick = () => openDrawer(c);
  el.onkeydown = (e) => e.key === 'Enter' && openDrawer(c);
  return el;
}

function closeDrawer() {
  stopDemo();
  $('#drawer').classList.remove('open');
  $('#backdrop').classList.remove('open');
}

const SPEEDS = [['0.25×', 0.25], ['0.5×', 0.5], ['1×', 1], ['2×', 2]];
const restart = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

// Step-by-step animated walkthrough of the button presses.
function demo(c) {
  const st = { i: -1, playing: false, speed: 0.5, con: 0, pressed: '', held: false, next: 0, rel: 0 };
  const steps = () => [
    { text: 'Press Up on the D-pad to open your phone', dir: 'Up', held: false },
    { text: `Now hold ${CONSOLES[st.con][1]}`, dir: '', held: true },
    ...c.input.map((d) => ({ text: `Press ${d}`, dir: d, held: true })),
  ];
  const dur = () => 1000 / st.speed;

  const pad = {};
  const dpad = h('div', { className: 'dpad' },
    ['Up', 'Left', 'Right', 'Down'].map((d) => (pad[d] = h('span', { className: 'pad ' + d.toLowerCase(), textContent: ARROW[d] }))));
  const sh = [h('span', { className: 'sh' }), h('span', { className: 'sh' })];
  const seq = c.input.map((d) => h('kbd', { textContent: ARROW[d] }));
  const fill = h('div', { className: 'fill' });
  const caption = h('p', { className: 'caption' });
  const playBtn = h('button', { className: 'ctl play', onclick: toggle });

  function paint() {
    const list = steps(), s = list[st.i];
    Object.entries(pad).forEach(([d, el]) => el.classList.toggle('on', st.pressed === d));
    CONSOLES[st.con][1].split(' + ').forEach((t, n) => (sh[n].textContent = t));
    sh.forEach((el) => el.classList.toggle('on', st.held));
    seq.forEach((k, n) => {
      k.classList.toggle('cur', st.i - 2 === n);
      k.classList.toggle('done', st.i - 2 > n);
    });
    fill.style.width = `${((st.i + 1) / list.length) * 100}%`;
    caption.textContent = s ? `Step ${st.i + 1} of ${list.length}: ${s.text}` : 'Press play to watch the sequence.';
    playBtn.textContent = st.playing ? 'Pause' : st.i >= list.length - 1 ? 'Replay' : 'Play';
  }
  // Press a step, then release the D-pad shortly after so repeated
  // directions (Up, Up, Up) are visibly separate presses.
  function press(i) {
    clearTimeout(st.rel);
    st.i = i;
    const s = steps()[i];
    st.pressed = s.dir;
    st.held = s.held;
    paint();
    if (s.dir) restart(pad[s.dir], 'hit');
    restart(caption, 'swap');
    st.rel = setTimeout(() => {
      st.pressed = '';
      if (st.i === steps().length - 1) st.held = false;
      paint();
    }, Math.min(dur() * 0.6, 1200));
  }
  function tick() {
    if (st.i >= steps().length - 1) { st.playing = false; paint(); return; }
    press(st.i + 1);
    st.next = setTimeout(tick, dur());
  }
  function toggle() {
    clearTimeout(st.next);
    if (st.playing) { st.playing = false; paint(); return; }
    if (st.i >= steps().length - 1) { st.i = -1; st.pressed = ''; st.held = false; }
    st.playing = true;
    tick();
  }
  function go(delta) {
    clearTimeout(st.next);
    st.playing = false;
    const i = Math.max(-1, Math.min(steps().length - 1, st.i + delta));
    if (i < 0) { clearTimeout(st.rel); st.i = -1; st.pressed = ''; st.held = false; paint(); }
    else press(i);
  }
  const group = (opts, cur, set) => {
    const box = h('div', { className: 'chips small' });
    const draw = () =>
      box.replaceChildren(...opts.map(([label, v]) =>
        h('button', { className: 'chip' + (cur() === v ? ' on' : ''), textContent: label, onclick: () => { set(v); draw(); paint(); } })));
    draw();
    return box;
  };

  stopDemo = () => {
    clearTimeout(st.next);
    clearTimeout(st.rel);
    st.playing = false;
    st.pressed = '';
    paint();
  };
  paint();
  return h('div', { className: 'demo' },
    h('div', { className: 'stage' }, h('div', { className: 'shoulders' }, sh), dpad),
    h('div', { className: 'track' }, fill),
    caption,
    h('span', { className: 'keys' }, seq),
    h('div', { className: 'ctls' },
      h('button', { className: 'ctl', textContent: '‹', ariaLabel: 'Previous step', onclick: () => go(-1) }),
      playBtn,
      h('button', { className: 'ctl', textContent: '›', ariaLabel: 'Next step', onclick: () => go(1) })),
    h('div', { className: 'opt' }, h('span', { className: 'label', textContent: 'Speed' }), group(SPEEDS, () => st.speed, (v) => (st.speed = v))),
    h('div', { className: 'opt' }, h('span', { className: 'label', textContent: 'Console' }), group(CONSOLES.map(([n], i) => [n, i]), () => st.con, (v) => (st.con = v))));
}

// The demo is only built and shown when the user asks for it.
function demoToggle(c) {
  const inner = h('div', { className: 'demo-inner' });
  const wrap = h('div', { className: 'demo-wrap' }, inner);
  wrap.inert = true;
  const btn = h('button', { className: 'ctl watch', textContent: '▶  Watch demo' });
  let built = false, open = false;
  btn.onclick = () => {
    open = !open;
    if (open && !built) { inner.append(demo(c)); built = true; }
    if (!open) stopDemo();
    wrap.inert = !open;
    wrap.classList.toggle('open', open);
    btn.textContent = open ? 'Hide demo' : '▶  Watch demo';
  };
  return h('div', {}, btn, wrap);
}

async function openDrawer(c) {
  stopDemo();
  const col = color(c.category);
  scene.setAccent(col);
  scene.pulse();

  const list = h('div', { className: 'comments' });
  const msg = h('p', { className: 'msg' });
  const author = h('input', { placeholder: 'Name (optional)', maxLength: 40 });
  const body = h('textarea', { placeholder: 'Share a tip…', maxLength: 1000, required: true });
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

  form.onsubmit = async (e) => {
    e.preventDefault();
    msg.textContent = '';
    try {
      const res = await api(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author: author.value, body: body.value, website: hp.value }),
      });
      body.value = '';
      if (res.status === 'pending approval') msg.textContent = 'Thanks! Your comment is awaiting approval.';
      else showComments(await api(path));
    } catch (err) {
      msg.textContent = err.message;
    }
  };

  const how = c.discovered
    ? h('div', { className: 'how' },
        h('p', { className: 'hint', textContent: 'Press Up on the D-pad to open your phone, then:' }),
        CONSOLES.map(([name, hold]) =>
          h('div', { className: 'console' },
            h('div', {}, h('b', { textContent: name }), h('span', { textContent: ` · Hold ${hold}, then` })),
            keys(c.input))),
        demoToggle(c))
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
  $('#drawer').classList.add('open');
  $('#backdrop').classList.add('open');
}

async function init() {
  let t;
  $('#q').oninput = (e) => {
    clearTimeout(t);
    t = setTimeout(() => { state.q = e.target.value; render(); }, 120);
  };
  $('#backdrop').onclick = closeDrawer;
  addEventListener('keydown', (e) => e.key === 'Escape' && closeDrawer());

  try {
    state.cheats = await api('/cheats');
    const found = state.cheats.filter((c) => c.discovered).length;
    $('#count').textContent = `${found} of ${state.cheats.length} discovered.`;
    drawFilters();
    render();
  } catch (e) {
    $('#grid').replaceChildren(
      h('p', { className: 'empty', textContent: `Could not reach the backend (${e.message}). Is it running on :8080?` })
    );
  }
}
init();
