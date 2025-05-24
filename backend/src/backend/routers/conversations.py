from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List

from ..database import get_db
from ..models import Conversation, Message
from ..schemas import (
    ConversationCreate,
    ConversationResponse,
    ConversationListResponse,
    ConversationTree,
    MessageTreeNode,
    MessageResponse
)

router = APIRouter()


@router.post("/", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    conversation: ConversationCreate,
    db: AsyncSession = Depends(get_db)
):
    """新しい会話を作成"""
    db_conversation = Conversation(title=conversation.title)
    db.add(db_conversation)
    await db.commit()
    await db.refresh(db_conversation)
    
    # メッセージリストを空で初期化してレスポンスを作成
    return ConversationResponse(
        id=db_conversation.id,
        title=db_conversation.title,
        created_at=db_conversation.created_at,
        updated_at=db_conversation.updated_at,
        messages=[]
    )


@router.get("/", response_model=List[ConversationListResponse])
async def get_conversations(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """会話一覧を取得"""
    # 会話とメッセージ数を取得
    query = (
        select(
            Conversation,
            func.count(Message.id).label("message_count")
        )
        .outerjoin(Message)
        .group_by(Conversation.id)
        .order_by(Conversation.updated_at.desc())
        .offset(skip)
        .limit(limit)
    )
    
    result = await db.execute(query)
    conversations_with_count = result.all()
    
    return [
        ConversationListResponse(
            id=conv.id,
            title=conv.title,
            created_at=conv.created_at,
            updated_at=conv.updated_at,
            message_count=count
        )
        for conv, count in conversations_with_count
    ]


@router.get("/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: int,
    db: AsyncSession = Depends(get_db)
):
    """特定の会話を取得"""
    # 会話を取得
    conv_query = select(Conversation).where(Conversation.id == conversation_id)
    conv_result = await db.execute(conv_query)
    conversation = conv_result.scalar_one_or_none()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    # メッセージを別途取得
    messages_query = (
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at)
    )
    messages_result = await db.execute(messages_query)
    messages = messages_result.scalars().all()
    
    # レスポンスを手動で構築
    message_responses = [
        MessageResponse(
            id=msg.id,
            conversation_id=msg.conversation_id,
            parent_id=msg.parent_id,
            role=msg.role,
            content=msg.content,
            created_at=msg.created_at
        )
        for msg in messages
    ]
    
    return ConversationResponse(
        id=conversation.id,
        title=conversation.title,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
        messages=message_responses
    )


@router.get("/{conversation_id}/tree", response_model=ConversationTree)
async def get_conversation_tree(
    conversation_id: int,
    db: AsyncSession = Depends(get_db)
):
    """会話のツリー構造を取得"""
    # 会話の存在確認
    conv_query = select(Conversation).where(Conversation.id == conversation_id)
    conv_result = await db.execute(conv_query)
    conversation = conv_result.scalar_one_or_none()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    # 全メッセージを取得
    messages_query = (
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at)
    )
    messages_result = await db.execute(messages_query)
    messages = messages_result.scalars().all()
    
    # メッセージをツリー構造に変換
    root_messages = []
    
    def build_tree_node(message: Message) -> MessageTreeNode:
        children = [
            build_tree_node(child_msg)
            for child_msg in messages
            if child_msg.parent_id == message.id
        ]
        
        return MessageTreeNode(
            id=message.id,
            role=message.role,
            content=message.content,
            created_at=message.created_at,
            children=children
        )
    
    # ルートメッセージ（parent_id が None）から開始
    for message in messages:
        if message.parent_id is None:
            root_messages.append(build_tree_node(message))
    
    return ConversationTree(
        conversation_id=conversation_id,
        title=conversation.title,
        root_messages=root_messages
    )


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: int,
    db: AsyncSession = Depends(get_db)
):
    """会話を削除"""
    query = select(Conversation).where(Conversation.id == conversation_id)
    result = await db.execute(query)
    conversation = result.scalar_one_or_none()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    await db.delete(conversation)
    await db.commit()


@router.put("/{conversation_id}/title")
async def update_conversation_title(
    conversation_id: int,
    request: dict,
    db: AsyncSession = Depends(get_db)
):
    """会話のタイトルを更新"""
    query = select(Conversation).where(Conversation.id == conversation_id)
    result = await db.execute(query)
    conversation = result.scalar_one_or_none()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    conversation.title = request.get("title", "")
    await db.commit()
    await db.refresh(conversation)
    
    return {"message": "Title updated successfully"}
