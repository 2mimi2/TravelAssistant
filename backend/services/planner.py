import json
import asyncio
from typing import AsyncGenerator

from backend.prompts.templates import (
    TRIP_PLAN_SYSTEM_PROMPT,
    TRIP_ADJUST_SYSTEM_PROMPT,
    TRIP_QUESTION_SYSTEM_PROMPT,
)
from backend.services.llm_client import (
    deepseek_chat_stream,
    deepseek_chat_with_json_retry,
    deepseek_chat,
    _extract_json,
)
from backend.schemas.trip import TripPlanRequest, TripAdjustRequest, TripQuestionRequest, SSEProgress

BUDGET_LABEL = {
    "economy": "经济 (2000以下)",
    "comfort": "舒适 (2000-5000)",
    "luxury": "轻奢 (5000-8000)",
    "unlimited": "无上限",
}

COMPANION_LABEL = {
    "solo": "独自旅行",
    "couple": "伴侣",
    "friends": "朋友",
    "with_kids": "带娃亲子",
}


def _build_plan_user_message(req: TripPlanRequest) -> str:
    prefs = "、".join(req.preferences) if req.preferences else "无特殊偏好"
    budget_label = BUDGET_LABEL.get(req.budget, req.budget)
    companion_label = COMPANION_LABEL.get(req.companions, req.companions)
    notes = req.notes or "无"

    return f"""请为我规划一次旅行：

目的地：{req.destination}
日期：{req.start_date} 至 {req.end_date}
预算档位：{budget_label}
偏好标签：{prefs}
同行人：{companion_label}
特别要求：{notes}"""


async def plan_trip_stream(req: TripPlanRequest) -> AsyncGenerator[str, None]:
    stages = [
        ("analyzing", "正在分析你的偏好..."),
        ("searching", "正在筛选最佳景点和餐厅..."),
    ]

    days_count = _calculate_days(req.start_date, req.end_date)
    for i in range(1, days_count + 1):
        stages.append((f"planning_day{i}", f"正在规划第{i}天行程..."))
    stages.append(("estimating", "正在估算预算..."))
    stages.append(("done", "行程已生成！"))

    user_message = _build_plan_user_message(req)

    for stage, message in stages[:-1]:
        progress = SSEProgress(stage=stage, message=message)
        yield f"data: {progress.model_dump_json()}\n\n"
        await asyncio.sleep(0.3)

    full_response = []
    async for token in deepseek_chat_stream(
        system_prompt=TRIP_PLAN_SYSTEM_PROMPT,
        user_message=user_message,
        temperature=0.7,
        max_tokens=4096,
    ):
        full_response.append(token)

    response_text = "".join(full_response)
    plan_data = _extract_json(response_text)

    done_stage = stages[-1]
    progress = SSEProgress(stage=done_stage[0], message=done_stage[1], data=plan_data)
    yield f"data: {progress.model_dump_json()}\n\n"


async def adjust_trip(req: TripAdjustRequest) -> dict:
    current_plan_json = json.dumps(req.current_plan, ensure_ascii=False, indent=2)
    user_message = f"当前行程：\n{current_plan_json}\n\n调整要求：{req.instruction}"

    return await deepseek_chat_with_json_retry(
        system_prompt=TRIP_ADJUST_SYSTEM_PROMPT,
        user_message=user_message,
        temperature=0.5,
        max_tokens=4096,
    )


async def answer_question(req: TripQuestionRequest) -> str:
    history_text = ""
    if req.history:
        history_parts = []
        for h in req.history[-6:]:
            role_label = "用户" if h.get("role") == "user" else "助手"
            history_parts.append(f"{role_label}：{h.get('content', '')}")
        history_text = "对话历史：\n" + "\n".join(history_parts) + "\n\n"

    current_plan_json = json.dumps(req.current_plan, ensure_ascii=False, indent=2)
    user_message = f"{history_text}当前行程：\n{current_plan_json}\n\n用户问题：{req.question}"

    response = await deepseek_chat(
        system_prompt=TRIP_QUESTION_SYSTEM_PROMPT,
        user_message=user_message,
        temperature=0.7,
        max_tokens=1024,
    )
    return response


def _calculate_days(start_date: str, end_date: str) -> int:
    from datetime import datetime

    try:
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")
        days = (end - start).days + 1
        return max(1, min(days, 14))
    except (ValueError, TypeError):
        return 3
