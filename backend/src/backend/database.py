from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import os
from dotenv import load_dotenv

from .models import Base

load_dotenv()

# データベースURL設定
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./chat.db")

# 非同期エンジンの作成
if DATABASE_URL.startswith("sqlite"):
    # SQLite用の設定
    engine = create_async_engine(
        DATABASE_URL,
        connect_args={
            "check_same_thread": False,
        },
        poolclass=StaticPool,
        echo=True  # 開発時のSQL出力
    )
else:
    # PostgreSQL用の設定
    engine = create_async_engine(
        DATABASE_URL,
        echo=True  # 開発時のSQL出力
    )

# セッションファクトリーの作成
AsyncSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


async def init_db():
    """データベースの初期化"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    """データベースセッションの依存性注入"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


# 同期版（Alembicマイグレーション用）
SYNC_DATABASE_URL = DATABASE_URL.replace("+aiosqlite", "").replace("postgresql+asyncpg", "postgresql")
sync_engine = create_engine(SYNC_DATABASE_URL)
