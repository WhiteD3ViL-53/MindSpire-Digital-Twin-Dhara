// ======================
// DHARA / BHOSARI TWIN CORE
// ======================

// --- CONFIG ---
const DEFAULT_LOC = [73.855, 18.625]; // [Lng, Lat] Bhosari

// API CONFIGURATION (DUAL SYSTEM: OPEN-METEO + OPENWEATHERMAP)
const API_CONFIG = {
    primary: {
        id: 'open_meteo',
        name: 'Open-Meteo (Primary)',
        url: (lat, lon) =>
            `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide`
    },
    secondary: {
        id: 'open_weather',
        name: 'OpenWeatherMap (Fallback)',
        // ⚠️ MANDATORY: INSERT YOUR OPENWEATHERMAP API KEY BELOW
        key: 'INSERT_OPENWEATHER_KEY_HERE',
        url: (lat, lon, key) =>
            `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${key}`
    },
    geocoding: {
        url: (query) => `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`
    }
};

// STRATEGIES DATABASE
const STRATEGIES = [
    { id: 'timber', title: 'Timber Construction', desc: 'Replace concrete with timber.', label: '% Adoption', max_co2: 0.35, max_pol: 0.10, icon: '🏗️', color: '#8b5cf6', category: 'positive' },
    { id: 'cement', title: 'Green Cement', desc: 'Use low-clinker alternatives.', label: '% Mix', max_co2: 0.30, max_pol: 0.05, icon: '🏭', color: '#06b6d4', category: 'positive' },
    { id: 'retrofit', title: 'Retrofit Policy', desc: 'Renovate instead of demolish.', label: '% Projects', max_co2: 0.90, max_pol: 0.60, icon: '🔧', color: '#10b981', category: 'positive' },
    { id: 'transport', title: 'Public Transit', desc: 'Shift to light-rail/metro.', label: '% Shift', max_co2: 0.50, max_pol: 0.40, icon: '🚇', color: '#f59e0b', category: 'positive' },
    { id: 'ev', title: 'EV Adoption', desc: 'Electrify vehicle fleet.', label: '% Fleet', max_co2: 0.65, max_pol: 0.50, icon: '⚡', color: '#eab308', category: 'positive' },
    { id: 'trees', title: 'Urban Greening', desc: 'Expand tree canopy.', label: '% Target', max_co2: 0.15, max_pol: 0.20, icon: '🌳', color: '#22c55e', category: 'positive' },
    { id: 'ccs', title: 'Industrial CCS', desc: 'Carbon capture on stacks.', label: '% Stacks', max_co2: 0.75, max_pol: 0.30, icon: '🏭', color: '#ef4444', category: 'positive' },
    // NEGATIVE INTERVENTION: Parali Burning
    { id: 'parali', title: 'Parali Burning', desc: 'Source: 1 tonne = 1460kg CO₂', label: 'Intensity', max_co2: 1.46, max_pol: 0.80, icon: '🔥', color: '#dc2626', category: 'negative' }
];

let map;
let currentLocation = { lat: DEFAULT_LOC[1], lon: DEFAULT_LOC[0], label: 'Bhosari, Pune' };

let liveData = { pm2_5: 55, pm10: 90, co: 600, no2: 40, co2_baseline: 1000 }; 
let currentAQI = { value: 0, category: 'Unknown', color: '#64748b' };
let projectedAQI = { value: 0, category: 'Unknown', color: '#64748b' };

// Status Tracking
let dataStatus = { lastFetch: null, isLive: false, source: 'initializing', apiHealth: 'unknown', validationPassed: false };
const API_TIMEOUT = 8000; 
let auditLog = [];
let interventionPlacements = {}; 
let markerCounter = 0;
let draggedElement = null;
let draggedMarkerId = null;

