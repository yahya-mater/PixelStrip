// =============================================
// cursor.js — Custom brush size cursor circle
// =============================================

import { state } from './state.js';

const circle = document.getElementById('cursor-circle');
const wrapper = document.getElementById('canvas-wrapper');

let cursorX = 0, cursorY = 0;
let rafId = null;

function updateCircleStyle() {
  // Size in screen pixels = brush size * zoom
  const screenSize = state.brushSize * state.zoom;
  circle.style.width  = screenSize + 'px';
  circle.style.height = screenSize + 'px';
  circle.classList.toggle('eraser-mode', state.tool === 'eraser');
}

function moveCursor(x, y) {
  cursorX = x;
  cursorY = y;
  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    circle.style.transform = `translate(calc(${cursorX}px - 50%), calc(${cursorY}px - 50%))`;
    rafId = null;
  });
}

export function initCursor() {
  // Follow mouse over the canvas wrapper
  wrapper.addEventListener('pointermove', e => {
    moveCursor(e.clientX, e.clientY);
    updateCircleStyle();
    if (state.tool === 'zoom') circle.classList.remove('visible');
  });

  // Show on enter
  wrapper.addEventListener('pointerenter', e => {
    updateCircleStyle();
    moveCursor(e.clientX, e.clientY);
    // Don't show brush circle for zoom tool — it has its own overlay cursor
    if (state.tool !== 'zoom') circle.classList.add('visible');
  });

  // Hide on leave
  wrapper.addEventListener('pointerleave', () => {
    circle.classList.remove('visible');
  });

  // Re-render whenever brush size or zoom changes
  // so the circle updates immediately without moving the mouse
  const brushSlider = document.getElementById('brush-size');
  brushSlider.addEventListener('input', () => {
    updateCircleStyle();
  });
}

// Call this from setActiveTool so circle updates on tool switch
export function refreshCursor() {
  updateCircleStyle();
}