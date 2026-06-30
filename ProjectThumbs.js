// ProjectThumbs.js
// Resolves the thumbnail for a project by picking a RANDOM image from the
// images that accompany that project (the ones listed in the project's own
// projectpage.json). Falls back to the project's configured `thumbnail` when a
// project has no accompanying images.
//
// Usage:
//   import { loadProjectImages, pickThumb, getRandomThumb } from './ProjectThumbs.js';
//   await loadProjectImages(project);   // preload once (cached per folder)
//   const src = pickThumb(project);      // synchronous random pick (uses cache)
//   const src = await getRandomThumb(project); // ensure-loaded + pick

const imageCache = new Map(); // folder -> array<string> of image paths
const inflight = new Map();   // folder -> Promise<array<string>>

// Derive a project's asset folder from its `link`
// e.g. "assets/PROJECT-PAGES/Elvira/projectpage.html" -> "assets/PROJECT-PAGES/Elvira"
function projectFolder(project) {
    const link = project && project.link;
    if (!link) return null;
    const idx = link.lastIndexOf('/');
    return idx >= 0 ? link.slice(0, idx) : '';
}

// Collect every image filename from the project's sections and turn it into a
// full, fetchable path relative to the site root.
function extractImages(json, folder) {
    const out = [];
    const projectsArr = (json && json.projects) || [];
    projectsArr.forEach((p) => {
        (p.sections || []).forEach((sec) => {
            if (sec && sec.sectiontype === 'image' && Array.isArray(sec.value)) {
                sec.value.forEach((item) => {
                    const fn = item && item.filename;
                    if (fn) out.push(`${folder}/${fn}`);
                });
            }
        });
    });
    return out;
}

// Fetch + cache the accompanying-image list for a project. Safe to call many
// times; only fetches once per folder.
export async function loadProjectImages(project) {
    const folder = projectFolder(project);
    if (!folder) return [];
    if (imageCache.has(folder)) return imageCache.get(folder);
    if (inflight.has(folder)) return inflight.get(folder);

    const promise = (async () => {
        try {
            const res = await fetch(`${folder}/projectpage.json`);
            if (!res.ok) throw new Error(`projectpage.json ${res.status}`);
            const json = await res.json();
            const imgs = extractImages(json, folder);
            imageCache.set(folder, imgs);
            return imgs;
        } catch (err) {
            console.warn(`ProjectThumbs: could not load images for ${folder}:`, err.message);
            imageCache.set(folder, []);
            return [];
        } finally {
            inflight.delete(folder);
        }
    })();

    inflight.set(folder, promise);
    return promise;
}

// Synchronous random pick. Returns a random accompanying-image path if the
// folder's images have been loaded; otherwise falls back to the configured
// thumbnail (or '' if none).
export function pickThumb(project) {
    const folder = projectFolder(project);
    const imgs = folder ? imageCache.get(folder) : null;
    if (imgs && imgs.length) {
        return imgs[Math.floor(Math.random() * imgs.length)];
    }
    return (project && project.thumbnail) ? project.thumbnail : '';
}

// Ensure images are loaded, then pick a random one.
export async function getRandomThumb(project) {
    await loadProjectImages(project);
    return pickThumb(project);
}

// Preload image lists for many projects at once.
export async function preloadProjectImages(projectList) {
    if (!Array.isArray(projectList)) return;
    await Promise.all(projectList.map((p) => loadProjectImages(p)));
}
