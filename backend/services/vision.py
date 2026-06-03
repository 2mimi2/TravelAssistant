from backend.services.llm_client import (
    qwen_vision_identify,
    qwen_vision_menu,
    qwen_vision_recommend,
)


async def identify_landmark(image_base64: str) -> dict:
    return await qwen_vision_identify(image_base64)


async def translate_menu(image_base64: str) -> dict:
    return await qwen_vision_menu(image_base64)


async def recommend_by_photo(image_base64: str) -> dict:
    return await qwen_vision_recommend(image_base64)
