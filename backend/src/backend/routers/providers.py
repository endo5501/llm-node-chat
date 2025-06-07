from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from typing import List

from ..database import get_db
from ..models import LLMProvider
from ..schemas import (
    LLMProviderCreate,
    LLMProviderUpdate,
    LLMProviderResponse
)

router = APIRouter()


@router.post("/", response_model=LLMProviderResponse, status_code=status.HTTP_201_CREATED)
async def create_provider(
    provider: LLMProviderCreate,
    db: AsyncSession = Depends(get_db)
):
    """新しいLLMプロバイダーを作成"""
    
    # 同じ名前のプロバイダーが既に存在するかチェック
    existing_query = select(LLMProvider).where(LLMProvider.name == provider.name)
    existing_result = await db.execute(existing_query)
    existing_provider = existing_result.scalar_one_or_none()
    
    if existing_provider:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Provider with name '{provider.name}' already exists"
        )
    
    db_provider = LLMProvider(**provider.model_dump())
    db.add(db_provider)
    await db.commit()
    await db.refresh(db_provider)
    
    return db_provider


@router.get("/", response_model=List[LLMProviderResponse])
async def get_providers(
    db: AsyncSession = Depends(get_db)
):
    """全LLMプロバイダーを取得"""
    query = select(LLMProvider).order_by(LLMProvider.name)
    result = await db.execute(query)
    providers = result.scalars().all()
    
    return providers


@router.get("/active", response_model=LLMProviderResponse)
async def get_active_provider(
    db: AsyncSession = Depends(get_db)
):
    """アクティブなLLMプロバイダーを取得"""
    query = select(LLMProvider).where(LLMProvider.is_active == True)
    result = await db.execute(query)
    provider = result.scalar_one_or_none()
    
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active provider found"
        )
    
    return provider


@router.get("/{provider_id}", response_model=LLMProviderResponse)
async def get_provider(
    provider_id: int,
    db: AsyncSession = Depends(get_db)
):
    """特定のLLMプロバイダーを取得"""
    query = select(LLMProvider).where(LLMProvider.id == provider_id)
    result = await db.execute(query)
    provider = result.scalar_one_or_none()
    
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider not found"
        )
    
    return provider


@router.put("/{provider_id}", response_model=LLMProviderResponse)
async def update_provider(
    provider_id: int,
    provider_update: LLMProviderUpdate,
    db: AsyncSession = Depends(get_db)
):
    """LLMプロバイダーを更新"""
    query = select(LLMProvider).where(LLMProvider.id == provider_id)
    result = await db.execute(query)
    provider = result.scalar_one_or_none()
    
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider not found"
        )
    
    # 更新データを適用
    update_data = provider_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(provider, field, value)
    
    await db.commit()
    await db.refresh(provider)
    
    return provider


@router.post("/{provider_id}/activate")
async def activate_provider(
    provider_id: int,
    db: AsyncSession = Depends(get_db)
):
    """指定されたプロバイダーをアクティブにし、他を非アクティブにする"""
    
    # プロバイダーの存在確認
    query = select(LLMProvider).where(LLMProvider.id == provider_id)
    result = await db.execute(query)
    provider = result.scalar_one_or_none()
    
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider not found"
        )
    
    # 全プロバイダーを非アクティブにする
    await db.execute(
        update(LLMProvider).values(is_active=False)
    )
    
    # 指定されたプロバイダーをアクティブにする
    provider.is_active = True
    await db.commit()
    await db.refresh(provider)
    
    return {"message": f"Provider '{provider.name}' activated successfully"}


@router.delete("/{provider_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_provider(
    provider_id: int,
    db: AsyncSession = Depends(get_db)
):
    """LLMプロバイダーを削除"""
    query = select(LLMProvider).where(LLMProvider.id == provider_id)
    result = await db.execute(query)
    provider = result.scalar_one_or_none()
    
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider not found"
        )
    
    await db.delete(provider)
    await db.commit()


@router.post("/test/{provider_id}")
async def test_provider(
    provider_id: int,
    test_message: str = "Hello, this is a test message.",
    db: AsyncSession = Depends(get_db)
):
    """LLMプロバイダーの接続をテスト"""
    from ..llm_service import llm_service
    from ..schemas import MessageResponse
    from datetime import datetime
    
    # プロバイダーの取得
    query = select(LLMProvider).where(LLMProvider.id == provider_id)
    result = await db.execute(query)
    provider = result.scalar_one_or_none()
    
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider not found"
        )
    
    try:
        # テストメッセージを作成
        test_messages = [
            MessageResponse(
                id=1,
                conversation_id=1,
                parent_id=None,
                role="user",
                content=test_message,
                created_at=datetime.utcnow()
            )
        ]
        
        # LLMからの応答を生成
        response = await llm_service.generate_response(
            provider,
            test_messages,
            max_tokens=100
        )
        
        return {
            "success": True,
            "provider": provider.name,
            "test_message": test_message,
            "response": response
        }
        
    except Exception as e:
        return {
            "success": False,
            "provider": provider.name,
            "error": str(e)
        }
