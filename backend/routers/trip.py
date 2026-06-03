from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from backend.schemas.trip import TripPlanRequest, TripAdjustRequest, TripQuestionRequest
from backend.services.planner import plan_trip_stream, adjust_trip, answer_question

router = APIRouter(prefix="/api/trip", tags=["行程"])


@router.post("/plan")
async def plan_trip(req: TripPlanRequest):
    return StreamingResponse(
        plan_trip_stream(req),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/adjust")
async def adjust_trip_route(req: TripAdjustRequest):
    result = await adjust_trip(req)
    return result


@router.post("/question")
async def answer_trip_question(req: TripQuestionRequest):
    result = await answer_question(req)
    return {"answer": result}