// AQI Constants
const AQI_BREAKPOINTS = {
    pm2_5: [
        { cLow: 0.0, cHigh: 12.0, iLow: 0, iHigh: 50 },
        { cLow: 12.1, cHigh: 35.4, iLow: 51, iHigh: 100 },
        { cLow: 35.5, cHigh: 55.4, iLow: 101, iHigh: 150 },
        { cLow: 55.5, cHigh: 150.4, iLow: 151, iHigh: 200 },
        { cLow: 150.5, cHigh: 250.4, iLow: 201, iHigh: 300 },
        { cLow: 250.5, cHigh: 500.4, iLow: 301, iHigh: 500 }
    ],
    pm10: [
        { cLow: 0, cHigh: 54, iLow: 0, iHigh: 50 },
        { cLow: 55, cHigh: 154, iLow: 51, iHigh: 100 },
        { cLow: 155, cHigh: 254, iLow: 101, iHigh: 150 },
        { cLow: 255, cHigh: 354, iLow: 151, iHigh: 200 },
        { cLow: 355, cHigh: 424, iLow: 201, iHigh: 300 },
        { cLow: 425, cHigh: 604, iLow: 301, iHigh: 500 }
    ],
    co: [
        { cLow: 0.0, cHigh: 4400, iLow: 0, iHigh: 50 },
        { cLow: 4500, cHigh: 9400, iLow: 51, iHigh: 100 },
        { cLow: 9500, cHigh: 12400, iLow: 101, iHigh: 150 },
        { cLow: 12500, cHigh: 15400, iLow: 151, iHigh: 200 },
        { cLow: 15500, cHigh: 30400, iLow: 201, iHigh: 300 },
        { cLow: 30500, cHigh: 50400, iLow: 301, iHigh: 500 }
    ],
    no2: [
        { cLow: 0, cHigh: 53, iLow: 0, iHigh: 50 },
        { cLow: 54, cHigh: 100, iLow: 51, iHigh: 100 },
        { cLow: 101, cHigh: 360, iLow: 101, iHigh: 150 },
        { cLow: 361, cHigh: 649, iLow: 151, iHigh: 200 },
        { cLow: 650, cHigh: 1249, iLow: 201, iHigh: 300 },
        { cLow: 1250, cHigh: 2049, iLow: 301, iHigh: 500 }
    ]
};

const AQI_CATEGORIES = [
    { min: 0,   max: 50,  label: 'Good',                    color: '#10b981', description: 'Air quality is satisfactory' },
    { min: 51,  max: 100, label: 'Moderate',                color: '#f59e0b', description: 'Acceptable for most people' },
    { min: 101, max: 150, label: 'Unhealthy for Sensitive', color: '#fb923c', description: 'Sensitive groups may be affected' },
    { min: 151, max: 200, label: 'Unhealthy',               color: '#ef4444', description: 'Everyone may experience effects' },
    { min: 201, max: 300, label: 'Very Unhealthy',          color: '#dc2626', description: 'Health alert: serious effects' },
    { min: 301, max: 500, label: 'Hazardous',               color: '#991b1b', description: 'Emergency conditions: all affected' }
];

// =========================
// 1. LOCATION SEARCH (FIX)
// =========================
async function searchLocation() {
    const input = document.getElementById('location-input');
    const statusEl = document.getElementById('location-status');
    const query = input.value.trim();
    
    if(!query) {
        alert("Please enter a location name.");
        return;
    }

    if(statusEl) statusEl.textContent = "Searching...";
    
    try {
        const res = await fetch(API_CONFIG.geocoding.url(query));
        const data = await res.json();

        if (data.results && data.results.length > 0) {
            const loc = data.results[0];
            currentLocation = {
                lat: loc.latitude,
                lon: loc.longitude,
                label: `${loc.name}, ${loc.country}`
            };

            // Fly map to new location
            if (map) {
                map.flyTo({
                    center: [currentLocation.lon, currentLocation.lat],
                    zoom: 13,
                    essential: true
                });
            }

            if(statusEl) statusEl.textContent = currentLocation.label;
            
            // Log and Fetch new air data
            logAudit('LOCATION_CHANGE', `Moved to ${currentLocation.label}`, 'SUCCESS');
            initiateDataFetch();

        } else {
            if(statusEl) statusEl.textContent = "Location not found.";
            logAudit('SEARCH_FAILED', `No results for "${query}"`, 'WARNING');
        }
    } catch (e) {
        console.error("Geocoding Error", e);
        if(statusEl) statusEl.textContent = "Search Error.";
        logAudit('SEARCH_ERROR', e.message, 'FAILED');
    }
}

// =========================
// AQI CALCULATIONS
// =========================
function calculateAQI(pollutant, concentration) {
    const breakpoints = AQI_BREAKPOINTS[pollutant];
    if (!breakpoints) return 0;
    for (let bp of breakpoints) {
        if (concentration >= bp.cLow && concentration <= bp.cHigh) {
            return Math.round(((bp.iHigh - bp.iLow) / (bp.cHigh - bp.cLow)) * (concentration - bp.cLow) + bp.iLow);
        }
    }
    return concentration > breakpoints[breakpoints.length - 1].cHigh ? 500 : 0;
}

