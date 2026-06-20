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
        cb(null, 'assets/thumbnail/');
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
        const thumbnailPath = `assets/thumbnail/${req.file.filename}`;
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

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
