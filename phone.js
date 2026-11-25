/* =====================================================================
   PINSPO  -  phone.js   (the phone version, used by phone.html)
   A copy of script.js changed for touch screens. The desktop version
   still uses script.js.

   TABLE OF CONTENTS
    1. Setup ........................ page pieces and settings
    2. Sounds ....................... sounds made in code
    3. Adding things to the board ... items, images, text
    4. Select / edit / delete ....... tapping, typing
    5. Move / resize / rotate / flip  dragging items with a finger
    6. Pencil jar text panel ........ font, colors, "Add to board"
    7. Upload ....................... add your own pictures
    8. Save as PNG .................. download your board
    9. Edit board (candle) .......... layers list + clear board
   10. Calendar ..................... adds a date
   11. Shelf animations ............. sticky note, polaroid, jar, calendar
   12. Shelf buttons (actions) ...... what each shelf tile does
   13. Tapping the shelf ............ plays the animation, then the action
   14. Intro screen
   15. Autosave ..................... keeps your board between visits
   ===================================================================== */


/* =====================================================================
   1. SETUP
   ===================================================================== */
const stage = document.getElementById('stage');
const board = document.getElementById('board');

let selected = null;            // the item that is currently selected
let currentFont = 'Caveat';     // font for new text
let currentColor = '#3a2c20';   // color for new text
let drag = null;                // what is being dragged right now
let restoring = false;          // true while the saved board is being put back

const showPage = () => document.documentElement.classList.add('ready');
window.addEventListener('load', showPage);
setTimeout(showPage, 3000);


/* =====================================================================
   2. SOUNDS  (made in code, no sound files needed)
   ===================================================================== */
let soundOn = localStorage.getItem('pinspoSound') !== 'off';
const MASTER_VOLUME = 1.5;
let ac = null;
let master = null;

function audioCtx() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = MASTER_VOLUME;
    master.connect(ac.destination);
  }
  return ac;
}

// Phones keep sound off until a person taps. This wakes it up on the first tap.
function unlockAudio() {
  const c = audioCtx();
  if (!c || c.state === 'running') return;
  c.resume();
  const b = c.createBuffer(1, 1, 22050), s = c.createBufferSource();
  s.buffer = b; s.connect(c.destination); s.start(0);
}
['pointerdown', 'touchend', 'keydown', 'click'].forEach(ev =>
  document.addEventListener(ev, unlockAudio, { capture: true }));

function noise(dur, lo, hi, vol, delay = 0) {
  const c = audioCtx(), t = c.currentTime + delay, n = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = buf;
  f.type = 'bandpass'; f.Q.value = 0.9;
  f.frequency.setValueAtTime(lo, t);
  f.frequency.exponentialRampToValueAtTime(hi, t + dur);
  const atk = Math.min(0.012, dur / 3);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t);
}

const TOUCH = (delay = 0) => {
  noise(0.07, 2600, 1500, 0.20, delay);
  noise(0.04, 3800, 2200, 0.08, delay + 0.012);
};

const SOUNDS = {
  click:  () => TOUCH(),
  close:  () => TOUCH(),
  add:    () => TOUCH(0.12),
  remove: () => TOUCH(),
  clear:  () => TOUCH(),
  save:   () => TOUCH(),
  flip:   () => TOUCH()
};

function play(name) {
  if (!soundOn || !SOUNDS[name]) return;
  try {
    const c = audioCtx();
    if (!c) return;
    if (c.state === 'suspended') { c.resume().then(() => SOUNDS[name]()).catch(() => {}); return; }
    SOUNDS[name]();
  } catch (err) { console.warn('Sound problem:', err); }
}


/* =====================================================================
   3. ADDING THINGS TO THE BOARD
   The number in each call is the size, as a % of the board's width.
   ===================================================================== */
function addItem(content, widthPct, isText) {
  const item = document.createElement('div');
  item.className = 'item';
  item.style.width = widthPct + '%';
  item.style.left = (20 + Math.random() * 35) + '%';
  item.style.top = (15 + Math.random() * 35) + '%';
  item.appendChild(content);
  item.insertAdjacentHTML('beforeend',
    '<span class="handle"></span><span class="del">×</span><span class="rot"></span>');
  if (isText) { item.dataset.text = '1'; sizeText(item); }
  board.appendChild(item);
  if (!restoring) { play('add'); select(item); }
  return item;
}

