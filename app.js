
(() => {
  const INVENTORY_URL = "./inventario.json";

  const WHATSAPP_NUMBER = "522283338572";

  const STORAGE_KEY = "dg_inventory_selection_v1";

  const STATUS_OUT = "out"; // Se acabó
  const STATUS_LOW = "low"; // Queda Poco
  const EMOJI_OUT = "\uD83D\uDEAB";  // 🚫
  const EMOJI_LOW = "\u26A0\uFE0F";  // ⚠️

  const $categorySelect = document.getElementById("categorySelect");
  const $subcategorySelect = document.getElementById("subcategorySelect");
  const $searchInput = document.getElementById("searchInput");
  const $hideInventoryToggle = document.getElementById("hideInventoryToggle");

  const $inventoryWrap = document.getElementById("inventoryWrap");
  const $inventoryContainer = document.getElementById("inventoryContainer");
  const $loadingState = document.getElementById("loadingState");

  const $markedCount = document.getElementById("markedCount");

  const $summaryCount = document.getElementById("summaryCount");
  const $summaryOut = document.getElementById("summaryOut");
  const $summaryLow = document.getElementById("summaryLow");

  const $sendBtn = document.getElementById("sendBtn");
  const $clearBtn = document.getElementById("clearBtn");

  const summaryTitles = document.querySelectorAll(".summaryMini__title");
  if (summaryTitles.length >= 2) {
    summaryTitles[0].textContent = "🚫 Se acabó";
    summaryTitles[1].textContent = "⚠️ Queda Poco";
  }

  /** @type {Array<{id:string, producto:string, categoria:string, subcategoria:string}>} */
  let inventory = [];


  let selectionMap = loadSelection();

  init().catch((err) => {
    console.error(err);
    if ($loadingState) $loadingState.textContent = "Error cargando inventario.";
  });

  async function init() {
    inventory = await fetchInventory(INVENTORY_URL);

    inventory.sort((a, b) => a.producto.localeCompare(b.producto, "es"));

    populateCategorySelect(inventory);

    $categorySelect.addEventListener("change", () => {
      populateSubcategorySelect(inventory, $categorySelect.value);
      renderList();
    });

    $subcategorySelect.addEventListener("change", renderList);
    $searchInput.addEventListener("input", renderList);

    $hideInventoryToggle.addEventListener("change", () => {
      $inventoryWrap.style.display = $hideInventoryToggle.checked ? "none" : "block";
    });

    $clearBtn.addEventListener("click", () => {
      clearSelection();
      renderList();
      renderSummary();
    });

$sendBtn.addEventListener("click", () => {
  const msg = buildMessage();
  if (!msg) return;

  const url = buildWhatsAppUrl(WHATSAPP_NUMBER, msg);

  clearSelection();
  renderList();
  renderSummary();

  const opened = window.open(url, "_blank");
  if (!opened) {
    window.location.href = url;
  }
});

    populateSubcategorySelect(inventory, $categorySelect.value);
    renderList();
    renderSummary();
  }

  async function fetchInventory(url) {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error(`No se pudo cargar ${url} (${res.status})`);
    const data = await res.json();

    const clean = [];
    const seen = new Set();

    for (const item of data) {
      if (!item || typeof item !== "object") continue;
      const id = String(item.id ?? "").trim();
      const producto = String(item.producto ?? "").trim();
      const categoria = String(item.categoria ?? "").trim();
      const subcategoria = String(item.subcategoria ?? "").trim();

      if (!id || !producto || !categoria) continue;

      if (seen.has(id)) continue;
      seen.add(id);

      clean.push({ id, producto, categoria, subcategoria: subcategoria || "General" });
    }

    return clean;
  }

  function populateCategorySelect(items) {
    const categories = Array.from(new Set(items.map((x) => x.categoria))).sort((a, b) =>
      a.localeCompare(b, "es")
    );

    // reset
    $categorySelect.innerHTML = `<option value="__all__">Todas</option>`;
    for (const c of categories) {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      $categorySelect.appendChild(opt);
    }
  }

  function populateSubcategorySelect(items, categoryValue) {
    const filtered =
      categoryValue === "__all__" ? items : items.filter((x) => x.categoria === categoryValue);

    const subcats = Array.from(new Set(filtered.map((x) => x.subcategoria)))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "es"));

    $subcategorySelect.innerHTML = `<option value="__all__">Todas</option>`;
    for (const s of subcats) {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      $subcategorySelect.appendChild(opt);
    }

    $subcategorySelect.disabled = subcats.length === 0;
  }

  function renderList() {
    if (!$inventoryContainer) return;

    if ($loadingState) $loadingState.style.display = "none";

    const categoryValue = $categorySelect.value;
    const subcatValue = $subcategorySelect.value;
    const q = ($searchInput.value || "").trim().toLowerCase();

    let list = inventory;

    if (categoryValue !== "__all__") {
      list = list.filter((x) => x.categoria === categoryValue);
    }
    if (subcatValue !== "__all__") {
      list = list.filter((x) => x.subcategoria === subcatValue);
    }
    if (q) {
      list = list.filter((x) => x.producto.toLowerCase().includes(q));
    }

    $inventoryContainer.innerHTML = "";

    if (list.length === 0) {
      const empty = document.createElement("div");
      empty.className = "loading";
      empty.textContent = "Sin resultados.";
      $inventoryContainer.appendChild(empty);
      updateCounts();
      return;
    }

    for (const item of list) {
      const row = document.createElement("div");
      row.className = "inventoryItem";

      const name = document.createElement("div");
      name.className = "inventoryItem__name";
      name.textContent = item.producto;

      const actions = document.createElement("div");
      actions.className = "inventoryItem__actions";

      const btnWarn = document.createElement("button");
      btnWarn.className = "iconBtn";
      btnWarn.type = "button";
      btnWarn.textContent = "🚫";
      btnWarn.title = "Se acabó";
      btnWarn.setAttribute("aria-label", `Marcar "${item.producto}" como Se acabó`);

      const btnDanger = document.createElement("button");
      btnDanger.className = "iconBtn";
      btnDanger.type = "button";
      btnDanger.textContent = "⚠️";
      btnDanger.title = "Queda Poco";
      btnDanger.setAttribute("aria-label", `Marcar "${item.producto}" como Queda Poco`);

      applyButtonState(item.id, btnWarn, btnDanger);

      btnWarn.addEventListener("click", () => {
        toggleStatus(item.id, STATUS_OUT); // 🚫
        applyButtonState(item.id, btnWarn, btnDanger);
        renderSummary();
      });

      btnDanger.addEventListener("click", () => {
        toggleStatus(item.id, STATUS_LOW); // ⚠️
        applyButtonState(item.id, btnWarn, btnDanger);
        renderSummary();
      });

      actions.appendChild(btnWarn);
      actions.appendChild(btnDanger);

      row.appendChild(name);
      row.appendChild(actions);

      $inventoryContainer.appendChild(row);
    }

    updateCounts();
  }

  function applyButtonState(id, btnWarn, btnDanger) {
    const st = selectionMap[id];

    btnWarn.classList.remove("active-warn");
    btnDanger.classList.remove("active-danger");

    if (st === STATUS_OUT) btnWarn.classList.add("active-warn");

    if (st === STATUS_LOW) btnDanger.classList.add("active-danger");

    updateCounts();
  }

  function toggleStatus(id, status) {
    if (selectionMap[id] === status) {
      delete selectionMap[id];
    } else {
      selectionMap[id] = status;
    }
    saveSelection(selectionMap);
    updateCounts();
  }

  function renderSummary() {
    const outItems = getSelectedItemsByStatus(STATUS_OUT);
    const lowItems = getSelectedItemsByStatus(STATUS_LOW);

    // Render mini-listas (texto simple)
    $summaryOut.textContent = outItems.length ? outItems.join(", ") : "—";
    $summaryLow.textContent = lowItems.length ? lowItems.join(", ") : "—";

    updateCounts();
  }

  function getSelectedItemsByStatus(status) {
    const names = [];
    for (const id in selectionMap) {
      if (selectionMap[id] !== status) continue;
      const item = inventory.find((x) => x.id === id);
      if (item) names.push(item.producto);
    }
    names.sort((a, b) => a.localeCompare(b, "es"));
    return names;
  }

  function updateCounts() {
    const total = Object.keys(selectionMap).length;
    $markedCount.textContent = `Marcados: ${total}`;
    $summaryCount.textContent = `${total} ${total === 1 ? "elemento" : "elementos"}`;

    $sendBtn.disabled = total === 0;
    $clearBtn.disabled = total === 0;
  }

  function buildMessage() {
    const outItems = getSelectedItemsByStatus(STATUS_OUT);
    const lowItems = getSelectedItemsByStatus(STATUS_LOW);

    const total = outItems.length + lowItems.length;
    if (total === 0) return "";

    const dateStr = formatDateDDMMYYYY(new Date());

    const lines = [];
    lines.push("Inventario");
    lines.push(`Fecha: ${dateStr}`);
    lines.push("");

    lines.push(`${EMOJI_OUT}Se acabó (${outItems.length}):`);
    if (outItems.length) {
      for (const name of outItems) lines.push(`- ${name}`);
    }
    lines.push("");

    lines.push(`${EMOJI_LOW}Queda Poco (${lowItems.length}):`);
    if (lowItems.length) {
      for (const name of lowItems) lines.push(`- ${name}`);
    }

    return lines.join("\n");
  }

function buildWhatsAppUrl(phone, text) {
  const cleanPhone = String(phone || "").replace(/[^\d]/g, "");
  const encoded = encodeURIComponent(text);
  return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`;
}

  function formatDateDDMMYYYY(d) {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = String(d.getFullYear());
    return `${dd}/${mm}/${yyyy}`;
  }

  function loadSelection() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return {};
      return parsed;
    } catch {
      return {};
    }
  }

  function saveSelection(map) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {
    }
  }

  function clearSelection() {
    selectionMap = {};
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
    }
    updateCounts();
  }
})();