// generator.js
let blocks = [];
let blockStates = {};
let stateTypes = {};

let selectedFrom = [];
let selectedTo = [];

function $(id) {
  return document.getElementById(id);
}

const fromInput = $("fromInput");
const toInput = $("toInput");
const fromChips = $("fromChips");
const toChips = $("toChips");
const previewFrom = $("previewFrom");
const previewTo = $("previewTo");
const outputDiv = $("output");
const generateBtn = $("generateBtn");
const clearBtn = $("clearBtn");

async function load(path) {
  const r = await fetch(path);
  return r.json();
}

async function init() {
  try {
    blocks = await load("./data/blocks.json");
    blockStates = await load("./data/blockstates.json");
    stateTypes = await load("./data/stateTypes.json");
  } catch (e) {
    console.error("Loading data failed:", e);
    return;
  }
  setupInputs();
  refreshAll();
}
init();

setupSuggestions(fromInput, $("fromSuggestions"), (block) => addChip(block, selectedFrom));
setupSuggestions(toInput, $("toSuggestions"), (block) => addChip(block, selectedTo));

/* ----------------- AUTOCOMPLETE ----------------- */
function setupSuggestions(inputEl, suggestionsEl, onPick) {
  inputEl.addEventListener("input", () => {
    const q = inputEl.value.trim().toLowerCase();
    suggestionsEl.innerHTML = "";
    if (!q) return;

    const matches = blocks
      .filter((b) => b.toLowerCase().includes(q))
      .slice(0, 20);
    matches.forEach((b) => {
      const div = document.createElement("div");
      div.textContent = b;
      div.style.padding = "6px 10px";
      div.style.cursor = "pointer";
      div.addEventListener("mousedown", (e) => {
        // use mousedown instead of click so input doesn't lose focus too early
        e.preventDefault();
        onPick(b);
        inputEl.value = "";
        suggestionsEl.innerHTML = "";
      });
      suggestionsEl.appendChild(div);
    });
  });

  // hide suggestions when clicking outside
  document.addEventListener("click", (e) => {
    if (!suggestionsEl.contains(e.target) && e.target !== inputEl) {
      suggestionsEl.innerHTML = "";
    }
  });
}

/* ----------------- CHIP & STATE PANEL ----------------- */
function addChip(name, list) {
  const obj = { name, selections: {} };
  list.push(obj);
  renderChips();
  refreshAll();
}

function removeChip(idx, list) {
  list.splice(idx, 1);
  renderChips();
  refreshAll();
}

function renderChips() {
  renderChipGroup(selectedFrom, fromChips);
  renderChipGroup(selectedTo, toChips);
}

function renderChipGroup(list, container) {
  container.innerHTML = "";
  list.forEach((obj, idx) => {
    const chip = document.createElement("div");
    chip.className = "chip";

    const top = document.createElement("div");
    top.className = "chip-top";

    const name = document.createElement("div");
    name.className = "chip-name";
    name.textContent = obj.name;

    const removeBtn = document.createElement("button");
    removeBtn.className = "chip-remove";
    removeBtn.textContent = "×";
    removeBtn.onclick = (e) => {
      e.stopPropagation();
      removeChip(idx, list);
    };

    top.appendChild(name);
    top.appendChild(removeBtn);
    chip.appendChild(top);

    const summary = document.createElement("div");
    summary.className = "chip-states";
    summary.textContent = stateSummary(obj);
    chip.appendChild(summary);

    chip.onclick = (ev) => {
      if (ev.target === removeBtn) return;
      toggleStatePanel(obj, chip);
    };

    container.appendChild(chip);
  });
}

