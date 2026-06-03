import os
import sys

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .config import SERVER_HOST, SERVER_PORT
from .routers.trip import router as trip_router
from .routers.vision import router as vision_router

app = FastAPI(
    title="SmartTravelAssistant",
    description="智能旅游助手 API — 行程规划 + 图像识别",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(trip_router)
app.include_router(vision_router)

frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend")
css_path = os.path.join(frontend_path, "css")
js_path = os.path.join(frontend_path, "js")

if os.path.isdir(css_path):
    app.mount("/css", StaticFiles(directory=css_path), name="css")
if os.path.isdir(js_path):
    app.mount("/js", StaticFiles(directory=js_path), name="js")


@app.get("/")
async def serve_index():
    index_file = os.path.join(frontend_path, "index.html")
    if os.path.isfile(index_file):
        return FileResponse(index_file)
    return {"message": "Frontend not found"}


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "SmartTravelAssistant"}


if __name__ == "__main__":
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    import uvicorn
    uvicorn.run(
        "backend.main:app",
        host=SERVER_HOST,
        port=SERVER_PORT,
        reload=True,
    )
