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
let filteredPhotos = []; // Photos to display (filtered or all)
let allPhotosGlobal = []; // All photos from all cities, sorted by date
let isGlobalGallery = false; // true = timeline mode (all photos), false = city mode
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

// Get thumbnail URL (falls back to original if thumb doesn't exist)
function getThumbUrl(photoPath) {
    const parts = photoPath.split('/');
    const folder = parts[0];
    const filename = parts[1];
    const thumbFilename = filename.replace(/\.[^.]+$/, '.jpg');
    return `photos/thumbs/${folder}/${thumbFilename}`;
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
        openCityGallery(visit);
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
// If +1 remaining: show 9th image normally
// If +2 or more: show blurred 9th image with +N overlay
function showHoverPreview(e, visit) {
    if (!visit.photos || visit.photos.length === 0) return;

    const previewTitle = hoverPreview.querySelector('.hover-preview-title');
    const previewGrid = hoverPreview.querySelector('.hover-preview-grid');

    previewTitle.textContent = `${visit.city}, ${visit.country}`;

    const sortedPhotos = getSortedPhotos(visit.photos);
    const maxVisible = 8;
    const photos = sortedPhotos.slice(0, Math.min(maxVisible, sortedPhotos.length));
    const remainingCount = sortedPhotos.length - maxVisible;

    // Photos are now objects with .path
    previewGrid.innerHTML = photos.map(p => {
        const photoPath = typeof p === 'string' ? p : p.path;
        return `<img src="photos/${photoPath}" alt="">`;
    }).join('');

    // Handle 9th slot based on remaining count
    if (remainingCount === 1) {
        // Show 9th image as normal photo
        const ninthPhoto = sortedPhotos[maxVisible];
        const photoPath = typeof ninthPhoto === 'string' ? ninthPhoto : ninthPhoto.path;
        previewGrid.innerHTML += `<img src="photos/${photoPath}" alt="">`;
    } else if (remainingCount >= 2) {
        // Show blurred 9th image with +N overlay
        const ninthPhoto = sortedPhotos[maxVisible];
        const photoPath = typeof ninthPhoto === 'string' ? ninthPhoto : ninthPhoto.path;
        previewGrid.innerHTML += `<div class="hover-preview-more-blur">
            <img src="photos/${photoPath}" alt="">
            <span class="plus-n-overlay">+${remainingCount}</span>
        </div>`;
    }

    // Position preview (offset by 50% for timeline width)
    const point = map.latLngToContainerPoint(e.latlng);
    const mapOffset = window.innerWidth * 0.5;
    hoverPreview.style.left = `${mapOffset + point.x + 20}px`;
    hoverPreview.style.top = `${point.y + 60}px`;
    hoverPreview.classList.add('visible');
}

function hideHoverPreview() {
    hoverPreview.classList.remove('visible');
}

// Build global photo list from all visits
function buildGlobalPhotoList() {
    allPhotosGlobal = [];
    visits.forEach(visit => {
        if (!visit.photos) return;
        visit.photos.forEach((photo, photoIndex) => {
            const date = typeof photo === 'string' ? '' : (photo.date || '');
            if (!date) return; // Skip photos without date
            allPhotosGlobal.push({
                photo,
                visit,
                photoIndex,
                date
            });
        });
    });
    // Sort by date (newest first)
    allPhotosGlobal.sort((a, b) => b.date.localeCompare(a.date));
}

// Open gallery for a single city (from city marker click)
function openCityGallery(visit) {
    if (!visit.photos || visit.photos.length === 0) return;

    isGlobalGallery = false;
    currentVisit = visit;

    // Get all photos for this city, sorted by date
    let photosToShow = visit.photos.map((p, i) => ({ photo: p, originalIndex: i }));
    photosToShow.sort((a, b) => {
        const dateA = typeof a.photo === 'string' ? '' : (a.photo.date || '');
        const dateB = typeof b.photo === 'string' ? '' : (b.photo.date || '');
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateB.localeCompare(dateA);
    });

    filteredPhotos = photosToShow;
    currentPhotoIndex = 0;

    galleryTitle.textContent = `${visit.city}, ${visit.country}`;

    updateGalleryThumbnails();
    updateGalleryImage();
    gallery.classList.remove('hidden');
}

// Open global gallery (from timeline click) - shows all photos from all cities
function openGlobalGallery(startPhotoPath) {
    if (allPhotosGlobal.length === 0) return;

    isGlobalGallery = true;
    currentVisit = null;
    filteredPhotos = allPhotosGlobal;

    // Find starting position based on photo path
    currentPhotoIndex = 0;
    if (startPhotoPath) {
        const startIdx = allPhotosGlobal.findIndex(item => {
            const path = typeof item.photo === 'string' ? item.photo : item.photo.path;
            return path === startPhotoPath;
        });
        if (startIdx >= 0) currentPhotoIndex = startIdx;
    }

    updateGalleryThumbnails();
    updateGalleryImage();
    gallery.classList.remove('hidden');
}

// Build thumbnails with sliding window (max 8 visible at a time for global gallery)
function updateGalleryThumbnails() {
    const maxThumbs = 8;
    let thumbsToShow;
    let startIdx = 0;
    let hasMoreBefore = false;
    let hasMoreAfter = false;

    if (isGlobalGallery && filteredPhotos.length > maxThumbs) {
        // Sliding window centered on current photo
        startIdx = currentPhotoIndex - Math.floor(maxThumbs / 2);
        startIdx = Math.max(0, startIdx);
        startIdx = Math.min(startIdx, filteredPhotos.length - maxThumbs);
        thumbsToShow = filteredPhotos.slice(startIdx, startIdx + maxThumbs);
        hasMoreBefore = startIdx > 0;
        hasMoreAfter = startIdx + maxThumbs < filteredPhotos.length;
    } else {
        thumbsToShow = filteredPhotos;
    }

    galleryThumbnails.innerHTML = thumbsToShow.map((item, i) => {
        const actualIndex = startIdx + i;
        const photoPath = typeof item.photo === 'string' ? item.photo : item.photo.path;

        // Add gradient fade effect on edge thumbnails (2 levels each side)
        let edgeClass = '';
        if (isGlobalGallery && filteredPhotos.length > maxThumbs) {
            // Left side fade
            if (i === 0 && hasMoreBefore) edgeClass = 'thumb-fade-2';
            else if (i === 1 && hasMoreBefore) edgeClass = 'thumb-fade-1';
            // Right side fade
            if (i === thumbsToShow.length - 1 && hasMoreAfter) edgeClass = 'thumb-fade-2';
            else if (i === thumbsToShow.length - 2 && hasMoreAfter) edgeClass = 'thumb-fade-1';
        }

        return `<div class="gallery-thumb ${actualIndex === currentPhotoIndex ? 'active' : ''} ${edgeClass}" data-index="${actualIndex}">
            <img src="photos/${photoPath}" alt="" loading="lazy">
        </div>`;
    }).join('');
}

function closeGallery() {
    gallery.classList.add('hidden');
    currentVisit = null;
    filteredPhotos = [];
    isGlobalGallery = false;
    clearTimelineHighlight();

    // Restore previous map view
    if (previousMapView) {
        map.flyTo(previousMapView.center, previousMapView.zoom, { duration: 0.5 });
        previousMapView = null;
    }
}

function updateGalleryImage() {
    if (filteredPhotos.length === 0) return;

    const item = filteredPhotos[currentPhotoIndex];
    if (!item) return;

    let photoPath, photoDate, city, country;

    if (isGlobalGallery) {
        // Global mode - item has visit info
        photoPath = typeof item.photo === 'string' ? item.photo : item.photo.path;
        photoDate = item.date;
        city = item.visit.city;
        country = item.visit.country;
        galleryTitle.textContent = `${city}, ${country}`;
    } else {
        // City mode - item has photo and originalIndex
        const photo = item.photo;
        photoPath = typeof photo === 'string' ? photo : photo.path;
        photoDate = typeof photo === 'string' ? '' : (photo.date || '');
        galleryTitle.textContent = `${currentVisit.city}, ${currentVisit.country}`;
    }

    galleryImage.src = `photos/${photoPath}`;
    galleryDate.textContent = photoDate;

    // Rebuild thumbnails for sliding window in global mode
    if (isGlobalGallery) {
        updateGalleryThumbnails();
    } else {
        // Update thumbnail active state
        galleryThumbnails.querySelectorAll('.gallery-thumb').forEach((thumb) => {
            const idx = parseInt(thumb.dataset.index);
            thumb.classList.toggle('active', idx === currentPhotoIndex);
        });
    }

    // Scroll active thumbnail into view
    const activeThumb = galleryThumbnails.querySelector('.gallery-thumb.active');
    if (activeThumb) {
        activeThumb.scrollIntoView({ behavior: 'smooth', inline: 'center' });
    }
}

function navigateGallery(direction) {
    if (filteredPhotos.length === 0) return;
    const newIndex = currentPhotoIndex + direction;
    if (newIndex >= 0 && newIndex < filteredPhotos.length) {
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

        // Show up to 4 photos normally, then handle +N logic for 5th slot
        // If +1 remaining: show 5th image normally
        // If +2 or more: show blurred 5th image with +N overlay
        const maxVisible = 4;
        const totalPhotos = entry.photos.length;
        const previewPhotos = entry.photos.slice(0, Math.min(maxVisible, totalPhotos));
        const remainingCount = totalPhotos - maxVisible;

        // Build the +N slot if needed
        let plusNSlot = '';
        if (remainingCount === 1) {
            // Show 9th image as normal photo
            const ninthPhoto = entry.photos[maxVisible];
            const photoPath = typeof ninthPhoto === 'string' ? ninthPhoto : ninthPhoto.path;
            const thumbPath = getThumbUrl(photoPath);
            plusNSlot = `<div class="timeline-photo" data-path="${photoPath}"><img src="${thumbPath}" alt="" loading="lazy" decoding="async" onerror="this.src='photos/${photoPath}'"></div>`;
        } else if (remainingCount >= 2) {
            // Show blurred 9th image with +N overlay
            const ninthPhoto = entry.photos[maxVisible];
            const photoPath = typeof ninthPhoto === 'string' ? ninthPhoto : ninthPhoto.path;
            const thumbPath = getThumbUrl(photoPath);
            plusNSlot = `<div class="timeline-photo-more-blur" data-path="${photoPath}">
                <img src="${thumbPath}" alt="" loading="lazy" decoding="async" onerror="this.src='photos/${photoPath}'">
                <span class="plus-n-overlay">+${remainingCount}</span>
            </div>`;
        }

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
                        const thumbPath = getThumbUrl(photoPath);
                        return `<div class="timeline-photo" data-path="${photoPath}"><img src="${thumbPath}" alt="" loading="lazy" decoding="async" onerror="this.src='photos/${photoPath}'"></div>`;
                    }).join('')}
                    ${plusNSlot}
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

// Timeline click handler - opens global gallery with all photos
timeline.addEventListener('click', (e) => {
    // Check if a specific photo or +N was clicked
    const photoEl = e.target.closest('.timeline-photo, .timeline-photo-more, .timeline-photo-more-blur');
    const entryEl = e.target.closest('.timeline-entry');

    if (!entryEl) return;

    // Get the photo path to start at
    let startPhotoPath = null;
    if (photoEl && photoEl.dataset.path) {
        startPhotoPath = photoEl.dataset.path;
    } else {
        // Clicked on header - start at first photo of this entry
        const index = parseInt(entryEl.dataset.index);
        const entry = timeline.entries?.[index];
        if (entry && entry.photos.length > 0) {
            const firstPhoto = entry.photos[0];
            startPhotoPath = typeof firstPhoto === 'string' ? firstPhoto : firstPhoto.path;
        }
    }

    // Save current map view before opening gallery
    previousMapView = { center: map.getCenter(), zoom: map.getZoom() };

    // Open global gallery with all photos, starting at clicked photo
    openGlobalGallery(startPhotoPath);
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

        // Build global photo list for timeline gallery
        buildGlobalPhotoList();

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
