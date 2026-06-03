# SmartTravelAssistant — 智能旅游助手

> AI 驱动的旅行规划与图像识别助手 | Python FastAPI + DeepSeek + Qwen VL · 纯前端 SPA

---

## 产品定位

**一句话：** 用 AI 帮你规划旅行、识别景点、翻译菜单——解决"去哪玩、怎么玩、这是什么"三个旅途核心问题。

**面向人群：** 自由行游客、旅行规划懒人、海外旅行遇到语言障碍者。

**Demo 场景：** 就业作品集 / 面试技术展示 / Hackathon 快速原型。

---

## 技术架构

```
 ┌───────────────────────────────────────────────────┐
 │                  浏览器 (SPA)                       │
 │    HTML/CSS/JS · SSE ReadableStream  · Canvas 压缩   │
 └──────────────────────┬────────────────────────────┘
                        │  HTTP + SSE (POST)
 ┌──────────────────────▼────────────────────────────┐
 │              FastAPI 异步后端 (Python)               │
 │                                                    │
 │  ┌──────────┐  ┌───────────┐  ┌───────────────┐   │
 │  │ /trip/*  │  │ /vision/* │  │ /api/health   │   │
 │  │ 行程路由  │  │ 视觉路由   │  │ 健康检查       │   │
 │  └────┬─────┘  └─────┬─────┘  └───────────────┘   │
 │       │               │                            │
 │  ┌────▼───────────────▼────────────────────────┐   │
 │  │              Model Router                   │   │
 │  │  DeepSeek Chat ──→ 文本推理 (行程/问答)      │   │
 │  │  Qwen VL Plus   ──→ 多模态视觉 (识图/菜单)   │   │
 │  └─────────────────────────────────────────────┘   │
 └────────────────────────────────────────────────────┘
```

---

## 为什么这样选？

| 决策 | 选择 | 原因 |
|------|------|------|
| 后端框架 | **FastAPI** | 原生 async、自动 OpenAPI 文档、SSE StreamingResponse 支持 |
| 前端方式 | **自写 SPA** | 无框架依赖，展示原生 JS 驾驭能力；比 Gradio/Streamlit 更像产品 |
| 文本推理 | **DeepSeek Chat** | 极低成本（¥1/百万 token）、中文强、OpenAI 兼容 SDK |
| 图像识别 | **Qwen VL Plus** | DashScope 多模态，支持中文场景识别和菜单翻译 |
| 流式传输 | **SSE** (Server-Sent Events) | 比 WebSocket 更轻量，POST + ReadableStream 天然支持 |
| 持久化 | **localStorage** | Demo 级场景零依赖，刷新不丢行程 |

### 成本效益

纯文本走 DeepSeek，多模态走 Qwen VL——两个模型的调用成本差 5-10 倍，是一个合理产品必须考虑的性价比。一次完整的 3 天行程生成约消耗 3000-4000 token，成本不到 0.5 分钱。

---

## 项目结构

```
TravelAssistant/
├── README.md
├── .env.example                    # API Key 配置模板
├── requirements_lock.txt           # 完整依赖树 (pip freeze)
│
├── backend/
│   ├── main.py                     # FastAPI 入口 · 静态文件 · CORS
│   ├── config.py                   # 环境变量加载 + 启动自检
│   ├── requirements.txt            # 核心依赖声明
│   │
│   ├── routers/
│   │   ├── trip.py                 # POST /api/trip/plan | adjust | question
│   │   └── vision.py               # POST /api/vision/identify | menu | recommend
│   │
│   ├── services/
│   │   ├── llm_client.py           # 统一 LLM 调用层 (超时·重试·错误包装)
│   │   ├── planner.py              # 行程规划 + SSE 进度 + 调整 + 多轮问答
│   │   └── vision.py               # 图像识别调度
│   │
│   ├── prompts/
│   │   └── templates.py            # 5 套 Structured Prompt 模板
│   │
│   └── schemas/
│       └── trip.py                 # Pydantic 数据模型 (请求/响应/SSE)
│
└── frontend/
    ├── index.html                  # SPA 单页 · 双Tab · 弹窗 · 浮动按钮
    ├── css/
    │   └── style.css               # 完整样式系统 (骨架屏·弹窗·响应式)
    └── js/
        ├── api.js                  # API 封装 (fetch + SSE Reader)
        ├── components.js           # UI 渲染 (进度条·行程卡片·视觉结果)
        └── app.js                  # 主逻辑 (交互·持久化·压缩·多轮对话)
```

---

## API 接口

### 行程

| 方法 | 路径 | 模型 | 传输 | 说明 |
|------|------|------|------|------|
| POST | `/api/trip/plan` | DeepSeek | SSE 流式 | 提交偏好表单 → AI 生成多天行程 |
| POST | `/api/trip/adjust` | DeepSeek | JSON | 调整已有行程（换景点/加天数/改安排） |
| POST | `/api/trip/question` | DeepSeek | JSON | 基于行程的上下文问答（含多轮记忆） |

### 图像

| 方法 | 路径 | 模型 | 传输 | 说明 |
|------|------|------|------|------|
| POST | `/api/vision/identify` | Qwen VL | FormData | 拍照识别地标 → 名称/介绍/评分/贴士 |
| POST | `/api/vision/menu` | Qwen VL | FormData | 拍照翻译菜单 → 菜品推荐 |
| POST | `/api/vision/recommend` | Qwen VL | FormData | 拍风景 → 推荐玩法和类似目的地 |

