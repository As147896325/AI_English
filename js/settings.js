// ===== Settings Module =====

function loadSettingsPage() {
    const settings = AI.getSettings();

    document.getElementById('ai-provider').value = settings.provider || 'openai';
    document.getElementById('api-key-input').value = settings.apiKey || '';
    document.getElementById('model-name-input').value = settings.model || AI.providers[settings.provider]?.defaultModel || '';

    if (settings.provider === 'custom') {
        document.getElementById('custom-url-section').style.display = '';
        document.getElementById('custom-api-url').value = settings.customUrl || '';
    } else {
        document.getElementById('custom-url-section').style.display = 'none';
    }

    // Daily words
    const dailyWords = localStorage.getItem('wordwise_daily_new') || '20';
    document.getElementById('daily-new-words').value = dailyWords;

    // Learning settings
    const requiredCorrect = localStorage.getItem('wordwise_required_correct') || '2';
    document.getElementById('required-correct-count').value = requiredCorrect;

    // Sort mode
    const sortMode = localStorage.getItem('wordwise_sort_mode') || 'frequency';
    document.getElementById('sort-mode-select').value = sortMode;

    // Dark mode
    document.getElementById('dark-mode-toggle').checked = document.documentElement.getAttribute('data-theme') === 'dark';

    // Usage
    updateUsageDisplay();
}

function onProviderChange() {
    const provider = document.getElementById('ai-provider').value;
    const modelInput = document.getElementById('model-name-input');
    const customSection = document.getElementById('custom-url-section');
    const modelList = document.getElementById('model-list-container');

    if (provider === 'custom') {
        customSection.style.display = '';
        modelInput.placeholder = '输入模型名称';
        if (modelList) modelList.innerHTML = '';
    } else {
        customSection.style.display = 'none';
        const defaultModel = AI.providers[provider]?.defaultModel || '';
        modelInput.value = defaultModel;
        modelInput.placeholder = defaultModel;

        // Render recommended models if available
        if (modelList && AI.providers[provider]?.models) {
            const models = AI.providers[provider].models;
            modelList.innerHTML = `
                <div style="margin-top:8px; display:flex; flex-wrap:wrap; gap:6px;">
                    ${models.map(m => `
                        <button class="btn btn-secondary btn-sm" style="font-size:11px; padding:4px 8px;" 
                                onclick="document.getElementById('model-name-input').value='${m.id}'">
                            ${m.name}
                        </button>
                    `).join('')}
                </div>
            `;
        } else if (modelList) {
            modelList.innerHTML = '';
        }
    }
}

function saveAPISettings() {
    const provider = document.getElementById('ai-provider').value;
    const apiKey = document.getElementById('api-key-input').value.trim();
    const model = document.getElementById('model-name-input').value.trim();
    const customUrl = document.getElementById('custom-api-url')?.value.trim() || '';

    if (!apiKey) {
        showToast('请输入 API 密钥');
        return;
    }

    AI.saveSettings({ provider, apiKey, model, customUrl });
    showToast('API 设置已保存 ✓');
}

async function testAPIConnection() {
    // Save first
    saveAPISettings();

    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = '测试中...';
    btn.disabled = true;

    const result = await AI.testConnection();

    btn.textContent = originalText;
    btn.disabled = false;

    if (result.ok) {
        showToast('✅ ' + result.msg);
    } else {
        showToast('❌ ' + result.msg);
    }
}

function saveDailyWords() {
    const value = document.getElementById('daily-new-words').value;
    localStorage.setItem('wordwise_daily_new', value);
    showToast(`每日新词已设为 ${value} 个`);
}

function toggleDarkMode() {
    const isDark = document.getElementById('dark-mode-toggle').checked;
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : '');
    localStorage.setItem('wordwise_theme', isDark ? 'dark' : 'light');

    // Update theme-color meta
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
        metaTheme.content = isDark ? '#000000' : '#F2F2F7';
    }
}

function exportData() {
    const username = Auth.getUsername();
    const exportObj = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        username: username,
        data: {}
    };

    // Collect all user data
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.includes(username) || key === 'wordwise_theme' || key === 'wordwise_daily_new') {
            exportObj.data[key] = localStorage.getItem(key);
        }
    }

    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wordwise_backup_${username}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('数据已导出 ✓');
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importObj = JSON.parse(e.target.result);
            if (!importObj.data || !importObj.version) {
                showToast('无效的备份文件');
                return;
            }

            if (!confirm(`确认导入来自 "${importObj.username}" 的数据吗？当前数据将被覆盖。`)) {
                return;
            }

            for (const [key, value] of Object.entries(importObj.data)) {
                localStorage.setItem(key, value);
            }

            showToast('数据已导入 ✓');
            updateHomeStats();
            loadSettingsPage();
        } catch (err) {
            showToast('导入失败: 文件格式错误');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function clearAllData() {
    if (!confirm('确定要清除所有学习数据吗？此操作不可恢复！')) return;
    if (!confirm('再次确认：真的要清除吗？')) return;

    const username = Auth.getUsername();

    // 先收集所有要删除的 key，再统一删除
    // 注意：不能在遍历中直接删除，否则 localStorage 的 index 会错位
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes(username) && key !== Auth.USERS_KEY) {
            keysToRemove.push(key);
        }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
    showToast('数据已清除 ✓');
    updateHomeStats();
    loadSettingsPage();
}

function showChangePasswordModal() {
    const modalHTML = `
    <div class="modal-overlay show" id="password-modal" onclick="closePasswordModal(event)">
      <div class="modal-content" onclick="event.stopPropagation()" style="max-width:400px;">
        <div class="modal-handle"></div>
        <div class="text-center">
          <div style="font-size:48px;margin-bottom:12px;">🔒</div>
          <h2 style="margin-bottom:8px;">修改密码</h2>
          <p class="text-secondary" style="margin-bottom:20px; font-size:13px;">请妥善保管你的新密码</p>
          
          <div class="form-group text-left" style="margin-bottom:12px;">
            <label class="form-label">旧密码</label>
            <input type="password" id="old-password" class="form-input" placeholder="请输入旧密码">
          </div>
          
          <div class="form-group text-left" style="margin-bottom:20px;">
            <label class="form-label">新密码</label>
            <input type="password" id="new-password" class="form-input" placeholder="请输入新密码 (6位以上)">
          </div>

          <button class="btn btn-primary btn-block btn-lg" onclick="executeChangePassword()">确认修改</button>
          <button class="btn btn-secondary btn-block mt-8" onclick="closePasswordModal()">取消</button>
        </div>
      </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closePasswordModal(e) {
    if (e && e.target !== e.currentTarget) return;
    const modal = document.getElementById('password-modal');
    if (modal) modal.remove();
}

async function executeChangePassword() {
    const oldPass = document.getElementById('old-password').value;
    const newPass = document.getElementById('new-password').value;

    if (!oldPass || !newPass) {
        showToast('请填写完整信息');
        return;
    }

    const result = await Auth.changePassword(oldPass, newPass);
    if (result.ok) {
        showToast('密码修改成功 ✓');
        closePasswordModal();
    } else {
        showToast('❌ ' + result.msg);
    }
}

function logout() {
    Auth.logout();
    navigateTo('login');
}

function saveLearningSettings() {
    const requiredCorrect = document.getElementById('required-correct-count').value;
    localStorage.setItem('wordwise_required_correct', requiredCorrect);

    const sortMode = document.getElementById('sort-mode-select').value;
    localStorage.setItem('wordwise_sort_mode', sortMode);

    showToast('学习设置已保存 ✓');
}
