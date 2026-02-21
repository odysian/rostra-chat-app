"""
Tests for operational health endpoints.
"""

from httpx import AsyncClient


async def test_db_health_requires_authentication(client: AsyncClient):
    """DB health endpoint rejects unauthenticated requests."""
    response = await client.get("/api/health/db")

    assert response.status_code in {401, 403}


async def test_db_health_returns_pool_metrics_and_status_for_authenticated_user(
    client: AsyncClient, create_user
):
    """DB health endpoint returns pool metrics to authenticated users."""
    user_data = await create_user()
    token = user_data["access_token"]

    response = await client.get(
        "/api/health/db", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200
    data = response.json()

    assert isinstance(data["pool_size"], int)
    assert isinstance(data["checked_out"], int)
    assert isinstance(data["overflow"], int)
    assert data["status"] in {"healthy", "degraded"}
