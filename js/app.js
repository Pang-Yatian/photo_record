// Public visualization page with 3D Cesium Globe

// Set Cesium base URL for assets
window.CESIUM_BASE_URL = 'https://cesium.com/downloads/cesiumjs/releases/1.113/Build/Cesium/';

// Initialize Cesium viewer
const viewer = new Cesium.Viewer('map', {
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    navigationHelpButton: false,
    sceneModePicker: false,
    timeline: false,
    animation: false,
    fullscreenButton: false,
    vrButton: false,
    infoBox: false,
    selectionIndicator: false,
    shadows: false,
    shouldAnimate: true,
});

// Dark theme setup
viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#1a1a2e');
viewer.scene.skyBox = undefined;
viewer.scene.sun.show = false;
viewer.scene.moon.show = false;
viewer.scene.skyAtmosphere.show = false;
viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#1a1a2e');

// Use CartoDB dark tiles with English labels
viewer.imageryLayers.removeAll();
viewer.imageryLayers.addImageryProvider(
    new Cesium.UrlTemplateImageryProvider({
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        subdomains: ['a', 'b', 'c', 'd'],
        credit: 'Map tiles by CartoDB'
    })
);

// Set initial camera to GMT+8 timezone, balanced view for both hemispheres
viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(120, 10, 16000000),
    orientation: {
        heading: 0,
        pitch: -Cesium.Math.PI_OVER_TWO,
        roll: 0
    }
});

// Auto-rotate state
let autoRotate = true;
let isHoveringMarker = false;
let lastInteraction = Date.now();
const IDLE_TIMEOUT = 2000;

// Start auto-rotate animation (faster speed)
viewer.clock.onTick.addEventListener(() => {
    if (autoRotate && !isHoveringMarker && Date.now() - lastInteraction > IDLE_TIMEOUT) {
        viewer.scene.camera.rotate(Cesium.Cartesian3.UNIT_Z, 0.0025);
    }
});

// Interaction listeners to pause auto-rotate
viewer.scene.canvas.addEventListener('mousedown', () => {
    autoRotate = false;
    lastInteraction = Date.now();
});
viewer.scene.canvas.addEventListener('mouseup', () => {
    autoRotate = true;
    lastInteraction = Date.now();
});
viewer.scene.canvas.addEventListener('wheel', () => {
    lastInteraction = Date.now();
});

// State
let countriesDataSource = null;
let visitedCountryCodes = new Set();
let visits = [];
let markers = [];

// Gallery state
let currentVisit = null;
let currentPhotoIndex = 0;
let sortedPhotoIndices = [];
let filteredPhotos = [];
let allPhotosGlobal = [];
let isGlobalGallery = false;
let previousCameraState = null;

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

// Get thumbnail URL
function getThumbUrl(photoPath) {
    const parts = photoPath.split('/');
    const folder = parts[0];
    const filename = parts[1];
    const thumbFilename = filename.replace(/\.[^.]+$/, '.jpg');
    return `photos/thumbs/${folder}/${thumbFilename}`;
}

// Country highlighting with GeoJSON
async function loadCountries() {
    try {
        countriesDataSource = await Cesium.GeoJsonDataSource.load(
            'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson',
            {
                stroke: Cesium.Color.TRANSPARENT,
                fill: Cesium.Color.TRANSPARENT,
                strokeWidth: 0
            }
        );
        viewer.dataSources.add(countriesDataSource);
    } catch (error) {
        console.error('Failed to load countries:', error);
    }
}

function highlightCountries() {
    if (!countriesDataSource) return;

    const entities = countriesDataSource.entities.values;
    for (let i = 0; i < entities.length; i++) {
        const entity = entities[i];
        if (!entity.polygon) continue;

        const props = entity.properties;
        const code = props['ISO3166-1-Alpha-2']?.getValue() ||
                     props.ISO_A2?.getValue();

        if (visitedCountryCodes.has(code)) {
            entity.polygon.material = Cesium.Color.fromCssColorString('#00d4aa').withAlpha(0.5);
        } else {
            entity.polygon.material = Cesium.Color.TRANSPARENT;
        }
        entity.polygon.outline = false;
    }
}

// Create marker for a city
function createMarker(visit, zIndex = 100) {
    const entity = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(visit.lng, visit.lat),
        point: {
            pixelSize: 14,
            color: Cesium.Color.fromCssColorString('#00d4aa'),
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2,
        },
        properties: {
            visit: visit,
            zIndex: zIndex
        }
    });

    markers.push({ entity, visit });
    return entity;
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

