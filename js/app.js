// Public visualization page - read only

// Initialize map
const map = L.map('map', {
    center: [20, 0],
    zoom: 2,
    minZoom: 2,
    maxZoom: 18,
    worldCopyJump: true
});

// Add dark tile layer
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 19
}).addTo(map);

// State
let countriesLayer = null;
let visitedCountryCodes = new Set();
let visits = [];

// Lightbox state
let currentPhotos = [];
let currentPhotoIndex = 0;

// DOM elements
const lightbox = document.getElementById('lightbox');
const lightboxImage = document.getElementById('lightbox-image');
const lightboxCity = document.getElementById('lightbox-city');
const lightboxDate = document.getElementById('lightbox-date');
const lightboxCurrent = document.getElementById('lightbox-current');
const lightboxTotal = document.getElementById('lightbox-total');
const countryCount = document.getElementById('country-count');
const cityCount = document.getElementById('city-count');

// Load countries GeoJSON
async function loadCountries() {
    try {
        const response = await fetch('https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson');
        const data = await response.json();

        countriesLayer = L.geoJSON(data, {
            style: () => ({
                fillColor: 'transparent',
                fillOpacity: 0,
                color: 'transparent',
                weight: 0
            }),
            onEachFeature: (feature, layer) => {
                layer.feature = feature;
            }
        }).addTo(map);

    } catch (error) {
        console.error('Failed to load countries:', error);
    }
}

// Highlight visited countries
function highlightCountries() {
    if (!countriesLayer) return;

    countriesLayer.eachLayer(layer => {
        const code = layer.feature.properties.ISO_A2;
        if (visitedCountryCodes.has(code)) {
            layer.setStyle({
                fillColor: '#00d4aa',
                fillOpacity: 0.25,
                color: '#00d4aa',
                weight: 1
            });
        }
    });
}

// Create marker
function createMarker(visit) {
    const icon = L.divIcon({
        className: 'city-marker',
        iconSize: [16, 16],
        iconAnchor: [8, 8]
    });

    const marker = L.marker([visit.lat, visit.lng], { icon })
        .addTo(map)
        .bindTooltip(visit.city, {
            direction: 'top',
            offset: [0, -10]
        });

    marker.on('click', () => openLightbox(visit));
    return marker;
}

// Lightbox
function openLightbox(visit) {
    if (!visit.photos || visit.photos.length === 0) return;

    currentPhotos = visit.photos;
    currentPhotoIndex = 0;

    lightboxCity.textContent = `${visit.city}, ${visit.country}`;
    lightboxDate.textContent = visit.date || '';
    lightboxTotal.textContent = currentPhotos.length;

    updateLightboxImage();
    lightbox.classList.remove('hidden');
}

function closeLightbox() {
    lightbox.classList.add('hidden');
    currentPhotos = [];
    currentPhotoIndex = 0;
}

function updateLightboxImage() {
    lightboxImage.src = `photos/${currentPhotos[currentPhotoIndex]}`;
    lightboxCurrent.textContent = currentPhotoIndex + 1;
    document.querySelector('.lightbox-prev').disabled = currentPhotoIndex === 0;
    document.querySelector('.lightbox-next').disabled = currentPhotoIndex === currentPhotos.length - 1;
}

function navigateLightbox(direction) {
    const newIndex = currentPhotoIndex + direction;
    if (newIndex >= 0 && newIndex < currentPhotos.length) {
        currentPhotoIndex = newIndex;
        updateLightboxImage();
    }
}

// Update stats
function updateStats() {
    countryCount.textContent = visitedCountryCodes.size;
    cityCount.textContent = visits.length;
}

// Load travel data
async function loadData() {
    try {
        const response = await fetch('data.json');
        const data = await response.json();
        visits = data.visits || [];

        // Collect country codes
        visits.forEach(visit => {
            if (visit.countryCode) {
                visitedCountryCodes.add(visit.countryCode);
            }
        });

        // Highlight countries
        highlightCountries();

        // Add markers
        visits.forEach(visit => createMarker(visit));

        // Update stats
        updateStats();

    } catch (error) {
        console.error('Failed to load data:', error);
    }
}

// Event listeners
document.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
document.querySelector('.lightbox-overlay').addEventListener('click', closeLightbox);
document.querySelector('.lightbox-prev').addEventListener('click', () => navigateLightbox(-1));
document.querySelector('.lightbox-next').addEventListener('click', () => navigateLightbox(1));

// Keyboard navigation
document.addEventListener('keydown', e => {
    if (lightbox.classList.contains('hidden')) return;
    switch (e.key) {
        case 'Escape': closeLightbox(); break;
        case 'ArrowLeft': navigateLightbox(-1); break;
        case 'ArrowRight': navigateLightbox(1); break;
    }
});

// Initialize
async function init() {
    await loadCountries();
    await loadData();
}

init();
