from app.scoring import CreditPolicyEngine


def test_approves_low_risk_amount() -> None:
    decision = CreditPolicyEngine("test-policy").analyze(10_000)

    assert decision.approved is True
    assert decision.maximum_limit_minor == 20_000
    assert decision.score >= 0.65
    assert decision.policy_version == "test-policy"


def test_reduces_limit_for_amount_above_automatic_policy() -> None:
    decision = CreditPolicyEngine("test-policy").analyze(60_000)

    assert decision.maximum_limit_minor == 10_000
    assert decision.factors[0].code == "AMOUNT_ABOVE_AUTOMATIC_POLICY"


def test_rejects_amount_requiring_manual_review() -> None:
    decision = CreditPolicyEngine("test-policy").analyze(120_000)

    assert decision.approved is False
    assert decision.score < 0.65


def test_rejects_invalid_amount() -> None:
    try:
        CreditPolicyEngine("test-policy").analyze(0)
    except ValueError as error:
        assert "positivo" in str(error)
    else:
        raise AssertionError("Valor inválido deveria falhar")