function getOverallAQI(data) {
    const aqis = {
        pm2_5: calculateAQI('pm2_5', data.pm2_5),
        pm10:  calculateAQI('pm10',  data.pm10),
        co:    calculateAQI('co',    data.co),
        no2:   calculateAQI('no2',   data.no2)
    };
    const maxAQI = Math.max(...Object.values(aqis));
    const category = AQI_CATEGORIES.find(cat => maxAQI >= cat.min && maxAQI <= cat.max) || AQI_CATEGORIES[AQI_CATEGORIES.length - 1];
    return {
        value: maxAQI,
        category: category.label,
        color: category.color,
        description: category.description,
        individual: aqis
    };
}

function updateAQIDisplay(currentData, projectedData) {
    currentAQI = getOverallAQI(currentData);
    projectedAQI = getOverallAQI(projectedData);
    const valAqiEl = document.getElementById('val-aqi');
    if (!valAqiEl) return; 

    valAqiEl.textContent = currentAQI.value;
    const badge = document.getElementById('aqi-badge');
    badge.textContent = currentAQI.category;
    badge.style.background = currentAQI.color;
    document.getElementById('aqi-card').style.borderLeftColor = currentAQI.color;
    
    const imp = currentAQI.value - projectedAQI.value;
    document.getElementById('aqi-change').innerHTML =
        imp > 0 ? `<span style="color:#10b981;">▼ ${imp} pts better</span>` :
        (imp < 0 ? `<span style="color:#ef4444;">▲ ${Math.abs(imp)} pts worse</span>` : 'No change');
    
    ['pm2_5','pm10','co','no2'].forEach(p =>
        document.getElementById(`aqi-${p.replace('_','')}`).textContent = currentAQI.individual[p]
    );
    const desc = document.getElementById('aqi-description');
    desc.textContent = currentAQI.description;
    desc.style.background = currentAQI.color + '20';
    desc.style.borderLeft = `3px solid ${currentAQI.color}`;
}

// =========================
// PANEL & SLIDERS
// =========================
function buildPanel() {
    // Looks for split sections first (new layout), then fallback to old single list
    const posSection = document.getElementById('int-positive-section');
    const negSection = document.getElementById('int-negative-section');
    const listEl     = document.getElementById('int-list') || document.getElementById('int-container');

    // Clear existing if any (to prevent duplicates on re-init)
    if(posSection) posSection.innerHTML = '';
    if(negSection) negSection.innerHTML = '';

    STRATEGIES.forEach(s => {
        const html = `
            <div class="int-group" data-intervention="${s.id}">
                <div class="int-header">
                    <span class="int-title" draggable="true" data-id="${s.id}">
                        <span class="drag-handle">⋮⋮</span>${s.icon} ${s.title}
                    </span>
                    <span class="int-perc" id="disp-${s.id}">0</span>
                </div>
                <div class="int-desc">${s.desc}</div>
                <input type="range" id="${s.id}" min="0" max="100" value="0"
                    oninput="updateVal('${s.id}')" onchange="updateSim()">
            </div>`;

        if (posSection && negSection) {
            if (s.category === 'negative') {
                negSection.insertAdjacentHTML('beforeend', html);
            } else {
                posSection.insertAdjacentHTML('beforeend', html);
            }
        } else if (listEl) {
            listEl.insertAdjacentHTML('beforeend', html);
        }
    });
}

function updateVal(id) {
    const slider = document.getElementById(id);
    if (!slider) return;
    const val = slider.value;
    let suffix = "%";
    // Special handling for labels if needed
    if (id === 'parali') suffix = ""; 

    const dispEl = document.getElementById(`disp-${id}`);
    if (dispEl) dispEl.innerText = val + suffix;

    const markers = document.querySelectorAll(`.intervention-marker[data-strategy-id="${id}"]`);
    const zones   = document.querySelectorAll(`.impact-zone[data-strategy-id="${id}"]`);
    
    // Update visual state of markers
    markers.forEach(m => {
        val > 0 ? m.classList.add('active') : m.classList.remove('active');
        // Update data-val for tooltip
        m.dataset.val = val;
    });
    zones.forEach(z => val > 0 ? z.classList.add('active') : z.classList.remove('active'));

    updateSim(); 
}

