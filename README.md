# Photo Record (Travel Map Gallery)

Local Node.js app for managing and viewing a world travel photo gallery.

## Requirements

- Node.js 18+ (Node 20 recommended)
- npm

## Run locally

From project root:

```bash
npm install
npm start
```

The server runs at:

- Admin upload page: `http://localhost:3000/`
- Public gallery page: `http://localhost:3000/index.html`

## How to upload photos

1. Open `http://localhost:3000/` (admin page).
2. Click `+` to open the **Add City** sidebar.
3. Search a city name and pick one from suggestions.
4. Optionally set a month in **Date**.
5. Drag/drop photos (or click to select).
6. Click **Add to Map**.

Uploaded files are saved under `photos/<city-folder>/` and thumbnails under `photos/thumbs/<city-folder>/`.
Metadata is stored in `data.json`.

## Project files

- `server.js` - Express server + upload APIs + city/photo management APIs
- `admin.html` + `js/admin.js` - Admin UI for adding/editing/deleting
- `index.html` + `js/app.js` - Public gallery/map view
- `data.json` - Gallery data (cities + photo paths/dates)
- `photos/` - Original photos and generated thumbnails

## Useful notes

- The app uses OpenStreetMap Nominatim for city geocoding.
- Upload accepts: `jpeg`, `jpg`, `png`, `gif`, `webp`, and iPhone `heic`/`heif`.
- iPhone HEIC photos are **automatically converted to JPEG** on upload (browsers cannot display HEIC).
- Max upload size per file is 20MB; max 20 photos per upload.
