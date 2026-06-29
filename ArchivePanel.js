// ArchivePanel.js
// In-page "Archive Index" panel that cascades out from the right side of the
// interactive canvas (#app-container), occupying ~3/4 of the width, instead of
// opening projectindex.html in a new tab. Searchable / filterable, with an
// inline detail pane. Pure DOM (no PixiJS) layered above the canvas.

let panelEl = null;        // the sliding panel
let backdropEl = null;     // dim/click-to-close layer
let projectsData = [];     // loaded from data/projects.json
let dataLoaded = false;
let selectedIndex = -1;
let built = false;

const CATEGORIES = ['ART', 'COMMUNITY', 'ECOLOGY', 'RESEARCH', 'HEALTH', 'EDUCATION'];

function escapeHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function buildPanel() {
    if (built) return;
    const container = document.getElementById('app-container');
    if (!container) {
        console.error('ArchivePanel: #app-container not found');
        return;
    }

    // Backdrop (covers the whole container; clicking the exposed area closes)
    backdropEl = document.createElement('div');
    backdropEl.className = 'archive-backdrop';
    backdropEl.addEventListener('click', closeArchivePanel);

    // Panel
    panelEl = document.createElement('div');
    panelEl.className = 'archive-panel';
    panelEl.setAttribute('role', 'dialog');
    panelEl.setAttribute('aria-label', 'Project Index');
    // Prevent backdrop click from firing when interacting inside the panel
    panelEl.addEventListener('click', (e) => e.stopPropagation());

    const categoryOptions = CATEGORIES
        .map((c) => `<option value="${c}">${c}</option>`)
        .join('');

    panelEl.innerHTML = `
        <div class="archive-header">
            <div class="archive-titlerow">
                <h2>Project Index</h2>
                <div class="archive-count"><span id="archiveCountText">0</span></div>
                <button class="archive-close" id="archiveCloseBtn" title="Close">&times;</button>
            </div>
            <div class="archive-search">
                <input type="text" id="archiveSearchInput" placeholder="Search projects...">
                <select id="archiveYearFilter"><option value="">All Years</option></select>
                <select id="archivePrimaryFilter">
                    <option value="">All Primary Categories</option>
                    ${categoryOptions}
                </select>
                <select id="archiveSecondaryFilter">
                    <option value="">All Secondary Categories</option>
                    ${categoryOptions}
                </select>
            </div>
        </div>
        <div class="archive-content">
            <div class="archive-left full-width">
                <div class="archive-grid" id="archiveGrid"></div>
            </div>
            <div class="archive-right" id="archiveDetails">
                <button class="archive-detail-close" id="archiveDetailClose" title="Close details">&times;</button>
                <div class="archive-no-selection"><h3>Select a project to view details</h3></div>
            </div>
        </div>
    `;

    container.appendChild(backdropEl);
    container.appendChild(panelEl);

    // Wire controls
    panelEl.querySelector('#archiveCloseBtn').addEventListener('click', closeArchivePanel);
    panelEl.querySelector('#archiveDetailClose').addEventListener('click', closeDetails);
    panelEl.querySelector('#archiveSearchInput').addEventListener('input', refreshGrid);
    panelEl.querySelector('#archiveYearFilter').addEventListener('change', refreshGrid);
    panelEl.querySelector('#archivePrimaryFilter').addEventListener('change', refreshGrid);
    panelEl.querySelector('#archiveSecondaryFilter').addEventListener('change', refreshGrid);

    // Esc closes
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && panelEl.classList.contains('open')) closeArchivePanel();
    });

    built = true;
}

async function loadData() {
    if (dataLoaded) return;
    try {
        const res = await fetch('data/projects.json');
        const data = await res.json();
        projectsData = data.projects || [];
        dataLoaded = true;
        populateYearFilter();
    } catch (err) {
        console.error('ArchivePanel: error loading projects.json', err);
        const grid = panelEl && panelEl.querySelector('#archiveGrid');
        if (grid) {
            grid.innerHTML = '<div class="archive-no-results"><h3>Could not load projects</h3></div>';
        }
    }
}

function populateYearFilter() {
    const years = new Set();
    projectsData.forEach((p) => {
        if (p.startdate) {
            const y = new Date(p.startdate).getFullYear();
            if (!isNaN(y)) years.add(y);
        }
    });
    const sel = panelEl.querySelector('#archiveYearFilter');
    Array.from(years)
        .sort((a, b) => b - a)
        .forEach((y) => {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            sel.appendChild(opt);
        });
}

