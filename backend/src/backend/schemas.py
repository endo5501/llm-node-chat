from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime


# Message schemas
class MessageBase(BaseModel):
    role: str = Field(..., description="メッセージの役割 (user, assistant, system)")
    content: str = Field(..., description="メッセージの内容")


class MessageCreate(MessageBase):
    parent_id: Optional[int] = Field(None, description="親メッセージのID (NULLならroot)")


class MessageResponse(MessageBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    conversation_id: int
    parent_id: Optional[int]
    created_at: datetime


# Conversation schemas
class ConversationBase(BaseModel):
    title: str = Field(..., description="会話のタイトル")


class ConversationCreate(ConversationBase):
    pass


class ConversationResponse(ConversationBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    created_at: datetime
    updated_at: datetime
    messages: List[MessageResponse] = []


class ConversationListResponse(ConversationBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    created_at: datetime
    updated_at: datetime
    message_count: int = Field(0, description="メッセージ数")


# Chat schemas
class ChatRequest(BaseModel):
    conversation_id: int = Field(..., description="会話ID")
    message: str = Field(..., description="ユーザーメッセージ")
    parent_id: Optional[int] = Field(None, description="親メッセージのID")


class ChatResponse(BaseModel):
    user_message: MessageResponse
    assistant_message: MessageResponse


# LLM Provider schemas
class LLMProviderBase(BaseModel):
    name: str = Field(..., description="プロバイダー名")
    model_name: str = Field(..., description="モデル名")
    api_key: Optional[str] = Field(None, description="APIキー")
    api_url: Optional[str] = Field(None, description="API URL (Ollamaなど)")


class LLMProviderCreate(LLMProviderBase):
    pass


class LLMProviderUpdate(BaseModel):
    model_name: Optional[str] = None
    api_key: Optional[str] = None
    api_url: Optional[str] = None
    is_active: Optional[bool] = None


class LLMProviderResponse(LLMProviderBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


# Tree structure for conversation visualization
class MessageTreeNode(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    role: str
    content: str
    created_at: datetime
    children: List['MessageTreeNode'] = []


class ConversationTree(BaseModel):
    conversation_id: int
    title: str
    root_messages: List[MessageTreeNode]


# WebSocket message types
class WSMessageType(BaseModel):
    type: str = Field(..., description="メッセージタイプ")
    data: dict = Field(..., description="メッセージデータ")


# Update forward references
MessageTreeNode.model_rebuild()
