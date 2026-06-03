const API_BASE = '/api';

const api = {
    async planTrip(formData) {
        const response = await fetch(`${API_BASE}/trip/plan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData),
        });

        if (!response.ok) {
            throw new Error(`请求失败: ${response.status}`);
        }

        return response.body.getReader();
    },

    async adjustTrip(currentPlan, instruction) {
        const response = await fetch(`${API_BASE}/trip/adjust`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ current_plan: currentPlan, instruction }),
        });
        return response.json();
    },

    async askQuestion(currentPlan, question, history) {
        const response = await fetch(`${API_BASE}/trip/question`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ current_plan: currentPlan, question, history: history || [] }),
        });
        return response.json();
    },

    async visionIdentify(imageFile, location) {
        const formData = new FormData();
        formData.append('image', imageFile);
        if (location) formData.append('location', location);

        const response = await fetch(`${API_BASE}/vision/identify`, {
            method: 'POST',
            body: formData,
        });
        return response.json();
    },

    async visionMenu(imageFile) {
        const formData = new FormData();
        formData.append('image', imageFile);

        const response = await fetch(`${API_BASE}/vision/menu`, {
            method: 'POST',
            body: formData,
        });
        return response.json();
    },

    async visionRecommend(imageFile) {
        const formData = new FormData();
        formData.append('image', imageFile);

        const response = await fetch(`${API_BASE}/vision/recommend`, {
            method: 'POST',
            body: formData,
        });
        return response.json();
    },

    async healthCheck() {
        const response = await fetch(`${API_BASE}/health`);
        return response.json();
    }
};
