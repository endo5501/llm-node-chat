from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List

from ..database import get_db
from ..models import Conversation, Message, LLMProvider
from ..schemas import ChatRequest, ChatResponse, MessageResponse
from ..llm_service import llm_service

router = APIRouter()


async def get_conversation_history(
    conversation_id: int,
    parent_id: int = None,
    db: AsyncSession = None
) -> List[MessageResponse]:
    """指定されたノードから根までの会話履歴を取得"""
    messages = []
    current_id = parent_id
    
    # parent_idから根まで遡る
    while current_id is not None:
        query = select(Message).where(Message.id == current_id)
        result = await db.execute(query)
        message = result.scalar_one_or_none()
        
        if not message:
            break
            
        messages.insert(0, MessageResponse.from_orm(message))
        current_id = message.parent_id
    
    return messages


async def get_active_llm_provider(db: AsyncSession) -> LLMProvider:
    """アクティブなLLMプロバイダーを取得"""
    query = select(LLMProvider).where(LLMProvider.is_active == True)
    result = await db.execute(query)
    provider = result.scalar_one_or_none()
    
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active LLM provider found. Please configure a provider first."
        )
    
    return provider


@router.post("/send", response_model=ChatResponse)
async def send_message(
    chat_request: ChatRequest,
    db: AsyncSession = Depends(get_db)
):
    """メッセージを送信してLLMからの応答を取得"""
    
    # 会話の存在確認
    conv_query = select(Conversation).where(Conversation.id == chat_request.conversation_id)
    conv_result = await db.execute(conv_query)
    conversation = conv_result.scalar_one_or_none()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    # アクティブなLLMプロバイダーを取得
    provider = await get_active_llm_provider(db)
    
    # ユーザーメッセージを保存
    user_message = Message(
        conversation_id=chat_request.conversation_id,
        parent_id=chat_request.parent_id,
        role="user",
        content=chat_request.message
    )
    db.add(user_message)
    await db.commit()
    await db.refresh(user_message)
    
    try:
        # 会話履歴を取得（選択されたノードから根まで）
        history = await get_conversation_history(
            chat_request.conversation_id,
            user_message.id,
            db
        )
        
        # コンテキスト制限に合わせて履歴を切り詰め
        truncated_history = llm_service.truncate_messages_for_context(history)
        
        # LLMからの応答を生成
        assistant_response = await llm_service.generate_response(
            provider,
            truncated_history
        )
        
        # アシスタントメッセージを保存
        assistant_message = Message(
            conversation_id=chat_request.conversation_id,
            parent_id=user_message.id,
            role="assistant",
            content=assistant_response
        )
        db.add(assistant_message)
        await db.commit()
        await db.refresh(assistant_message)
        
        # 会話の更新日時を更新
        conversation.updated_at = assistant_message.created_at
        await db.commit()
        
        return ChatResponse(
            user_message=MessageResponse.from_orm(user_message),
            assistant_message=MessageResponse.from_orm(assistant_message)
        )
        
    except Exception as e:
        # エラーが発生した場合、ユーザーメッセージは保存されているが、
        # アシスタントメッセージは保存されない
        print(f"Error generating LLM response: {str(e)}")
        
        # エラーメッセージをアシスタントメッセージとして保存
        error_message = Message(
            conversation_id=chat_request.conversation_id,
            parent_id=user_message.id,
            role="assistant",
            content="申し訳ございません。応答の生成中にエラーが発生しました。しばらく時間をおいて再度お試しください。"
        )
        db.add(error_message)
        await db.commit()
        await db.refresh(error_message)
        
        return ChatResponse(
            user_message=MessageResponse.from_orm(user_message),
            assistant_message=MessageResponse.from_orm(error_message)
        )


@router.get("/history/{conversation_id}")
async def get_chat_history(
    conversation_id: int,
    from_message_id: int = None,
    db: AsyncSession = Depends(get_db)
):
    """指定されたメッセージから根までの会話履歴を取得"""
    
    # 会話の存在確認
    conv_query = select(Conversation).where(Conversation.id == conversation_id)
    conv_result = await db.execute(conv_query)
    conversation = conv_result.scalar_one_or_none()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    if from_message_id:
        # 指定されたメッセージから根までの履歴を取得
        history = await get_conversation_history(conversation_id, from_message_id, db)
    else:
        # 全メッセージを取得（ツリー構造ではなく時系列順）
        query = (
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at)
        )
        result = await db.execute(query)
        messages = result.scalars().all()
        history = [MessageResponse.from_orm(msg) for msg in messages]
    
    return {
        "conversation_id": conversation_id,
        "messages": history
    }


@router.post("/regenerate/{message_id}", response_model=MessageResponse)
async def regenerate_response(
    message_id: int,
    db: AsyncSession = Depends(get_db)
):
    """指定されたアシスタントメッセージを再生成"""
    
    # メッセージの存在確認
    query = select(Message).where(Message.id == message_id)
    result = await db.execute(query)
    message = result.scalar_one_or_none()
    
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )
    
    if message.role != "assistant":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only regenerate assistant messages"
        )
    
    # アクティブなLLMプロバイダーを取得
    provider = await get_active_llm_provider(db)
    
    try:
        # 親メッセージまでの履歴を取得
        history = await get_conversation_history(
            message.conversation_id,
            message.parent_id,
            db
        )
        
        # コンテキスト制限に合わせて履歴を切り詰め
        truncated_history = llm_service.truncate_messages_for_context(history)
        
        # LLMからの新しい応答を生成
        new_response = await llm_service.generate_response(
            provider,
            truncated_history
        )
        
        # メッセージの内容を更新
        message.content = new_response
        await db.commit()
        await db.refresh(message)
        
        return MessageResponse.from_orm(message)
        
    except Exception as e:
        print(f"Error regenerating response: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to regenerate response"
        )