function sizeText(item) {   // text grows and shrinks with its box
  item.style.fontSize = (parseFloat(item.style.width) * 0.19) + 'cqw';
}

function addImage(src, widthPct) {
  const img = document.createElement('img');
  img.src = src;
  img.draggable = false;
  return addItem(img, widthPct, false);
}

function addText(words, font = currentFont, color = currentColor) {
  const t = document.createElement('div');
  t.className = 'text';
  t.textContent = words;
  t.style.fontFamily = font;
  t.style.color = color;
  return addItem(t, 30, true);
}


/* =====================================================================
   4. SELECT, EDIT, DELETE
   Tap an item to select it. Tap a selected text item again to type in it.
   ===================================================================== */
function select(item) {
  const editing = board.querySelector('[contenteditable="true"]');
  if (editing && !(item && item.contains(editing))) editing.blur();
  if (selected) selected.classList.remove('selected');
  selected = item;
  if (item) item.classList.add('selected');
  if (layersOpen()) renderLayers();
}

function edit(t) {   // let someone type in a text box
  t.contentEditable = 'true';
  t.focus();
  document.getSelection().selectAllChildren(t);
}

board.addEventListener('dblclick', e => {
  const t = e.target.closest('.text');
  if (t) edit(t);
});

board.addEventListener('focusout', e => {
  if (e.target.classList && e.target.classList.contains('text')) e.target.contentEditable = 'false';
});


/* =====================================================================
   5. MOVE, RESIZE, ROTATE, FLIP  (one finger at a time)
   ===================================================================== */
board.addEventListener('pointerdown', e => {
  if (drag) return;                                    // ignore a second finger
  const item = e.target.closest('.item');
  if (!item) { select(null); return; }
  if (e.target.closest('[contenteditable="true"]')) return;   // let people type
  const wasSelected = item === selected;
  select(item);
  if (e.target.classList.contains('del')) { play('remove'); item.remove(); selected = null; return; }

  const b = board.getBoundingClientRect();
  const r = item.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  drag = {
    item, b, cx, cy, wasSelected,
    id: e.pointerId,
    rotate: e.target.classList.contains('rot'),
    resize: e.target.classList.contains('handle'),
    x: e.clientX, y: e.clientY,
    left: parseFloat(item.style.left), top: parseFloat(item.style.top),
    wPx: item.offsetWidth,
    rot: parseFloat(item.style.rotate) || 0,
    a0: Math.atan2(e.clientY - cy, e.clientX - cx),
    moved: 0
  };
  e.preventDefault();
});

document.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  drag.moved = Math.max(drag.moved, Math.abs(dx) + Math.abs(dy));
  if (drag.rotate) {
    let deg = drag.rot + (Math.atan2(e.clientY - drag.cy, e.clientX - drag.cx) - drag.a0) * 180 / Math.PI;
    const near = Math.round(deg / 90) * 90;
    if (Math.abs(deg - near) < 4) deg = near;          // gently snaps to straight
    drag.item.style.rotate = deg + 'deg';
  } else if (drag.resize) {
    const a = drag.rot * Math.PI / 180;
    const along = dx * Math.cos(a) + dy * Math.sin(a);  // follows the item's own direction
    const w = Math.max(4, (drag.wPx + along) / drag.b.width * 100);
    drag.item.style.width = w + '%';
    if (drag.item.dataset.text) sizeText(drag.item);
  } else {
    drag.item.style.left = (drag.left + dx / drag.b.width * 100) + '%';
    drag.item.style.top = (drag.top + dy / drag.b.height * 100) + '%';
  }
});

function endDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const tap = e.type === 'pointerup' && !drag.rotate && !drag.resize && drag.moved < 8;
  if (tap && drag.item.classList.contains('flippable')) {        // tap the pin to flip it
    drag.item.classList.toggle('flipped');
    play('flip');
  } else if (tap && drag.wasSelected && drag.item.dataset.text) { // second tap on text = type
    edit(drag.item.querySelector('.text'));
  }
  drag = null;
}
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);


