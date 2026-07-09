const sourceColumns = [
  ["rynokOnline", "Рынок Онлайн"],
  ["vkusvill", "ВкусВилл"],
  ["pyaterochka", "Пятёрочка"],
  ["azbukaVkusa", "Азбука Вкуса"],
  ["yandexLavka", "Яндекс Лавка"],
  ["samokat", "Самокат"]
];

const state = {
  rows: [],
  filteredRows: [],
  activeType: "Все",
  search: ""
};

function formatPrice(value) {
  if (value === null || value === undefined || value === "") return "—";
  return new Intl.NumberFormat("ru-RU").format(value);
}

function priceClass(value) {
  return value === null || value === undefined || value === "" ? "empty" : "";
}

function minSource(row) {
  const values = sourceColumns
    .map(([key, label]) => ({ key, label, value: row[key] }))
    .filter(item => typeof item.value === "number");

  if (!values.length) return "";
  const min = Math.min(...values.map(item => item.value));
  return values.filter(item => item.value === min).map(item => item.label).join(", ");
}

function renderSummary(data) {
  document.querySelector("#generatedAt").textContent = new Date(data.generatedAt).toLocaleString("ru-RU");
  document.querySelector("#address").textContent = data.address;
  document.querySelector("#rowsCount").textContent = data.rows.length;

  const filled = sourceColumns.map(([key, label]) => {
    const count = data.rows.filter(row => typeof row[key] === "number").length;
    return `<span class="source-pill">${label}: ${count}</span>`;
  }).join("");

  document.querySelector("#sourceCoverage").innerHTML = filled;
}

function renderFilters(rows) {
  const types = ["Все", ...Array.from(new Set(rows.map(row => row.type))).sort((a, b) => a.localeCompare(b, "ru"))];
  document.querySelector("#typeFilters").innerHTML = types.map(type => {
    const active = type === state.activeType ? "active" : "";
    return `<button class="filter-chip ${active}" data-type="${type}">${type}</button>`;
  }).join("");

  document.querySelectorAll(".filter-chip").forEach(button => {
    button.addEventListener("click", () => {
      state.activeType = button.dataset.type;
      applyFilters();
    });
  });
}

function applyFilters() {
  const q = state.search.trim().toLowerCase();
  state.filteredRows = state.rows.filter(row => {
    const byType = state.activeType === "Все" || row.type === state.activeType;
    const bySearch = !q || `${row.type} ${row.variant} ${row.comment}`.toLowerCase().includes(q);
    return byType && bySearch;
  });
  renderFilters(state.rows);
  renderTable(state.filteredRows);
}

function renderTable(rows) {
  const body = document.querySelector("#priceRows");

  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="11" class="empty-state">Ничего не найдено по текущему фильтру.</td></tr>`;
    return;
  }

  body.innerHTML = rows.map(row => {
    const best = minSource(row);
    const prices = sourceColumns.map(([key]) => {
      return `<td class="price ${priceClass(row[key])}">${formatPrice(row[key])}</td>`;
    }).join("");

    return `
      <tr>
        <td class="type-cell">${row.type}</td>
        <td>${row.variant}</td>
        ${prices}
        <td>${best || "—"}</td>
        <td class="comment">${row.comment || ""}</td>
      </tr>
    `;
  }).join("");
}

async function boot() {
  try {
    const response = await fetch("./data/latest.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    state.rows = data.rows;
    state.filteredRows = data.rows;
    renderSummary(data);
    renderFilters(data.rows);
    renderTable(data.rows);
  } catch (error) {
    document.querySelector("#priceRows").innerHTML = `
      <tr>
        <td colspan="11" class="empty-state">
          Не удалось загрузить данные. Если страница открыта как файл, запустите её через GitHub Pages или локальный сервер.
        </td>
      </tr>
    `;
  }

  document.querySelector("#search").addEventListener("input", event => {
    state.search = event.target.value;
    applyFilters();
  });
}

boot();
