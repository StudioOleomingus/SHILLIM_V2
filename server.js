const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const app = express();
const port = 3001;

// Configure multer for thumbnail uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'assets/PREVIEW-ASSETS/thumbnail/');
    },
    filename: function (req, file, cb) {
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        cb(null, `thumbnail_${timestamp}${ext}`);
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: function (req, file, cb) {
        // Accept images only
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    }
});

app.use(express.json());
app.use(cors());
app.use(express.static('.'));

const jsonFile = './data/projects.json';

// Upload thumbnail endpoint
app.post('/api/upload-thumbnail', upload.single('thumbnail'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const thumbnailPath = `assets/PREVIEW-ASSETS/thumbnail/${req.file.filename}`;
        res.json({ success: true, path: thumbnailPath });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all projects
app.get('/api/projects', async (req, res) => {
    try {
        const data = await fs.readFile(jsonFile, 'utf8');
        const jsonData = JSON.parse(data);
        const projects = jsonData.projects || [];
        res.json(Array.isArray(projects) ? projects : [projects]);
    } catch (error) {
        if (error.code === 'ENOENT') {
            // If file doesn't exist, return empty array
            res.json([]);
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

// Update or add project
app.post('/api/projects', async (req, res) => {
    try {
        let projects = [];
        try {
            const data = await fs.readFile(jsonFile, 'utf8');
            const jsonData = JSON.parse(data);
            projects = jsonData.projects || [];
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
        }

        if (!Array.isArray(projects)) projects = [];
        
        const index = parseInt(req.body.index);
        const projectData = req.body.project;

        if (index >= 0 && index < projects.length) {
            projects[index] = projectData;
        } else {
            projects.push(projectData);
        }

        await fs.writeFile(jsonFile, JSON.stringify({ projects }, null, 2));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete project
app.delete('/api/projects/:index', async (req, res) => {
    try {
        const data = await fs.readFile(jsonFile, 'utf8');
        const jsonData = JSON.parse(data);
        const projects = jsonData.projects || [];
        
        const index = parseInt(req.params.index);
        if (index >= 0 && index < projects.length) {
            const project = projects[index];
            
            // Delete thumbnail file if it exists
            if (project.thumbnail) {
                const thumbnailPath = path.join(__dirname, project.thumbnail);
                try {
                    await fs.unlink(thumbnailPath);
                    console.log(`Deleted thumbnail: ${thumbnailPath}`);
                } catch (err) {
                    console.log(`Could not delete thumbnail: ${err.message}`);
                    // Continue with project deletion even if thumbnail deletion fails
                }
            }
            
            projects.splice(index, 1);
            await fs.writeFile(jsonFile, JSON.stringify({ projects }, null, 2));
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Project not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ---------------------------------------------------------------------------
// Unified CRUD additions: per-project page JSONs, asset metadata, media upload
// ---------------------------------------------------------------------------

const PROJECT_ROOT = __dirname;
const MEDIA_EXT = {
    image: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif'],
    video: ['.mp4', '.webm', '.mov', '.m4v', '.ogv'],
    audio: ['.mp3', '.wav', '.m4a', '.ogg', '.aac', '.flac']
};

// Resolve a client-supplied relative path safely inside the project root.
function safeResolve(relPath) {
    if (!relPath || typeof relPath !== 'string') return null;
    const clean = relPath.replace(/^\/+/, '');
    const abs = path.resolve(PROJECT_ROOT, clean);
    if (abs !== PROJECT_ROOT && !abs.startsWith(PROJECT_ROOT + path.sep)) return null;
    return abs;
}

// Derive the folder + page-json path from an index project's `link` field.
function pageInfoFromLink(link) {
    if (!link) return { folder: null, pageJson: null };
    const folder = path.posix.dirname(link.replace(/\\/g, '/'));
    return { folder, pageJson: path.posix.join(folder, 'projectpage.json') };
}

function classifyExt(ext) {
    ext = ext.toLowerCase();
    if (MEDIA_EXT.image.includes(ext)) return 'image';
    if (MEDIA_EXT.video.includes(ext)) return 'video';
    if (MEDIA_EXT.audio.includes(ext)) return 'audio';
    return null;
}

// Gather media + page metadata for a project folder.
async function folderMeta(folder) {
    const meta = {
        folder,
        pageJsonExists: false,
        projectCount: 0,
        sectionCount: 0,
        imageRefCount: 0,
        media: { image: 0, video: 0, audio: 0, total: 0 }
    };
    if (!folder) return meta;
    const absFolder = safeResolve(folder);
    if (!absFolder) return meta;

    // Page JSON stats
    const absJson = path.join(absFolder, 'projectpage.json');
    try {
        const raw = await fs.readFile(absJson, 'utf8');
        const data = JSON.parse(raw);
        meta.pageJsonExists = true;
        const projects = Array.isArray(data.projects) ? data.projects : [];
        meta.projectCount = projects.length;
        for (const p of projects) {
            const sections = Array.isArray(p.sections) ? p.sections : [];
            meta.sectionCount += sections.length;
            for (const s of sections) {
                if (s.sectiontype === 'image' && Array.isArray(s.value)) {
                    meta.imageRefCount += s.value.length;
                }
            }
        }
    } catch (e) { /* no page json */ }

    // Count media files on disk
    try {
        const entries = await fs.readdir(absFolder, { withFileTypes: true });
        for (const ent of entries) {
            if (!ent.isFile()) continue;
            const kind = classifyExt(path.extname(ent.name));
            if (kind) { meta.media[kind]++; meta.media.total++; }
        }
    } catch (e) { /* folder missing */ }

    return meta;
}

// GET /api/archive — index entries each augmented with asset metadata.
app.get('/api/archive', async (req, res) => {
    try {
        let projects = [];
        try {
            const data = await fs.readFile(jsonFile, 'utf8');
            projects = JSON.parse(data).projects || [];
        } catch (e) { if (e.code !== 'ENOENT') throw e; }
        if (!Array.isArray(projects)) projects = [projects];

        const out = [];
        for (const p of projects) {
            const { folder, pageJson } = pageInfoFromLink(p.link);
            const meta = await folderMeta(folder);
            meta.pageJson = pageJson;
            // Thumbnail existence
            meta.thumbnailExists = false;
            if (p.thumbnail) {
                const absThumb = safeResolve(p.thumbnail);
                if (absThumb) {
                    try { await fs.access(absThumb); meta.thumbnailExists = true; } catch (e) {}
                }
            }
            out.push({ ...p, _meta: meta });
        }
        res.json({ projects: out });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/projectpage?path=assets/PROJECT-PAGES/<Name>/projectpage.json
app.get('/api/projectpage', async (req, res) => {
    const abs = safeResolve(req.query.path);
    if (!abs) return res.status(400).json({ error: 'Invalid path' });
    try {
        const raw = await fs.readFile(abs, 'utf8');
        res.json(JSON.parse(raw));
    } catch (error) {
        if (error.code === 'ENOENT') return res.status(404).json({ error: 'Not found' });
        res.status(500).json({ error: error.message });
    }
});

// POST /api/projectpage  { path, data }  — write a per-project page JSON to disk.
app.post('/api/projectpage', async (req, res) => {
    const abs = safeResolve(req.body && req.body.path);
    if (!abs) return res.status(400).json({ error: 'Invalid path' });
    if (typeof req.body.data !== 'object' || req.body.data === null) {
        return res.status(400).json({ error: 'Missing data object' });
    }
    try {
        await fs.mkdir(path.dirname(abs), { recursive: true });
        await fs.writeFile(abs, JSON.stringify(req.body.data, null, 2));
        res.json({ success: true, path: req.body.path });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/folder-media?dir=assets/PROJECT-PAGES/<Name> — list media files in a folder.
app.get('/api/folder-media', async (req, res) => {
    const dir = req.query.dir;
    const abs = safeResolve(dir);
    if (!abs) return res.status(400).json({ error: 'Invalid dir' });
    try {
        const entries = await fs.readdir(abs, { withFileTypes: true });
        const files = [];
        for (const ent of entries) {
            if (!ent.isFile()) continue;
            const kind = classifyExt(path.extname(ent.name));
            if (kind) files.push({ name: ent.name, kind, path: path.posix.join(dir.replace(/\\/g, '/'), ent.name) });
        }
        res.json({ files });
    } catch (error) {
        if (error.code === 'ENOENT') return res.json({ files: [] });
        res.status(500).json({ error: error.message });
    }
});

// POST /api/upload-asset — upload a media file into a project folder.
// Folder is passed as ?dir=... (defaults to a generic uploads folder).
const assetUpload = multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            const dir = (req.query.dir || 'assets/PREVIEW-ASSETS/thumbnail').toString();
            const abs = safeResolve(dir);
            if (!abs) return cb(new Error('Invalid dir'));
            fs.mkdir(abs, { recursive: true }).then(() => cb(null, abs)).catch(cb);
        },
        filename: function (req, file, cb) {
            // Preserve original name; avoid collisions with a short suffix.
            const ext = path.extname(file.originalname);
            const base = path.basename(file.originalname, ext)
                .replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60) || 'asset';
            cb(null, `${base}${ext}`);
        }
    })
});

app.post('/api/upload-asset', assetUpload.single('asset'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        const dir = (req.query.dir || 'assets/PREVIEW-ASSETS/thumbnail').toString().replace(/\\/g, '/');
        const relPath = path.posix.join(dir, req.file.filename);
        res.json({ success: true, path: relPath, filename: req.file.filename });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
