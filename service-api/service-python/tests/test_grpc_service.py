from concurrent import futures

from grpc_health.v1 import health_pb2, health_pb2_grpc

import grpc
from app.grpc.generated import financial_pb2, financial_pb2_grpc
from app.grpc.service import CreditScoringService
from app.scoring import CreditPolicyEngine


def test_grpc_analyze_risk_roundtrip() -> None:
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=1))
    financial_pb2_grpc.add_CreditScoringServicer_to_server(
        CreditScoringService(CreditPolicyEngine("test-policy")), server
    )
    port = server.add_insecure_port("127.0.0.1:0")
    server.start()

    try:
        channel = grpc.insecure_channel(f"127.0.0.1:{port}")
        stub = financial_pb2_grpc.CreditScoringStub(channel)
        response = stub.AnalyzeRisk(
            financial_pb2.RiskAnalysisRequest(
                metadata=financial_pb2.RequestMetadata(
                    request_id="test-request",
                    tenant_id="0194fd70-0000-7000-8000-000000000001",
                    idempotency_key="test-key",
                    caller_service="pytest",
                ),
                tenant_id="0194fd70-0000-7000-8000-000000000001",
                account_id="0194fd70-0000-7000-8000-000000000101",
                requested_amount=10_000,
            ),
            timeout=2,
            metadata=(("x-request-id", "test-request"),),
        )
    finally:
        server.stop(0)

    assert response.approved is True
    assert response.maximum_limit == 20_000


def test_grpc_health_package_is_available() -> None:
    assert health_pb2.HealthCheckResponse.SERVING == 1
    assert health_pb2_grpc.HealthStub is not None