/* =====================================================================
   6. PENCIL JAR TEXT PANEL  (opens at the bottom of the screen)
   The same panel also edits a text that's already on the board: press
   ✎ next to it in Edit board. Changes show right away; "Save changes"
   keeps them and ✕ puts the text back the way it was.
   ===================================================================== */
const panel = document.getElementById('panel');
const panelText = document.getElementById('panelText');
const panelTitle = document.getElementById('panelTitle');
const fontSelect = document.getElementById('fontSelect');
const addBtn = document.getElementById('addText');
let editing = null;   // { item, text, font, color, fromLayers } while a board text is being edited

function showPanel() {
  layersBox.style.display = 'none';
  applyBoxSize(panel);
  panel.style.display = 'block';
}

function closePanel(keep) {
  let backToLayers = false;
  if (editing) {
    const t = editing.item.querySelector('.text');
    if (!keep) {                                       // ✕ = undo the changes
      t.textContent = editing.text;
      t.style.fontFamily = editing.font;
      t.style.color = editing.color;
    } else if (!t.textContent.trim()) {
      t.textContent = editing.text;                    // never leave an empty text
    }
    backToLayers = editing.fromLayers && editing.item.isConnected;
    editing = null;
    panelTitle.textContent = 'Add text';
    addBtn.textContent = 'Add to board';
    panelText.value = '';
    fontSelect.value = currentFont;                    // back to the settings for new text
    panelText.style.fontFamily = currentFont;
    markColor(currentColor);
  }
  panelText.blur();
  panel.style.display = 'none';
  if (backToLayers) toggleLayers();                    // go back to Edit board
}

