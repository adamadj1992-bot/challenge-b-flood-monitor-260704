const API_ROOT = "https://environment.data.gov.uk/flood-monitoring";
const UK_BOUNDS = {
  minLat: 49.8,
  maxLat: 60.9,
  minLong: -8.6,
  maxLong: 1.9,
};

const searchForm = document.querySelector("#station-search");
const searchInput = document.querySelector("#search-term");
const quickSearchButtons = document.querySelectorAll("[data-query]");
const stationList = document.querySelector("#station-list");
const resultsState = document.querySelector("#results-state");
const stationCount = document.querySelector("#station-count");
const selectedStation = document.querySelector("#selected-station");
const latestReading = document.querySelector("#latest-reading");
const stationSummary = document.querySelector("#station-summary");
const refreshButton = document.querySelector("#refresh-station");
const mapCoordinates = document.querySelector("#map-coordinates");
const mapMarker = document.querySelector(".map-marker");
const readingChart = document.querySelector("#reading-chart");
const chartUnit = document.querySelector("#chart-unit");
const readingTable = document.querySelector("#reading-table");
const apiLog = document.querySelector("#api-log");
const clearLogButton = document.querySelector("#clear-log");

let stations = [];
let activeStation = null;
let activeStationButton = null;

function setState(label, tone = "ready") {
  resultsState.textContent = label;
  resultsState.classList.toggle("is-loading", tone === "loading");
  resultsState.classList.toggle("is-error", tone === "error");
}

function buildUrl(path, params = {}) {
  const url = new URL(`${API_ROOT}${path}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  return url;
}

async function fetchJson(path, params) {
  const url = buildUrl(path, params);
  logRequest(url);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`API returned ${response.status}`);
  }

  return response.json();
}

function logRequest(url) {
  const item = document.createElement("li");
  const timestamp = new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  item.innerHTML = `<strong>${timestamp}</strong> <code>${escapeHtml(url.href)}</code>`;
  apiLog.prepend(item);
}

function stationTitle(station) {
  return station.label || station.stationReference || "Unnamed station";
}

function stationLocation(station) {
  return [station.town, station.riverName, station.catchmentName]
    .filter(Boolean)
    .join(" | ");
}

function formatDateTime(value) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatNumber(value, digits = 3) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "No data";
  }

  return value.toFixed(digits).replace(/\.?0+$/, "");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function resetDetailPanel() {
  activeStation = null;
  activeStationButton = null;
  selectedStation.textContent = "None";
  latestReading.textContent = "Awaiting selection";
  refreshButton.disabled = true;
  mapCoordinates.textContent = "No station";
  mapMarker.style.left = "50%";
  mapMarker.style.top = "50%";
  chartUnit.textContent = "No data";
  readingChart.innerHTML = '<p class="chart-empty">No readings loaded.</p>';
  readingTable.innerHTML = '<tr><td colspan="3">No readings loaded.</td></tr>';
  stationSummary.innerHTML = '<p class="empty-state">Search for a place, then select a station.</p>';
}

function renderStations(nextStations) {
  stations = nextStations;
  stationCount.textContent = String(stations.length);
  stationList.innerHTML = "";

  if (!stations.length) {
    stationList.innerHTML = '<p class="empty-state">No stations matched this search.</p>';
    resetDetailPanel();
    return;
  }

  stations.forEach((station) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "station-card";
    button.innerHTML = `
      <strong>${escapeHtml(stationTitle(station))}</strong>
      <span class="station-meta">
        <span>${escapeHtml(stationLocation(station) || "Location not listed")}</span>
        <span>Reference: ${escapeHtml(station.stationReference || "Not listed")}</span>
      </span>
    `;

    button.addEventListener("click", () => {
      loadStation(station, button);
    });

    stationList.append(button);
  });
}

function updateSummary(station, readings, measure) {
  const latest = readings[0];
  const oldest = readings[readings.length - 1];
  const trend = latest && oldest ? latest.value - oldest.value : null;
  const trendText = trend === null ? "No trend" : `${trend >= 0 ? "+" : ""}${formatNumber(trend)} ${measure?.unitName || ""}`;

  selectedStation.textContent = stationTitle(station);
  latestReading.textContent = latest
    ? `${formatNumber(latest.value)} ${measure?.unitName || ""}`
    : "No readings";

  stationSummary.innerHTML = `
    <div class="summary-grid">
      <div>
        <span>Station</span>
        <strong>${escapeHtml(stationTitle(station))}</strong>
      </div>
      <div>
        <span>River</span>
        <strong>${escapeHtml(station.riverName || "Not listed")}</strong>
      </div>
      <div>
        <span>Last update</span>
        <strong>${escapeHtml(formatDateTime(latest?.dateTime))}</strong>
      </div>
      <div>
        <span>Change across loaded readings</span>
        <strong>${escapeHtml(trendText)}</strong>
      </div>
    </div>
  `;
}

function updateMap(station) {
  const lat = Number(station.lat);
  const long = Number(station.long);

  if (!Number.isFinite(lat) || !Number.isFinite(long)) {
    mapCoordinates.textContent = "Coordinates missing";
    mapMarker.style.left = "50%";
    mapMarker.style.top = "50%";
    return;
  }

  const x = ((long - UK_BOUNDS.minLong) / (UK_BOUNDS.maxLong - UK_BOUNDS.minLong)) * 100;
  const y = 100 - ((lat - UK_BOUNDS.minLat) / (UK_BOUNDS.maxLat - UK_BOUNDS.minLat)) * 100;

  mapCoordinates.textContent = `${lat.toFixed(4)}, ${long.toFixed(4)}`;
  mapMarker.style.left = `${Math.min(94, Math.max(6, x))}%`;
  mapMarker.style.top = `${Math.min(94, Math.max(6, y))}%`;
}

function renderChart(readings, measure) {
  const values = readings
    .map((reading) => reading.value)
    .filter((value) => typeof value === "number" && Number.isFinite(value));

  chartUnit.textContent = measure?.unitName || "Value";
  readingChart.innerHTML = "";

  if (!values.length) {
    readingChart.innerHTML = '<p class="chart-empty">No numeric readings returned.</p>';
    return;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  readings
    .slice()
    .reverse()
    .forEach((reading) => {
      const bar = document.createElement("span");
      const value = typeof reading.value === "number" ? reading.value : min;
      const height = 12 + ((value - min) / range) * 88;
      bar.className = "chart-bar";
      bar.style.height = `${height}%`;
      bar.title = `${formatNumber(value)} ${measure?.unitName || ""} at ${formatDateTime(reading.dateTime)}`;
      readingChart.append(bar);
    });
}

function renderTable(readings, measure) {
  if (!readings.length) {
    readingTable.innerHTML = '<tr><td colspan="3">No readings returned.</td></tr>';
    return;
  }

  readingTable.innerHTML = readings
    .map(
      (reading) => `
        <tr>
          <td>${escapeHtml(formatDateTime(reading.dateTime))}</td>
          <td>${escapeHtml(`${formatNumber(reading.value)} ${measure?.unitName || ""}`)}</td>
          <td>${escapeHtml(`${measure?.parameterName || "Reading"} ${measure?.qualifier ? `(${measure.qualifier})` : ""}`)}</td>
        </tr>
      `,
    )
    .join("");
}

async function searchStations(query) {
  setState("Searching", "loading");
  resetDetailPanel();

  try {
    const data = await fetchJson("/id/stations", {
      search: query,
      _limit: 10,
    });

    renderStations(data.items || []);
    setState("Loaded");
  } catch (error) {
    stationList.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`;
    stationCount.textContent = "0";
    setState("Error", "error");
  }
}

