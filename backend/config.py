import os
import logging
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

logger = logging.getLogger("SmartTravelAssistant")

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")

DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY", "")
QWEN_VL_MODEL = os.getenv("QWEN_VL_MODEL", "qwen-vl-plus")

SERVER_HOST = os.getenv("SERVER_HOST", "0.0.0.0")
SERVER_PORT = int(os.getenv("SERVER_PORT", "8000"))

_missing_keys = []
if not DEEPSEEK_API_KEY:
    _missing_keys.append("DEEPSEEK_API_KEY")
if not DASHSCOPE_API_KEY:
    _missing_keys.append("DASHSCOPE_API_KEY")

if _missing_keys:
    msg = f"[WARNING] 以下 API Key 未配置：{', '.join(_missing_keys)}。请编辑 .env 文件填入你的 Key，否则对应功能无法使用。"
    logger.warning(msg)
    print(f"\n{'='*60}\n{msg}\n{'='*60}\n")