// =========================
// DRAG & DROP + MARKERS
// =========================
function setupDragAndDrop() {
    const titles = document.querySelectorAll('.int-title');
    const mapEl = document.getElementById('map');
    if (!mapEl) return;

    titles.forEach(title => {
        title.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('intervention-id', e.target.dataset.id);
            e.target.classList.add('dragging');
        });
        title.addEventListener('dragend', (e) => {
            e.target.classList.remove('dragging');
        });
    });

    mapEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });

    mapEl.addEventListener('drop', (e) => {
        e.preventDefault();
        const id = e.dataTransfer.getData('intervention-id');
        if (id) placeIntervention(id, e.clientX, e.clientY);
    });
    
    // Moving existing markers
    document.addEventListener('mousedown', (e) => {
        const marker = e.target.closest('.intervention-marker');
        if (marker) {
            draggedElement = marker;
            draggedMarkerId = marker.dataset.markerId;
            draggedElement.style.cursor = 'grabbing';
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (draggedElement && draggedMarkerId) {
            updateInterventionCoordinates(draggedMarkerId, e.clientX, e.clientY);
            draggedElement.style.left = (e.clientX - 30) + 'px';
            draggedElement.style.top  = (e.clientY - 30) + 'px';
            updateSim();
        }
    });

    document.addEventListener('mouseup', () => {
        if (draggedElement) {
            draggedElement.style.cursor = 'move';
            draggedElement = null;
            draggedMarkerId = null;
        }
    });
}

function placeIntervention(strategyId, x, y) {
    const strategy = STRATEGIES.find(s => s.id === strategyId);
    if (!strategy || !map) return;

    const markerId = `${strategyId}-${Date.now()}-${markerCounter++}`;
    const lngLat = map.unproject([x, y]);

    // Create Impact Zone (Circle)
    const zone = document.createElement('div');
    zone.className = 'impact-zone';
    zone.dataset.markerId = markerId;
    zone.dataset.strategyId = strategyId;
    zone.style.left = (x - 100) + 'px';
    zone.style.top  = (y - 100) + 'px';
    zone.style.borderColor = strategy.color;

    // Create Marker
    const marker = document.createElement('div');
    marker.className = 'intervention-marker';
    marker.dataset.markerId = markerId;
    marker.dataset.strategyId = strategyId;
    // CRITICAL for Tooltips:
    marker.dataset.type = strategyId; 
    marker.dataset.val = document.getElementById(strategyId).value || 0;

    marker.style.left = (x - 30) + 'px';
    marker.style.top  = (y - 30) + 'px';
    marker.style.background = strategy.color;
    marker.style.borderColor = strategy.color;
    marker.innerHTML = `
        <span class="marker-icon">${strategy.icon}</span>
        <div class="marker-label" style="color: ${strategy.color}">${strategy.title}</div>
        <button class="marker-delete" title="Remove" onclick="deleteInterventionMarker('${markerId}', event)">×</button>
    `;

    const container = document.getElementById('intervention-markers');
    if (!container) return;
    container.appendChild(zone);
    container.appendChild(marker);

    const sliderVal = parseInt(document.getElementById(strategyId).value);
    if (sliderVal > 0) {
        marker.classList.add('active');
        zone.classList.add('active');
    }

    interventionPlacements[markerId] = {
        markerId,
        strategyId,
        lngLat,
        screenX: x,
        screenY: y,
        strategy
    };

    updateSim();
}

function deleteInterventionMarker(markerId, event) {
    if (event) event.stopPropagation();
    const marker = document.querySelector(`.intervention-marker[data-marker-id="${markerId}"]`);
    const zone   = document.querySelector(`.impact-zone[data-marker-id="${markerId}"]`);
    if (marker) marker.remove();
    if (zone) zone.remove();
    delete interventionPlacements[markerId];
    updateSim();
}

function updateInterventionCoordinates(markerId, x, y) {
    const placement = interventionPlacements[markerId];
    if (!placement || !map) return;

    placement.lngLat = map.unproject([x, y]);
    placement.screenX = x;
    placement.screenY = y;

    const zone = document.querySelector(`.impact-zone[data-marker-id="${markerId}"]`);
    if (zone) {
        zone.style.left = (x - 100) + 'px';
        zone.style.top  = (y - 100) + 'px';
    }
}

function updateMarkerPositions() {
    if (!map) return;
    Object.values(interventionPlacements).forEach(p => {
        const point = map.project(p.lngLat);
        const marker = document.querySelector(`.intervention-marker[data-marker-id="${p.markerId}"]`);
        const zone   = document.querySelector(`.impact-zone[data-marker-id="${p.markerId}"]`);
        if (marker && !draggedElement) {
            marker.style.left = (point.x - 30) + 'px';
            marker.style.top  = (point.y - 30) + 'px';
        }
        if (zone) {
            zone.style.left = (point.x - 100) + 'px';
            zone.style.top  = (point.y - 100) + 'px';
        }
    });
}