function editText(item) {   // open the panel to change a text on the board
  if (editing && editing.item !== item) closePanel(true);
  const t = item.querySelector('.text');
  editing = { item, text: t.innerText, font: t.style.fontFamily, color: t.style.color, fromLayers: layersOpen() };
  select(item);
  const font = (t.style.fontFamily || currentFont).replace(/["']/g, '');
  fontSelect.value = font;
  panelText.style.fontFamily = font;
  panelText.value = editing.text;
  markColor(t.style.color || currentColor);
  panelTitle.textContent = 'Edit text';
  addBtn.textContent = 'Save changes';
  showPanel();
}

// The text that color and font changes go to: the one being edited, or the selected one
function textTarget() {
  if (editing) return editing.item.querySelector('.text');
  return selected && selected.dataset.text ? selected.querySelector('.text') : null;
}

document.getElementById('panelClose').onclick = () => { play('close'); closePanel(false); };

// The text box (while editing, typing changes the board text right away)
panelText.style.color = currentColor;
panelText.style.fontFamily = currentFont;
panelText.addEventListener('input', () => {
  if (editing) editing.item.querySelector('.text').textContent = panelText.value;
});

// The color circles (change the list to change the colors).
// The last, rainbow circle opens a picker for any color.
const SWATCHES = ['#3a2c20', '#c0392b', '#e67e22', '#d4a017', '#4f8a4b', '#2f7ea1', '#7b4fa0', '#e07aa0', '#ffffff'];
const swatchBox = document.getElementById('swatches');
SWATCHES.forEach(c => {
  const s = document.createElement('span');
  s.className = 'sw';
  s.dataset.c = c;
  s.style.background = c;
  s.onclick = () => pickColor(c);
  swatchBox.appendChild(s);
});
const customSw = document.createElement('label');
customSw.className = 'sw custom';
customSw.innerHTML = '<input type="color" aria-label="Pick any color">';
const colorInput = customSw.querySelector('input');
colorInput.addEventListener('input', () => pickColor(colorInput.value));
swatchBox.appendChild(customSw);

function colorKey(c) {   // turns "#c0392b" and "rgb(192, 57, 43)" into the same thing
  const d = document.createElement('div');
  d.style.color = c;
  return d.style.color;
}
function toHex(c) {
  const m = colorKey(c).match(/\d+/g);
  return m ? '#' + m.slice(0, 3).map(n => (+n).toString(16).padStart(2, '0')).join('') : '#3a2c20';
}
function markColor(c) {   // highlights the matching circle
  const key = colorKey(c);
  let found = false;
  swatchBox.querySelectorAll('.sw[data-c]').forEach(s => {
    const on = colorKey(s.dataset.c) === key;
    s.classList.toggle('on', on);
    if (on) found = true;
  });
  customSw.classList.toggle('on', !found);
  colorInput.value = toHex(c);
  panelText.style.color = c;
}
function pickColor(c) {
  markColor(c);
  if (!editing) currentColor = c;
  const t = textTarget();
  if (t) t.style.color = c;
}
markColor(currentColor);

// The font list
fontSelect.onchange = e => {
  const f = e.target.value;
  panelText.style.fontFamily = f;
  if (!editing) currentFont = f;
  const t = textTarget();
  if (t) t.style.fontFamily = f;
};

// "Add to board" button (it says "Save changes" while editing)
addBtn.onclick = () => {
  if (editing) { play('close'); closePanel(true); return; }
  addText(panelText.value.trim() || 'Your text');
  panelText.value = '';
  closePanel(true);
};

function togglePanel() {
  if (panel.style.display === 'block') closePanel(true);
  else showPanel();
}


/* =====================================================================
   7. UPLOAD  (add your own pictures)
   Photos are made smaller first so they fit in the autosave.
   ===================================================================== */
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = 'image/*';
fileInput.onchange = async e => {
  const f = e.target.files[0];
  fileInput.value = '';
  if (!f) return;
  try { addImage(await shrinkImage(f), 25); }
  catch (err) { toast('Sorry, that picture could not be opened.', 3000); }
};

function shrinkImage(file) {
  const keepClear = /png|gif|webp/.test(file.type);   // keep see-through parts
  const max = keepClear ? 900 : 1200;                  // longest side, in pixels
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k);
      c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      res(c.toDataURL(keepClear ? 'image/png' : 'image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('bad image')); };
    img.src = url;
  });
}


/* =====================================================================
   8. SAVE AS PNG
   ===================================================================== */
// Where the cork sits inside background.png (the same numbers as #board in style.css)
const CORK = { x: 0.04, y: 0.114, w: 0.677, h: 0.772 };

function toast(msg, ms) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.style.opacity = 1;
  clearTimeout(t._h);
  if (ms) t._h = setTimeout(() => { t.style.opacity = 0; }, ms);
}

function loadImg(path) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = path; });
}

function showSaved(url) {
  const old = document.getElementById('saveBox');
  if (old) old.remove();
  const box = document.createElement('div');
  box.id = 'saveBox';
  box.innerHTML = '<img src="' + url + '"><p>Or press and hold the picture to save it to your photos.</p>' +
    '<div><a download="my-pinspo-board.png" href="' + url + '">Download</a><button type="button">Close</button></div>';
  box.querySelector('button').onclick = () => box.remove();
  document.body.appendChild(box);
}

async function savePNG() {
  if (typeof html2canvas === 'undefined') { toast('Saving needs an internet connection.', 3500); return; }
  toast('Saving your board…');
  select(null);
  document.body.classList.add('exporting');
  const items = [...board.querySelectorAll('.item')];
  const keep = items.map(it => ({ it, fs: it.style.fontSize, rot: it.style.rotate, tf: it.style.transform }));
  items.forEach(it => {
    if (it.dataset.text) it.style.fontSize = getComputedStyle(it).fontSize;
    if (it.style.rotate) { it.style.transform = 'rotate(' + it.style.rotate + ')'; it.style.rotate = 'none'; }
  });
  try {
    const bgImg = await loadImg('images/background.png');
    const b = board.getBoundingClientRect();
    const shot = await html2canvas(board, { backgroundColor: null, scale: Math.max(2, 1600 / b.width), logging: false });
    const out = document.createElement('canvas');
    out.width = shot.width; out.height = shot.height;
    const g = out.getContext('2d');
    const W = bgImg.naturalWidth, H = bgImg.naturalHeight;
    g.drawImage(bgImg, CORK.x * W, CORK.y * H, CORK.w * W, CORK.h * H, 0, 0, out.width, out.height);
    g.drawImage(shot, 0, 0);
    out.toBlob(blob => { play('save'); toast('Saved!', 1500); showSaved(URL.createObjectURL(blob)); }, 'image/png');
  } catch (err) {
    console.error(err);
    toast('Sorry, saving did not work.', 4000);
  } finally {
    document.body.classList.remove('exporting');
    keep.forEach(o => { o.it.style.fontSize = o.fs; o.it.style.rotate = o.rot; o.it.style.transform = o.tf; });
  }
}


