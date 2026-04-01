// =============================================
// resizer.js — Draggable panel resize handles
// =============================================

const STORAGE_KEY_LEFT  = 'pixelstrip-left-w';
const STORAGE_KEY_RIGHT = 'pixelstrip-right-w';

const MIN_W = 44;
const MAX_LEFT  = 320;
const MAX_RIGHT = 420;

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

function setGridWidths(leftW, rightW) {
  const body = document.querySelector('.app-body');
  body.style.setProperty('--left-w',  leftW  + 'px');
  body.style.setProperty('--right-w', rightW + 'px');
}

function getGridWidths() {
  const body   = document.querySelector('.app-body');
  const style  = getComputedStyle(body);
  const cols   = style.gridTemplateColumns.split(' ');
  // cols = [leftW, 4px, 1fr, 4px, rightW]
  return {
    leftW:  parseFloat(cols[0]),
    rightW: parseFloat(cols[4]),
  };
}

function saveWidths(leftW, rightW) {
  try {
    localStorage.setItem(STORAGE_KEY_LEFT,  leftW);
    localStorage.setItem(STORAGE_KEY_RIGHT, rightW);
  } catch (_) {}
}

function loadWidths() {
  try {
    const l = parseFloat(localStorage.getItem(STORAGE_KEY_LEFT));
    const r = parseFloat(localStorage.getItem(STORAGE_KEY_RIGHT));
    if (!isNaN(l) && !isNaN(r)) setGridWidths(l, r);
  } catch (_) {}
}

function initHandle(handleEl, side) {
  let dragging  = false;
  let startX    = 0;
  let startW    = 0;

  handleEl.addEventListener('pointerdown', e => {
    dragging = true;
    startX   = e.clientX;
    const widths = getGridWidths();
    startW = side === 'left' ? widths.leftW : widths.rightW;
    handleEl.setPointerCapture(e.pointerId);
    handleEl.classList.add('dragging');
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  });

  handleEl.addEventListener('pointermove', e => {
    if (!dragging) return;
    const delta = e.clientX - startX;
    const widths = getGridWidths();

    if (side === 'left') {
      const newW = clamp(startW + delta, MIN_W, MAX_LEFT);
      setGridWidths(newW, widths.rightW);
    } else {
      // Right panel: drag left = wider, drag right = narrower
      const newW = clamp(startW - delta, MIN_W, MAX_RIGHT);
      setGridWidths(widths.leftW, newW);
    }
  });

  const stopDrag = () => {
    if (!dragging) return;
    dragging = false;
    handleEl.classList.remove('dragging');
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    const widths = getGridWidths();
    saveWidths(widths.leftW, widths.rightW);
  };

  handleEl.addEventListener('pointerup',    stopDrag);
  handleEl.addEventListener('pointercancel', stopDrag);

  // Double-click to collapse / restore
  let lastW = side === 'left' ? 56 : 220;

  handleEl.addEventListener('dblclick', () => {
    const widths = getGridWidths();
    const cur    = side === 'left' ? widths.leftW : widths.rightW;

    if (cur > MIN_W + 4) {
      // Collapse
      lastW = cur;
      if (side === 'left') setGridWidths(MIN_W, widths.rightW);
      else                  setGridWidths(widths.leftW, MIN_W);
    } else {
      // Restore
      if (side === 'left') setGridWidths(lastW, widths.rightW);
      else                  setGridWidths(widths.leftW, lastW);
    }

    const w = getGridWidths();
    saveWidths(w.leftW, w.rightW);
  });
}

export function initResizers() {
  loadWidths();
  const handleLeft  = document.getElementById('handle-left');
  const handleRight = document.getElementById('handle-right');
  if (handleLeft)  initHandle(handleLeft,  'left');
  if (handleRight) initHandle(handleRight, 'right');
}