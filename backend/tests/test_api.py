import os
import pytest
from httpx import AsyncClient
import httpx
from asgi_lifespan import LifespanManager

# Set in-memory database before importing the app
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"


from backend.main import app
from backend.database import Base, engine

import pytest_asyncio


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest_asyncio.fixture()
async def client():
    async with LifespanManager(app):
        transport = httpx.ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac


@pytest.mark.asyncio
async def test_root(client):
    res = await client.get("/")
    assert res.status_code == 200
    assert res.json() == {"message": "LLM Chat Backend API"}


@pytest.mark.asyncio
async def test_health(client):
    res = await client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "healthy"}


@pytest.mark.asyncio
async def test_conversation_crud(client):
    # Create conversation
    res = await client.post("/api/conversations/", json={"title": "Test"})
    assert res.status_code == 201
    data = res.json()
    conv_id = data["id"]
    assert data["title"] == "Test"

    # Get conversation
    res = await client.get(f"/api/conversations/{conv_id}")
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == conv_id
    assert data["messages"] == []

    # List conversations
    res = await client.get("/api/conversations/")
    assert res.status_code == 200
    convs = res.json()
    assert len(convs) == 1
    assert convs[0]["id"] == conv_id

    # Delete conversation
    res = await client.delete(f"/api/conversations/{conv_id}")
    assert res.status_code == 204


@pytest.mark.asyncio
async def test_provider_activate(client):
    # Create provider
    res = await client.post(
        "/api/providers/",
        json={"name": "openai", "model_name": "gpt-3.5-turbo"}
    )
    assert res.status_code == 201
    provider_id = res.json()["id"]

    # Activate provider
    res = await client.post(f"/api/providers/{provider_id}/activate")
    assert res.status_code == 200

    # Get active provider
    res = await client.get("/api/providers/active")
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == provider_id
    assert data["is_active"] is True

