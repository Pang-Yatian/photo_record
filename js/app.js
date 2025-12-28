// Public visualization page with D3.js SVG Map

// D3 Map state
let svg, g, projection, path, zoom;
let worldData = null;

// ISO numeric to alpha-2 country code mapping
const numericToAlpha2 = {
    '4': 'AF', '8': 'AL', '12': 'DZ', '20': 'AD', '24': 'AO', '28': 'AG', '32': 'AR', '36': 'AU',
    '40': 'AT', '31': 'AZ', '44': 'BS', '48': 'BH', '50': 'BD', '52': 'BB', '112': 'BY', '56': 'BE',
    '84': 'BZ', '204': 'BJ', '64': 'BT', '68': 'BO', '70': 'BA', '72': 'BW', '76': 'BR', '96': 'BN',
    '100': 'BG', '854': 'BF', '108': 'BI', '116': 'KH', '120': 'CM', '124': 'CA', '132': 'CV',
    '140': 'CF', '148': 'TD', '152': 'CL', '156': 'CN', '170': 'CO', '174': 'KM', '178': 'CG',
    '180': 'CD', '188': 'CR', '384': 'CI', '191': 'HR', '192': 'CU', '196': 'CY', '203': 'CZ',
    '208': 'DK', '262': 'DJ', '212': 'DM', '214': 'DO', '218': 'EC', '818': 'EG', '222': 'SV',
    '226': 'GQ', '232': 'ER', '233': 'EE', '231': 'ET', '242': 'FJ', '246': 'FI', '250': 'FR',
    '266': 'GA', '270': 'GM', '268': 'GE', '276': 'DE', '288': 'GH', '300': 'GR', '308': 'GD',
    '320': 'GT', '324': 'GN', '624': 'GW', '328': 'GY', '332': 'HT', '340': 'HN', '348': 'HU',
    '352': 'IS', '356': 'IN', '360': 'ID', '364': 'IR', '368': 'IQ', '372': 'IE', '376': 'IL',
    '380': 'IT', '388': 'JM', '392': 'JP', '400': 'JO', '398': 'KZ', '404': 'KE', '296': 'KI',
    '408': 'KP', '410': 'KR', '414': 'KW', '417': 'KG', '418': 'LA', '428': 'LV', '422': 'LB',
    '426': 'LS', '430': 'LR', '434': 'LY', '438': 'LI', '440': 'LT', '442': 'LU', '807': 'MK',
    '450': 'MG', '454': 'MW', '458': 'MY', '462': 'MV', '466': 'ML', '470': 'MT', '584': 'MH',
    '478': 'MR', '480': 'MU', '484': 'MX', '583': 'FM', '498': 'MD', '492': 'MC', '496': 'MN',
    '499': 'ME', '504': 'MA', '508': 'MZ', '104': 'MM', '516': 'NA', '520': 'NR', '524': 'NP',
    '528': 'NL', '554': 'NZ', '558': 'NI', '562': 'NE', '566': 'NG', '578': 'NO', '512': 'OM',
    '586': 'PK', '585': 'PW', '591': 'PA', '598': 'PG', '600': 'PY', '604': 'PE', '608': 'PH',
    '616': 'PL', '620': 'PT', '634': 'QA', '642': 'RO', '643': 'RU', '646': 'RW', '659': 'KN',
    '662': 'LC', '670': 'VC', '882': 'WS', '674': 'SM', '678': 'ST', '682': 'SA', '686': 'SN',
    '688': 'RS', '690': 'SC', '694': 'SL', '702': 'SG', '703': 'SK', '705': 'SI', '90': 'SB',
    '706': 'SO', '710': 'ZA', '724': 'ES', '144': 'LK', '729': 'SD', '740': 'SR', '748': 'SZ',
    '752': 'SE', '756': 'CH', '760': 'SY', '158': 'TW', '762': 'TJ', '834': 'TZ', '764': 'TH',
    '626': 'TL', '768': 'TG', '776': 'TO', '780': 'TT', '788': 'TN', '792': 'TR', '795': 'TM',
    '798': 'TV', '800': 'UG', '804': 'UA', '784': 'AE', '826': 'GB', '840': 'US', '858': 'UY',
    '860': 'UZ', '548': 'VU', '862': 'VE', '704': 'VN', '887': 'YE', '894': 'ZM', '716': 'ZW'
};

