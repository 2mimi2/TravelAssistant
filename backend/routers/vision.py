import base64
from fastapi import APIRouter, UploadFile, File, Form
from typing import Optional

from backend.services.vision import identify_landmark, translate_menu, recommend_by_photo

router = APIRouter(prefix="/api/vision", tags=["图像识别"])


def _read_image_base64(file: UploadFile) -> str:
    return base64.b64encode(file.file.read()).decode("utf-8")


@router.post("/identify")
async def identify_landmark_route(
    image: UploadFile = File(...),
    location: Optional[str] = Form(default=None),
):
    image_base64 = _read_image_base64(image)
    result = await identify_landmark(image_base64)
    if location:
        result["_location_hint"] = location
    return result


@router.post("/menu")
async def translate_menu_route(image: UploadFile = File(...)):
    image_base64 = _read_image_base64(image)
    result = await translate_menu(image_base64)
    return result


@router.post("/recommend")
async def recommend_by_photo_route(image: UploadFile = File(...)):
    image_base64 = _read_image_base64(image)
    result = await recommend_by_photo(image_base64)
    return result
