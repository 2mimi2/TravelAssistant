import json
import re
import asyncio
from typing import AsyncGenerator, Optional
from openai import AsyncOpenAI
import dashscope

from backend.config import (
    DEEPSEEK_API_KEY,
    DEEPSEEK_BASE_URL,
    DEEPSEEK_MODEL,
    DASHSCOPE_API_KEY,
    QWEN_VL_MODEL,
)

deepseek_client = AsyncOpenAI(
    api_key=DEEPSEEK_API_KEY,
    base_url=DEEPSEEK_BASE_URL,
    timeout=60.0,
)

MAX_JSON_RETRIES = 1


def _extract_json(text: str) -> dict:
    json_match = re.search(r'\{[\s\S]*\}', text)
    if json_match:
        try:
            return json.loads(json_match.group())
        except json.JSONDecodeError:
            pass
    return {}


async def deepseek_chat_stream(
    system_prompt: str,
    user_message: str,
    temperature: float = 0.7,
    max_tokens: int = 4096,
) -> AsyncGenerator[str, None]:
    try:
        response = await asyncio.wait_for(
            deepseek_client.chat.completions.create(
                model=DEEPSEEK_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                temperature=temperature,
                max_tokens=max_tokens,
                stream=True,
            ),
            timeout=90,
        )
        async for chunk in response:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
    except asyncio.TimeoutError:
        yield json.dumps({"error": "请求超时，请稍后重试"})
    except Exception as e:
        yield json.dumps({"error": f"API调用失败: {str(e)}"})


async def deepseek_chat(
    system_prompt: str,
    user_message: str,
    temperature: float = 0.7,
    max_tokens: int = 4096,
) -> str:
    try:
        response = await asyncio.wait_for(
            deepseek_client.chat.completions.create(
                model=DEEPSEEK_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                temperature=temperature,
                max_tokens=max_tokens,
                stream=False,
            ),
            timeout=90,
        )
        return response.choices[0].message.content
    except asyncio.TimeoutError:
        return json.dumps({"error": "请求超时，请稍后重试"})
    except Exception as e:
        return json.dumps({"error": f"API调用失败: {str(e)}"})


async def deepseek_chat_with_json_retry(
    system_prompt: str,
    user_message: str,
    temperature: float = 0.7,
    max_tokens: int = 4096,
) -> dict:
    response = await deepseek_chat(system_prompt, user_message, temperature, max_tokens)
    result = _extract_json(response)

    if not result and MAX_JSON_RETRIES > 0:
        retry_message = f"{user_message}\n\n【重要提醒】请务必只输出纯JSON，不要包含任何markdown代码块标记。"
        response = await deepseek_chat(system_prompt, retry_message, temperature + 0.1, max_tokens)
        result = _extract_json(response)

    return result


async def qwen_vision_chat(
    prompt: str,
    image_base64: str,
    temperature: float = 0.7,
) -> str:
    messages = [
        {
            "role": "user",
            "content": [
                {"image": f"data:image/jpeg;base64,{image_base64}"},
                {"text": prompt},
            ],
        }
    ]

    try:
        response = await asyncio.wait_for(
            asyncio.get_event_loop().run_in_executor(
                None,
                lambda: dashscope.MultiModalConversation.call(
                    model=QWEN_VL_MODEL,
                    api_key=DASHSCOPE_API_KEY,
                    messages=messages,
                    temperature=temperature,
                ),
            ),
            timeout=60,
        )
    except asyncio.TimeoutError:
        return json.dumps({"error": "图像识别超时，图片可能过大，请尝试压缩后重试"})
    except Exception as e:
        return json.dumps({"error": f"图像识别失败: {str(e)}"})

    if response.status_code == 200:
        output = response.output
        if output and output.choices:
            content = output.choices[0].message.content
            if isinstance(content, list):
                texts = []
                for item in content:
                    if isinstance(item, dict) and "text" in item:
                        texts.append(item["text"])
                    elif isinstance(item, str):
                        texts.append(item)
                return "".join(texts)
            return str(content)
    return json.dumps({
        "error": "图像识别失败",
        "detail": getattr(response, "message", "未知错误"),
        "code": getattr(response, "status_code", -1),
    })


def _parse_vision_error_as_dict(result_str: str) -> dict:
    try:
        data = json.loads(result_str)
        if "error" in data:
            return {
                "name": "识别失败",
                "description": data["error"],
                "category": "error",
            }
    except json.JSONDecodeError:
        pass
    return _extract_json(result_str)


async def qwen_vision_identify(image_base64: str) -> dict:
    from backend.prompts.templates import VISION_IDENTIFY_PROMPT

    result = await qwen_vision_chat(VISION_IDENTIFY_PROMPT, image_base64)
    return _parse_vision_error_as_dict(result)


async def qwen_vision_menu(image_base64: str) -> dict:
    from backend.prompts.templates import VISION_MENU_PROMPT

    result = await qwen_vision_chat(VISION_MENU_PROMPT, image_base64)
    return _parse_vision_error_as_dict(result)


async def qwen_vision_recommend(image_base64: str) -> dict:
    from backend.prompts.templates import VISION_RECOMMEND_PROMPT

    result = await qwen_vision_chat(VISION_RECOMMEND_PROMPT, image_base64)
    return _parse_vision_error_as_dict(result)