// State
let visitedCountryCodes = new Set();
let visits = [];
let markers = [];

// Overlap detection for hover preview
const OVERLAP_DISTANCE = 9;   // Pixels - markers closer than this are grouped

// Gallery state
let currentVisit = null;
let currentPhotoIndex = 0;
let sortedPhotoIndices = [];
let filteredPhotos = [];
let allPhotosGlobal = [];
let isGlobalGallery = false;

// Autoplay state
let autoplayInterval = null;
let isAutoplayActive = false;
const AUTOPLAY_DELAY = 6500; // 6.5 seconds per photo

// Hover preview state
let isHoverPinned = false;
let justPinned = false; // Prevent immediate close after pinning

// DOM elements
const hoverPreview = document.getElementById('hover-preview');
const photoViewer = document.getElementById('photo-viewer');
const gallery = document.getElementById('gallery');
const galleryImage = document.getElementById('gallery-image');
const galleryTitle = document.getElementById('gallery-title');
const galleryDate = document.getElementById('gallery-date');
const galleryThumbnails = document.getElementById('gallery-thumbnails');
const timeline = document.getElementById('timeline');

// Initialize D3 Map
async function initMap() {
    const container = document.getElementById('map');
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Create SVG - no viewBox to avoid distortion
    svg = d3.select('#map')
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    g = svg.append('g');

    // Initial projection setup
    projection = d3.geoNaturalEarth1()
        .rotate([-150, 0, 0]);  // Atlantic as boundary, Asia center, Americas right

    path = d3.geoPath().projection(projection);

    // Zoom behavior
    zoom = d3.zoom()
        .scaleExtent([0.5, 20])
        .on('zoom', handleZoom);

    svg.call(zoom);

    // Add ocean background
    g.append('rect')
        .attr('class', 'ocean')
        .attr('x', -5000)
        .attr('y', -5000)
        .attr('width', 10000)
        .attr('height', 10000);

    // Load world map
    try {
        const world = await d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json');
        worldData = topojson.feature(world, world.objects.countries);

        // Use fitSize for optimal projection fitting (no distortion)
        const padding = 10;
        projection.fitSize([width - padding * 2, height - padding * 2], worldData);

        // Adjust translation to center with padding
        const currentTranslate = projection.translate();
        projection.translate([currentTranslate[0] + padding, currentTranslate[1] + padding]);

        // Render countries
        g.selectAll('.country')
            .data(worldData.features)
            .enter()
            .append('path')
            .attr('class', 'country')
            .attr('d', path)
            .attr('data-id', d => d.id);
    } catch (error) {
        console.error('Failed to load world map:', error);
    }

}

// Handle zoom/pan
function handleZoom(event) {
    g.attr('transform', event.transform);

    // Scale markers inversely to maintain consistent size
    const k = event.transform.k;
    g.selectAll('.city-marker')
        .attr('r', 7 / k)
        .attr('stroke-width', 2 / k);

}

// Highlight visited countries
function highlightCountries() {
    g.selectAll('.country')
        .classed('visited', d => {
            // Normalize ID by removing leading zeros (e.g., '040' -> '40')
            const normalizedId = String(parseInt(d.id, 10));
            const alpha2 = numericToAlpha2[normalizedId];
            return alpha2 && visitedCountryCodes.has(alpha2);
        });
}

