from dataclasses import dataclass


@dataclass(frozen=True)
class RiskFactor:
    code: str
    message: str
    impact: float


@dataclass(frozen=True)
class CreditDecision:
    score: float
    approved: bool
    maximum_limit_minor: int
    reason: str
    policy_version: str
    factors: tuple[RiskFactor, ...]


class CreditPolicyEngine:
    """
    Política real e determinística de decisão.
    Não é mock: a regra é simples, versionada e auditável até existir modelo estatístico aprovado.
    """

    def __init__(self, policy_version: str) -> None:
        self.policy_version = policy_version

    def analyze(self, requested_amount_minor: int) -> CreditDecision:
        if requested_amount_minor <= 0:
            raise ValueError("requested_amount deve ser positivo")

        factors: list[RiskFactor] = []
        score = 0.92
        maximum_limit = requested_amount_minor * 2

        if requested_amount_minor > 50_000:
            score -= 0.35
            maximum_limit = min(maximum_limit, 10_000)
            factors.append(
                RiskFactor(
                    code="AMOUNT_ABOVE_AUTOMATIC_POLICY",
                    message="Valor solicitado excede a política automática de baixo risco.",
                    impact=-0.35,
                )
            )

        if requested_amount_minor > 100_000:
            score -= 0.25
            factors.append(
                RiskFactor(
                    code="AMOUNT_REQUIRES_MANUAL_REVIEW",
                    message="Valor exige revisão manual antes de aprovação.",
                    impact=-0.25,
                )
            )

        score = max(0.0, min(1.0, score))
        approved = score >= 0.65 and requested_amount_minor <= maximum_limit
        reason = (
            "Perfil aprovado pela política determinística de crédito."
            if approved
            else "Perfil recusado pela política determinística de crédito."
        )

        return CreditDecision(
            score=score,
            approved=approved,
            maximum_limit_minor=maximum_limit,
            reason=reason,
            policy_version=self.policy_version,
            factors=tuple(factors),
        )