/* =====================================================================
   9. EDIT BOARD  (opened by the candle: layers list + clear board)
   ===================================================================== */
const layersBox = document.getElementById('layersBox');
const layerList = document.getElementById('layerList');
const layersOpen = () => layersBox.style.display === 'block';

function itemName(it) {
  if (it.dataset.text) return '“' + it.querySelector('.text').textContent.trim().slice(0, 16) + '”';
  const img = it.querySelector('img');
  const s = img ? img.getAttribute('src') : '';
  if (s.startsWith('data:')) return 'My picture';
  return s ? s.split('/').pop().replace(/\.\w+$/, '') : 'Item';
}

// Each row: ✎ edit (texts only), ⧉ duplicate, ▲ move up, ▼ move down
function renderLayers() {
  const items = [...board.querySelectorAll('.item')];
  layerList.innerHTML = '';
  if (!items.length) { layerList.innerHTML = '<p class="empty">The board is empty.</p>'; return; }
  items.slice().reverse().forEach(it => {
    const row = document.createElement('div');
    row.className = 'lrow' + (it === selected ? ' on' : '');
    row.innerHTML = '<b>' + (items.indexOf(it) + 1) + '</b><span></span>' +
      (it.dataset.text ? '<button type="button" data-a="edit" aria-label="Edit text and color">✎</button>' : '') +
      '<button type="button" data-a="dup" aria-label="Duplicate">⧉</button>' +
      '<button type="button" data-a="up" aria-label="Move up">▲</button>' +
      '<button type="button" data-a="down" aria-label="Move down">▼</button>';
    row.querySelector('span').textContent = itemName(it);
    row.onclick = e => {
      const a = e.target.dataset.a;
      if (a === 'edit') { editText(it); return; }
      if (a === 'dup') { duplicate(it); return; }
      if (a === 'up' && it.nextElementSibling) it.nextElementSibling.after(it);
      if (a === 'down' && it.previousElementSibling) it.previousElementSibling.before(it);
      select(it);
    };
    layerList.appendChild(row);
  });
}

function duplicate(it) {   // a copy lands a little down and to the right, just in front
  const copy = it.cloneNode(true);
  copy.classList.remove('selected');
  const t = copy.querySelector('.text');
  if (t) t.contentEditable = 'false';
  copy.style.left = (parseFloat(it.style.left) + 3) + '%';
  copy.style.top = (parseFloat(it.style.top) + 3) + '%';
  it.after(copy);
  play('add');
  select(copy);
}

function toggleLayers() {
  if (panel.style.display === 'block') closePanel(true);
  layersBox.style.display = layersOpen() ? 'none' : 'block';
  if (layersOpen()) { applyBoxSize(layersBox); renderLayers(); }
}

document.getElementById('layersClose').onclick = () => { play('close'); layersBox.style.display = 'none'; };

document.getElementById('clearBoard').onclick = () => {
  if (!confirm('Clear the entire board?')) return;
  play('clear');
  board.querySelectorAll('.item').forEach(i => i.remove());
  selected = null;
};

new MutationObserver(() => {
  if (editing && !editing.item.isConnected) closePanel(true);   // the text being edited was deleted
  if (layersOpen()) renderLayers();
}).observe(board, { childList: true });


/* ---- Box size (A− / A+ in the text panel and in Edit board) ----
   Each sheet remembers its own size, from 80% to 140%. */
const BOX_MIN = 0.8, BOX_MAX = 1.4, BOX_STEP = 0.1;

