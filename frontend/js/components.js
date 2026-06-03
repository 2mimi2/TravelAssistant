const components = {
    progressStageLabels: {
        'analyzing': '分析偏好',
        'searching': '筛选景点和餐厅',
        'estimating': '估算预算',
        'done': '行程已生成！',
    },

    _knownStages: null,
    _seenStages: [],

    getProgressLabel(stage) {
        if (this.progressStageLabels[stage]) return this.progressStageLabels[stage];
        const match = stage.match(/^planning_day(\d+)$/);
        if (match) return `规划第${match[1]}天`;
        return stage;
    },

    renderProgressSteps(stage, message) {
        const container = document.getElementById('progressSteps');

        if (!this._seenStages.includes(stage)) {
            this._seenStages.push(stage);
        }

        const currentIndex = this._seenStages.indexOf(stage);

        container.innerHTML = this._seenStages.map((s, i) => {
            let cls = 'pending';
            let icon = '○';
            if (i < currentIndex) {
                cls = 'done';
                icon = '✓';
            } else if (i === currentIndex) {
                cls = 'active';
                icon = '◉';
            }
            const label = this.getProgressLabel(s);
            return `<div class="progress-step ${cls}">
                <span class="step-icon">${icon}</span>
                <span>${label}</span>
            </div>`;
        }).join('');
    },

    resetProgressSteps() {
        this._seenStages = [];
    },

    renderTripPlan(data) {
        if (!data || !data.days || data.days.length === 0) {
            return `<div class="result-empty">
                <div class="empty-icon">⚠️</div>
                <p class="empty-text">生成失败，请重试</p>
            </div>`;
        }

        const budgetEstimate = data.total_budget_estimate
            ? `<div class="budget-estimate">💰 预估总花费：${escapeHtml(data.total_budget_estimate)}</div>`
            : '';

        const tips = data.tips && data.tips.length > 0
            ? `<div class="trip-tips">
                <h4>💡 旅行小贴士</h4>
                <ul>${data.tips.map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
            </div>`
            : '';

        return `
            <div class="trip-header">
                <div class="trip-destination">📍 ${escapeHtml(data.destination)}</div>
                <div class="trip-meta">
                    <span>📅 ${escapeHtml(data.duration)}</span>
                    <span>💰 ${escapeHtml(data.budget)}</span>
                </div>
            </div>
            <div class="trip-overview">${escapeHtml(data.overview || '')}</div>
            <div class="trip-actions-top">
                <button class="btn-icon" onclick="app.exportTrip()">⬇️ 导出文本</button>
                <button class="btn-icon" onclick="app.copyWholeTrip()">📋 复制全部</button>
            </div>
            ${data.days.map((day, i) => this.renderDayCard(day, i)).join('')}
            <button class="add-day-btn" onclick="app.addDay()">
                ➕ 加一天
            </button>
            ${budgetEstimate}
            ${tips}
        `;
    },

    renderDayCard(day, dayIndex) {
        return `<div class="day-card" data-day="${dayIndex}">
            <div class="day-header">
                <span class="day-title">📋 Day ${day.day} · ${escapeHtml(day.title || '')}</span>
                <div class="day-toolbar">
                    <span class="day-date">${escapeHtml(day.date || '')}</span>
                    <button class="btn-icon" onclick="app.editDay(${dayIndex})">✏️ 调整这天</button>
                    <button class="btn-icon" onclick="app.copyDay(${dayIndex})">📋 复制</button>
                </div>
            </div>
            <div class="activity-list">
                ${(day.activities || []).map((a, i) => this.renderActivity(a, dayIndex, i)).join('')}
            </div>
        </div>`;
    },

    renderActivity(activity, dayIndex, actIndex) {
        const aiBadge = (activity.name || '').includes('⭐') || (activity.name || '').includes('AI推荐')
            ? '<span class="activity-ai-badge">⭐AI推荐</span>'
            : '';

        const menuBtn = (activity.name || '').includes('餐') || (activity.name || '').includes('食')
            ? `<button class="vision-action-btn" onclick="app.openVisionWithImage('menu')" title="拍菜单翻译">📷 拍菜单</button>`
            : '';

        return `<div class="activity-item">
            <span class="activity-time">${escapeHtml(activity.time || '')}</span>
            <div class="activity-info">
                <span class="activity-name">${escapeHtml(activity.name || '')}${aiBadge}${menuBtn}</span>
                ${activity.duration ? `<span class="activity-duration">${escapeHtml(activity.duration)}</span>` : ''}
                ${activity.tips ? `<div class="activity-tips">💡 ${escapeHtml(activity.tips)}</div>` : ''}
            </div>
            <div class="activity-actions">
                <button class="btn-edit" onclick="app.editActivity(${dayIndex}, ${actIndex})" title="修改此活动">✏️</button>
                <button class="btn-delete" onclick="app.deleteActivity(${dayIndex}, ${actIndex})" title="删除此活动">✕</button>
            </div>
        </div>`;
    },

    renderVisionIdentify(data, _prefix) {
        const addTripBtn = (data.name && data.name !== '未知地点' && data.category !== 'unknown')
            ? `<button class="add-to-trip-btn" onclick="app.addSpotFromVision(${JSON.stringify(data).replace(/"/g, '&quot;')})">
                ➕ 加入当前行程
            </button>`
            : '';

        if (data.name === '未知地点') {
            return `<div class="vision-result" data-vision-result="${_prefix}">
                <div class="vr-title">❓ 无法识别</div>
                <div class="vr-desc">${escapeHtml(data.description || '')}</div>
            </div>`;
        }
        return `<div class="vision-result" data-vision-result="${_prefix}">
            <div class="vr-title">📍 ${escapeHtml(data.name || '')}</div>
            <div class="vr-meta">
                ${data.rating ? `<span>⭐ ${escapeHtml(data.rating)}</span>` : ''}
                <span>🏷️ ${escapeHtml(data.category || '')}</span>
            </div>
            <div class="vr-desc">${escapeHtml(data.description || '')}</div>
            ${data.tips ? `<div class="vr-section"><h4>💡 游览建议</h4><p>${escapeHtml(data.tips)}</p></div>` : ''}
            ${addTripBtn}
        </div>`;
    },

    renderVisionMenu(data) {
        const items = (data.items || []).map(item => `
            <div class="menu-item">
                <div class="menu-item-name">
                    ${escapeHtml(item.original_name || '')}
                    <span class="stars">${'⭐'.repeat(item.recommend_score || 0)}</span>
                    <span class="vr-tag">${escapeHtml(item.price_range || '')}</span>
                </div>
                <div class="menu-item-trans">→ ${escapeHtml(item.translation || '')}</div>
                <div class="menu-item-desc">${escapeHtml(item.description || '')}</div>
            </div>
        `).join('');

        return `<div class="vision-result">
            <div class="vr-title">🍽️ ${escapeHtml(data.restaurant_name || '菜单')}</div>
            <div class="vr-meta">${escapeHtml(data.cuisine_type || '')}</div>
            ${items}
            ${data.summary ? `<div class="vr-section"><h4>📝 推荐总结</h4><p>${escapeHtml(data.summary)}</p></div>` : ''}
        </div>`;
    },

    renderVisionRecommend(data) {
        return `<div class="vision-result">
            <div class="vr-title">🎨 ${escapeHtml(data.scene_type || '')}</div>
            <div class="vr-desc">${escapeHtml(data.description || '')}</div>
            ${(data.suggested_activities || []).length > 0 ? `<div class="vr-section">
                <h4>🎯 推荐活动</h4>
                ${data.suggested_activities.map(a => `<span class="vr-tag">${escapeHtml(a)}</span>`).join('')}
            </div>` : ''}
            ${(data.nearby_spots_style || []).length > 0 ? `<div class="vr-section">
                <h4>🌍 相似目的地</h4>
                ${data.nearby_spots_style.map(s => `<span class="vr-tag">${escapeHtml(s)}</span>`).join('')}
            </div>` : ''}
            ${data.photo_tips ? `<div class="vr-section"><h4>📸 拍摄建议</h4><p>${escapeHtml(data.photo_tips)}</p></div>` : ''}
        </div>`;
    },
};

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