// =========================
// MAP INIT
// =========================
function initMap() {
    if (!window.maplibregl) {
        console.error('maplibre-gl not loaded');
        return;
    }

    map = new maplibregl.Map({
        container: 'map',
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [currentLocation.lon, currentLocation.lat],
        zoom: 14,
        pitch: 60,
        bearing: -20,
        antialias: true
    });

    map.on('load', () => {
        // 3D Buildings
        map.addLayer({
            id: '3d-buildings',
            source: 'openfreemap',
            'source-layer': 'building',
            type: 'fill-extrusion',
            minzoom: 13,
            paint: {
                'fill-extrusion-color': '#222',
                'fill-extrusion-height': [
                    'interpolate', ['linear'], ['zoom'],
                    13, 0,
                    13.05, ['get', 'render_height']
                ],
                'fill-extrusion-base': ['get', 'render_min_height'],
                'fill-extrusion-opacity': 0.9
            }
        });

        // Heatmap Source
        map.addSource('pollution', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });

        // Heatmap Layer
        map.addLayer({
            id: 'pollution-heat',
            type: 'heatmap',
            source: 'pollution',
            maxzoom: 20,
            paint: {
                'heatmap-weight': ['interpolate', ['linear'], ['get', 'intensity'], 0, 0, 1, 1],
                'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 15, 2, 18, 3],
                'heatmap-color': [
                    'interpolate', ['linear'], ['heatmap-density'],
                    0, 'rgba(0,0,0,0)',
                    0.1, 'rgba(56, 189, 248, 0.6)',
                    0.3, 'rgba(16, 185, 129, 0.7)',
                    0.5, 'rgba(250, 204, 21, 0.8)',
                    0.7, 'rgba(251, 146, 60, 0.85)',
                    1, 'rgba(239, 68, 68, 0.9)'
                ],
                'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 15, 30, 18, 50],
                'heatmap-opacity': 0.8
            }
        });

        initiateDataFetch();
        map.on('move', updateMarkerPositions);
        map.on('zoom', updateMarkerPositions);
    });
}

// =========================
// DATA FETCH LOGIC
// =========================
function initiateDataFetch() {
    updateStatus('fetching', 'Connecting to Primary API...');
    logAudit('FETCH_INITIATED', 'Starting fetch sequence', 'INITIATED');
    
    fetchPrimaryAPI()
        .then(data => handleDataSuccess(data, 'primary'))
        .catch(error => {
            logAudit('PRIMARY_FAILED', error.message, 'FAILED');
            updateStatus('warning', 'Primary failed. Switching to OpenWeatherMap...');
            return fetchSecondaryAPI();
        })
        .then(data => { if (data) handleDataSuccess(data, 'secondary'); })
        .catch(error => {
            logAudit('TOTAL_FAILURE', 'Both APIs unresponsive', 'FAILED');
            handleTotalFailure();
        });
}

async function fetchPrimaryAPI() {
    const c = new AbortController();
    const id = setTimeout(() => c.abort(), API_TIMEOUT);
    try {
        const url = API_CONFIG.primary.url(currentLocation.lat, currentLocation.lon);
        const r = await fetch(url, { signal: c.signal });
        clearTimeout(id);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = await r.json();
        if (!d.current) throw new Error('Invalid structure');
        return {
            pm2_5: d.current.pm2_5,
            pm10:  d.current.pm10,
            co:    d.current.carbon_monoxide,
            no2:   d.current.nitrogen_dioxide
        };
    } catch (e) {
        clearTimeout(id);
        throw e;
    }
}

async function fetchSecondaryAPI() {
    if (API_CONFIG.secondary.key.includes('INSERT')) throw new Error('Missing OpenWeatherMap Key');
    const c = new AbortController();
    const id = setTimeout(() => c.abort(), API_TIMEOUT);
    try {
        const url = API_CONFIG.secondary.url(currentLocation.lat, currentLocation.lon, API_CONFIG.secondary.key);
        const r = await fetch(url, { signal: c.signal });
        clearTimeout(id);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = await r.json();
        if (!d.list || !d.list[0].components) throw new Error('Missing AQI data');
        const comp = d.list[0].components;
        return {
            pm2_5: comp.pm2_5,
            pm10:  comp.pm10,
            co:    comp.co, // OpenWeather returns CO in µg/m3, Meteo in µg/m3 (usually), check docs.
            no2:   comp.no2
        };
    } catch (e) {
        clearTimeout(id);
        throw e;
    }
}

