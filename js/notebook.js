// ===== Notebook Module — View learned words & AI annotations =====

let _notebookData = [];
let _notebookFilter = 'all';
let _notebookSearch = '';

async function loadNotebookPage() {
    const studyData = Study.getStudyData();
    const allWords = await WordBank.loadSelectedWords();
    const aiCache = AI.getCache();

    // Build notebook entries from study data
    _notebookData = [];
    for (const wordObj of allWords) {
        const record = studyData[wordObj.word];
        if (!record) continue; // Only show words that have been studied

        const cached = aiCache[wordObj.word];
        _notebookData.push({
            word: wordObj.word,
            phonetic: wordObj.phonetic || '',
            translation: wordObj.translation || '',
            stage: record.stage || 0,
            correctCount: record.correctCount || 0,
            wrongCount: record.wrongCount || 0,
            fuzzyCount: record.fuzzyCount || 0,
            firstSeen: record.firstSeen || '',
            lastReviewed: record.lastReviewed || '',
            mastered: record.stage >= Study.INTERVALS.length,
            aiContent: cached ? cached.content : null,
            aiCachedAt: cached ? cached.cachedAt : null
        });
    }

    // Sort: most recently reviewed first
    _notebookData.sort((a, b) => (b.lastReviewed || '').localeCompare(a.lastReviewed || ''));

    renderNotebook();
}

function renderNotebook() {
    const listEl = document.getElementById('notebook-list');
    const emptyEl = document.getElementById('notebook-empty');

    // Apply filters
    let filtered = _notebookData;

    if (_notebookFilter === 'learning') {
        filtered = filtered.filter(w => !w.mastered);
    } else if (_notebookFilter === 'mastered') {
        filtered = filtered.filter(w => w.mastered);
    }

    if (_notebookSearch) {
        const q = _notebookSearch.toLowerCase();
        filtered = filtered.filter(w =>
            w.word.toLowerCase().includes(q) ||
            w.translation.toLowerCase().includes(q)
        );
    }

    if (filtered.length === 0) {
        listEl.innerHTML = '';
        emptyEl.style.display = '';
        return;
    }

    emptyEl.style.display = 'none';

    const maxStage = Study.INTERVALS.length;

    listEl.innerHTML = filtered.map((item, idx) => {
        const stagePct = Math.min(100, (item.stage / maxStage) * 100);
        const stageColor = item.mastered ? 'var(--success)' : 'var(--primary)';
        const stageLabel = item.mastered ? '已掌握 ✓' : `阶段 ${item.stage}/${maxStage}`;

        return `
        <div class="notebook-item" id="notebook-item-${idx}">
            <div class="notebook-item-header" onclick="toggleNotebookAI(${idx})">
                <div class="notebook-word-info">
                    <div class="notebook-word">${item.word}</div>
                    <div class="notebook-phonetic">${item.phonetic}</div>
                    <div class="notebook-translation">${item.translation}</div>
                </div>
                <div class="notebook-meta">
                    <div class="notebook-stage-label" style="color:${stageColor}">${stageLabel}</div>
                    <div class="notebook-stage-bar">
                        <div class="notebook-stage-fill" style="width:${stagePct}%; background:${stageColor}"></div>
                    </div>
                    <div class="notebook-stats-mini">
                        <span style="color:var(--success)">✓${item.correctCount}</span>
                        <span style="color:var(--danger)">✗${item.wrongCount}</span>
                        ${item.fuzzyCount > 0 ? `<span style="color:var(--warning)">~${item.fuzzyCount}</span>` : ''}
                    </div>
                </div>
            </div>
            <div class="notebook-ai-note" id="notebook-ai-${idx}" style="display:none;">
                ${item.aiContent
                ? `<div class="ai-content-body">${formatAIContent(item.aiContent)}</div>
                       <div class="text-secondary" style="font-size:11px; margin-top:8px;">缓存于 ${new Date(item.aiCachedAt).toLocaleString()}</div>`
                : `<div class="text-secondary" style="padding:12px; text-align:center;">暂无 AI 注解<br><button class="btn btn-sm btn-primary mt-8" onclick="generateNotebookAI('${item.word}', ${idx})">生成 AI 注解</button></div>`
            }
            </div>
        </div>`;
    }).join('');
}

function formatAIContent(content) {
    return content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
}

function filterNotebook(type, btn) {
    _notebookFilter = type;
    // Update active tab
    document.querySelectorAll('.notebook-filter').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderNotebook();
}

function searchNotebook(query) {
    _notebookSearch = query;
    renderNotebook();
}

function toggleNotebookAI(idx) {
    const el = document.getElementById(`notebook-ai-${idx}`);
    if (el) {
        el.style.display = el.style.display === 'none' ? '' : 'none';
    }
}

async function generateNotebookAI(word, idx) {
    if (!AI.isConfigured()) {
        showToast('请先在设置中配置 AI API');
        return;
    }

    const noteEl = document.getElementById(`notebook-ai-${idx}`);
    noteEl.innerHTML = '<div class="ai-loading"><div class="spinner"></div><span>AI 正在生成...</span></div>';

    const result = await AI.getWordAssist(word, true);
    if (result.ok) {
        _notebookData[idx].aiContent = result.content;
        _notebookData[idx].aiCachedAt = new Date().toISOString();
        noteEl.innerHTML = `<div class="ai-content-body">${formatAIContent(result.content)}</div>`;
        showToast('AI 注解已生成 ✓');
    } else {
        noteEl.innerHTML = `<div class="text-danger" style="padding:12px;">${result.msg}</div>`;
    }
}
