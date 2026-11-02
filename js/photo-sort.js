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
    const dateA = getPhotoDate(a).substring(0, 7);
    const dateB = getPhotoDate(b).substring(0, 7);
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

/** Latest upload in this city/month group, independent of the photo array order. */
function getLatestUploadTimestamp(photos) {
    return (photos || []).reduce((latest, photo) => Math.max(latest, getUploadTimestamp(photo)), 0);
}

/** Timeline: newest month first; within a month, latest uploaded city group first. */
function compareTimelineEntries(a, b) {
    const monthCmp = b.date.substring(0, 7).localeCompare(a.date.substring(0, 7));
    if (monthCmp !== 0) return monthCmp;
    return getLatestUploadTimestamp(b.photos) - getLatestUploadTimestamp(a.photos);
}

function compareGlobalPhotos(a, b) {
    return comparePhotos(a.photo, b.photo);
}