function handleDataSuccess(newData, source) {
    if (!validateDataRanges(newData)) {
        logAudit('VALIDATION_FAILED', `Bad data from ${source}`, 'FAILED');
        if (source === 'primary') throw new Error('Validation failed'); 
        return handleTotalFailure(); 
    }
    liveData = { ...newData, co2_baseline: 1000 };
    dataStatus = {
        lastFetch: new Date(),
        isLive: true,
        source,
        apiHealth: 'healthy',
        validationPassed: true
    };
    updateStatus('success', `Live: ${source === 'primary' ? 'Open-Meteo' : 'OpenWeatherMap'}`);
    logAudit('DATA_UPDATE', `Updated via ${source}`, 'SUCCESS');
    updateSim();
    setTimeout(initiateDataFetch, 15 * 60 * 1000);
}

function handleTotalFailure() {
    dataStatus = { ...dataStatus, apiHealth: 'failed', source: 'fallback' };
    updateStatus('fallback', 'System Offline (Using Fallback)');
    logAudit('FALLBACK_ACTIVATED', 'Using hardcoded simulation data', 'FALLBACK');
    updateSim();
    setTimeout(initiateDataFetch, 2 * 60 * 1000);
}

function validateDataRanges(d) {
    return !(d.pm2_5 < 0 || d.pm2_5 > 900 || d.pm10 < 0 || d.pm10 > 1000);
}

function updateStatus(type, msg) {
    const ind = document.getElementById('status-indicator');
    const txt = document.getElementById('status-text');
    const time = document.getElementById('status-time');
    const c = {
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        fallback: '#8b5cf6',
        fetching: '#3b82f6'
    };
    if (!ind || !txt || !time) return;
    ind.style.background = c[type] || '#64748b';
    txt.textContent = msg;
    time.textContent = dataStatus.lastFetch ?
        `Updated: ${dataStatus.lastFetch.toLocaleTimeString()}` : 'Waiting...';
}

function logAudit(action, details, status) {
    auditLog.unshift({
        timestamp: new Date().toISOString(),
        action,
        details,
        status
    });
    if (auditLog.length > 50) auditLog.pop();
}

