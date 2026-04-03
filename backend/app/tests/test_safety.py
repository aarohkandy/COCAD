from app.services.safety import SafetyService


def test_blocks_weapons_request():
    policy = SafetyService()

    decision = policy.check("Design a weapon-mounted suppressor.")

    assert decision is not None


def test_allows_safe_request():
    policy = SafetyService()

    decision = policy.check("Make me a hanging planter for my apartment.")

    assert decision is None
