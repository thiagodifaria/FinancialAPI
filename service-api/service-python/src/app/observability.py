import logging
from collections.abc import Iterator
from contextlib import contextmanager

from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from prometheus_client import Counter, Gauge, Histogram, start_http_server

from app.config import Settings

logger = logging.getLogger("financial-api-scoring")

DECISIONS_TOTAL = Counter(
    "scoring_decisions_total",
    "Total de decisões de crédito calculadas.",
    ["result", "policy_version"],
)
ERRORS_TOTAL = Counter(
    "scoring_errors_total",
    "Total de erros do serviço de scoring.",
    ["code"],
)
LATENCY_SECONDS = Histogram(
    "scoring_decision_latency_seconds",
    "Latência da decisão de crédito.",
    ["policy_version"],
)
POLICY_INFO = Gauge(
    "scoring_policy_info",
    "Versão de política carregada pelo scoring.",
    ["policy_version"],
)


def configure_observability(settings: Settings) -> None:
    POLICY_INFO.labels(policy_version=settings.policy_version).set(1)
    start_http_server(settings.metrics_port)
    logger.info("Métricas Prometheus do scoring habilitadas", extra={"port": settings.metrics_port})

    if settings.otel_enabled:
        provider = TracerProvider(
            resource=Resource.create(
                {
                    "service.name": "financial-api-scoring",
                    "deployment.environment": settings.environment,
                }
            )
        )
        trace.set_tracer_provider(provider)


def record_decision(approved: bool, policy_version: str, latency_seconds: float) -> None:
    result = "approved" if approved else "rejected"
    DECISIONS_TOTAL.labels(result=result, policy_version=policy_version).inc()
    LATENCY_SECONDS.labels(policy_version=policy_version).observe(latency_seconds)


def record_error(code: str) -> None:
    ERRORS_TOTAL.labels(code=code).inc()


@contextmanager
def scoring_span(name: str, **attributes: str) -> Iterator[None]:
    tracer = trace.get_tracer("financial-api-scoring")
    with tracer.start_as_current_span(name) as span:
        for key, value in attributes.items():
            span.set_attribute(key, value)
        yield