// =========================
// 2. SIMULATION & UNITS ENGINE
// =========================
function updateSim() {
    if (!map) return;

    const pollutantSelect = document.getElementById('pollutant');
    if (!pollutantSelect) return;
    const type = pollutantSelect.value;

    // Unit Definitions
    const units = {
        'pm2_5': 'µg/m³',
        'pm10': 'µg/m³',
        'co': 'mg/m³',
        'no2': 'µg/m³',
        'co2': 'Tonnes',
        'aqi': 'Index'
    };
    const unitStr = units[type] || '';

    const base = type === 'aqi'
        ? currentAQI.value
        : (type === 'co2' ? liveData.co2_baseline : liveData[type]);

    let totalPolRed = 0, totalCo2Red = 0;
    let totalPolInc = 0, totalCo2Inc = 0;

    // Count markers
    const counts = {};
    Object.values(interventionPlacements).forEach(p => {
        counts[p.strategyId] = (counts[p.strategyId] || 0) + 1;
    });

    STRATEGIES.forEach(s => {
        const sliderEl = document.getElementById(s.id);
        if (!sliderEl) return;
        const v = parseInt(sliderEl.value);
        const markerCount = counts[s.id] || 0;

        if (v > 0 && markerCount > 0) {
            let f = (v / 100) * markerCount;
            if (f > 1.5) f = 1.5; 

            let w = 0.5; 
            if (type.includes('pm') && s.max_pol > 0.4) w = 1.0; 
            if ((type === 'co' || type === 'no2') && s.id === 'ev') w = 1.2;
            if (type === 'aqi' && s.max_pol > 0.3) w = 0.8;
            
            if (s.id === 'parali') {
                totalPolInc  += (s.max_pol * f * w * 0.4);
                totalCo2Inc  += (s.max_co2 * f);
            } else {
                totalPolRed  += (s.max_pol * f * w * 0.4); 
                totalCo2Red  += (s.max_co2 * f * 0.5);
            }
        }
    });
    
    if (totalPolRed > 0.95) totalPolRed = 0.95;
    if (totalCo2Red > 0.95) totalCo2Red = 0.95;

    const netFactorPol = (1 - totalPolRed) * (1 + totalPolInc);
    const netFactorCo2 = (1 - totalCo2Red) * (1 + totalCo2Inc);

    const proj = { 
        pm2_5: liveData.pm2_5 * netFactorPol, 
        pm10:  liveData.pm10  * netFactorPol, 
        co:    liveData.co    * netFactorPol, 
        no2:   liveData.no2   * netFactorPol 
    };
    
    let final;
    const valCurEl = document.getElementById('val-cur');
    const valSimEl = document.getElementById('val-sim');
    const lblCurEl = document.getElementById('lbl-cur');
    const lblSimEl = document.getElementById('lbl-sim');

    // Helper to inject unit span safely
    const setLabel = (el, text) => {
        el.innerHTML = `${text} <span style="font-size:0.8em; color:#64748b; font-weight:400;">${unitStr}</span>`;
    };

    if (type === 'aqi') {
        projectedAQI = getOverallAQI(proj);
        final = projectedAQI.value;
        if (lblCurEl) setLabel(lblCurEl, 'Current AQI');
        if (lblSimEl) setLabel(lblSimEl, 'Projected AQI');
        if (valCurEl) valCurEl.innerText = Math.round(base);
        if (valSimEl) valSimEl.innerText = Math.round(final);
    } else if (type === 'co2') {
        final = base * netFactorCo2;
        if (lblCurEl) setLabel(lblCurEl, 'Current CO₂e');
        if (lblSimEl) setLabel(lblSimEl, 'Projected CO₂e');
        if (valCurEl) valCurEl.innerText = Math.round(base);
        if (valSimEl) valSimEl.innerText = Math.round(final);
    } else {
        final = base * netFactorPol;
        if (lblCurEl) setLabel(lblCurEl, 'Current Level');
        if (lblSimEl) setLabel(lblSimEl, 'Projected Level');
        if (valCurEl) valCurEl.innerText = base.toFixed(1);
        if (valSimEl) valSimEl.innerText = final.toFixed(1);
    }
    
    // Smart CO2 Label
    const co2Card = document.getElementById('co2-card');
    const co2Label = document.getElementById('lbl-co2');
    const co2Val = document.getElementById('val-co2');
    
    const netChange = (netFactorCo2 - 1) * 100;
    if (co2Card && co2Label && co2Val) {
        if (netChange > 0.1) {
            co2Card.style.borderLeftColor = '#dc2626';
            co2Card.style.background = 'rgba(239, 68, 68, 0.05)';
            co2Label.textContent = 'Total CO₂e INCREASE';
            co2Val.textContent = `+${netChange.toFixed(0)}%`;
            co2Val.style.color = '#dc2626';
        } else {
            co2Card.style.borderLeftColor = '#10b981';
            co2Card.style.background = 'rgba(16, 185, 129, 0.05)';
            co2Label.textContent = 'Total CO₂e Reduction';
            co2Val.textContent = `${netChange.toFixed(0)}%`;
            co2Val.style.color = '#34d399';
        }
    }

    updateAQIDisplay(liveData, proj);
    drawHeatCloud(final, type, totalPolRed, totalPolInc);
}

// =========================
// HEATMAP PAINTER
// =========================
function drawHeatCloud(intensity, visualMode, totalReduction, totalIncrease) {
    if (!map) return;

    const c = currentLocation;
    const hotspots = [
        { lng: c.lon - 0.003, lat: c.lat + 0.002, type: 'industrial',   baseMultiplier: 1.8, radius: 0.008 },
        { lng: c.lon + 0.002, lat: c.lat,         type: 'traffic',      baseMultiplier: 1.6, radius: 0.007 },
        { lng: c.lon - 0.001, lat: c.lat - 0.002, type: 'construction', baseMultiplier: 1.7, radius: 0.006 },
        { lng: c.lon + 0.004, lat: c.lat + 0.003, type: 'residential',  baseMultiplier: 1.0, radius: 0.009 },
        { lng: c.lon - 0.004, lat: c.lat - 0.001, type: 'traffic',      baseMultiplier: 1.4, radius: 0.006 }
    ];

    const features = [];

    const interventions = {};
    STRATEGIES.forEach(s => {
        const slider = document.getElementById(s.id);
        interventions[s.id] = slider ? parseInt(slider.value) / 100 : 0;
    });

    function getImpact(lng, lat) {
        let reduction = 0;
        let increase = 0;
        Object.values(interventionPlacements).forEach(p => {
            const v = interventions[p.strategyId] || 0;
            if (v > 0) {
                const dx = (lng - p.lngLat.lng) * 111000;
                const dy = (lat - p.lngLat.lat) * 111000;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist < 500) {
                    const effect = (1 - dist/500) * v * 0.5;
                    if (p.strategyId === 'parali') increase += effect;
                    else reduction += effect;
                }
            }
        });
        return { red: Math.min(reduction, 0.9), inc: increase };
    }

    hotspots.forEach(h => {
        for (let i = 0; i < 60; i++) {
            const r = h.radius * Math.sqrt(Math.random());
            const theta = Math.random() * 2 * Math.PI;
            const lng = h.lng + r * Math.cos(theta);
            const lat = h.lat + r * Math.sin(theta);
            
            const local = getImpact(lng, lat);
            let val = (intensity/100) * h.baseMultiplier 
                * (1 - totalReduction*0.5) 
                * (1 + totalIncrease)
                * (1 - local.red)
                * (1 + local.inc);
                
            if (visualMode === 'aqi') {
                val = (intensity/300) * h.baseMultiplier * (1 - local.red) * (1 + local.inc);
            }
            
            val *= (0.8 + Math.random()*0.4);
            if (val > 1) val = 1;
            if (val > 0.05) {
                features.push({
                    type: 'Feature',
                    properties: { intensity: val },
                    geometry: { type: 'Point', coordinates: [lng, lat] }
                });
            }
        }
    });

    const src = map.getSource('pollution');
    if (src) src.setData({ type: 'FeatureCollection', features });
}