// Show hover preview with thumbnails
function showHoverPreview(screenPosition, visit) {
    if (!visit.photos || visit.photos.length === 0) return;

    const previewTitle = hoverPreview.querySelector('.hover-preview-title');
    const previewGrid = hoverPreview.querySelector('.hover-preview-grid');

    previewTitle.textContent = `${visit.city}, ${visit.country}`;

    const sortedPhotos = getSortedPhotos(visit.photos);
    const maxVisible = 8;
    const photos = sortedPhotos.slice(0, Math.min(maxVisible, sortedPhotos.length));
    const remainingCount = sortedPhotos.length - maxVisible;

    // Use thumbnails instead of full images
    previewGrid.innerHTML = photos.map(p => {
        const photoPath = typeof p === 'string' ? p : p.path;
        const thumbPath = getThumbUrl(photoPath);
        return `<img src="${thumbPath}" alt="" onerror="this.src='photos/${photoPath}'">`;
    }).join('');

    if (remainingCount === 1) {
        const ninthPhoto = sortedPhotos[maxVisible];
        const photoPath = typeof ninthPhoto === 'string' ? ninthPhoto : ninthPhoto.path;
        const thumbPath = getThumbUrl(photoPath);
        previewGrid.innerHTML += `<img src="${thumbPath}" alt="" onerror="this.src='photos/${photoPath}'">`;
    } else if (remainingCount >= 2) {
        const ninthPhoto = sortedPhotos[maxVisible];
        const photoPath = typeof ninthPhoto === 'string' ? ninthPhoto : ninthPhoto.path;
        const thumbPath = getThumbUrl(photoPath);
        previewGrid.innerHTML += `<div class="hover-preview-more-blur">
            <img src="${thumbPath}" alt="" onerror="this.src='photos/${photoPath}'">
            <span class="plus-n-overlay">+${remainingCount}</span>
        </div>`;
    }

    // Position preview
    const mapOffset = window.innerWidth * 0.5;
    hoverPreview.style.left = `${mapOffset + screenPosition.x + 20}px`;
    hoverPreview.style.top = `${screenPosition.y + 60}px`;
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
            if (!date) return;
            allPhotosGlobal.push({
                photo,
                visit,
                photoIndex,
                date
            });
        });
    });
    allPhotosGlobal.sort((a, b) => b.date.localeCompare(a.date));
}