// Find overlapping markers (within OVERLAP_DISTANCE pixels, adjusted for zoom)
function findOverlappingMarkers() {
    const clusters = [];
    const assigned = new Set();

    // Get current zoom scale - at higher zoom, markers appear further apart
    const transform = d3.zoomTransform(svg.node());
    const k = transform.k;

    // Effective distance threshold (at zoom 2x, markers are 2x further apart visually)
    const effectiveDistance = OVERLAP_DISTANCE / k;

    visits.forEach((visit, i) => {
        if (assigned.has(i)) return;

        const [x1, y1] = projection([visit.lng, visit.lat]);
        const cluster = [{ index: i, visit, x: x1, y: y1 }];
        assigned.add(i);

        visits.forEach((other, j) => {
            if (i === j || assigned.has(j)) return;

            const [x2, y2] = projection([other.lng, other.lat]);
            const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

            if (distance < effectiveDistance) {
                cluster.push({ index: j, visit: other, x: x2, y: y2 });
                assigned.add(j);
            }
        });

        clusters.push(cluster);
    });

    return clusters;
}

// Create markers for cities
function createMarkers() {
    // Clear existing markers
    g.selectAll('.city-marker').remove();

    // Get current zoom scale for proper marker sizing
    const transform = d3.zoomTransform(svg.node());
    const k = transform.k;

    // Add markers for each visit
    visits.forEach((visit, index) => {
        const [x, y] = projection([visit.lng, visit.lat]);

        g.append('circle')
            .attr('class', 'city-marker')
            .attr('cx', x)
            .attr('cy', y)
            .attr('r', 7 / k)
            .attr('stroke-width', 2 / k)
            .attr('data-index', index)
            .on('mouseenter', function(event) {
                if (isHoverPinned) return; // Don't change hover if pinned

                const [mx, my] = d3.pointer(event, svg.node());

                // Check if this marker overlaps with others
                const clusters = findOverlappingMarkers();
                const cluster = clusters.find(c => c.some(m => m.index === index));

                if (cluster && cluster.length > 1) {
                    // Show all cities in the cluster
                    const visitsToShow = cluster.map(m => m.visit);
                    showMultiHoverPreview({ x: mx, y: my }, visitsToShow);
                } else {
                    showHoverPreview({ x: mx, y: my }, visit);
                }
            })
            .on('mouseleave', function() {
                if (!isHoverPinned) hideHoverPreview();
            })
            .on('click', function(event) {
                event.stopPropagation();

                // Check if this marker overlaps with others
                const clusters = findOverlappingMarkers();
                const cluster = clusters.find(c => c.some(m => m.index === index));

                if (cluster && cluster.length > 1) {
                    // Pin the hover preview for user to select
                    const [mx, my] = d3.pointer(event, svg.node());
                    showMultiHoverPreview({ x: mx, y: my }, cluster.map(m => m.visit), true);
                } else {
                    // Single marker - open directly
                    hideHoverPreview();
                    stopAutoplay();
                    updateAutoplayButton();
                    showInViewer(visit);
                }
            });
    });
}

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

// Build HTML for a single city's preview
function buildCityPreviewHTML(visit, index = 0) {
    if (!visit.photos || visit.photos.length === 0) return '';

    const sortedPhotos = getSortedPhotos(visit.photos);
    const maxVisible = 4;  // Fewer photos per city when showing multiple
    const photos = sortedPhotos.slice(0, Math.min(maxVisible, sortedPhotos.length));
    const remainingCount = sortedPhotos.length - maxVisible;

    let photosHTML = photos.map(p => {
        const photoPath = typeof p === 'string' ? p : p.path;
        const thumbPath = getThumbUrl(photoPath);
        return `<img src="${thumbPath}" alt="" onerror="this.src='photos/${photoPath}'">`;
    }).join('');

    if (remainingCount > 0) {
        const nextPhoto = sortedPhotos[maxVisible];
        const photoPath = typeof nextPhoto === 'string' ? nextPhoto : nextPhoto.path;
        const thumbPath = getThumbUrl(photoPath);
        photosHTML += `<div class="hover-preview-more-blur">
            <img src="${thumbPath}" alt="" onerror="this.src='photos/${photoPath}'">
            <span class="plus-n-overlay">+${remainingCount}</span>
        </div>`;
    }

    return `
        <div class="hover-city-block" data-city-index="${index}">
            <div class="hover-city-title">${visit.city}, ${visit.country}</div>
            <div class="hover-city-grid">${photosHTML}</div>
        </div>
    `;
}