function boxSize(box) {
  let v = 1;
  try { v = parseFloat(localStorage.getItem('pinspoSize-' + box.id)) || 1; } catch (err) {}
  return Math.min(BOX_MAX, Math.max(BOX_MIN, v));
}
function applyBoxSize(box) { box.style.setProperty('--size', boxSize(box)); }

document.querySelectorAll('.sizer button').forEach(b => b.addEventListener('click', () => {
  const box = b.closest('#panel, #layersBox');
  const size = Math.round((boxSize(box) + BOX_STEP * b.dataset.size) * 10) / 10;
  try { localStorage.setItem('pinspoSize-' + box.id, Math.min(BOX_MAX, Math.max(BOX_MIN, size))); } catch (err) {}
  applyBoxSize(box);
}));


/* =====================================================================
   10. CALENDAR  (adds a text box with today's date)
   ===================================================================== */
function openDatePicker() {
  addText(new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }));
}


/* =====================================================================
   11. SHELF ANIMATIONS
   Each one swaps the picture's frames. Folders:
   images/note, images/jar, images/peek
   On phones the "hover" class is added for a moment when a tile is tapped.
   ===================================================================== */

/* ---- Sticky note: crumples, then lands on the board ---- */
const noteEl = document.getElementById('stickynote');
const noteFrames = [1, 2, 3, 4, 5].map(n => 'images/note/note-0' + n + '.png');
noteFrames.forEach(f => { new Image().src = f; });
let noteBusy = false;
function crumpleNote() {
  if (noteBusy) return;
  noteBusy = true;
  let i = 0;
  const timer = setInterval(() => {
    noteEl.src = noteFrames[i];
    i++;
    if (i === noteFrames.length) {
      clearInterval(timer);
      setTimeout(() => {
        addImage(noteFrames[0], 35);
        noteEl.src = noteFrames[0];
        noteBusy = false;
      }, 400);
    }
  }, 150);
}

/* ---- Polaroid: sways ---- */
const polaEl = document.getElementById('poloroid');
new MutationObserver(() => {
  if (polaEl.classList.contains('hover') && !polaEl.classList.contains('swing')) polaEl.classList.add('swing');
}).observe(polaEl, { attributes: true, attributeFilter: ['class'] });
polaEl.addEventListener('animationiteration', () => {
  if (!polaEl.classList.contains('hover')) polaEl.classList.remove('swing');
});

/* ---- Pencil jar: wiggles ---- */
const jarEl = document.getElementById('penciljar');
const jarFrames = Array.from({ length: 39 }, (_, i) => 'images/jar/jar-' + String(i + 1).padStart(2, '0') + '.png');
jarFrames.forEach(f => { new Image().src = f; });
let jarIdx = 0, jarTimer = null;
function jarTick() {
  jarIdx = (jarIdx + 1) % jarFrames.length;
  jarEl.src = jarFrames[jarIdx];
  if (jarIdx === 0 && !jarEl.classList.contains('hover')) { clearInterval(jarTimer); jarTimer = null; }
}
new MutationObserver(() => {
  if (jarEl.classList.contains('hover') && !jarTimer) jarTimer = setInterval(jarTick, 100);
}).observe(jarEl, { attributes: true, attributeFilter: ['class'] });

/* ---- Calendar: the page corner lifts, then lowers ---- */
const calEl = document.getElementById('shelfcalendar');
const calFrames = [1, 2, 3, 4, 5].map(n => 'images/peek/peek-0' + n + '.png');
calFrames.forEach(f => { new Image().src = f; });
let calIdx = 0, calTimer = null;
function calGo(target) {
  clearInterval(calTimer);
  calTimer = setInterval(() => {
    if (calIdx === target) { clearInterval(calTimer); return; }
    calIdx += calIdx < target ? 1 : -1;
    calEl.src = calFrames[calIdx];
  }, 70);
}
new MutationObserver(() => calGo(calEl.classList.contains('hover') ? 4 : 0))
  .observe(calEl, { attributes: true, attributeFilter: ['class'] });


/* =====================================================================
   12. SHELF BUTTONS
   What happens when you tap each shelf tile. The number is the size on
   the board (% of the board's width).
   ===================================================================== */
const src = id => document.getElementById(id).getAttribute('src');