// =========================
// AUDIT LOG
// =========================
function showAuditLog() {
    const m = document.createElement('div');
    m.style.cssText = `
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.8);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(5px);
    `;
    const c = document.createElement('div');
    c.style.cssText = `
        background: #0f172a;
        border: 2px solid #334155;
        border-radius: 12px;
        padding: 30px;
        max-width: 800px;
        max-height: 80vh;
        overflow-y: auto;
        width: 90%;
    `;
    const srcC = dataStatus.source === 'primary'
        ? '#10b981'
        : (dataStatus.source === 'secondary' ? '#f59e0b' : '#8b5cf6');
    let h = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <h3 style="margin:0; color:#f8fafc; font-size:20px;">Security & Failover Log</h3>
            <button onclick="this.parentElement.parentElement.parentElement.remove()"
                style="background:#ef4444; border:none; color:white; padding:8px 16px; border-radius:6px; cursor:pointer; font-weight:700;">
                Close
            </button>
        </div>
        <div style="background:rgba(255,255,255,0.03); padding:15px; border-radius:8px; margin-bottom:15px;">
            <div style="font-size:11px; color:#94a3b8; margin-bottom:10px;">ACTIVE SOURCE</div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; font-size:12px;">
                <div>
                    <span style="color:#64748b;">Current API:</span>
                    <span style="color:${srcC}; font-weight:700; text-transform:uppercase;">${dataStatus.source}</span>
                </div>
                <div>
                    <span style="color:#64748b;">Status:</span>
                    <span style="color:${dataStatus.apiHealth === 'healthy' ? '#10b981' : '#ef4444'}; font-weight:700;">
                        ${dataStatus.apiHealth.toUpperCase()}
                    </span>
                </div>
            </div>
        </div>
        <div style="font-size:11px; color:#94a3b8; margin-bottom:10px;">SYSTEM EVENTS</div>
        <div style="background:#000; border-radius:8px; padding:15px; max-height:400px; overflow-y:auto; font-family:monospace; font-size:11px;">
    `;
    auditLog.forEach(e => {
        const col = {
            'SUCCESS': '#10b981',
            'FAILED': '#ef4444',
            'WARNING': '#f59e0b',
            'INITIATED': '#3b82f6',
            'FALLBACK': '#a855f7'
        }[e.status] || '#64748b';
        h += `
            <div style="border-bottom:1px solid #1e293b; padding:10px 0;">
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <span style="color:#e2e8f0; font-weight:700;">${e.action}</span>
                    <span style="color:${col}; font-weight:700;">${e.status}</span>
                </div>
                <div style="color:#94a3b8; font-size:10px;">${e.timestamp}</div>
                <div style="color:#cbd5e1; font-size:10px;">${e.details}</div>
            </div>
        `;
    });
    h += `</div>`;
    c.innerHTML = h;
    m.appendChild(c);
    document.body.appendChild(m);
    m.onclick = (e) => { if (e.target === m) m.remove(); };
}

// =========================
// PUBLIC INIT FUNCTION
// =========================
function initDharaTwin() {
    buildPanel();
    initMap();
    setupDragAndDrop();
}

// GLOBAL EXPORTS
window.initDharaTwin = initDharaTwin;
window.updateSim = updateSim;
window.updateVal = updateVal;
window.showAuditLog = showAuditLog;
window.searchLocation = searchLocation;
window.deleteInterventionMarker = deleteInterventionMarker;