// Store visits for pinned hover click handling
let pinnedVisits = [];

// Show hover preview for multiple cities (overlapping markers)
function showMultiHoverPreview(screenPosition, visitsToShow, pinned = false) {
    const validVisits = visitsToShow.filter(v => v.photos && v.photos.length > 0);
    if (validVisits.length === 0) return;

    isHoverPinned = pinned;
    pinnedVisits = pinned ? validVisits : [];

    // Build HTML for all cities with data-index
    const citiesHTML = validVisits.map((v, i) => buildCityPreviewHTML(v, i)).join('');

    const headerHTML = pinned ? '<div class="hover-preview-header">Select a city</div>' : '';
    hoverPreview.innerHTML = `<div class="hover-multi-container">${headerHTML}${citiesHTML}</div>`;

    // Position preview
    const mapRect = document.getElementById('map').getBoundingClientRect();
    hoverPreview.style.left = `${mapRect.left + screenPosition.x + 15}px`;
    hoverPreview.style.top = `${mapRect.top + screenPosition.y + 15}px`;
    hoverPreview.classList.add('visible');
    if (pinned) {
        hoverPreview.classList.add('pinned');
        justPinned = true;
        setTimeout(() => { justPinned = false; }, 100);
    }
}

// Show hover preview with thumbnails (single city)
function showHoverPreview(screenPosition, visit) {
    if (!visit.photos || visit.photos.length === 0) return;

    const sortedPhotos = getSortedPhotos(visit.photos);
    const maxVisible = 8;
    const photos = sortedPhotos.slice(0, Math.min(maxVisible, sortedPhotos.length));
    const remainingCount = sortedPhotos.length - maxVisible;

    // Use thumbnails instead of full images
    let photosHTML = photos.map(p => {
        const photoPath = typeof p === 'string' ? p : p.path;
        const thumbPath = getThumbUrl(photoPath);
        return `<img src="${thumbPath}" alt="" onerror="this.src='photos/${photoPath}'">`;
    }).join('');

    if (remainingCount === 1) {
        const ninthPhoto = sortedPhotos[maxVisible];
        const photoPath = typeof ninthPhoto === 'string' ? ninthPhoto : ninthPhoto.path;
        const thumbPath = getThumbUrl(photoPath);
        photosHTML += `<img src="${thumbPath}" alt="" onerror="this.src='photos/${photoPath}'">`;
    } else if (remainingCount >= 2) {
        const ninthPhoto = sortedPhotos[maxVisible];
        const photoPath = typeof ninthPhoto === 'string' ? ninthPhoto : ninthPhoto.path;
        const thumbPath = getThumbUrl(photoPath);
        photosHTML += `<div class="hover-preview-more-blur">
            <img src="${thumbPath}" alt="" onerror="this.src='photos/${photoPath}'">
            <span class="plus-n-overlay">+${remainingCount}</span>
        </div>`;
    }

    hoverPreview.innerHTML = `
        <div class="hover-preview-title">${visit.city}, ${visit.country}</div>
        <div class="hover-preview-grid">${photosHTML}</div>
    `;

    // Position preview
    const mapRect = document.getElementById('map').getBoundingClientRect();
    hoverPreview.style.left = `${mapRect.left + screenPosition.x + 15}px`;
    hoverPreview.style.top = `${mapRect.top + screenPosition.y + 15}px`;
    hoverPreview.classList.add('visible');
}

function hideHoverPreview() {
    hoverPreview.classList.remove('visible', 'pinned');
    isHoverPinned = false;
}

