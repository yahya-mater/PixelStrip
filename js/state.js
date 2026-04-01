// =============================================
// state.js — Central application state
// =============================================

export const state = {
  // Current active tool
  tool: 'pencil',

  // Colors
  fgColor: '#000000', //'#FFDD00',
  bgColor: '#ffffff',

  // Brush settings
  brushSize: 8,
  brushOpacity: 1.0,

  // Shape options
  shapeFilled: false,

  // Text
  fontSize: 28,

  // Canvas dimensions (logical, not display)
  canvasW: 0,
  canvasH: 0,

  // Zoom
  zoom: 1.0,

  // Whether an image is loaded
  imageLoaded: false,

  // Undo/redo stack
  undoStack: [],
  redoStack: [],
  MAX_UNDO: 30,

  // Drawing in progress flag
  isDrawing: false,
  // Fill tool tolerance (0-255)
  fillTolerance: 32,
  antiAlias: false,

  // Aspect ratio lock
  aspectLocked: true,
  aspectRatio: 1,

  // BG removal model
  modelReady: false,
  modelLoading: false,

  // JPG export quality
  jpgQuality: 1.00,
};

/** Push a snapshot of the canvas to the undo stack */
export function pushUndo(canvas) {
  const ctx = canvas.getContext('2d');
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  state.undoStack.push(data);
  if (state.undoStack.length > state.MAX_UNDO) {
    state.undoStack.shift();
  }
  // Clear redo stack on new action
  state.redoStack = [];
}

export function undo(canvas) {
  if (state.undoStack.length === 0) return false;
  const ctx = canvas.getContext('2d');
  // Save current state to redo
  state.redoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  const prev = state.undoStack.pop();
  ctx.putImageData(prev, 0, 0);
  return true;
}

export function redo(canvas) {
  if (state.redoStack.length === 0) return false;
  const ctx = canvas.getContext('2d');
  state.undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  const next = state.redoStack.pop();
  ctx.putImageData(next, 0, 0);
  return true;
}