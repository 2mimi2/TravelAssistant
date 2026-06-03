from pydantic import BaseModel, Field
from typing import List, Optional


class TripPlanRequest(BaseModel):
    destination: str = Field(..., description="目的地")
    start_date: str = Field(..., description="开始日期，如 2024-10-01")
    end_date: str = Field(..., description="结束日期，如 2024-10-03")
    budget: str = Field(..., description="预算档位: economy/comfort/luxury/unlimited")
    preferences: List[str] = Field(default_factory=list, description="偏好标签：美食/人文历史/自然风光/网红打卡/亲子/小众冷门/购物/慢节奏/特种兵")
    companions: str = Field(default="solo", description="同行人: solo/couple/friends/with_kids")
    notes: Optional[str] = Field(default=None, description="额外备注")


class TripAdjustRequest(BaseModel):
    current_plan: dict = Field(..., description="当前行程 JSON")
    instruction: str = Field(..., description="调整指令，如'把Day2的天龙寺换成别的'")


class TripQuestionRequest(BaseModel):
    current_plan: dict = Field(..., description="当前行程 JSON")
    question: str = Field(..., description="用户问题，如'第二天穿什么合适'")
    history: list = Field(default_factory=list, description="对话历史 [{role, content}]")


class PlanActivity(BaseModel):
    time: str = Field(..., description="时间，如 09:00")
    name: str = Field(..., description="活动名称")
    duration: str = Field(default="", description="时长，如 1h")
    tips: Optional[str] = Field(default=None, description="贴士")


class PlanDay(BaseModel):
    day: int = Field(..., description="第几天")
    date: str = Field(default="", description="日期")
    title: str = Field(default="", description="当日标题")
    activities: List[PlanActivity] = Field(default_factory=list)


class TripPlanResponse(BaseModel):
    destination: str
    duration: str
    budget: str
    overview: str = Field(default="", description="行程概览")
    days: List[PlanDay] = Field(default_factory=list)
    total_budget_estimate: Optional[str] = Field(default=None, description="预算估算")
    tips: List[str] = Field(default_factory=list, description="总体贴士")


class VisionIdentifyResponse(BaseModel):
    name: str = Field(default="", description="景点/地标名称")
    description: str = Field(default="", description="描述")
    rating: Optional[str] = Field(default=None, description="评分")
    tips: Optional[str] = Field(default=None, description="游览建议")
    category: str = Field(default="unknown", description="分类")


class MenuItem(BaseModel):
    original_name: str = Field(..., description="原菜名")
    translation: str = Field(default="", description="翻译")
    description: str = Field(default="", description="菜品描述")
    recommend_score: int = Field(default=0, description="推荐指数 1-5")
    price_range: str = Field(default="", description="价格区间")


class MenuResponse(BaseModel):
    restaurant_name: str = Field(default="", description="餐厅名")
    cuisine_type: str = Field(default="", description="菜系")
    items: List[MenuItem] = Field(default_factory=list)
    summary: str = Field(default="", description="总结推荐")


class VisionRecommendResponse(BaseModel):
    scene_type: str = Field(default="", description="场景类型")
    description: str = Field(default="", description="场景描述")
    suggested_activities: List[str] = Field(default_factory=list, description="推荐活动")
    nearby_spots_style: List[str] = Field(default_factory=list, description="推荐同类目的地")
    photo_tips: Optional[str] = Field(default=None, description="拍照建议")


class SSEProgress(BaseModel):
    stage: str = Field(..., description="当前阶段: analyzing/preferences/searching/planning_day1/planning_day2/planning_day3/estimating/done")
    message: str = Field(..., description="进度消息")
    data: Optional[dict] = Field(default=None, description="附带数据")
