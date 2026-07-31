// Shared photo / timeline sort helpers

function getPhotoPath(photo) {
    return typeof photo === 'string' ? photo : photo.path;
}

function getPhotoDate(photo) {
    return typeof photo === 'string' ? '' : (photo.date || '');
}

/** Upload time from filename suffix, e.g. name-1780378950285.jpg */
function getUploadTimestamp(photo) {
    const match = getPhotoPath(photo).match(/-(\d{10,})\.[^.]+$/i);
    return match ? parseInt(match[1], 10) : 0;
}

function comparePhotos(a, b) {
    const dateA = getPhotoDate(a);
    const dateB = getPhotoDate(b);
    if (dateA !== dateB) {
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateB.localeCompare(dateA);
    }
    return getUploadTimestamp(b) - getUploadTimestamp(a);
}

function sortPhotosNewestFirst(photos) {
    if (!photos || photos.length === 0) return [];
    return [...photos].sort(comparePhotos);
}

const REGION_ORDER = {
    oceania: 0,
    americas: 1,
    asia: 2,
    middle_east: 3,
    europe: 4
};

function getRegion(visit) {
    const cc = visit.countryCode;
    if (['AU', 'NZ', 'FJ', 'PG', 'NC'].includes(cc)) return 'oceania';
    if (['US', 'CA', 'MX'].includes(cc)) return 'americas';
    if (['JP', 'SG', 'CN', 'KR', 'TH', 'TW', 'MY', 'ID', 'MV', 'PH', 'VN', 'IN'].includes(cc)) {
        return 'asia';
    }
    if (['AE', 'IL', 'TR', 'QA', 'SA'].includes(cc)) return 'middle_east';
    return 'europe';
}

/** West→east within region (Melbourne→Sydney→Brisbane, SF→Denver, etc.) */
function compareLngInRegion(a, b, region) {
    if (region === 'asia') return b.lng - a.lng;
    return a.lng - b.lng;
}

function compareVisitsWestToEast(a, b) {
    const regionA = getRegion(a);
    const regionB = getRegion(b);
    const regionCmp = REGION_ORDER[regionA] - REGION_ORDER[regionB];
    if (regionCmp !== 0) return regionCmp;
    return compareLngInRegion(a, b, regionA);
}

/**
 * Timeline (left = newest month):
 * 1. Month descending
 * 2. Same month: Oceania → Americas → Asia (so AU Jun before Denver, Denver sits next to May SF)
 * 3. Within region: geographic order
 */
function compareTimelineEntries(a, b) {
    const monthCmp = b.date.substring(0, 7).localeCompare(a.date.substring(0, 7));
    if (monthCmp !== 0) return monthCmp;

    const regionA = getRegion(a.visit);
    const regionB = getRegion(b.visit);
    const regionCmp = REGION_ORDER[regionA] - REGION_ORDER[regionB];
    if (regionCmp !== 0) return regionCmp;

    return compareLngInRegion(a.visit, b.visit, regionA);
}

function compareGlobalPhotos(a, b) {
    const dateCmp = b.date.localeCompare(a.date);
    if (dateCmp !== 0) return dateCmp;
    const visitCmp = compareVisitsWestToEast(a.visit, b.visit);
    if (visitCmp !== 0) return visitCmp;
    return getUploadTimestamp(b.photo) - getUploadTimestamp(a.photo);
}