const actions = {
  penciljar:     togglePanel,
  books:         () => addImage('images/paper.png', 29),
  stickynote:    crumpleNote,
  pin:           () => addImage(src('pin'), 20).classList.add('flippable'),
  butterfly:     () => addImage(src('butterfly'), 20),
  flower:        () => addImage(src('flower'), 24),
  shelfcalendar: openDatePicker,
  poloroid:      () => addImage('images/emptypolaroid.png', 30),
  upload:        () => fileInput.click(),
  saveto:        savePNG,
  candel:        toggleLayers
};


/* =====================================================================
   13. TAPPING THE SHELF
   A tap plays the item's little animation (what hover does on desktop)
   and then runs its action. Swiping the row to scroll does not count as a tap.
   To change how long the animation plays, change TAP_ANIMATION_MS.
   ===================================================================== */
const TAP_ANIMATION_MS = 1200;
const tapTimers = new Map();

function shelfTap(e) {
  const tile = e.target.closest('.tile, .tool');
  if (!tile) return;
  const img = tile.querySelector('.shelf');
  play('click');
  img.classList.add('hover');
  tile.classList.add('tapped');
  clearTimeout(tapTimers.get(img));
  tapTimers.set(img, setTimeout(() => { img.classList.remove('hover'); tile.classList.remove('tapped'); }, TAP_ANIMATION_MS));
  if (actions[img.id]) actions[img.id]();
}
document.getElementById('shelfRow').addEventListener('click', shelfTap);
document.getElementById('toolRow').addEventListener('click', shelfTap);


/* =====================================================================
   14. INTRO SCREEN  (tap to skip, or it fades by itself)
   ===================================================================== */
const intro = document.getElementById('intro');
if (intro) {
  intro.style.pointerEvents = 'auto';
  intro.addEventListener('click', () => intro.remove());
  setTimeout(() => intro.remove(), 5400);
}


/* =====================================================================
   15. AUTOSAVE
   The board is saved in this browser after every change and put back
   when the page opens. The phone and desktop versions share the same
   saved board.
   ===================================================================== */
const SAVE_KEY = 'pinspoBoard';
let saveTimer = null, saveWarned = false;

function boardData() {
  return [...board.querySelectorAll('.item')].map(it => {
    const d = { left: it.style.left, top: it.style.top, width: it.style.width, rotate: it.style.rotate || '' };
    if (it.dataset.text) {
      const t = it.querySelector('.text');
      d.text = t.innerText;
      d.font = t.style.fontFamily;
      d.color = t.style.color;
    } else {
      d.src = it.querySelector('img').getAttribute('src');
      if (it.classList.contains('flippable')) d.flippable = 1;
      if (it.classList.contains('flipped')) d.flipped = 1;
    }
    return d;
  });
}

function saveBoard() {
  clearTimeout(saveTimer);
  if (restoring || document.body.classList.contains('exporting')) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, items: boardData() }));
    saveWarned = false;
  } catch (err) {
    if (!saveWarned) { saveWarned = true; toast('Board too full to autosave. Try removing a photo.', 4000); }
  }
}
const saveSoon = () => { clearTimeout(saveTimer); saveTimer = setTimeout(saveBoard, 300); };

function restoreBoard() {
  let data = null;
  try { data = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (err) { return; }
  if (!data || !Array.isArray(data.items)) return;
  restoring = true;
  data.items.forEach(d => {
    try {
      let item;
      if (d.text != null) item = addText(d.text, d.font, d.color);
      else if (d.src && !d.src.startsWith('blob:')) item = addImage(d.src, 20);
      else return;
      item.style.left = d.left; item.style.top = d.top; item.style.width = d.width;
      if (d.rotate) item.style.rotate = d.rotate;
      if (d.text != null) sizeText(item);
      if (d.flippable) item.classList.add('flippable');
      if (d.flipped) item.classList.add('flipped');
    } catch (err) { console.warn('Could not restore an item:', err); }
  });
  restoring = false;
}

restoreBoard();
new MutationObserver(saveSoon).observe(board,
  { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['style', 'class'] });
window.addEventListener('pagehide', saveBoard);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveBoard(); });