// Open gallery for a single city
function openCityGallery(visit) {
    if (!visit.photos || visit.photos.length === 0) return;

    isGlobalGallery = false;
    currentVisit = visit;

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

// Open global gallery (from timeline click)
function openGlobalGallery(startPhotoPath) {
    if (allPhotosGlobal.length === 0) return;

    isGlobalGallery = true;
    currentVisit = null;
    filteredPhotos = allPhotosGlobal;

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

// Build thumbnails with sliding window
function updateGalleryThumbnails() {
    const maxThumbs = 8;
    let thumbsToShow;
    let startIdx = 0;
    let hasMoreBefore = false;
    let hasMoreAfter = false;

    if (isGlobalGallery && filteredPhotos.length > maxThumbs) {
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

        let edgeClass = '';
        if (isGlobalGallery && filteredPhotos.length > maxThumbs) {
            if (i === 0 && hasMoreBefore) edgeClass = 'thumb-fade-2';
            else if (i === 1 && hasMoreBefore) edgeClass = 'thumb-fade-1';
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

    if (previousCameraState) {
        viewer.camera.flyTo({
            destination: previousCameraState.position,
            orientation: {
                direction: previousCameraState.direction,
                up: previousCameraState.up
            },
            duration: 0.5
        });
        previousCameraState = null;
    }
}

function updateGalleryImage() {
    if (filteredPhotos.length === 0) return;

    const item = filteredPhotos[currentPhotoIndex];
    if (!item) return;

    let photoPath, photoDate, city, country;

    if (isGlobalGallery) {
        photoPath = typeof item.photo === 'string' ? item.photo : item.photo.path;
        photoDate = item.date;
        city = item.visit.city;
        country = item.visit.country;
        galleryTitle.textContent = `${city}, ${country}`;
    } else {
        const photo = item.photo;
        photoPath = typeof photo === 'string' ? photo : photo.path;
        photoDate = typeof photo === 'string' ? '' : (photo.date || '');
        galleryTitle.textContent = `${currentVisit.city}, ${currentVisit.country}`;
    }

    galleryImage.src = `photos/${photoPath}`;
    galleryDate.textContent = photoDate;

    if (isGlobalGallery) {
        updateGalleryThumbnails();
    } else {
        galleryThumbnails.querySelectorAll('.gallery-thumb').forEach((thumb) => {
            const idx = parseInt(thumb.dataset.index);
            thumb.classList.toggle('active', idx === currentPhotoIndex);
        });
    }

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
    const entries = [];
    visits.forEach((visit) => {
        if (!visit.photos || visit.photos.length === 0) return;

        const dateMap = {};
        visit.photos.forEach((photo, photoIndex) => {
            const date = typeof photo === 'string' ? '' : (photo.date || '');
            if (!date) return;
            if (!dateMap[date]) {
                dateMap[date] = { photos: [], firstPhotoIndex: photoIndex };
            }
            dateMap[date].photos.push(photo);
        });

        Object.keys(dateMap).forEach(date => {
            entries.push({
                visit,
                date,
                photos: dateMap[date].photos,
                firstPhotoIndex: dateMap[date].firstPhotoIndex
            });
        });
    });

    entries.sort((a, b) => b.date.localeCompare(a.date));
    timeline.entries = entries;

    let currentMonth = '';
    let html = '';

    entries.forEach((entry, i) => {
        const entryMonth = entry.date.substring(0, 7);

        if (entryMonth !== currentMonth) {
            currentMonth = entryMonth;
            const d = new Date(entry.date + '-01');
            const monthLabel = d.toLocaleString('en', { month: 'long', year: 'numeric' });
            html += `<div class="timeline-month-header">${monthLabel}</div>`;
        }

        const maxVisible = 4;
        const totalPhotos = entry.photos.length;
        const previewPhotos = entry.photos.slice(0, Math.min(maxVisible, totalPhotos));
        const remainingCount = totalPhotos - maxVisible;

        let plusNSlot = '';
        if (remainingCount === 1) {
            const ninthPhoto = entry.photos[maxVisible];
            const photoPath = typeof ninthPhoto === 'string' ? ninthPhoto : ninthPhoto.path;
            const thumbPath = getThumbUrl(photoPath);
            plusNSlot = `<div class="timeline-photo" data-path="${photoPath}"><img src="${thumbPath}" alt="" loading="lazy" decoding="async" onerror="this.src='photos/${photoPath}'"></div>`;
        } else if (remainingCount >= 2) {
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

// Timeline click handler
timeline.addEventListener('click', (e) => {
    const photoEl = e.target.closest('.timeline-photo, .timeline-photo-more, .timeline-photo-more-blur');
    const entryEl = e.target.closest('.timeline-entry');

    if (!entryEl) return;

    let startPhotoPath = null;
    if (photoEl && photoEl.dataset.path) {
        startPhotoPath = photoEl.dataset.path;
    } else {
        const index = parseInt(entryEl.dataset.index);
        const entry = timeline.entries?.[index];
        if (entry && entry.photos.length > 0) {
            const firstPhoto = entry.photos[0];
            startPhotoPath = typeof firstPhoto === 'string' ? firstPhoto : firstPhoto.path;
        }
    }

    previousCameraState = {
        position: viewer.camera.position.clone(),
        direction: viewer.camera.direction.clone(),
        up: viewer.camera.up.clone()
    };

    openGlobalGallery(startPhotoPath);
});

// Cesium event handlers for hover and click
const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

// Hover handler - also stops rotation when hovering on marker
handler.setInputAction((movement) => {
    const picked = viewer.scene.pick(movement.endPosition);
    if (Cesium.defined(picked) && picked.id?.properties?.visit) {
        const visit = picked.id.properties.visit.getValue();
        isHoveringMarker = true;
        showHoverPreview(movement.endPosition, visit);
    } else {
        isHoveringMarker = false;
        hideHoverPreview();
    }
}, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

// Click handler
handler.setInputAction((click) => {
    const picked = viewer.scene.pick(click.position);
    if (Cesium.defined(picked) && picked.id?.properties?.visit) {
        const visit = picked.id.properties.visit.getValue();
        previousCameraState = {
            position: viewer.camera.position.clone(),
            direction: viewer.camera.direction.clone(),
            up: viewer.camera.up.clone()
        };
        hideHoverPreview();
        openCityGallery(visit);
    }
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);

// Load travel data
async function loadData() {
    try {
        const response = await fetch('data.json');
        const data = await response.json();
        visits = data.visits || [];

        visits.forEach(visit => {
            if (visit.countryCode) {
                visitedCountryCodes.add(visit.countryCode);
            }
        });

        highlightCountries();

        visits.forEach(visit => {
            const photoCount = visit.photos ? visit.photos.length : 0;
            createMarker(visit, photoCount * 10);
        });

        buildTimeline();
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

// Zoom controls
document.getElementById('zoom-in').addEventListener('click', () => {
    viewer.camera.zoomIn(viewer.camera.positionCartographic.height * 0.3);
});

document.getElementById('zoom-out').addEventListener('click', () => {
    viewer.camera.zoomOut(viewer.camera.positionCartographic.height * 0.5);
});

// Initialize
async function init() {
    await loadCountries();
    await loadData();
}

init();