// Show photos in the left viewer panel
function showInViewer(visit, startIndex = 0) {
    if (!visit.photos || visit.photos.length === 0) return;

    currentVisit = visit;
    isGlobalGallery = false;

    let photosToShow = visit.photos.map((p, i) => ({ photo: p, originalIndex: i }));
    photosToShow.sort((a, b) => {
        const dateA = typeof a.photo === 'string' ? '' : (a.photo.date || '');
        const dateB = typeof b.photo === 'string' ? '' : (b.photo.date || '');
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateB.localeCompare(dateA);
    });

    filteredPhotos = photosToShow;
    currentPhotoIndex = startIndex;

    renderViewer();
}

function showInViewerGlobal(startPhotoPath) {
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

    renderViewer();
}

function renderViewer() {
    if (filteredPhotos.length === 0) return;

    const item = filteredPhotos[currentPhotoIndex];
    const photo = item.photo;
    const photoPath = typeof photo === 'string' ? photo : photo.path;
    const photoDate = typeof photo === 'string' ? '' : (photo.date || '');

    let title, visit;
    if (isGlobalGallery) {
        visit = item.visit;
        title = `${visit.city}, ${visit.country}`;
    } else {
        visit = currentVisit;
        title = `${currentVisit.city}, ${currentVisit.country}`;
    }

    photoViewer.innerHTML = `
        <div class="photo-viewer-content">
            <div class="photo-viewer-main">
                <button class="photo-viewer-nav prev" ${currentPhotoIndex === 0 ? 'disabled' : ''}>‹</button>
                <img src="photos/${photoPath}" alt="">
                <button class="photo-viewer-nav next" ${currentPhotoIndex === filteredPhotos.length - 1 ? 'disabled' : ''}>›</button>
            </div>
            <div class="photo-viewer-info">
                <button class="autoplay-btn ${isAutoplayActive ? 'playing' : ''}">${isAutoplayActive ? '⏸' : '▶'}</button>
                <span class="photo-viewer-title">${title}</span>
                <span class="photo-viewer-date">${photoDate} · ${currentPhotoIndex + 1}/${filteredPhotos.length}</span>
            </div>
        </div>
    `;

    // Highlight current photo in timeline
    highlightTimelinePhoto(photoPath);

    // Highlight marker on map
    highlightMarker(visit);

    // Add event listeners
    photoViewer.querySelector('.photo-viewer-nav.prev')?.addEventListener('click', () => {
        if (currentPhotoIndex > 0) {
            stopAutoplay();
            updateAutoplayButton();
            currentPhotoIndex--;
            transitionToPhoto();
        }
    });

    photoViewer.querySelector('.photo-viewer-nav.next')?.addEventListener('click', () => {
        if (currentPhotoIndex < filteredPhotos.length - 1) {
            stopAutoplay();
            updateAutoplayButton();
            currentPhotoIndex++;
            transitionToPhoto();
        }
    });

    photoViewer.querySelector('.autoplay-btn')?.addEventListener('click', toggleAutoplay);
}

// Autoplay functions
function toggleAutoplay() {
    if (isAutoplayActive) {
        stopAutoplay();
        updateAutoplayButton();
    } else {
        startAutoplay();
    }
}

function startAutoplay() {
    // Start from global gallery if not already viewing
    if (filteredPhotos.length === 0) {
        showInViewerGlobal();
    }

    isAutoplayActive = true;
    updateAutoplayButton();

    autoplayInterval = setInterval(() => {
        if (currentPhotoIndex < filteredPhotos.length - 1) {
            currentPhotoIndex++;
        } else {
            // Loop back to start
            currentPhotoIndex = 0;
        }
        transitionToPhoto();
    }, AUTOPLAY_DELAY);
}

function stopAutoplay() {
    if (!isAutoplayActive) return;
    isAutoplayActive = false;
    if (autoplayInterval) {
        clearInterval(autoplayInterval);
        autoplayInterval = null;
    }
}

function updateAutoplayButton() {
    const btn = photoViewer.querySelector('.autoplay-btn');
    if (btn) {
        btn.textContent = isAutoplayActive ? '⏸' : '▶';
        btn.classList.toggle('playing', isAutoplayActive);
    }
}