function toggleStatePanel(obj, chip) {
  const existing = chip.querySelector(".state-panel");
  if (existing) {
    existing.remove();
    return;
  }

  // close other panels
  document.querySelectorAll(".state-panel").forEach((p) => p.remove());

  const cat = blockStates[obj.name];
  const panel = document.createElement("div");
  panel.className = "state-panel";
  panel.onclick = (e) => e.stopPropagation();

  if (!cat) {
    panel.textContent = "No states for this block.";
    chip.appendChild(panel);
    return;
  }

  const defs = stateTypes[cat];
  if (!defs) {
    panel.textContent = `No definitions for category "${cat}".`;
    chip.appendChild(panel);
    return;
  }

  Object.entries(defs).forEach(([stateName, values]) => {
    const group = document.createElement("div");
    group.className = "state-group";

    const title = document.createElement("div");
    title.className = "state-title";
    title.textContent = stateName + ":";
    group.appendChild(title);

    const opts = document.createElement("div");
    opts.className = "state-options";

    values.forEach((v) => {
      const label = document.createElement("label");
      label.className = "state-option";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = (obj.selections[stateName] || []).includes(v);
      input.onclick = (e) => e.stopPropagation();
      input.onchange = () => {
        if (!obj.selections[stateName]) obj.selections[stateName] = [];
        if (input.checked) {
          obj.selections[stateName].push(v);
        } else {
          obj.selections[stateName] = obj.selections[stateName].filter(
            (x) => x !== v
          );
          if (obj.selections[stateName].length === 0) {
            delete obj.selections[stateName];
          }
        }
        renderChips();
        refreshAll();
      };

      label.appendChild(input);
      label.appendChild(document.createTextNode(v));
      opts.appendChild(label);
    });

    group.appendChild(opts);
    panel.appendChild(group);
  });

  const btnRow = document.createElement("div");
  btnRow.style.textAlign = "right";
  btnRow.style.marginTop = "6px";

  const clear = document.createElement("button");
  clear.className = "btn-ghost";
  clear.textContent = "Clear";
  clear.onclick = (e) => {
    e.stopPropagation();
    obj.selections = {};
    renderChips();
    refreshAll();
    panel.remove();
  };

  const close = document.createElement("button");
  close.className = "btn-ghost";
  close.textContent = "Close";
  close.onclick = (e) => {
    e.stopPropagation();
    panel.remove();
  };

  btnRow.appendChild(clear);
  btnRow.appendChild(close);
  panel.appendChild(btnRow);

  chip.appendChild(panel);
}

function stateSummary(obj) {
  const sel = obj.selections;
  const keys = Object.keys(sel);
  if (keys.length === 0) return "";
  return keys.map((k) => `${k}: ${sel[k].join(",")}`).join(" · ");
}

/* ----------------- EXPAND & PREVIEW & OUTPUT ----------------- */
function expand(obj) {
  const keys = Object.keys(obj.selections);
  if (!keys.length) return [obj.name];

  const lists = keys.map((k) => obj.selections[k]);
  function cart(arr) {
    if (arr.length === 0) return [[]];
    const rest = cart(arr.slice(1));
    return arr[0].flatMap((x) => rest.map((r) => [x, ...r]));
  }

  const combos = cart(lists);
  return combos.map((c) => {
    const parts = c.map((v, i) => `${keys[i]}=${v}`).join(",");
    return `${obj.name}[${parts}]`;
  });
}

function refreshPreviews() {
  const fromList = selectedFrom.flatMap(expand);
  const toList = selectedTo.flatMap(expand);

  previewFrom.innerHTML = "";
  fromList.forEach((s) => {
    const el = document.createElement("div");
    el.className = "preview-item";
    el.textContent = s;
    previewFrom.appendChild(el);
  });

  previewTo.innerHTML = "";
  toList.forEach((s) => {
    const el = document.createElement("div");
    el.className = "preview-item";
    el.textContent = s;
    previewTo.appendChild(el);
  });

  const cmd = `//replace ${[...fromList, ...toList].join(",")}`;
  outputDiv.textContent = cmd;
  outputDiv.onclick = () => {
    navigator.clipboard.writeText(cmd);
    outputDiv.textContent = "Copied!";
    setTimeout(() => (outputDiv.textContent = cmd), 700);
  };
}

function refreshAll() {
  renderChips();
  refreshPreviews();
}
