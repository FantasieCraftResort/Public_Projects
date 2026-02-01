
(() => {
  const tableBody = document.querySelector('#points-table tbody');
  const addName = document.getElementById('add-name');
  const addX = document.getElementById('add-x');
  const addY = document.getElementById('add-y');
  const addBtn = document.getElementById('add-btn');

  const canvas = document.getElementById('plot');
  const wrapper = document.getElementById('plot-wrapper');
  const ctx = canvas.getContext('2d');

  // --- Fullscreen controls ---
  const fsBtn = document.getElementById('fs-btn');

  // --- Overlay controls ---
  const imgInput = document.getElementById('imgFile');
  const imgWidthUnitsInput = document.getElementById('imgWidthUnits');
  const imgOpacityPercentInput = document.getElementById('imgOpacityPercent');
  const imgOffsetXInput = document.getElementById('imgOffsetX');
  const imgOffsetYInput = document.getElementById('imgOffsetY');
  const clearImageBtn = document.getElementById('clearImage');

  // --- Audio analysis controls ---
  const audioFileInput = document.getElementById('audioFile');
  const analyzeBtn = document.getElementById('analyzeBtn');
  const clearTimelineBtn = document.getElementById('clearTimelineBtn');
  const winMsInput = document.getElementById('winMs');
  const hopMsInput = document.getElementById('hopMs');
  const thrDbInput = document.getElementById('thrDb');
  const minGapInput = document.getElementById('minGap');

  const timelineCanvas = document.getElementById('timeline');
  const timelineWrapper = document.getElementById('timeline-wrapper');
  const timelineCtx = timelineCanvas.getContext('2d');
  const timelineMeta = document.getElementById('timeline-meta');

  /** @type {{name:string, x:number, y:number}[]} */
  let points = [];

  /** @type {HTMLImageElement|null} */
  let overlayImg = null;
  let overlayImgNatural = { w: 0, h: 0 };

  // timeline state
  let timelineTicks = [];
  let timelineDuration = 0;

  // --- Helpers ---
  function isNonNegNumber(v) { return typeof v === 'number' && isFinite(v) && v >= 0; }
  function toNumber(el) { return parseFloat(el.value); }
  function sanitizeName(s) { return (s || '').trim(); }

  function normalizeNonNegNumberInput(el) {
    const v = toNumber(el);
    if (!isFinite(v)) return null;
    if (v < 0) { el.value = String(Math.abs(v)); return Math.abs(v); }
    return v;
  }
  function attachNumberGuards(el) { el.addEventListener('input', () => normalizeNonNegNumberInput(el)); }

  // --- Table rendering and editing ---
  function renderTable() {
    tableBody.innerHTML = '';

    if (points.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 4; td.textContent = 'No points yet. Add one below!'; td.style.color = '#868e96';
      tr.appendChild(td); tableBody.appendChild(tr); return;
    }

    points.forEach((p, idx) => {
      const tr = document.createElement('tr');

      const nameTd = document.createElement('td');
      const nameInp = document.createElement('input');
      nameInp.type = 'text'; nameInp.maxLength = 50; nameInp.value = p.name; nameInp.placeholder = 'Name';
      nameInp.addEventListener('input', () => { p.name = sanitizeName(nameInp.value); draw(); });
      nameTd.appendChild(nameInp);

      const xTd = document.createElement('td');
      const xInp = document.createElement('input');
      xInp.type = 'number'; xInp.min = '0'; xInp.step = 'any'; xInp.value = String(p.x);
      attachNumberGuards(xInp);
      xInp.addEventListener('input', () => { const v = toNumber(xInp); if (isNonNegNumber(v)) { p.x = v; draw(); }});
      xTd.appendChild(xInp);

      const yTd = document.createElement('td');
      const yInp = document.createElement('input');
      yInp.type = 'number'; yInp.min = '0'; yInp.step = 'any'; yInp.value = String(p.y);
      attachNumberGuards(yInp);
      yInp.addEventListener('input', () => { const v = toNumber(yInp); if (isNonNegNumber(v)) { p.y = v; draw(); }});
      yTd.appendChild(yInp);

      const actionsTd = document.createElement('td');
      actionsTd.className = 'actions-col';

      const cloneBtn = document.createElement('button');
      cloneBtn.className = 'small'; cloneBtn.type = 'button'; cloneBtn.textContent = 'Clone';
      cloneBtn.addEventListener('click', () => {
        const copy = { ...p };
        points.splice(idx + 1, 0, copy);
        renderTable(); draw();
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'small secondary'; delBtn.type = 'button'; delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => { points.splice(idx, 1); renderTable(); draw(); });

      actionsTd.append(cloneBtn, document.createTextNode(' '), delBtn);
      tr.append(nameTd, xTd, yTd, actionsTd);
      tableBody.appendChild(tr);
    });
  }

  // --- Add new point (below table) ---
  [addX, addY].forEach(attachNumberGuards);
  addBtn.addEventListener('click', () => {
    const name = sanitizeName(addName.value); const x = toNumber(addX); const y = toNumber(addY);
    if (!name) { addName.classList.add('bad'); setTimeout(() => addName.classList.remove('bad'), 800); return; }
    if (!isNonNegNumber(x) || !isNonNegNumber(y)) {
      [addX, addY].forEach(el => { if (!isNonNegNumber(toNumber(el))) el.classList.add('bad'); });
      setTimeout(() => [addX, addY].forEach(el => el.classList.remove('bad')), 800); return;
    }
    points.push({ name, x, y }); addName.value = ''; addX.value = ''; addY.value = '';
    renderTable(); draw();
  });

  // --- Canvas sizing (normal & fullscreen) ---
  function isFullscreen() { return !!document.fullscreenElement; }

  function fitCanvasToContainer() {
    const dpr = window.devicePixelRatio || 1;

    let width, height;
    if (isFullscreen()) {
      width  = Math.max(300, window.innerWidth);
      height = Math.max(200, window.innerHeight);
    } else {
      const cardBody = wrapper.parentElement; // .card-body
      const rect = cardBody.getBoundingClientRect();
      width  = Math.max(300, rect.width);
      height = Math.round(width * 2 / 3); // stable 3:2 aspect
    }

    canvas.style.width  = width + 'px';
    canvas.style.height = height + 'px';
    canvas.width  = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }

  function logicalSize() {
    const dpr = window.devicePixelRatio || 1;
    return { w: canvas.width / dpr, h: canvas.height / dpr };
  }

  window.addEventListener('resize', () => { fitCanvasToContainer(); draw(); });

  fsBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) { wrapper.requestFullscreen?.(); }
    else { document.exitFullscreen?.(); }
  });

  document.addEventListener('fullscreenchange', () => {
    const isFs = !!document.fullscreenElement;
    wrapper.classList.toggle('fullscreen', isFs);
    fsBtn.textContent = isFs ? 'Exit full screen' : 'Full screen';
    requestAnimationFrame(() => { requestAnimationFrame(() => { fitCanvasToContainer(); draw(); }); });
  });

  // --- Plotting ---
  const MARGIN = { left: 60, right: 20, top: 20, bottom: 50 };

  function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function computeScale(maxX, maxY) {
    const { w: cssW, h: cssH } = logicalSize();
    const w = cssW - MARGIN.left - MARGIN.right;
    const h = cssH - MARGIN.top - MARGIN.bottom;

    const padX = maxX * 0.1;
    const padY = maxY * 0.1;

    const rangeX = Math.max(10, Math.ceil(maxX + padX));
    const rangeY = Math.max(10, Math.ceil(maxY + padY));

    const scale = Math.min(w / rangeX, h / rangeY);
    return { scale, rangeX, rangeY };
  }

  function drawAxes(maxX, maxY, scale, rangeX, rangeY) {
    const { w: cssW, h: cssH } = logicalSize();
    const left = MARGIN.left;
    const bottom = cssH - MARGIN.bottom;
    const right = cssW - MARGIN.right;
    const top = MARGIN.top;

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;

    ctx.beginPath(); ctx.moveTo(left, bottom); ctx.lineTo(right, bottom); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(left, bottom); ctx.lineTo(left, top); ctx.stroke();

    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = '#343a40';

    const w = cssW - MARGIN.left - MARGIN.right;
    const pxPerUnit = scale;
    const labelEvery = pxPerUnit >= 28 ? 1 : pxPerUnit >= 14 ? 2 : pxPerUnit >= 7 ? 5 : 10;
    const gridEvery  = pxPerUnit >= 12 ? 1 : pxPerUnit >= 6 ? 2 : 5;

    ctx.lineWidth = 1;
    for (let x = 1; x <= rangeX; x += 1) {
      const sx = left + x * scale;
      if (sx > left + w) break;
      if (x % gridEvery === 0) { ctx.strokeStyle = '#e9ecef'; ctx.beginPath(); ctx.moveTo(sx, bottom); ctx.lineTo(sx, top); ctx.stroke(); }
      ctx.strokeStyle = '#000'; ctx.beginPath(); ctx.moveTo(sx, bottom); ctx.lineTo(sx, bottom + 6); ctx.stroke();
      if (x % labelEvery === 0) ctx.fillText(String(x), sx - 3, bottom + 18);
    }

    for (let y = 1; y <= rangeY; y += 1) {
      const sy = bottom - y * scale;
      if (sy < top) break;
      if (y % gridEvery === 0) { ctx.strokeStyle = '#e9ecef'; ctx.beginPath(); ctx.moveTo(left, sy); ctx.lineTo(right, sy); ctx.stroke(); }
      ctx.strokeStyle = '#000'; ctx.beginPath(); ctx.moveTo(left, sy); ctx.lineTo(left - 6, sy); ctx.stroke();
      if (y % labelEvery === 0) ctx.fillText(String(y), left - 24, sy + 4);
    }

    ctx.fillStyle = '#000'; ctx.fillText('0', left - 10, bottom + 18);

    ctx.save(); ctx.fillStyle = '#212529'; ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText('X', right - 10, bottom + 28);
    ctx.translate(left - 40, top + 10); ctx.rotate(-Math.PI / 2); ctx.fillText('Y', 0, 0); ctx.restore();
  }

  function drawPoints(scale) {
    const { w: cssW, h: cssH } = logicalSize();
    const left = MARGIN.left; const bottom = cssH - MARGIN.bottom;

    const S = 28; // square size for up to 3 letters

    points.forEach(p => {
      const cx = left + p.x * scale; const cy = bottom - p.y * scale;

      const half = S / 2; ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#000000'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.rect(Math.round(cx - half), Math.round(cy - half), S, S); ctx.fill(); ctx.stroke();

      const text = (p.name || '?').trim().slice(0, 3).toUpperCase() || '?';
      let size = 13; ctx.font = `bold ${size}px system-ui, sans-serif`;
      let width = ctx.measureText(text).width; const maxW = S - 6;
      while (width > maxW && size > 9) { size -= 1; ctx.font = `bold ${size}px system-ui, sans-serif`; width = ctx.measureText(text).width; }

      ctx.fillStyle = '#000000'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text, Math.round(cx), Math.round(cy + 1));
    });
  }

  function drawOverlay(scale) {
    if (!overlayImg) return;
    const { w: cssW, h: cssH } = logicalSize();
    const left = MARGIN.left; const bottom = cssH - MARGIN.bottom;

    const widthUnits = Math.max(0, parseFloat(imgWidthUnitsInput.value) || 0);
    const offX = Math.max(0, parseFloat(imgOffsetXInput.value) || 0);
    const offY = Math.max(0, parseFloat(imgOffsetYInput.value) || 0);
    if (widthUnits <= 0) return;

    const drawWidthPx = widthUnits * scale;
    const aspect = overlayImgNatural.h / overlayImgNatural.w;
    const drawHeightPx = drawWidthPx * aspect;

    const x = left + offX * scale;
    const y = bottom - offY * scale - drawHeightPx;

    const alpha = Math.min(1, Math.max(0, (parseFloat(imgOpacityPercentInput.value) || 40) / 100));
    ctx.save(); ctx.globalAlpha = alpha; ctx.imageSmoothingEnabled = true;
    ctx.drawImage(overlayImg, Math.round(x), Math.round(y), Math.round(drawWidthPx), Math.round(drawHeightPx));
    ctx.restore();
  }

  function draw() {
    clearCanvas();

    const maxX = points.reduce((m, p) => Math.max(m, p.x), 0);
    const maxY = points.reduce((m, p) => Math.max(m, p.y), 0);

    const widthUnits = Math.max(0, parseFloat(imgWidthUnitsInput.value) || 0);
    const offX = Math.max(0, parseFloat(imgOffsetXInput.value) || 0);
    const offY = Math.max(0, parseFloat(imgOffsetYInput.value) || 0);
    const overlayMaxX = overlayImg && widthUnits > 0 ? offX + widthUnits : 0;
    const overlayMaxY = overlayImg && widthUnits > 0 ? offY + (widthUnits * (overlayImgNatural.h / (overlayImgNatural.w || 1))) : 0;

    const maxXAll = Math.max(maxX, overlayMaxX);
    const maxYAll = Math.max(maxY, overlayMaxY);

    const { scale, rangeX, rangeY } = computeScale(maxXAll, maxYAll);

    drawAxes(maxXAll, maxYAll, scale, rangeX, rangeY);
    drawOverlay(scale);
    drawPoints(scale);
  }

  // --- Overlay events ---
  imgInput.addEventListener('change', () => {
    const file = imgInput.files && imgInput.files[0]; if (!file) return;
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => { overlayImg = img; overlayImgNatural = { w: img.naturalWidth, h: img.naturalHeight }; URL.revokeObjectURL(url); draw(); };
    img.onerror = () => { overlayImg = null; overlayImgNatural = { w: 0, h: 0 }; URL.revokeObjectURL(url); alert('Could not load image.'); };
    img.src = url;
  });

  ;[imgWidthUnitsInput, imgOpacityPercentInput, imgOffsetXInput, imgOffsetYInput].forEach(inp => { attachNumberGuards(inp); inp.addEventListener('input', draw); });

  clearImageBtn.addEventListener('click', () => { overlayImg = null; overlayImgNatural = { w: 0, h: 0 }; imgInput.value = ''; draw(); });

  // --- Audio analysis ---
  function fitTimelineCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = timelineWrapper.getBoundingClientRect();
    const width = Math.max(300, rect.width);
    const height = 120; // fixed CSS px height for simplicity

    timelineCanvas.style.width = width + 'px';
    timelineCanvas.style.height = height + 'px';
    timelineCanvas.width = Math.round(width * dpr);
    timelineCanvas.height = Math.round(height * dpr);
  }

  function clearTimelineCanvas() {
    timelineCtx.clearRect(0, 0, timelineCanvas.width, timelineCanvas.height);
    // white background
    timelineCtx.fillStyle = '#ffffff';
    timelineCtx.fillRect(0, 0, timelineCanvas.width, timelineCanvas.height);
  }

  function drawTimeline() {
    fitTimelineCanvas();
    clearTimelineCanvas();

    if (!timelineDuration || timelineTicks.length === 0) {
      timelineMeta.textContent = timelineDuration ? `Duration: ${timelineDuration.toFixed(2)} s — no moments detected (adjust threshold?)` : '';
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const cssW = timelineCanvas.width / dpr;
    const cssH = timelineCanvas.height / dpr;

    const M = { left: 20, right: 20, top: 20, bottom: 20 };
    const x0 = M.left;
    const x1 = cssW - M.right;
    const yBase = cssH / 2;

    // Baseline
    timelineCtx.save();
    timelineCtx.scale(dpr, dpr);
    timelineCtx.strokeStyle = '#000';
    timelineCtx.lineWidth = 2;
    timelineCtx.beginPath();
    timelineCtx.moveTo(x0, yBase);
    timelineCtx.lineTo(x1, yBase);
    timelineCtx.stroke();

    // Ticks (no labels)
    const tickHeight = 18;
    timelineCtx.lineWidth = 2;
    timelineCtx.strokeStyle = '#2f72ff';
    timelineTicks.forEach(t => {
      const x = x0 + (t / timelineDuration) * (x1 - x0);
      timelineCtx.beginPath();
      timelineCtx.moveTo(x, yBase - tickHeight);
      timelineCtx.lineTo(x, yBase + tickHeight);
      timelineCtx.stroke();
    });

    timelineCtx.restore();

    timelineMeta.textContent = `Duration: ${timelineDuration.toFixed(2)} s — ${timelineTicks.length} moments`;
  }

  async function decodeAudioFile(file) {
    const arrayBuf = await file.arrayBuffer();
    const AC = window.AudioContext || window.webkitAudioContext;
    const ac = new AC({ sampleRate: 44100 }); // hint; browser may choose native
    try {
      const audioBuf = await ac.decodeAudioData(arrayBuf.slice(0));
      return audioBuf;
    } finally {
      // close context to free resources
      if (ac.close) { try { await ac.close(); } catch {} }
    }
  }

  function computeRMSdB(buffer, winMs = 100, hopMs = 50) {
    const sr = buffer.sampleRate;
    const ch = buffer.numberOfChannels;
    const N = buffer.length;

    const win = Math.max(1, Math.round(sr * (winMs / 1000)));
    const hop = Math.max(1, Math.round(sr * (hopMs / 1000)));

    const numHops = 1 + Math.max(0, Math.floor((N - win) / hop));
    const times = new Array(numHops);
    const rmsDb = new Array(numHops);

    const EPS = 1e-12;

    // For efficiency, read channel data once
    const chData = new Array(ch);
    for (let c = 0; c < ch; c++) chData[c] = buffer.getChannelData(c);

    for (let h = 0; h < numHops; h++) {
      const start = h * hop;
      const end = start + win;
      let sumSq = 0;
      for (let n = start; n < end; n++) {
        const idx = n < N ? n : N - 1; // clamp for last partial window
        let s = 0;
        for (let c = 0; c < ch; c++) {
          const v = chData[c][idx];
          s += v * v; // power per channel
        }
        sumSq += s / ch; // average channel power sample-wise
      }
      const meanSq = sumSq / win;
      const rms = Math.sqrt(meanSq);
      const db = 20 * Math.log10(rms + EPS);

      const center = (start + win / 2) / sr;
      times[h] = center;
      rmsDb[h] = db;
    }

    return { times, rmsDb, sr };
  }

  function smoothMovingAvg(arr, span = 5) {
    if (span <= 1) return arr.slice();
    const out = new Array(arr.length);
    const half = Math.floor(span / 2);
    for (let i = 0; i < arr.length; i++) {
      let s = 0, c = 0;
      for (let k = i - half; k <= i + half; k++) {
        if (k >= 0 && k < arr.length) { s += arr[k]; c++; }
      }
      out[i] = s / Math.max(1, c);
    }
    return out;
  }

  function detectSignificantMoments(times, rmsDb, thresholdDb = 3, minGapSec = 1.0) {
    const ticks = [];
    let last = -Infinity;
    for (let i = 1; i < rmsDb.length; i++) {
      const delta = rmsDb[i] - rmsDb[i - 1];
      if (Math.abs(delta) >= thresholdDb) {
        const t = times[i];
        if (t - last >= minGapSec) {
          ticks.push(t);
          last = t;
        }
      }
    }
    return ticks;
  }

  analyzeBtn.addEventListener('click', async () => {
    const file = audioFileInput.files && audioFileInput.files[0];
    if (!file) { alert('Please choose an MP3 file first.'); return; }

    analyzeBtn.disabled = true; analyzeBtn.textContent = 'Analyzing…';
    try {
      const winMs = Math.max(5, parseFloat(winMsInput.value) || 100);
      const hopMs = Math.max(1, parseFloat(hopMsInput.value) || 50);
      const thrDb = Math.max(0.1, parseFloat(thrDbInput.value) || 3);
      const minGap = Math.max(0, parseFloat(minGapInput.value) || 1.0);

      const audioBuf = await decodeAudioFile(file);
      const duration = audioBuf.duration;
      const { times, rmsDb } = computeRMSdB(audioBuf, winMs, hopMs);

      // Light smoothing to reduce jitter in derivative
      const smoothed = smoothMovingAvg(rmsDb, 5);
      const ticks = detectSignificantMoments(times, smoothed, thrDb, minGap);

      timelineTicks = ticks;
      timelineDuration = duration;
      drawTimeline();
    } catch (e) {
      console.error(e);
      alert('Analyze failed. Your browser must support Web Audio to decode MP3.');
    } finally {
      analyzeBtn.disabled = false; analyzeBtn.textContent = 'Analyze';
    }
  });

  clearTimelineBtn.addEventListener('click', () => {
    timelineTicks = [];
    timelineDuration = 0;
    drawTimeline();
  });

  window.addEventListener('resize', drawTimeline);

  // Initial layout
  fitCanvasToContainer();
  renderTable();
  draw();
  drawTimeline();
})();