async function loadStation(station, button) {
  activeStation = station;
  activeStationButton?.classList.remove("is-selected");
  activeStationButton = button;
  activeStationButton?.classList.add("is-selected");
  refreshButton.disabled = false;
  setState("Loading", "loading");
  updateMap(station);

  try {
    const [measuresData, readingsData] = await Promise.all([
      fetchJson(`/id/stations/${encodeURIComponent(station.stationReference)}/measures`),
      fetchJson(`/id/stations/${encodeURIComponent(station.stationReference)}/readings`, {
        _sorted: "true",
        _limit: 12,
      }),
    ]);

    const readings = readingsData.items || [];
    const measure = (measuresData.items || []).find((item) => item.latestReading) || measuresData.items?.[0];

    updateSummary(station, readings, measure);
    renderChart(readings, measure);
    renderTable(readings, measure);
    setState("Loaded");
  } catch (error) {
    stationSummary.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`;
    latestReading.textContent = "Error";
    setState("Error", "error");
  }
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = searchInput.value.trim();

  if (query) {
    searchStations(query);
  }
});

quickSearchButtons.forEach((button) => {
  button.addEventListener("click", () => {
    searchInput.value = button.dataset.query;
    searchStations(button.dataset.query);
  });
});

refreshButton.addEventListener("click", () => {
  if (activeStation) {
    loadStation(activeStation, activeStationButton);
  }
});

clearLogButton.addEventListener("click", () => {
  apiLog.innerHTML = "";
});

searchStations(searchInput.value);
