const app = {
    currentPlanData: null,
    qaHistory: [],
    _lastVisionIdentify: null,

    init() {
        this.initTabs();
        this.initPlanForm();
        this.initDatePickers();
        this.initVisionUploads();
        this.initQA();
        this.initQuickQuestions();
        this.initAdjustModal();
        this.initFloatingCamera();
        this.initRestore();
    },

    /* ========== Tab 切换 ========== */
    initTabs() {
        document.getElementById('navTabs').addEventListener('click', (e) => {
            const tabBtn = e.target.closest('.nav-tab');
            if (!tabBtn) return;

            const tabId = tabBtn.dataset.tab;
            document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
            tabBtn.classList.add('active');

            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            document.getElementById(`tab-${tabId}`).classList.add('active');

            this._updateFabVisibility(tabId);
        });
    },

    /* ========== 表单交互 ========== */
    initPlanForm() {
        document.getElementById('budgetGroup').addEventListener('click', (e) => {
            const card = e.target.closest('.radio-card');
            if (!card) return;
            this._selectRadio('budgetGroup', card);
            this._toggleCustomBudget(card);
        });

        document.getElementById('companionGroup').addEventListener('click', (e) => {
            const card = e.target.closest('.radio-card');
            if (!card) return;
            this._selectRadio('companionGroup', card);
        });

        document.getElementById('prefGroup').addEventListener('click', (e) => {
            const tag = e.target.closest('.tag');
            if (!tag) return;
            tag.classList.toggle('selected');
        });

        document.getElementById('generateBtn').addEventListener('click', () => {
            this.generatePlan();
        });
    },

    _selectRadio(groupId, card) {
        card.parentElement.querySelectorAll('.radio-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
    },

    _toggleCustomBudget(card) {
        const row = document.getElementById('customBudgetRow');
        const input = card.querySelector('input');
        if (input && input.value === 'custom') {
            row.classList.remove('hidden');
            const budgetInput = document.getElementById('customBudget');
            budgetInput.focus();
            this._bindCustomBudgetFilter(budgetInput);
        } else {
            row.classList.add('hidden');
            const budgetInput = document.getElementById('customBudget');
            budgetInput.value = '';
            this._unbindCustomBudgetFilter(budgetInput);
        }
    },

    _bindCustomBudgetFilter(input) {
        if (input.dataset.filterBound) return;
        input.dataset.filterBound = '1';
        this._customBudgetFilterHandler = (e) => {
            let val = e.target.value;
            val = val.replace(/[^\d]/g, '');
            if (val.length > 1 && val[0] === '0') {
                val = val.replace(/^0+/, '') || '0';
            }
            e.target.value = val;
        };
        input.addEventListener('input', this._customBudgetFilterHandler);
    },

    _unbindCustomBudgetFilter(input) {
        if (this._customBudgetFilterHandler) {
            input.removeEventListener('input', this._customBudgetFilterHandler);
            this._customBudgetFilterHandler = null;
        }
        delete input.dataset.filterBound;
    },

    initDatePickers() {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayStr = `${yyyy}-${mm}-${dd}`;

        const nextMonth = new Date(today);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        const nY = nextMonth.getFullYear();
        const nM = String(nextMonth.getMonth() + 1).padStart(2, '0');
        const nD = String(nextMonth.getDate()).padStart(2, '0');

        document.getElementById('startDate').value = todayStr;
        document.getElementById('endDate').value = `${nY}-${nM}-${nD}`;

        const updateDays = () => {
            const sVal = document.getElementById('startDate').value;
            const eVal = document.getElementById('endDate').value;
            if (sVal && eVal) {
                const s = new Date(sVal);
                const e = new Date(eVal);
                const days = Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1);
                document.getElementById('daysHint').textContent = `共 ${days} 天`;
            }
        };

        document.getElementById('startDate').addEventListener('change', updateDays);
        document.getElementById('endDate').addEventListener('change', updateDays);
        updateDays();
    },

    /* ========== 行程生成 SSE ========== */
    async generatePlan() {
        const destination = document.getElementById('destination').value.trim();
        if (!destination) {
            alert('请输入目的地');
            return;
        }

        const formData = this._collectFormData();
        if (!formData) return;

        const resultEmpty = document.getElementById('resultEmpty');
        const resultLoading = document.getElementById('resultLoading');
        const resultContent = document.getElementById('resultContent');

        resultEmpty.classList.add('hidden');
        resultContent.classList.add('hidden');
        resultContent.innerHTML = '';
        resultLoading.classList.remove('hidden');
        components.resetProgressSteps();

        document.getElementById('generateBtn').disabled = true;
        document.getElementById('generateBtn').textContent = '⏳ 生成中...';
        this.currentPlanData = null;
        this.qaHistory = [];
        document.getElementById('qaSection').classList.add('hidden');

        const abortController = new AbortController();
        const timeoutId = setTimeout(() => {
            abortController.abort();
            resultLoading.classList.add('hidden');
            resultEmpty.classList.remove('hidden');
            resultEmpty.innerHTML = `<div class="empty-icon">⚠️</div>
                <p class="empty-text">请求超时，请检查网络后重试</p>
                <button class="btn-primary" style="margin-top:16px;" onclick="app.generatePlan()">🔄 重新生成</button>`;
            document.getElementById('generateBtn').disabled = false;
            document.getElementById('generateBtn').textContent = '✨ 生成行程';
        }, 120000);

        try {
            const reader = await api.planTrip(formData);
            clearTimeout(timeoutId);
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const jsonStr = line.slice(6).trim();
                        if (!jsonStr) continue;
                        try {
                            const data = JSON.parse(jsonStr);
                            this._handleSSEEvent(data);
                        } catch (e) {
                            console.warn('SSE parse error:', e);
                        }
                    }
                }
            }
        } catch (e) {
            console.error('Plan generation error:', e);
            resultLoading.classList.add('hidden');
            resultEmpty.classList.remove('hidden');
            resultEmpty.innerHTML = `<div class="empty-icon">⚠️</div>
                <p class="empty-text">生成失败，请检查网络后重试<br>${escapeHtml(e.message)}</p>
                <button class="btn-primary" style="margin-top:16px;" onclick="app.generatePlan()">🔄 重新生成</button>`;
        } finally {
            document.getElementById('generateBtn').disabled = false;
            document.getElementById('generateBtn').textContent = '✨ 生成行程';
        }
    },

    _handleSSEEvent(data) {
        if (!data || !data.stage) return;

        components.renderProgressSteps(data.stage, data.message);

        if (data.stage === 'done' && data.data) {
            setTimeout(() => {
                document.getElementById('resultLoading').classList.add('hidden');
                const resultContent = document.getElementById('resultContent');
                resultContent.innerHTML = components.renderTripPlan(data.data);
                resultContent.classList.remove('hidden');
                this.currentPlanData = data.data;
                document.getElementById('qaSection').classList.remove('hidden');
                this._updateFabVisibility('plan');
                this.saveTrip();
            }, 600);
        }
    },

    _collectFormData() {
        const budgetRadio = document.querySelector('#budgetGroup input:checked');
        const companionRadio = document.querySelector('#companionGroup input:checked');
        const selectedTags = document.querySelectorAll('#prefGroup .tag.selected');

        let budget = budgetRadio ? budgetRadio.value : 'comfort';
        if (budget === 'custom') {
            const customVal = document.getElementById('customBudget').value.trim();
            const num = Number(customVal);
            if (!customVal || !Number.isFinite(num) || num <= 0) {
                alert('请输入一个大于 0 的有效预算金额');
                document.getElementById('customBudget').focus();
                return null;
            }
            budget = `${Math.round(num)}元/人`;
        }

        return {
            destination: document.getElementById('destination').value.trim(),
            start_date: document.getElementById('startDate').value,
            end_date: document.getElementById('endDate').value,
            budget: budget,
            preferences: Array.from(selectedTags).map(t => t.dataset.tag),
            companions: companionRadio ? companionRadio.value : 'solo',
            notes: document.getElementById('notes').value.trim() || null,
        };
    },

    /* ========== 调整弹窗 ========== */
    initAdjustModal() {
        document.getElementById('adjustModalClose').addEventListener('click', () => this._closeAdjustModal());
        document.getElementById('adjustModalCancel').addEventListener('click', () => this._closeAdjustModal());
        document.getElementById('adjustModalSubmit').addEventListener('click', () => this._submitAdjust());
        document.getElementById('adjustModal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this._closeAdjustModal();
        });
    },

    _openAdjustModal(title, hint, placeholder) {
        document.getElementById('adjustModalTitle').textContent = title;
        document.getElementById('adjustModalHint').textContent = hint;
        document.getElementById('adjustModalInput').placeholder = placeholder || '描述你想要的调整...';
        document.getElementById('adjustModalInput').value = '';
        document.getElementById('adjustModal').classList.remove('hidden');
        document.getElementById('adjustModalInput').focus();
    },

    _closeAdjustModal() {
        document.getElementById('adjustModal').classList.add('hidden');
    },

    async _submitAdjust() {
        if (!this.currentPlanData) return;

        const instruction = document.getElementById('adjustModalInput').value.trim();
        if (!instruction) {
            alert('请输入调整内容');
            return;
        }

        const btn = document.getElementById('adjustModalSubmit');
        btn.disabled = true;
        btn.textContent = '⏳ 调整中...';

        try {
            const result = await api.adjustTrip(this.currentPlanData, instruction);
            if (result && result.days) {
                this.currentPlanData = result;
                const resultContent = document.getElementById('resultContent');
                resultContent.innerHTML = components.renderTripPlan(result);
                this.saveTrip();
                this._closeAdjustModal();
            } else {
                alert('调整失败，请重试');
            }
        } catch (e) {
            alert('调整请求失败: ' + e.message);
        } finally {
            btn.disabled = false;
            btn.textContent = '确认调整';
        }
    },

    /* ========== 景点级操作 ========== */
    editActivity(dayIndex, actIndex) {
        if (!this.currentPlanData) return;
        const activity = (this.currentPlanData.days[dayIndex].activities || [])[actIndex];
        const actName = (activity && activity.name) ? `「${activity.name}」` : '该景点';
        const dayNum = this.currentPlanData.days[dayIndex].day || (dayIndex + 1);

        this._openAdjustModal(
            `修改 Day${dayNum} ${actName}`,
            `你正在修改第${dayNum}天的${actName}。你想怎么调整？`,
            '如：换成清水寺 / 把时间改到下午 / 增加1小时游览时间'
        );
    },

    deleteActivity(dayIndex, actIndex) {
        if (!this.currentPlanData) return;
        const activity = (this.currentPlanData.days[dayIndex].activities || [])[actIndex];
        const actName = (activity && activity.name) ? `「${activity.name}」` : '该景点';
        const dayNum = this.currentPlanData.days[dayIndex].day || (dayIndex + 1);

        if (!confirm(`确定删除 Day${dayNum} 的 ${actName}？`)) return;

        const day = this.currentPlanData.days[dayIndex];
        day.activities.splice(actIndex, 1);

        const resultContent = document.getElementById('resultContent');
        resultContent.innerHTML = components.renderTripPlan(this.currentPlanData);
        this.saveTrip();
    },

    /* ========== 天级操作 ========== */
    editDay(dayIndex) {
        if (!this.currentPlanData) return;
        const dayNum = this.currentPlanData.days[dayIndex].day || (dayIndex + 1);

        this._openAdjustModal(
            `调整 Day${dayNum}`,
            `你正在调整第${dayNum}天的全部安排。你想怎么修改？`,
            '如：这一天安排太满了，帮我精简一下 / 增加一个美食体验 / 把景点按地理位置重新排序'
        );
    },

    addDay() {
        if (!this.currentPlanData) return;

        const newDayNum = (this.currentPlanData.days.length || 0) + 1;
        const instruction = `为行程增加第${newDayNum}天，合理安排新的景点和活动，确保与前后天衔接顺畅`;

        this._doAdjust(instruction);
    },

    /* ========== 复制/导出 ========== */
    copyDay(dayIndex) {
        if (!this.currentPlanData) return;
        const day = this.currentPlanData.days[dayIndex];
        const dayNum = day.day || (dayIndex + 1);
        let text = `📋 Day ${dayNum} · ${day.title || ''}\n${day.date || ''}\n\n`;

        (day.activities || []).forEach(a => {
            text += `${a.time || ''}  ${a.name || ''}`;
            if (a.duration) text += ` (${a.duration})`;
            if (a.tips) text += `\n   💡 ${a.tips}`;
            text += '\n';
        });

        this._copyToClipboard(text, '已复制当天行程到剪贴板');
    },

    copyWholeTrip() {
        if (!this.currentPlanData) return;
        let text = this._tripToText(this.currentPlanData);
        this._copyToClipboard(text, '已复制完整行程到剪贴板');
    },

    exportTrip() {
        if (!this.currentPlanData) return;
        const text = this._tripToText(this.currentPlanData);
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `行程_${this.currentPlanData.destination || 'travel'}_${new Date().toISOString().slice(0, 10)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    },

    _tripToText(data) {
        let text = `✈️ ${data.destination || ''}\n`;
        text += `${'='.repeat(40)}\n`;
        text += `📅 ${data.duration || ''}  💰 ${data.budget || ''}\n`;
        text += `${data.overview || ''}\n\n`;

        (data.days || []).forEach(day => {
            text += `\n📋 Day ${day.day} · ${day.title || ''}  ${day.date || ''}\n`;
            text += `${'-'.repeat(40)}\n`;
            (day.activities || []).forEach(a => {
                text += `  ${a.time || ''}  ${a.name || ''}`;
                if (a.duration) text += ` (${a.duration})`;
                if (a.tips) text += `\n       💡 ${a.tips}`;
                text += '\n';
            });
        });

        if (data.total_budget_estimate) {
            text += `\n💰 预估总花费：${data.total_budget_estimate}\n`;
        }

        if (data.tips && data.tips.length > 0) {
            text += `\n💡 旅行小贴士：\n`;
            data.tips.forEach(t => { text += `  • ${t}\n`; });
        }

        return text;
    },

    _copyToClipboard(text, successMsg) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                alert(successMsg);
            }).catch(() => {
                this._fallbackCopy(text, successMsg);
            });
        } else {
            this._fallbackCopy(text, successMsg);
        }
    },

    _fallbackCopy(text, successMsg) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand('copy');
            alert(successMsg);
        } catch (e) {
            alert('复制失败，请手动选择复制');
        }
        document.body.removeChild(ta);
    },

    _doAdjust(instruction) {
        if (!this.currentPlanData) return;

        const resultContent = document.getElementById('resultContent');
        const adjustBar = document.createElement('div');
        adjustBar.className = 'adjust-loading-bar';
        adjustBar.innerHTML = `<div class="loading-header" style="margin:0;padding:8px 16px;">
            <span class="loading-spinner" style="width:16px;height:16px;border-width:2px;"></span>
            <span class="loading-title" style="font-size:13px;">正在调整行程...</span>
        </div>`;
        resultContent.insertBefore(adjustBar, resultContent.firstChild);

        api.adjustTrip(this.currentPlanData, instruction).then(result => {
            if (result && result.days) {
                this.currentPlanData = result;
                resultContent.innerHTML = components.renderTripPlan(result);
                this.saveTrip();
            } else {
                adjustBar.remove();
                alert('调整失败，请重试');
            }
        }).catch(e => {
            adjustBar.remove();
            alert('调整请求失败: ' + e.message);
        });
    },

    /* ========== 行程问答 ========== */
    initQA() {
        document.getElementById('qaBtn').addEventListener('click', () => this.askQuestion());
        document.getElementById('qaInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.askQuestion();
        });
    },

    initQuickQuestions() {
        document.getElementById('qaTemplates').addEventListener('click', (e) => {
            const template = e.target.closest('.qa-template');
            if (!template) return;
            const question = template.dataset.q;
            if (question) {
                document.getElementById('qaInput').value = question;
                this.askQuestion();
            }
        });
    },

    async askQuestion(predefinedQuestion) {
        if (!this.currentPlanData) return;

        const input = document.getElementById('qaInput');
        const question = predefinedQuestion || input.value.trim();
        if (!question) return;

        const answerDiv = document.getElementById('qaAnswer');
        const btn = document.getElementById('qaBtn');

        btn.disabled = true;
        btn.textContent = '⏳';
        answerDiv.classList.remove('hidden');
        answerDiv.innerHTML = '<span style="color:var(--gray-400)">思考中...</span>';

        try {
            const history = this.qaHistory.slice();
            const result = await api.askQuestion(this.currentPlanData, question, history);
            const answer = result.answer || '抱歉，暂时无法回答这个问题。';

            this.qaHistory.push({ role: 'user', content: question });
            this.qaHistory.push({ role: 'assistant', content: answer });
            if (this.qaHistory.length > 10) {
                this.qaHistory = this.qaHistory.slice(-10);
            }

            const dest = this.currentPlanData.destination || '';
            const historyCount = Math.floor(this.qaHistory.length / 2);
            answerDiv.innerHTML = `<p>${escapeHtml(answer)}</p>
                <div style="margin-top:8px;font-size:11px;color:var(--gray-400)">
                    回答基于你的「${escapeHtml(dest)}」行程${historyCount > 0 ? ` · 已连续回答${historyCount}个问题` : ''}
                </div>`;
            if (!predefinedQuestion) input.value = '';
        } catch (e) {
            answerDiv.innerHTML = '<p>请求失败，请重试</p>';
        } finally {
            btn.disabled = false;
            btn.textContent = '提问';
        }
    },

    /* ========== 图像识别 ========== */
    initVisionUploads() {
        this._setupUpload('identify', api.visionIdentify, components.renderVisionIdentify);
        this._setupUpload('menu', api.visionMenu, components.renderVisionMenu);
        this._setupUpload('recommend', api.visionRecommend, components.renderVisionRecommend);
    },

    _compressImage(file, maxW, maxH, quality) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                    let w = img.width, h = img.height;
                    if (w > maxW || h > maxH) {
                        const ratio = Math.min(maxW / w, maxH / h);
                        w = Math.round(w * ratio);
                        h = Math.round(h * ratio);
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
                img.onerror = () => reject(new Error('图片加载失败'));
                img.src = ev.target.result;
            };
            reader.onerror = () => reject(new Error('文件读取失败'));
            reader.readAsDataURL(file);
        });
    },

    _setupUpload(prefix, apiFn, renderFn) {
        const fileInput = document.getElementById(`${prefix}File`);
        const uploadZone = document.getElementById(`${prefix}Upload`);
        const preview = document.getElementById(`${prefix}Preview`);
        const btn = document.getElementById(`${prefix}Btn`);
        const resultDiv = document.getElementById(`${prefix}Result`);

        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const dataUrl = await this._compressImage(file, 1600, 1600, 0.8);
                preview.src = dataUrl;
                preview.classList.remove('hidden');
                uploadZone.classList.add('has-image');
                btn.disabled = false;
                fileInput._compressedBase64 = dataUrl.split(',')[1];
            } catch (err) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    preview.src = ev.target.result;
                    preview.classList.remove('hidden');
                    uploadZone.classList.add('has-image');
                    btn.disabled = false;
                    fileInput._compressedBase64 = ev.target.result.split(',')[1];
                };
                reader.readAsDataURL(file);
            }
        });

        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.style.borderColor = 'var(--primary)';
        });

        uploadZone.addEventListener('dragleave', () => {
            uploadZone.style.borderColor = '';
        });

        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.style.borderColor = '';
            const file = e.dataTransfer.files[0];
            if (!file || !file.type.startsWith('image/')) return;
            fileInput.files = e.dataTransfer.files;
            fileInput.dispatchEvent(new Event('change'));
        });

        btn.addEventListener('click', async () => {
            const file = fileInput.files[0];
            if (!file) return;

            btn.disabled = true;
            btn.textContent = '⏳ 分析中...';
            resultDiv.classList.add('hidden');

            let apiFile = file;
            if (fileInput._compressedBase64) {
                const byteString = atob(fileInput._compressedBase64);
                const ab = new ArrayBuffer(byteString.length);
                const ia = new Uint8Array(ab);
                for (let i = 0; i < byteString.length; i++) {
                    ia[i] = byteString.charCodeAt(i);
                }
                apiFile = new Blob([ab], { type: 'image/jpeg' });
            }

            try {
                const result = await apiFn(apiFile);
                resultDiv.innerHTML = renderFn(result, prefix);
                resultDiv.classList.remove('hidden');

                if (prefix === 'identify' && result && result.name && result.name !== '未知地点') {
                    this._lastVisionIdentify = result;
                }
            } catch (e) {
                resultDiv.innerHTML = `<div class="vision-result"><p>分析失败: ${escapeHtml(e.message)}</p></div>`;
                resultDiv.classList.remove('hidden');
            } finally {
                btn.disabled = false;
                btn.textContent = prefix === 'identify' ? '识别景点'
                    : prefix === 'menu' ? '翻译菜单' : '获取推荐';
            }
        });
    },

    addSpotFromVision(data) {
        if (!this.currentPlanData) {
            alert('请先生成一份行程，才能把景点加入');
            return;
        }

        const spotName = data.name || '';
        const spotTips = data.tips || '';
        const days = this.currentPlanData.days;
        if (days.length === 0) return;
        const lastDay = days[days.length - 1];
        const activities = lastDay.activities || [];

        const newActivity = {
            time: '10:00',
            name: spotName + ' ⭐AI推荐',
            duration: '1h',
            tips: spotTips || undefined,
        };
        activities.push(newActivity);

        const resultContent = document.getElementById('resultContent');
        resultContent.innerHTML = components.renderTripPlan(this.currentPlanData);
        this.saveTrip();

        const adjustBar = document.createElement('div');
        adjustBar.className = 'adjust-loading-bar';
        adjustBar.innerHTML = `<div class="loading-header" style="margin:0;padding:8px 16px;">
            <span class="loading-spinner" style="width:16px;height:16px;border-width:2px;"></span>
            <span class="loading-title" style="font-size:13px;">正在为${escapeHtml(spotName)}优化行程...</span>
        </div>`;
        resultContent.insertBefore(adjustBar, resultContent.firstChild);

        const instruction = `新景点「${spotName}」已被添加到行程最后一天，请将它的位置和时间调整到更合适的位置，并重新调整当天其他活动的时间以协调。`;
        api.adjustTrip(this.currentPlanData, instruction).then(result => {
            if (result && result.days) {
                this.currentPlanData = result;
                resultContent.innerHTML = components.renderTripPlan(result);
                this.saveTrip();
            } else {
                adjustBar.remove();
            }
        }).catch(() => {
            adjustBar.remove();
        });
    },

    openVisionWithImage(type) {
        document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
        const visionTab = document.querySelector('.nav-tab[data-tab="vision"]');
        visionTab.classList.add('active');
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        document.getElementById('tab-vision').classList.add('active');
        this._updateFabVisibility('vision');

        const cardId = type === 'menu' ? 'menuUpload' : 'identifyUpload';
        document.getElementById(cardId).scrollIntoView({ behavior: 'smooth' });
    },

    /* ========== 悬浮拍照按钮 ========== */
    initFloatingCamera() {
        const fab = document.getElementById('fabCamera');
        fab.addEventListener('click', () => {
            this.openVisionWithImage('identify');
        });
        this._updateFabVisibility('plan');
    },

    _updateFabVisibility(activeTab) {
        const fab = document.getElementById('fabCamera');
        if (activeTab === 'plan' && this.currentPlanData) {
            fab.classList.remove('hidden');
        } else if (activeTab === 'vision') {
            fab.classList.add('hidden');
        } else if (activeTab === 'plan' && !this.currentPlanData) {
            fab.classList.add('hidden');
        }
    },

    /* ========== localStorage 持久化 ========== */
    saveTrip() {
        if (!this.currentPlanData) return;
        try {
            const payload = {
                data: this.currentPlanData,
                savedAt: new Date().toISOString(),
            };
            localStorage.setItem('travelAssistant_lastTrip', JSON.stringify(payload));
        } catch (e) {
            console.warn('localStorage save failed:', e);
        }
    },

    restoreTrip() {
        try {
            const raw = localStorage.getItem('travelAssistant_lastTrip');
            if (!raw) return;
            const payload = JSON.parse(raw);
            if (payload && payload.data) {
                this.currentPlanData = payload.data;
                const resultEmpty = document.getElementById('resultEmpty');
                const resultContent = document.getElementById('resultContent');
                resultEmpty.classList.add('hidden');
                resultContent.innerHTML = components.renderTripPlan(payload.data);
                resultContent.classList.remove('hidden');
                document.getElementById('qaSection').classList.remove('hidden');
                this._updateFabVisibility('plan');
            }
        } catch (e) {
            console.warn('localStorage restore failed:', e);
            localStorage.removeItem('travelAssistant_lastTrip');
        }
    },

    initRestore() {
        try {
            const raw = localStorage.getItem('travelAssistant_lastTrip');
            if (raw) {
                const payload = JSON.parse(raw);
                if (payload && payload.data && payload.data.destination) {
                    const dest = payload.data.destination;
                    const savedAt = payload.savedAt
                        ? new Date(payload.savedAt).toLocaleString('zh-CN')
                        : '';
                    const banner = document.getElementById('restoreBanner');
                    banner.querySelector('span').textContent =
                        `📌 检测到你上次的「${dest}」行程${savedAt ? ` (${savedAt})` : ''}`;
                    banner.classList.remove('hidden');

                    document.getElementById('restoreBtn').addEventListener('click', () => {
                        banner.classList.add('hidden');
                        this.restoreTrip();
                    }, { once: true });

                    document.getElementById('restoreDismiss').addEventListener('click', () => {
                        banner.classList.add('hidden');
                    }, { once: true });
                }
            }
        } catch (e) {
            localStorage.removeItem('travelAssistant_lastTrip');
        }
    },
};

document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
