// =============================================
// bgRemover.js — Background removal via Transformers.js
// Uses briaai/RMBG-1.4 model (ONNX, runs in browser)
// =============================================

import { state } from './state.js';
import { getCanvas, getCtx } from './canvas.js';
import { pushUndo } from './state.js';
import { showToast } from './ui.js';

let pipeline = null;
let AutoModel = null;
let AutoProcessor = null;
let env = null;
let RawImage = null;

const MODEL_ID = 'briaai/RMBG-1.4';

const statusEl    = document.getElementById('model-status');
const progressWrap = document.getElementById('progress-wrap');
const progressBar  = document.getElementById('progress-bar');

function setStatus(msg, cls = '') {
  statusEl.textContent = msg;
  statusEl.className = 'model-status ' + cls;
}

function setProgress(pct) {
  progressWrap.style.display = 'block';
  progressBar.style.width = pct + '%';
  if (pct >= 100) {
    setTimeout(() => { progressWrap.style.display = 'none'; }, 600);
  }
}

// ── Lazy-load Transformers.js ────────────────

async function loadTransformers() {
  if (AutoModel) return; // already loaded

  setStatus('Loading Transformers.js…', 'loading');

  const mod = await import(
    'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1/dist/transformers.min.js'
  );

  AutoModel     = mod.AutoModel;
  AutoProcessor = mod.AutoProcessor;
  env           = mod.env;
  RawImage      = mod.RawImage;

  // Use CDN ONNX runtime wasm files (avoid CORS issues)
  env.allowLocalModels = false;
  env.backends.onnx.wasm.proxy = false;
}

// ── Load the segmentation model ─────────────

export async function loadModel() {
  if (state.modelReady || state.modelLoading) return;
  state.modelLoading = true;

  try {
    await loadTransformers();
    setStatus('Downloading model (~40 MB)…', 'loading');
    setProgress(10);

    // Load model & processor from HuggingFace hub
    const [model, processor] = await Promise.all([
      AutoModel.from_pretrained(MODEL_ID, {
        device: 'wasm',
        dtype: 'fp32', // Add this to get the high-quality version
        progress_callback: (info) => {
          if (info.status === 'progress' && info.total) {
            const pct = Math.round((info.loaded / info.total) * 80) + 10;
            setProgress(pct);
            setStatus(`Downloading… ${Math.round(info.loaded / 1e6)}MB`, 'loading');
          }
        },
      }),
      AutoProcessor.from_pretrained(MODEL_ID),
    ]);

    pipeline = { model, processor };
    state.modelReady  = true;
    state.modelLoading = false;
    setProgress(100);
    setStatus('Model ready ✓', 'ready');
    showToast('Model loaded — ready to remove backgrounds!', 'success');

  } catch (err) {
    console.error('Model load error:', err);
    state.modelLoading = false;
    setStatus('Failed to load model', 'error');
    showToast('Model failed to load. Check console.', 'error');
  }
}

// ── Run background removal ───────────────────

export async function removeBackground() {
  const canvas = getCanvas();
  const ctx    = getCtx();

  if (!canvas || !state.imageLoaded) {
    showToast('Open an image first', 'error');
    return;
  }

  if (!state.modelReady) {
    showToast('Loading model, please wait…', 'info');
    await loadModel();
    if (!state.modelReady) return;
  }

  const btnRemove = document.getElementById('btn-remove-bg');
  btnRemove.classList.add('loading');
  btnRemove.textContent = '⏳ Processing…';
  btnRemove.disabled = true;

  setStatus('Running inference…', 'loading');
  setProgress(20);

  try {
    pushUndo(canvas);

    // Convert canvas to Blob → URL → RawImage
    const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
    const url  = URL.createObjectURL(blob);
    const rawImage = await RawImage.fromURL(url);
    URL.revokeObjectURL(url);

    setProgress(50);

    // Run model
    const { pixel_values } = await pipeline.processor(rawImage);
    const { output }       = await pipeline.model({ input: pixel_values });

    setProgress(80);

    // Post-process: resize mask to canvas size
    const maskData   = output[0].data; // Float32Array
    //const maskH      = output[0].dims[2];
    //const maskW      = output[0].dims[3];
    //const maskH      = Math.floor(Number(output[0].dims[2])); // Cast and floor
    //const maskW      = Math.floor(Number(output[0].dims[3])); // Cast and floor

    // Draw mask into a temp canvas then scale
    //const maskCanvas = document.createElement('canvas');
    //maskCanvas.width  = maskW;
    //maskCanvas.height = maskH;
    //const maskCtx = maskCanvas.getContext('2d');
    //const maskImgData = maskCtx.createImageData(maskW, maskH);


    // 1. Get the tensor from the output
    const maskTensor = output; // or output[0] if it's an array of tensors

    // 2. Extract dimensions safely
    // RMBG-1.4 usually returns [1, 1, H, W] or [1, H, W]
    const dims = maskTensor.dims;
    const maskH = Number(dims[dims.length - 2]); 
    const maskW = Number(dims[dims.length - 1]);

    // 3. Validate before creating image data
    if (!maskW || !maskH || isNaN(maskW) || isNaN(maskH)) {
        throw new Error(`Invalid mask dimensions: ${maskW}x${maskH}`);
    }

    const maskCanvas = document.createElement('canvas');
    maskCanvas.width  = maskW;
    maskCanvas.height = maskH;
    const maskCtx = maskCanvas.getContext('2d');

    // This line should now succeed
    const maskImgData = maskCtx.createImageData(maskW, maskH);



    for (let i = 0; i < maskData.length; i++) {
      const alpha = Math.round(maskData[i] * 255);
      maskImgData.data[i * 4]     = alpha;
      maskImgData.data[i * 4 + 1] = alpha;
      maskImgData.data[i * 4 + 2] = alpha;
      maskImgData.data[i * 4 + 3] = 255;
    }
    maskCtx.putImageData(maskImgData, 0, 0);

    // Scale mask to full canvas size
    const scaledMask = document.createElement('canvas');
    scaledMask.width  = canvas.width;
    scaledMask.height = canvas.height;
    scaledMask.getContext('2d').drawImage(maskCanvas, 0, 0, canvas.width, canvas.height);

    // Apply mask as alpha channel
    const imgData  = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const maskPixels = scaledMask.getContext('2d')
      .getImageData(0, 0, canvas.width, canvas.height).data;

    for (let i = 0; i < imgData.data.length; i += 4) {
      const maskVal = maskPixels[i]; // R channel of grayscale mask
      imgData.data[i + 3] = maskVal; // set alpha
    }

    ctx.putImageData(imgData, 0, 0);

    setProgress(100);
    setStatus('Background removed ✓', 'ready');
    showToast('Background removed!', 'success');

  } catch (err) {
    console.error('BG remove error:', err);
    setStatus('Error during inference', 'error');
    showToast('Background removal failed. See console.', 'error');
  } finally {
    btnRemove.classList.remove('loading');
    btnRemove.textContent = 'Remove Background';
    btnRemove.disabled = false;
  }
}