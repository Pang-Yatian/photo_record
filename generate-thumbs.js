// One-time script to generate thumbnails for existing photos
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const photosDir = path.join(__dirname, 'photos');
const thumbsDir = path.join(photosDir, 'thumbs');

async function generateThumbnails() {
    // Get all city folders (exclude thumbs folder)
    const folders = fs.readdirSync(photosDir).filter(f => {
        const fullPath = path.join(photosDir, f);
        return fs.statSync(fullPath).isDirectory() && f !== 'thumbs';
    });

    let processed = 0;
    let skipped = 0;
    let failed = 0;

    for (const folder of folders) {
        const cityPath = path.join(photosDir, folder);
        const thumbCityPath = path.join(thumbsDir, folder);

        // Create thumbs folder for this city
        if (!fs.existsSync(thumbCityPath)) {
            fs.mkdirSync(thumbCityPath, { recursive: true });
        }

        // Get all images in city folder
        const files = fs.readdirSync(cityPath).filter(f =>
            /\.(jpg|jpeg|png|gif|webp)$/i.test(f)
        );

        for (const file of files) {
            const inputPath = path.join(cityPath, file);
            const thumbFilename = file.replace(/\.[^.]+$/, '.jpg');
            const outputPath = path.join(thumbCityPath, thumbFilename);

            // Skip if thumbnail already exists
            if (fs.existsSync(outputPath)) {
                skipped++;
                continue;
            }

            try {
                await sharp(inputPath)
                    .rotate() // Auto-rotate based on EXIF orientation
                    .resize(200, 200, { fit: 'cover' })
                    .jpeg({ quality: 60 })
                    .toFile(outputPath);
                processed++;
                console.log(`Created: ${folder}/${thumbFilename}`);
            } catch (err) {
                failed++;
                console.error(`Failed: ${folder}/${file} - ${err.message}`);
            }
        }
    }

    console.log(`\nDone! Processed: ${processed}, Skipped: ${skipped}, Failed: ${failed}`);
}

generateThumbnails().catch(console.error);
