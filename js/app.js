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

// Timeline - fixed 12 month display with scroll back
function buildTimeline() {
    // Build entries for each unique date per city
    const entries = [];
    visits.forEach((visit) => {
        if (!visit.photos || visit.photos.length === 0) return;

        // Group photos by date
        const dateMap = {};
        visit.photos.forEach((photo, photoIndex) => {
            const date = typeof photo === 'string' ? '' : (photo.date || '');
            if (!dateMap[date]) {
                dateMap[date] = { firstPhotoIndex: photoIndex, count: 0 };
            }
            dateMap[date].count++;
        });

        // Create entry for each date
        Object.keys(dateMap).forEach(date => {
            entries.push({
                visit,
                date,
                firstPhotoIndex: dateMap[date].firstPhotoIndex,
                photoCount: dateMap[date].count
            });
        });
    });

    // Store entries for click handler
    timeline.entries = entries;

    // Find oldest entry date to determine scroll range
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11

    let oldestDate = null;
    entries.forEach(entry => {
        if (entry.date && (!oldestDate || entry.date < oldestDate)) {
            oldestDate = entry.date;
        }
    });

    // Calculate total months needed for scrolling (extends to oldest entry)
    let numMonths = 12;
    if (oldestDate) {
        const [oldYear, oldMonth] = oldestDate.split('-').map(Number);
        const monthsBack = (currentYear - oldYear) * 12 + (currentMonth + 1 - oldMonth);
        numMonths = Math.max(12, monthsBack + 1);
    }

    const months = [];
    for (let i = 0; i < numMonths; i++) {
        const d = new Date(currentYear, currentMonth - i, 1);
        const year = d.getFullYear();
        const month = d.getMonth() + 1; // 1-12
        const monthStr = `${year}-${String(month).padStart(2, '0')}`;
        const label = d.toLocaleString('en', { month: 'short' }) + (month === 1 || i === numMonths - 1 ? ` '${String(year).slice(-2)}` : '');
        months.push({ monthStr, label, index: i });
    }

    // Group entries by month AND deduplicate by country
    const entriesByMonth = {};
    entries.forEach((entry, i) => {
        if (!entry.date) return;
        const monthIndex = months.findIndex(m => m.monthStr === entry.date);
        if (monthIndex < 0) return;
        if (!entriesByMonth[monthIndex]) entriesByMonth[monthIndex] = {};

        // Only keep first entry per country (latest uploaded)
        const countryCode = entry.visit.countryCode;
        if (!entriesByMonth[monthIndex][countryCode]) {
            entriesByMonth[monthIndex][countryCode] = { entry, originalIndex: i };
        }
    });

    // Calculate timeline width (80px per month)
    const monthWidth = 80;
    const timelineWidth = numMonths * monthWidth + 80;

    // Build month labels
    const monthLabels = months.map((m, i) => {
        const position = 40 + (numMonths - 1 - i) * monthWidth;
        return `<div class="timeline-month${i === 0 ? ' current' : ''}" style="left: ${position}px">${m.label}</div>`;
    }).join('');

    // Build month ticks
    const monthTicks = months.map((m, i) => {
        const position = 40 + (numMonths - 1 - i) * monthWidth;
        return `<div class="timeline-month-tick" style="left: ${position}px"></div>`;
    }).join('');

    // Build flag markers with fan layout for multiple countries
    let flagMarkers = '';
    Object.keys(entriesByMonth).forEach(monthIndex => {
        const countryEntries = Object.values(entriesByMonth[monthIndex]);
        const baseX = 40 + (numMonths - 1 - monthIndex) * monthWidth;
        const count = Math.min(countryEntries.length, 5); // Max 5 flags

        // Fan layout: spread flags in an arc above the axis point
        countryEntries.slice(0, 5).forEach((item, i) => {
            const entry = item.entry;

            // Calculate position in fan layout
            let offsetX = 0;
            let offsetY = 0;

            if (count === 1) {
                offsetX = 0;
                offsetY = 0;
            } else if (count === 2) {
                offsetX = (i === 0 ? -18 : 18);
                offsetY = 0;
            } else if (count === 3) {
                const positions = [
                    { x: 0, y: -20 },
                    { x: -20, y: 5 },
                    { x: 20, y: 5 }
                ];
                offsetX = positions[i].x;
                offsetY = positions[i].y;
            } else if (count === 4) {
                const positions = [
                    { x: 0, y: -22 },
                    { x: -22, y: 0 },
                    { x: 22, y: 0 },
                    { x: 0, y: 22 }
                ];
                offsetX = positions[i].x;
                offsetY = positions[i].y;
            } else {
                const positions = [
                    { x: 0, y: -25 },
                    { x: -22, y: -8 },
                    { x: 22, y: -8 },
                    { x: -14, y: 15 },
                    { x: 14, y: 15 }
                ];
                offsetX = positions[i].x;
                offsetY = positions[i].y;
            }

            flagMarkers += `
                <div class="timeline-flag-marker" data-index="${item.originalIndex}" style="left: ${baseX + offsetX}px; transform: translate(-50%, calc(-100% - 5px - ${-offsetY}px))">
                    <div class="timeline-tooltip">
                        <div class="timeline-tooltip-city">${entry.visit.city}</div>
                        <div class="timeline-tooltip-date">${entry.date}</div>
                    </div>
                    <img class="timeline-flag" src="${getFlagUrl(entry.visit.countryCode)}" alt="${entry.visit.country}"
                         onerror="this.style.display='none'">
                </div>`;
        });

        // Show "+N" indicator if more than 5 countries
        if (countryEntries.length > 5) {
            flagMarkers += `
                <div class="timeline-more-indicator" style="left: ${baseX}px">+${countryEntries.length - 5}</div>`;
        }
    });

    timeline.innerHTML = `
        <div class="timeline-container" style="width: ${timelineWidth}px">
            <div class="timeline-axis"></div>
            ${monthTicks}
            <div class="timeline-months">${monthLabels}</div>
            ${flagMarkers}
        </div>`;

    // Scroll to right (current month)
    timeline.scrollLeft = timeline.scrollWidth;
}

function highlightTimelineItem(visit, date) {
    clearTimelineHighlight();
    if (!timeline.entries) return;

    const markers = timeline.querySelectorAll('.timeline-flag-marker');
    markers.forEach((marker) => {
        const index = parseInt(marker.dataset.index);
        const entry = timeline.entries[index];
        if (entry && entry.visit === visit && (!date || entry.date === date)) {
            marker.classList.add('active');
            marker.scrollIntoView({ behavior: 'smooth', inline: 'center' });
        }
    });
}

function clearTimelineHighlight() {
    timeline.querySelectorAll('.timeline-flag-marker').forEach(marker => {
        marker.classList.remove('active');
    });
}

// Timeline click handler
timeline.addEventListener('click', (e) => {
    const marker = e.target.closest('.timeline-flag-marker');
    if (!marker || !timeline.entries) return;

    const index = parseInt(marker.dataset.index);
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

        // Add markers
        visits.forEach(visit => createMarker(visit));

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
