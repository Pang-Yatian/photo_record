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

function isAmericas(visit) {
    return visit.lng < 0 || ['US', 'CA', 'MX'].includes(visit.countryCode);
}

/** Same calendar month: Americas (west→east), then Asia (east→west lng: Tokyo before Singapore) */
function compareVisitsWestToEast(a, b) {
    const americasA = isAmericas(a);
    const americasB = isAmericas(b);
    if (americasA !== americasB) return americasA ? -1 : 1;
    if (americasA) return a.lng - b.lng;
    return b.lng - a.lng;
}

function compareTimelineEntries(a, b) {
    const monthCmp = b.date.substring(0, 7).localeCompare(a.date.substring(0, 7));
    if (monthCmp !== 0) return monthCmp;
    return compareVisitsWestToEast(a.visit, b.visit);
}

function compareGlobalPhotos(a, b) {
    const dateCmp = b.date.localeCompare(a.date);
    if (dateCmp !== 0) return dateCmp;
    const visitCmp = compareVisitsWestToEast(a.visit, b.visit);
    if (visitCmp !== 0) return visitCmp;
    return getUploadTimestamp(b.photo) - getUploadTimestamp(a.photo);
}
