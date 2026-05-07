import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    host: str
    port: int
    metrics_port: int
    max_workers: int
    log_level: str
    policy_version: str
    environment: str
    otel_enabled: bool


def load_settings() -> Settings:
    return Settings(
        host=os.getenv("SCORING_HOST", "[::]"),
        port=int(os.getenv("SCORING_PORT", "50052")),
        metrics_port=int(os.getenv("SCORING_METRICS_PORT", "9102")),
        max_workers=int(os.getenv("SCORING_MAX_WORKERS", "10")),
        log_level=os.getenv("LOG_LEVEL", "INFO").upper(),
        policy_version=os.getenv("SCORING_POLICY_VERSION", "credit-policy-v1"),
        environment=os.getenv("APP_ENV", "development"),
        otel_enabled=os.getenv("OTEL_SDK_DISABLED", "false").lower() != "true",
    )