// Smooth transition to new photo
function transitionToPhoto() {
    const img = photoViewer.querySelector('.photo-viewer-main img');
    if (!img) {
        renderViewer();
        return;
    }

    // Fade out
    img.style.transition = 'opacity 0.3s ease-out';
    img.style.opacity = '0';

    setTimeout(() => {
        // Update content
        const item = filteredPhotos[currentPhotoIndex];
        const photo = item.photo;
        const photoPath = typeof photo === 'string' ? photo : photo.path;
        const photoDate = typeof photo === 'string' ? '' : (photo.date || '');

        let title, visit;
        if (isGlobalGallery) {
            visit = item.visit;
            title = `${visit.city}, ${visit.country}`;
        } else {
            visit = currentVisit;
            title = `${currentVisit.city}, ${currentVisit.country}`;
        }

        // Update info
        const titleEl = photoViewer.querySelector('.photo-viewer-title');
        const dateEl = photoViewer.querySelector('.photo-viewer-date');
        if (titleEl) titleEl.textContent = title;
        if (dateEl) dateEl.textContent = `${photoDate} · ${currentPhotoIndex + 1}/${filteredPhotos.length}`;

        // Update nav buttons
        const prevBtn = photoViewer.querySelector('.photo-viewer-nav.prev');
        const nextBtn = photoViewer.querySelector('.photo-viewer-nav.next');
        if (prevBtn) prevBtn.disabled = currentPhotoIndex === 0;
        if (nextBtn) nextBtn.disabled = currentPhotoIndex === filteredPhotos.length - 1;

        // Highlight timeline and marker
        highlightTimelinePhoto(photoPath);
        highlightMarker(visit);

        // Hide image completely while changing src
        img.style.visibility = 'hidden';

        // Preload new image, then fade in
        const newSrc = `photos/${photoPath}`;
        const preloadImg = new Image();

        const showImage = () => {
            img.src = newSrc;
            // Wait for browser to update, then show
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    img.style.visibility = 'visible';
                    img.style.opacity = '1';
                });
            });
        };

        preloadImg.onload = showImage;
        preloadImg.onerror = showImage;
        preloadImg.src = newSrc;
    }, 300);
}

