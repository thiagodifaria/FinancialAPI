import logging
from concurrent import futures
from typing import Any

from grpc_health.v1 import health, health_pb2, health_pb2_grpc

import grpc
from app.config import load_settings
from app.grpc.generated import financial_pb2_grpc
from app.grpc.service import CreditScoringService
from app.logging import configure_logging
from app.observability import configure_observability
from app.scoring import CreditPolicyEngine


def create_server() -> Any:
    settings = load_settings()
    configure_logging(settings.log_level)
    configure_observability(settings)

    server = grpc.server(futures.ThreadPoolExecutor(max_workers=settings.max_workers))
    engine = CreditPolicyEngine(settings.policy_version)
    financial_pb2_grpc.add_CreditScoringServicer_to_server(CreditScoringService(engine), server)

    health_servicer = health.HealthServicer()
    health_pb2_grpc.add_HealthServicer_to_server(health_servicer, server)
    health_servicer.set("", health_pb2.HealthCheckResponse.SERVING)
    health_servicer.set(
        "financial_api.scoring.v1.CreditScoring", health_pb2.HealthCheckResponse.SERVING
    )

    server.add_insecure_port(f"{settings.host}:{settings.port}")
    return server


def serve() -> None:
    settings = load_settings()
    server = create_server()
    logging.getLogger("zins-scoring-engine").info(
        "Scoring Engine rodando", extra={"policy_version": settings.policy_version}
    )
    server.start()
    server.wait_for_termination()
