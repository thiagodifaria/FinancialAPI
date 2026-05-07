import logging
import time
from typing import Any

import grpc
from app.observability import record_decision, record_error, scoring_span
from app.scoring.policy import CreditPolicyEngine

from .generated import financial_pb2, financial_pb2_grpc

logger = logging.getLogger("financial-api-scoring")


class CreditScoringService(financial_pb2_grpc.CreditScoringServicer):  # type: ignore[misc]
    def __init__(self, engine: CreditPolicyEngine) -> None:
        self.engine = engine

    def AnalyzeRisk(self, request: Any, context: Any) -> Any:
        started = time.perf_counter()
        call_metadata = self._metadata(context)
        request_metadata = request.metadata
        request_id = call_metadata.get("x-request-id") or request_metadata.request_id

        try:
            self._validate_metadata(request_metadata)
            if request.tenant_id != request_metadata.tenant_id:
                raise ValueError("tenant_id deve bater com metadata.tenant_id")
            amount = int(request.requested_amount)
            with scoring_span(
                "scoring.analyze_risk",
                tenant_id=request.tenant_id,
                account_id=request.account_id,
                request_id=request_id,
            ):
                decision = self.engine.analyze(amount)
        except ValueError as error:
            record_error("INVALID_ARGUMENT")
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, str(error))
        except Exception:
            record_error("INTERNAL")
            logger.exception("Falha ao analisar risco", extra={"request_id": request_id})
            context.abort(grpc.StatusCode.INTERNAL, "Falha interna ao analisar risco")

        latency_seconds = time.perf_counter() - started
        latency_ms = round(latency_seconds * 1000, 2)
        record_decision(decision.approved, decision.policy_version, latency_seconds)
        logger.info(
            "Decisão de crédito calculada",
            extra={
                "tenant_id": request.tenant_id,
                "account_id": request.account_id,
                "request_id": request_id,
                "policy_version": decision.policy_version,
                "latency_ms": latency_ms,
            },
        )

        return financial_pb2.RiskAnalysisResponse(
            score=decision.score,
            approved=decision.approved,
            maximum_limit=decision.maximum_limit_minor,
            reason=decision.reason,
            policy_version=decision.policy_version,
            reasons=[
                financial_pb2.DecisionReason(
                    code=factor.code,
                    message=factor.message,
                    impact=factor.impact,
                )
                for factor in decision.factors
            ],
        )

    def _metadata(self, context: Any) -> dict[str, str]:
        return {key: value for key, value in context.invocation_metadata()}

    def _validate_metadata(self, metadata: Any) -> None:
        missing = [
            name
            for name in ("request_id", "tenant_id", "caller_service")
            if not getattr(metadata, name)
        ]
        if missing:
            raise ValueError(f"metadata obrigatório ausente: {', '.join(missing)}")