function refreshGrid() {
    const grid = panelEl.querySelector('#archiveGrid');
    const searchTerm = panelEl.querySelector('#archiveSearchInput').value.toLowerCase();
    const yearFilter = panelEl.querySelector('#archiveYearFilter').value;
    const primaryFilter = panelEl.querySelector('#archivePrimaryFilter').value;
    const secondaryFilter = panelEl.querySelector('#archiveSecondaryFilter').value;

    const filtered = projectsData.filter((p) => {
        const matchesSearch = !searchTerm ||
            (p.title && p.title.toLowerCase().includes(searchTerm)) ||
            (p.author && p.author.toLowerCase().includes(searchTerm)) ||
            (p.primarycategory && p.primarycategory.toLowerCase().includes(searchTerm)) ||
            (p.secondarycategory && p.secondarycategory.toLowerCase().includes(searchTerm)) ||
            (p.shortdescription && p.shortdescription.toLowerCase().includes(searchTerm)) ||
            (p.details && p.details.toLowerCase().includes(searchTerm));

        const matchesYear = !yearFilter ||
            (p.startdate && new Date(p.startdate).getFullYear().toString() === yearFilter);

        const matchesPrimary = !primaryFilter || p.primarycategory === primaryFilter;

        const matchesSecondary = !secondaryFilter ||
            (p.secondarycategory &&
                p.secondarycategory.split(',').map((c) => c.trim()).includes(secondaryFilter));

        return matchesSearch && matchesYear && matchesPrimary && matchesSecondary;
    });

    panelEl.querySelector('#archiveCountText').textContent = filtered.length;

    grid.innerHTML = '';
    if (filtered.length === 0) {
        grid.innerHTML = '<div class="archive-no-results"><h3>No projects found</h3><p>Try adjusting your search terms</p></div>';
        return;
    }

    filtered.forEach((project) => {
        const originalIndex = projectsData.indexOf(project);
        const card = document.createElement('div');
        card.className = 'archive-card' + (originalIndex === selectedIndex ? ' selected' : '');
        card.addEventListener('click', () => selectProject(originalIndex));

        const displayText = project.shortdescription ||
            (project.details && project.details.length > 100
                ? project.details.substring(0, 100) + '...'
                : project.details || '');

        const dateDisplay = project.startdate && project.enddate
            ? `${project.startdate} to ${project.enddate}`
            : (project.date || '');

        const thumb = project.thumbnail
            ? `<img src="${escapeHtml(project.thumbnail)}" alt="${escapeHtml(project.title)}" onerror="this.style.display='none'">`
            : '';

        card.innerHTML = `
            ${thumb}
            <h3>${escapeHtml(project.title)}</h3>
            <p><strong>Author:</strong> ${escapeHtml(project.author)}</p>
            <p><strong>Date:</strong> ${escapeHtml(dateDisplay)}</p>
            <p>${escapeHtml(displayText)}</p>
        `;
        grid.appendChild(card);
    });
}

function selectProject(index) {
    selectedIndex = index;
    const project = projectsData[index];

    const left = panelEl.querySelector('.archive-left');
    const right = panelEl.querySelector('#archiveDetails');
    left.classList.remove('full-width');
    left.classList.add('half-width');
    right.classList.add('visible');

    panelEl.querySelectorAll('.archive-card').forEach((c) => c.classList.remove('selected'));
    // re-mark selected (grid order may differ from index, so match by content)
    refreshSelectedHighlight();

    const dateDisplay = project.startdate && project.enddate
        ? `${project.startdate} to ${project.enddate}`
        : (project.date || '');

    const thumb = project.thumbnail
        ? `<img src="${escapeHtml(project.thumbnail)}" alt="${escapeHtml(project.title)}" class="archive-detail-thumb" onerror="this.style.display='none'">`
        : '';

    const shortDesc = project.shortdescription
        ? `<div class="archive-detail-section"><h3>Summary</h3><p>${escapeHtml(project.shortdescription)}</p></div>`
        : '';

    const secondaryTags = (project.secondarycategory || '')
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean)
        .map((c) => `<span class="tag">${escapeHtml(c)}</span>`)
        .join('');

    right.innerHTML = `
        <button class="archive-detail-close" id="archiveDetailClose" title="Close details">&times;</button>
        <h2>${escapeHtml(project.title)}</h2>
        ${thumb}
        <div class="archive-detail-section"><h3>Author</h3><p>${escapeHtml(project.author)}</p></div>
        <div class="archive-detail-section"><h3>Duration</h3><p>${escapeHtml(dateDisplay)}</p></div>
        <div class="archive-detail-section">
            <h3>Categories</h3>
            <p><span class="tag">${escapeHtml(project.primarycategory)}</span>${secondaryTags}</p>
        </div>
        ${shortDesc}
        <div class="archive-detail-section"><h3>Description</h3><p>${escapeHtml(project.details)}</p></div>
        <div class="archive-detail-section">
            <h3>Project Page</h3>
            <p><a href="${escapeHtml(project.link)}" target="_blank" rel="noopener">Open project page &rarr;</a></p>
        </div>
    `;
    right.querySelector('#archiveDetailClose').addEventListener('click', closeDetails);
    right.scrollTop = 0;
}

function refreshSelectedHighlight() {
    const grid = panelEl.querySelector('#archiveGrid');
    const cards = grid.querySelectorAll('.archive-card');
    // Rebuild mapping: order of cards matches current filtered order; simplest is
    // to re-run refreshGrid which honors selectedIndex. To avoid losing scroll,
    // just toggle by comparing title text.
    const selTitle = selectedIndex >= 0 ? projectsData[selectedIndex].title : null;
    cards.forEach((card) => {
        const h3 = card.querySelector('h3');
        card.classList.toggle('selected', !!selTitle && h3 && h3.textContent === selTitle);
    });
}

function closeDetails() {
    const left = panelEl.querySelector('.archive-left');
    const right = panelEl.querySelector('#archiveDetails');
    right.classList.remove('visible');
    left.classList.remove('half-width');
    left.classList.add('full-width');
    selectedIndex = -1;
    panelEl.querySelectorAll('.archive-card').forEach((c) => c.classList.remove('selected'));
}

async function openArchivePanel() {
    buildPanel();
    await loadData();
    refreshGrid();
    // Force reflow so the transition runs from the off-screen state
    void panelEl.offsetWidth;
    backdropEl.classList.add('open');
    panelEl.classList.add('open');
}

function closeArchivePanel() {
    if (!panelEl) return;
    panelEl.classList.remove('open');
    backdropEl.classList.remove('open');
}

window.openArchivePanel = openArchivePanel;
window.closeArchivePanel = closeArchivePanel;

export { openArchivePanel, closeArchivePanel };