### 系统

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 `{"status":"ok"}` |

---

## 快速开始

```bash
# 1. 进入项目目录
cd TravelAssistant

# 2. 配置 API Key
cp .env.example .env
# 编辑 .env，填入你的 DEEPSEEK_API_KEY 和 DASHSCOPE_API_KEY

# 3. 安装依赖
pip install -r backend/requirements.txt

# 4. 启动服务
python -m backend.main

# 5. 打开浏览器 → http://localhost:8000
```

### 获取 API Key

| 服务 | 地址 | 用途 |
|------|------|------|
| **DeepSeek** | [platform.deepseek.com](https://platform.deepseek.com) → API Keys | 行程规划 + 问答 |
| **DashScope** | [dashscope.aliyun.com](https://dashscope.aliyun.com) → API-KEY 管理 | 图像识别 (Qwen VL) |

---

## 核心功能详情

### ✈️ 行程规划

- **多维度输入**：目的地 / 日期范围 / 预算档位(经济·舒适·轻奢·无上限·自定义) / 偏好标签(9种) / 同行人 / 自由备注
- **SSE 流式生成**：后端按用户选择天数动态生成阶段（Day1→DayN），前端渐进式渲染进度条 + shimmer 骨架屏
- **自定义预算验证**：实时过滤非数字字符，三层防线（输入过滤 → Number.isFinite → generatePlan 拦截）
- **行程操作**：
  - ✏️ 弹窗调整任一景点（自然语言描述，LLM 自动理解）
  - ❌ 删除活动 → 直接 splice 重渲染（0次 API 调用，瞬间完成）
  - ⬆️⬇️ 调整单天安排 / 增加新天数
- **关键词闭环**：生成 → 查看 → 调整 → 再生成，不是一次性输出

### 📍 图像识别

- **景点识别**：拍照 → Qwen VL 识别地标 → 名称/历史/评分/游览建议/分类
- **菜单翻译**：拍照 → 翻译每道菜 + 推荐指数 + 价格区间 + 总结推荐
- **拍照推荐**：拍风景 → 分析场景类型 + 推荐玩法和相似目的地
- **图片预处理**：上传时 Canvas 自动压缩至 1600×1600 80% JPEG，避免 4000px 原图直传
- **与行程闭环**：识别出景点 → 点「加入行程」→ 即时插入当前行程末尾（带 ⭐AI推荐 标记）→ 异步 LLM 优化位置

### 💡 智能问答

- 基于当前行程的上下文问答（天气穿搭 / 提前预订 / 交通 / 美食 / 注意事项）
- **5 个快捷模板**，一键提问
- **多轮对话记忆**：前端存储最近 10 轮历史，后端拼接最近 6 轮上下文，连续提问保持连贯

### 🔄 行程持久化

- 生成/调整后自动 `localStorage.setItem`
- 刷新页面弹出恢复横幅：「检测到你上次生成的行程」→ 一键恢复
- 导出文本、复制整天行程到剪贴板

---

## 关键产品决策

### 1. 多模型分工 = 成本控制

纯文本推理走 DeepSeek（极便宜），多模态视觉走 Qwen VL。两者成本差约 5-10 倍——一个实际可用的 AI 产品必须考虑边际成本，而非无脑调用最强模型。

### 2. 预算用「档位」而非「填数字」

用户对旅游花费只有模糊认知。"经济/舒适/轻奢"比输入具体数字更符合心智模型。同时保留「自定义」入口满足精确控制需求。

### 3. 删除不走 LLM

`deleteActivity` 直接 splice 数组 + 重渲染，0 次 API 调用。让 AI 做推理（换什么景点好），让 JS 做操作（删一条数据）——各司其职。

### 4. 视觉识别嵌入场景而非独立功能

菜单翻译按钮出现在行程的餐饮活动中；识别出景点后可一键加入行程。AI 能力的最佳体验是藏在场景里，用户不需要"打开图像识别"，而是"看不懂菜单时自然触发"。

### 5. 调整时保留旧内容

调整行程时不清空面板，只在顶部插入黄色加载条——用户始终能看到"现在是什么"，不会因等待而焦虑。

### 6. SSE 渐进式反馈

不等 10 秒弹最终结果，分阶段展示「分析偏好→筛选景点→规划Day1→规划Day2→...→估算预算→完成」，降低等待焦虑。进度条按用户选择的天数动态生成，而非硬编码。


## 技术细节

### SSE over POST

传统 SSE 只支持 GET，本项目通过 `fetch` + `response.body.getReader()` 实现 POST 请求下的 SSE 流式消费，解决了复杂查询参数（一整份行程偏好 JSON）无法塞进 URL 的问题。

### 动态进度阶段

后端 `planner.py` 根据用户选择的日期计算天数，动态生成 `planning_day1` ~ `planning_dayN` 阶段。前端 `components.js` 不再硬编码天数，而是用正则 `/planning_day(\d+)/` 自动匹配并累积渲染。

### 图片压缩链

`文件选择 → FileReader → Image(img.onload) → Canvas drawImage + resize → toDataURL('image/jpeg', 0.8) → base64 直传 Qwen`。仅当压缩失败时降级到原图。

---

*Powered by DeepSeek Chat & Qwen VL Plus via DashScope*
# TravelAssistant
