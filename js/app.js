// Public visualization page

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
let markers = [];

// Gallery state
let currentVisit = null;
let currentPhotoIndex = 0;

// DOM elements
const hoverPreview = document.getElementById('hover-preview');
const gallery = document.getElementById('gallery');
const galleryImage = document.getElementById('gallery-image');
const galleryTitle = document.getElementById('gallery-title');
const galleryDate = document.getElementById('gallery-date');
const galleryThumbnails = document.getElementById('gallery-thumbnails');
const timeline = document.getElementById('timeline');
const countryCount = document.getElementById('country-count');
const cityCount = document.getElementById('city-count');

// Get country flag URL
function getFlagUrl(countryCode) {
    return `https://flagcdn.com/w40/${countryCode.toLowerCase()}.png`;
}

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
        const props = layer.feature.properties;
        const code = props['ISO3166-1-Alpha-2'] || props.ISO_A2 || props.iso_a2;
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

// Create marker with hover preview
function createMarker(visit) {
    const icon = L.divIcon({
        className: 'city-marker',
        iconSize: [16, 16],
        iconAnchor: [8, 8]
    });

    const marker = L.marker([visit.lat, visit.lng], { icon })
        .addTo(map);

    // Hover preview
    marker.on('mouseover', (e) => showHoverPreview(e, visit));
    marker.on('mouseout', hideHoverPreview);
    marker.on('click', () => openGallery(visit));

    markers.push({ marker, visit });
    return marker;
}

// Show hover preview with max 5 images
function showHoverPreview(e, visit) {
    if (!visit.photos || visit.photos.length === 0) return;

    const previewTitle = hoverPreview.querySelector('.hover-preview-title');
    const previewGrid = hoverPreview.querySelector('.hover-preview-grid');

    previewTitle.textContent = `${visit.city}, ${visit.country}`;

    const photos = visit.photos.slice(0, 5);
    const remaining = visit.photos.length - 5;

    previewGrid.innerHTML = photos.map(p =>
        `<img src="photos/${p}" alt="">`
    ).join('');

    if (remaining > 0) {
        previewGrid.innerHTML += `<div class="hover-preview-more">+${remaining}</div>`;
    }

    // Position preview
    const point = map.latLngToContainerPoint(e.latlng);
    hoverPreview.style.left = `${point.x + 20}px`;
    hoverPreview.style.top = `${point.y - 20}px`;
    hoverPreview.classList.add('visible');
}

function hideHoverPreview() {
    hoverPreview.classList.remove('visible');
}

// iPhone-style Gallery
function openGallery(visit) {
    if (!visit.photos || visit.photos.length === 0) return;

    currentVisit = visit;
    currentPhotoIndex = 0;

    galleryTitle.textContent = `${visit.city}, ${visit.country}`;
    galleryDate.textContent = visit.date || '';

    // Build thumbnails
    galleryThumbnails.innerHTML = visit.photos.map((p, i) =>
        `<div class="gallery-thumb ${i === 0 ? 'active' : ''}" data-index="${i}">
            <img src="photos/${p}" alt="">
        </div>`
    ).join('');

    updateGalleryImage();
    gallery.classList.remove('hidden');

    // Highlight corresponding timeline item
    highlightTimelineItem(visit);
}

function closeGallery() {
    gallery.classList.add('hidden');
    currentVisit = null;
    clearTimelineHighlight();
}

function updateGalleryImage() {
    if (!currentVisit) return;
    galleryImage.src = `photos/${currentVisit.photos[currentPhotoIndex]}`;

    // Update thumbnail active state
    galleryThumbnails.querySelectorAll('.gallery-thumb').forEach((thumb, i) => {
        thumb.classList.toggle('active', i === currentPhotoIndex);
    });

    // Scroll active thumbnail into view
    const activeThumb = galleryThumbnails.querySelector('.gallery-thumb.active');
    if (activeThumb) {
        activeThumb.scrollIntoView({ behavior: 'smooth', inline: 'center' });
    }
}

function navigateGallery(direction) {
    if (!currentVisit) return;
    const newIndex = currentPhotoIndex + direction;
    if (newIndex >= 0 && newIndex < currentVisit.photos.length) {
        currentPhotoIndex = newIndex;
        updateGalleryImage();
    }
}

// Timeline
function buildTimeline() {
    // Sort visits by date (newest first)
    const sortedVisits = [...visits].sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return b.date.localeCompare(a.date);
    });

    timeline.innerHTML = sortedVisits.map((visit, i) => `
        <div class="timeline-item" data-index="${i}">
            <img class="timeline-flag" src="${getFlagUrl(visit.countryCode)}" alt="${visit.country}"
                 onerror="this.style.display='none'">
            <span class="timeline-city">${visit.city}</span>
            <span class="timeline-date">${visit.date || ''}</span>
        </div>
    `).join('');

    // Store sorted visits for reference
    timeline.sortedVisits = sortedVisits;
}

function highlightTimelineItem(visit) {
    clearTimelineHighlight();
    const items = timeline.querySelectorAll('.timeline-item');
    items.forEach((item, i) => {
        if (timeline.sortedVisits[i] === visit) {
            item.classList.add('active');
            item.scrollIntoView({ behavior: 'smooth', inline: 'center' });
        }
    });
}

function clearTimelineHighlight() {
    timeline.querySelectorAll('.timeline-item').forEach(item => {
        item.classList.remove('active');
    });
}

// Timeline click handler
timeline.addEventListener('click', (e) => {
    const item = e.target.closest('.timeline-item');
    if (!item) return;

    const index = parseInt(item.dataset.index);
    const visit = timeline.sortedVisits[index];

    // Fly to city on map
    map.flyTo([visit.lat, visit.lng], 10, { duration: 1 });

    // Open gallery
    openGallery(visit);
});

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

        // Build timeline
        buildTimeline();

        // Update stats
        updateStats();

    } catch (error) {
        console.error('Failed to load data:', error);
    }
}

// Gallery event listeners
document.querySelector('.gallery-close').addEventListener('click', closeGallery);
document.querySelector('.gallery-nav.prev').addEventListener('click', () => navigateGallery(-1));
document.querySelector('.gallery-nav.next').addEventListener('click', () => navigateGallery(1));

galleryThumbnails.addEventListener('click', (e) => {
    const thumb = e.target.closest('.gallery-thumb');
    if (thumb) {
        currentPhotoIndex = parseInt(thumb.dataset.index);
        updateGalleryImage();
    }
});

// Keyboard navigation
document.addEventListener('keydown', e => {
    if (gallery.classList.contains('hidden')) return;
    switch (e.key) {
        case 'Escape': closeGallery(); break;
        case 'ArrowLeft': navigateGallery(-1); break;
        case 'ArrowRight': navigateGallery(1); break;
    }
});

// Swipe support for gallery
let touchStartX = 0;
gallery.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
});

gallery.addEventListener('touchend', (e) => {
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    if (Math.abs(diff) > 50) {
        navigateGallery(diff > 0 ? 1 : -1);
    }
});

// Initialize
async function init() {
    await loadCountries();
    await loadData();
}

init();
