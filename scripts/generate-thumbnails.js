#!/usr/bin/env node
/**
 * generate-thumbnails.js
 * -----------------------------------------------------------------------------
 * Produces small WebP thumbnails used by the archive index and the landing
 * preview, WITHOUT touching the full-resolution originals that project pages
 * display.
 *
 * For a source image at   <dir>/<name>.<ext>
 * the thumbnail is written <dir>/thumbs/<name>.webp
 *
 * The front-end resolves that path automatically (see thumbPath() in
 * ProjectThumbs.js) and falls back to the original if a thumbnail is missing,
 * so it is always safe to run — or not run — this script.
 *
 * It is incremental: a thumbnail is only (re)generated when it is missing or
 * older than its source. Run it again whenever you add new project images:
 *
 *     npm run thumbnails
 *
 * Requires the `sharp` dev dependency (installed via `npm install`).
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = process.cwd();
const THUMB_DIR = 'thumbs';

// Which folders to process, and how big / how compressed their thumbnails are.
const GROUPS = [
    // Project-page images: these feed the random index-card thumbnails.
    { dir: 'assets/PROJECT-PAGES',            recursive: true,  maxEdge: 700,  quality: 74 },
    // The configured per-project thumbnails (projectindex.html detail panel).
    { dir: 'assets/PREVIEW-ASSETS/thumbnail', recursive: false, maxEdge: 700,  quality: 74 },
    // The decorative landing preview — shown larger, so keep it a bit crisper.
    { dir: 'assets/PREVIEW-ASSETS/previewimages', recursive: false, maxEdge: 1200, quality: 80 },
];

const SOURCE_EXTS = new Set(['.jpg', '.jpeg', '.png']);

let made = 0, skipped = 0, failed = 0;

function walk(dir, recursive, out = []) {
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return out; // folder doesn't exist yet — fine
    }
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            if (e.name === THUMB_DIR) continue;          // never thumbnail thumbnails
            if (recursive) walk(full, recursive, out);
        } else if (e.isFile()) {
            if (SOURCE_EXTS.has(path.extname(e.name).toLowerCase())) out.push(full);
        }
    }
    return out;
}

function thumbTargetFor(srcAbs) {
    const dir = path.dirname(srcAbs);
    const name = path.basename(srcAbs, path.extname(srcAbs));
    return path.join(dir, THUMB_DIR, `${name}.webp`);
}

function needsBuild(srcAbs, dstAbs) {
    try {
        const s = fs.statSync(srcAbs);
        const d = fs.statSync(dstAbs);
        return s.mtimeMs > d.mtimeMs; // rebuild only if source is newer
    } catch {
        return true; // dst missing
    }
}

async function build(group) {
    const base = path.join(ROOT, group.dir);
    const files = walk(base, group.recursive);
    for (const srcAbs of files) {
        const dstAbs = thumbTargetFor(srcAbs);
        if (!needsBuild(srcAbs, dstAbs)) { skipped++; continue; }
        try {
            fs.mkdirSync(path.dirname(dstAbs), { recursive: true });
            await sharp(srcAbs)
                .rotate() // respect EXIF orientation
                .resize({ width: group.maxEdge, height: group.maxEdge, fit: 'inside', withoutEnlargement: true })
                .webp({ quality: group.quality })
                .toFile(dstAbs);
            made++;
            const kb = (fs.statSync(dstAbs).size / 1024).toFixed(0);
            console.log(`  ✓ ${path.relative(ROOT, dstAbs)} (${kb} KB)`);
        } catch (err) {
            failed++;
            console.warn(`  ✗ ${path.relative(ROOT, srcAbs)} — ${err.message}`);
        }
    }
}

(async () => {
    console.log('Generating thumbnails…');
    for (const g of GROUPS) {
        console.log(`\n[${g.dir}]`);
        await build(g);
    }
    console.log(`\nDone. ${made} built, ${skipped} up-to-date, ${failed} failed.`);
    if (failed) process.exitCode = 1;
})();
