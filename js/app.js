// Public visualization page

// Initialize map - global view
const map = L.map('map', {
    center: [20, 0],
    zoom: 1.5,
    minZoom: 1,
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
let sortedPhotoIndices = [];
let previousMapView = null; // Store map view before gallery opens

// DOM elements
const hoverPreview = document.getElementById('hover-preview');
const gallery = document.getElementById('gallery');
const galleryImage = document.getElementById('gallery-image');
const galleryTitle = document.getElementById('gallery-title');
const galleryDate = document.getElementById('gallery-date');
const galleryThumbnails = document.getElementById('gallery-thumbnails');
const timeline = document.getElementById('timeline');

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
function createMarker(visit, zIndex = 100) {
    const icon = L.divIcon({
        className: 'city-marker',
        iconSize: [16, 16],
        iconAnchor: [8, 8]
    });

    const marker = L.marker([visit.lat, visit.lng], { icon, zIndexOffset: zIndex })
        .addTo(map);

    // Hover preview
    marker.on('mouseover', (e) => showHoverPreview(e, visit));
    marker.on('mouseout', hideHoverPreview);
    marker.on('click', () => {
        previousMapView = { center: map.getCenter(), zoom: map.getZoom() };
        openGallery(visit);
    });

    markers.push({ marker, visit });
    return marker;
}

// Sort photos by date (newest first)
function getSortedPhotos(photos) {
    if (!photos || photos.length === 0) return [];
    return [...photos].sort((a, b) => {
        const dateA = typeof a === 'string' ? '' : (a.date || '');
        const dateB = typeof b === 'string' ? '' : (b.date || '');
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateB.localeCompare(dateA);
    });
}

// Show hover preview with max 9 images (sorted by date)
function showHoverPreview(e, visit) {
    if (!visit.photos || visit.photos.length === 0) return;

    const previewTitle = hoverPreview.querySelector('.hover-preview-title');
    const previewGrid = hoverPreview.querySelector('.hover-preview-grid');

    previewTitle.textContent = `${visit.city}, ${visit.country}`;

    const sortedPhotos = getSortedPhotos(visit.photos);
    const photos = sortedPhotos.slice(0, 9);
    const remaining = sortedPhotos.length - 9;

    // Photos are now objects with .path
    previewGrid.innerHTML = photos.map(p => {
        const photoPath = typeof p === 'string' ? p : p.path;
        return `<img src="photos/${photoPath}" alt="">`;
    }).join('');

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
function openGallery(visit, startPhotoIndex = null) {
    if (!visit.photos || visit.photos.length === 0) return;

    currentVisit = visit;

    // Sort photos by date and track original indices
    const photosWithIndex = visit.photos.map((p, i) => ({ photo: p, originalIndex: i }));
    photosWithIndex.sort((a, b) => {
        const dateA = typeof a.photo === 'string' ? '' : (a.photo.date || '');
        const dateB = typeof b.photo === 'string' ? '' : (b.photo.date || '');
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateB.localeCompare(dateA);
    });
    sortedPhotoIndices = photosWithIndex.map(p => p.originalIndex);

    // Find starting position
    if (startPhotoIndex !== null) {
        currentPhotoIndex = sortedPhotoIndices.indexOf(startPhotoIndex);
        if (currentPhotoIndex < 0) currentPhotoIndex = 0;
    } else {
        currentPhotoIndex = 0;
    }

    galleryTitle.textContent = `${visit.city}, ${visit.country}`;

    // Build thumbnails in sorted order
    galleryThumbnails.innerHTML = photosWithIndex.map((item, i) => {
        const photoPath = typeof item.photo === 'string' ? item.photo : item.photo.path;
        return `<div class="gallery-thumb ${i === currentPhotoIndex ? 'active' : ''}" data-index="${i}">
            <img src="photos/${photoPath}" alt="">
        </div>`;
    }).join('');

    updateGalleryImage();
    gallery.classList.remove('hidden');

    // Highlight corresponding timeline item
    highlightTimelineItem(visit);
}

function closeGallery() {
    gallery.classList.add('hidden');
    currentVisit = null;
    sortedPhotoIndices = [];
    clearTimelineHighlight();

    // Restore previous map view
    if (previousMapView) {
        map.flyTo(previousMapView.center, previousMapView.zoom, { duration: 0.5 });
        previousMapView = null;
    }
}

function updateGalleryImage() {
    if (!currentVisit || sortedPhotoIndices.length === 0) return;

    const originalIndex = sortedPhotoIndices[currentPhotoIndex];
    const photo = currentVisit.photos[originalIndex];
    const photoPath = typeof photo === 'string' ? photo : photo.path;
    const photoDate = typeof photo === 'string' ? '' : (photo.date || '');

    galleryImage.src = `photos/${photoPath}`;
    galleryDate.textContent = photoDate;

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

// Timeline - vertical left sidebar with photo previews
function buildTimeline() {
    // Build entries for each unique date per city (skip empty dates)
    const entries = [];
    visits.forEach((visit) => {
        if (!visit.photos || visit.photos.length === 0) return;

        // Group photos by date
        const dateMap = {};
        visit.photos.forEach((photo, photoIndex) => {
            const date = typeof photo === 'string' ? '' : (photo.date || '');
            if (!date) return; // Skip photos without date
            if (!dateMap[date]) {
                dateMap[date] = { photos: [], firstPhotoIndex: photoIndex };
            }
            dateMap[date].photos.push(photo);
        });

        // Create entry for each date
        Object.keys(dateMap).forEach(date => {
            entries.push({
                visit,
                date,
                photos: dateMap[date].photos,
                firstPhotoIndex: dateMap[date].firstPhotoIndex
            });
        });
    });

    // Sort entries by date (newest first)
    entries.sort((a, b) => b.date.localeCompare(a.date));

    // Store entries for click handler
    timeline.entries = entries;

    // Group entries by month for headers
    let currentMonth = '';
    let html = '';

    entries.forEach((entry, i) => {
        const entryMonth = entry.date.substring(0, 7); // YYYY-MM

        // Add month header if new month
        if (entryMonth !== currentMonth) {
            currentMonth = entryMonth;
            const d = new Date(entry.date + '-01');
            const monthLabel = d.toLocaleString('en', { month: 'long', year: 'numeric' });
            html += `<div class="timeline-month-header">${monthLabel}</div>`;
        }

        // Get up to 5 photos for preview
        const previewPhotos = entry.photos.slice(0, 5);

        html += `
            <div class="timeline-entry" data-index="${i}">
                <div class="timeline-entry-header">
                    <img class="timeline-flag" src="${getFlagUrl(entry.visit.countryCode)}" alt="${entry.visit.country}"
                         onerror="this.style.display='none'">
                    <div class="timeline-entry-info">
                        <div class="timeline-entry-city">${entry.visit.city}</div>
                        <div class="timeline-entry-date">${entry.date} · ${entry.photos.length} photos</div>
                    </div>
                </div>
                <div class="timeline-photos">
                    ${previewPhotos.map(p => {
                        const photoPath = typeof p === 'string' ? p : p.path;
                        return `<div class="timeline-photo"><img src="photos/${photoPath}" alt=""></div>`;
                    }).join('')}
                </div>
            </div>`;
    });

    timeline.innerHTML = html || '<div style="padding: 20px; color: #888; text-align: center;">No photos yet</div>';
}

function highlightTimelineItem(visit, date) {
    clearTimelineHighlight();
    if (!timeline.entries) return;

    const entries = timeline.querySelectorAll('.timeline-entry');
    entries.forEach((el) => {
        const index = parseInt(el.dataset.index);
        const entry = timeline.entries[index];
        if (entry && entry.visit === visit && (!date || entry.date === date)) {
            el.classList.add('active');
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    });
}

function clearTimelineHighlight() {
    timeline.querySelectorAll('.timeline-entry').forEach(el => {
        el.classList.remove('active');
    });
}

// Timeline click handler
timeline.addEventListener('click', (e) => {
    const entryEl = e.target.closest('.timeline-entry');
    if (!entryEl || !timeline.entries) return;

    const index = parseInt(entryEl.dataset.index);
    const entry = timeline.entries[index];
    if (!entry) return;

    // Save current map view before flying
    previousMapView = { center: map.getCenter(), zoom: map.getZoom() };

    // Fly to city on map (use moderate zoom level)
    map.flyTo([entry.visit.lat, entry.visit.lng], 6, { duration: 1 });

    // Open gallery at the first photo of this date
    openGallery(entry.visit, entry.firstPhotoIndex);
});


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

        // Add markers (cities with more photos get higher z-index)
        visits.forEach(visit => {
            const photoCount = visit.photos ? visit.photos.length : 0;
            createMarker(visit, photoCount * 10);
        });

        // Build timeline
        buildTimeline();

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
