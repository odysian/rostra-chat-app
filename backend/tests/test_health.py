"""
Tests for operational health endpoints.
"""

from httpx import AsyncClient


async def test_db_health_returns_pool_metrics_and_status(client: AsyncClient):
    """DB health endpoint returns pool metrics and a derived status."""
    response = await client.get("/api/health/db")

    assert response.status_code == 200
    data = response.json()

    assert isinstance(data["pool_size"], int)
    assert isinstance(data["checked_out"], int)
    assert isinstance(data["overflow"], int)
    assert data["status"] in {"healthy", "degraded"}