// Highlight photo in timeline
function highlightTimelinePhoto(photoPath) {
    // Remove previous highlight
    document.querySelectorAll('.timeline-photo.playing').forEach(el => {
        el.classList.remove('playing');
    });

    // Add highlight to current photo
    const photoEl = document.querySelector(`.timeline-photo[data-path="${photoPath}"]`);
    if (photoEl) {
        photoEl.classList.add('playing');
        photoEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
}

// Highlight marker on map (including overlapping markers in the same cluster)
function highlightMarker(visit) {
    // Remove previous highlight
    g.selectAll('.city-marker').classed('active-marker', false);

    const index = visits.indexOf(visit);
    if (index < 0) return;

    // Find clusters and check if this visit is in an overlapping cluster
    const clusters = findOverlappingMarkers();
    const cluster = clusters.find(c => c.some(m => m.index === index));

    if (cluster && cluster.length > 1) {
        // Highlight all markers in the overlapping cluster
        cluster.forEach(m => {
            g.select(`.city-marker[data-index="${m.index}"]`).classed('active-marker', true);
        });
    } else {
        // Single marker - just highlight it
        g.select(`.city-marker[data-index="${index}"]`).classed('active-marker', true);
    }
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

    let html = '';

    entries.forEach((entry, i) => {
        // Format date as YYYY-MM
        const yearMonth = entry.date.substring(0, 7);

        html += `
            <div class="timeline-entry" data-index="${i}">
                <div class="timeline-entry-header">
                    <img class="timeline-flag" src="${getFlagUrl(entry.visit.countryCode)}" alt="${entry.visit.country}"
                         onerror="this.style.display='none'">
                    <span class="timeline-entry-city">${entry.visit.city}</span>
                    <span class="timeline-entry-date">${yearMonth}</span>
                </div>
                <div class="timeline-photos">
                    ${entry.photos.map(p => {
                        const photoPath = typeof p === 'string' ? p : p.path;
                        const thumbPath = getThumbUrl(photoPath);
                        return `<div class="timeline-photo" data-path="${photoPath}"><img src="${thumbPath}" alt="" loading="lazy" decoding="async" onerror="this.src='photos/${photoPath}'"></div>`;
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
    const photoEl = e.target.closest('.timeline-photo, .timeline-photo-more, .timeline-photo-more-blur');
    const entryEl = e.target.closest('.timeline-entry');

    if (!entryEl) return;

    stopAutoplay();

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

    showInViewerGlobal(startPhotoPath);
});

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

        // Manually add Taiwan as visited
        visitedCountryCodes.add('TW');

        highlightCountries();
        createMarkers();
        buildTimeline();
        buildGlobalPhotoList();

        // Start autoplay by default
        if (allPhotosGlobal.length > 0) {
            showInViewerGlobal();
            setTimeout(() => startAutoplay(), 500);
        }

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
    // Photo viewer navigation
    if (filteredPhotos.length > 0) {
        if (e.key === 'ArrowLeft' && currentPhotoIndex > 0) {
            stopAutoplay();
            updateAutoplayButton();
            currentPhotoIndex--;
            transitionToPhoto();
        } else if (e.key === 'ArrowRight' && currentPhotoIndex < filteredPhotos.length - 1) {
            stopAutoplay();
            updateAutoplayButton();
            currentPhotoIndex++;
            transitionToPhoto();
        }
    }

    // Full-screen gallery (if still used)
    if (!gallery.classList.contains('hidden')) {
        switch (e.key) {
            case 'Escape': closeGallery(); break;
            case 'ArrowLeft': navigateGallery(-1); break;
            case 'ArrowRight': navigateGallery(1); break;
        }
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

// Handle clicks on pinned hover preview city blocks
hoverPreview.addEventListener('click', (e) => {
    if (!isHoverPinned) return;

    const cityBlock = e.target.closest('.hover-city-block');
    if (cityBlock && cityBlock.dataset.cityIndex !== undefined) {
        e.stopPropagation();
        const index = parseInt(cityBlock.dataset.cityIndex);
        const visit = pinnedVisits[index];
        if (visit) {
            hideHoverPreview();
            stopAutoplay();
            updateAutoplayButton();
            showInViewer(visit);
        }
    }
});

// Close pinned hover preview when clicking outside
document.addEventListener('click', (e) => {
    if (isHoverPinned && !justPinned && !hoverPreview.contains(e.target)) {
        hideHoverPreview();
    }
});

// Zoom controls
document.getElementById('zoom-in').addEventListener('click', () => {
    svg.transition().duration(300).call(zoom.scaleBy, 1.5);
});

document.getElementById('zoom-out').addEventListener('click', () => {
    svg.transition().duration(300).call(zoom.scaleBy, 0.67);
});

// Window resize handler
function handleResize() {
    const container = document.getElementById('map');
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Update SVG size
    svg.attr('width', width).attr('height', height);

    // Recalculate projection using fitSize
    if (worldData) {
        const padding = 10;
        projection.fitSize([width - padding * 2, height - padding * 2], worldData);
        const currentTranslate = projection.translate();
        projection.translate([currentTranslate[0] + padding, currentTranslate[1] + padding]);
    }

    g.selectAll('.country').attr('d', path);
    g.selectAll('.city-marker').each(function() {
        const index = +d3.select(this).attr('data-index');
        const visit = visits[index];
        if (visit) {
            const [x, y] = projection([visit.lng, visit.lat]);
            d3.select(this).attr('cx', x).attr('cy', y);
        }
    });
}

window.addEventListener('resize', handleResize);

// Initialize
async function init() {
    await initMap();
    await loadData();
}

init();
