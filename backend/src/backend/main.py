from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn

from .database import init_db
from .routers import chat, conversations, providers


@asynccontextmanager
async def lifespan(app: FastAPI):
    # アプリケーション起動時
    await init_db()
    yield
    # アプリケーション終了時（必要に応じて）


app = FastAPI(
    title="LLM Chat Backend API",
    description="会話分岐機能付きLLMチャットアプリケーションのバックエンドAPI",
    version="0.1.0",
    lifespan=lifespan
)

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # フロントエンドのURL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ルーターの登録
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(conversations.router, prefix="/api/conversations", tags=["conversations"])
app.include_router(providers.router, prefix="/api/providers", tags=["providers"])


@app.get("/")
async def root():
    return {"message": "LLM Chat Backend API"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
