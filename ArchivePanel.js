// ArchivePanel.js
import { initBeeAnimator, spawnBee } from './BeeAnimator.js';
import { preloadProjectImages, pickThumb } from './ProjectThumbs.js';

let panelEl = null;
let backdropEl = null;
let projectsData = [];
let dataLoaded = false;
let selectedIndex = -1;
let built = false;
let bee = null;

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

    backdropEl = document.createElement('div');
    backdropEl.className = 'archive-backdrop';
    backdropEl.addEventListener('click', closeArchivePanel);

    panelEl = document.createElement('div');
    panelEl.className = 'archive-panel';
    panelEl.setAttribute('role', 'dialog');
    panelEl.setAttribute('aria-label', 'Project Index');
    panelEl.addEventListener('click', (e) => e.stopPropagation());

    const categoryOptions = CATEGORIES
        .map((c) => `<option value="${c}">${c}</option>`)
        .join('');

    panelEl.innerHTML = `
        <div class="archive-header">
            <div class="archive-titlerow">
                <span id="archiveCountText" hidden>0</span>
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
                <button class="archive-close" id="archiveCloseBtn" title="Close">&times;</button>
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

    panelEl.querySelector('#archiveCloseBtn').addEventListener('click', closeArchivePanel);
    panelEl.querySelector('#archiveDetailClose').addEventListener('click', closeDetails);
    panelEl.querySelector('#archiveSearchInput').addEventListener('input', refreshGrid);
    panelEl.querySelector('#archiveYearFilter').addEventListener('change', refreshGrid);
    panelEl.querySelector('#archivePrimaryFilter').addEventListener('change', refreshGrid);
    panelEl.querySelector('#archiveSecondaryFilter').addEventListener('change', refreshGrid);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && panelEl.classList.contains('open')) closeArchivePanel();
    });

    // Trigger the bee's flutter animation while browsing the panel
    panelEl.addEventListener('wheel', () => { if (bee) bee.onScroll(); }, { passive: true });

    built = true;
}

async function loadData() {
    if (dataLoaded) return;
    try {
        const res = await fetch('data/projects.json');
        const data = await res.json();
        projectsData = data.projects || [];
        // Preload each project's accompanying images so thumbnails can be
        // picked at random (see ProjectThumbs.js).
        await preloadProjectImages(projectsData);
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

        const cardThumbSrc = pickThumb(project);
        const cardThumb = cardThumbSrc
            ? `<div class="archive-card-thumb"><img src="${escapeHtml(cardThumbSrc)}" alt="${escapeHtml(project.title)}" onerror="this.parentElement.style.display='none'"></div>`
            : '';

        card.innerHTML = `
            <h3>${escapeHtml(project.title)}</h3>
            <p class="archive-card-meta">${escapeHtml(project.author)}</p>
            <p class="archive-card-meta">${escapeHtml(dateDisplay)}</p>
            <p class="archive-card-desc">${escapeHtml(displayText)}</p>
            ${cardThumb}
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
    refreshSelectedHighlight();

    const dateDisplay = project.startdate && project.enddate
        ? `${project.startdate} to ${project.enddate}`
        : (project.date || '');

    const thumbSrc = pickThumb(project);
    const thumb = thumbSrc
        ? `<img src="${escapeHtml(thumbSrc)}" alt="${escapeHtml(project.title)}" class="archive-detail-thumb" onerror="this.style.display='none'">`
        : '';

    const shortDesc = project.shortdescription
        ? `<div class="archive-detail-section archive-detail-summary"><h3>Summary</h3><p>${escapeHtml(project.shortdescription)}</p></div>`
        : '';

    const secondaryTags = (project.secondarycategory || '')
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean)
        .map((c) => `<span class="tag">${escapeHtml(c)}</span>`)
        .join('');

    const gotoBtn = project.link
        ? `<div class="archive-goto-wrap"><a class="archive-goto-btn" href="${escapeHtml(project.link)}" target="_blank" rel="noopener" aria-label="Open Project-Page"><span class="archive-goto-label">Open Project-Page</span><span class="archive-goto-circle"><img src="assets/UI-ELEMENTS/PLUS.png" alt=""></span></a></div>`
        : '';

    right.innerHTML = `
        <button class="archive-detail-close" id="archiveDetailClose" title="Close details">&times;</button>
        <h2>${escapeHtml(project.title)}</h2>
        ${thumb}
        <button class="archive-meta-toggle" id="archiveMetaToggle" type="button" aria-expanded="false" aria-controls="archiveMetaRow">Details<span class="archive-meta-chevron">&#9662;</span></button>
        <div class="archive-detail-meta-row" id="archiveMetaRow" hidden>
            <div class="archive-meta-item"><h3>Author</h3><p>${escapeHtml(project.author)}</p></div>
            <div class="archive-meta-item"><h3>Duration</h3><p>${escapeHtml(dateDisplay)}</p></div>
            <div class="archive-meta-item"><h3>Categories</h3><p><span class="tag">${escapeHtml(project.primarycategory)}</span>${secondaryTags}</p></div>
        </div>
        ${shortDesc}
        <div class="archive-detail-section"><h3>Description</h3><p>${escapeHtml(project.details)}</p></div>
        ${gotoBtn}
    `;
    right.querySelector('#archiveDetailClose').addEventListener('click', closeDetails);

    const metaToggle = right.querySelector('#archiveMetaToggle');
    const metaRow = right.querySelector('#archiveMetaRow');
    if (metaToggle && metaRow) {
        metaToggle.addEventListener('click', () => {
            const willOpen = metaRow.hidden;
            metaRow.hidden = !willOpen;
            metaToggle.classList.toggle('open', willOpen);
            metaToggle.setAttribute('aria-expanded', String(willOpen));
        });
    }

    right.scrollTop = 0;
}

function refreshSelectedHighlight() {
    const grid = panelEl.querySelector('#archiveGrid');
    const cards = grid.querySelectorAll('.archive-card');
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
    void panelEl.offsetWidth;
    backdropEl.classList.add('open');
    panelEl.classList.add('open');

    // Spawn the bee from the close button's on-screen position
    await initBeeAnimator();
    const closeBtn = panelEl.querySelector('#archiveCloseBtn');
    let spawnX = 1300, spawnY = 60;
    if (closeBtn) {
        const r = closeBtn.getBoundingClientRect();
        spawnX = r.left + r.width / 2;
        spawnY = r.top + r.height / 2;
    }
    bee = spawnBee(spawnX, spawnY);
}

function closeArchivePanel() {
    if (!panelEl) return;
    panelEl.classList.remove('open');
    backdropEl.classList.remove('open');

    // Bee crawls off-screen and stays behind
    if (bee) {
        bee.drop();
        bee = null;
    }
}

window.openArchivePanel = openArchivePanel;
window.closeArchivePanel = closeArchivePanel;

export { openArchivePanel, closeArchivePanel };