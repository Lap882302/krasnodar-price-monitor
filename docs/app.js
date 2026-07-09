const sourceColumns = [
  ["rynokOnline", "Рынок Онлайн"],
  ["vkusvill", "ВкусВилл"],
  ["pyaterochka", "Пятёрочка"],
  ["azbukaVkusa", "Азбука Вкуса"],
  ["yandexLavka", "Яндекс Лавка"],
  ["samokat", "Самокат"]
];

const dataVersion = "2026-07-09T13-45-unit-labels";
const minimumGeneratedAt = "2026-07-09T12:45:00+03:00";
const dataUrls = [
  `https://raw.githubusercontent.com/Lap882302/krasnodar-price-monitor/main/docs/data/latest.json?v=${dataVersion}`,
  `./data/latest.json?v=${dataVersion}`
];

const productTypeOrder = [
  "Помидор",
  "Клубника",
  "Картофель",
  "Курица",
  "Огурец",
  "Черешня",
  "Лук",
  "Болгарский перец",
  "Морковь",
  "Укроп",
  "Говядина"
];

const state = {
  rows: [],
  filteredRows: [],
  activeType: "Все",
  search: ""
};

function isFreshEnough(data) {
  return data?.generatedAt && new Date(data.generatedAt) >= new Date(minimumGeneratedAt);
}

function formatPrice(value) {
  if (value === null || value === undefined || value === "") return "—";
  return `${new Intl.NumberFormat("ru-RU").format(value)} ₽/кг`;
}

function priceClass(value) {
  return value === null || value === undefined || value === "" ? "empty" : "";
}

function typeRank(type) {
  const rank = productTypeOrder.indexOf(type);
  return rank === -1 ? productTypeOrder.length : rank;
}

function sourceRank(row) {
  const rank = sourceColumns.findIndex(([key]) => typeof row[key] === "number");
  return rank === -1 ? sourceColumns.length : rank;
}

function sortRows(rows) {
  return [...rows].sort((a, b) => {
    const byType = typeRank(a.type) - typeRank(b.type);
    if (byType !== 0) return byType;

    const bySource = sourceRank(a) - sourceRank(b);
    if (bySource !== 0) return bySource;

    return a.variant.localeCompare(b.variant, "ru");
  });
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

function renderSourceStatus(data) {
  const container = document.querySelector("#sourceStatus");
  if (!container) return;

  const statuses = data.sourceStatus || [];
  if (!statuses.length) {
    container.innerHTML = `<div class="empty-state">Статусы источников пока не заданы.</div>`;
    return;
  }

  container.innerHTML = statuses.map(source => `
    <article class="source-status-card ${source.status}">
      <div class="source-status-top">
        <h3>${source.name}</h3>
        <span>${source.label}</span>
      </div>
      <p>${source.method}</p>
      <strong>Следующий шаг</strong>
      <p>${source.nextStep}</p>
    </article>
  `).join("");
}

function renderFilters(rows) {
  const types = [
    "Все",
    ...Array.from(new Set(rows.map(row => row.type))).sort((a, b) => {
      const byType = typeRank(a) - typeRank(b);
      return byType !== 0 ? byType : a.localeCompare(b, "ru");
    })
  ];
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
  state.filteredRows = sortRows(state.rows.filter(row => {
    const byType = state.activeType === "Все" || row.type === state.activeType;
    const bySearch = !q || `${row.type} ${row.variant} ${row.comment}`.toLowerCase().includes(q);
    return byType && bySearch;
  }));
  renderFilters(state.rows);
  renderTable(state.filteredRows);
}

function renderTable(rows) {
  const body = document.querySelector("#priceRows");

  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="10" class="empty-state">Ничего не найдено по текущему фильтру.</td></tr>`;
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
    let data = null;
    let lastError = null;

    for (const url of dataUrls) {
      try {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const candidate = await response.json();
        if (!isFreshEnough(candidate)) throw new Error("Stale data");
        data = candidate;
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!data) throw lastError || new Error("No data");

    state.rows = sortRows(data.rows);
    state.filteredRows = state.rows;
    renderSummary(data);
    renderSourceStatus(data);
    renderFilters(data.rows);
    renderTable(data.rows);
  } catch (error) {
    document.querySelector("#priceRows").innerHTML = `
      <tr>
        <td colspan="10" class="empty-state">
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
