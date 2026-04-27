from app.adapters.mosip import _with_default_timeout


def test_with_default_timeout_sets_timeout_when_missing() -> None:
    captured = {}

    def fake_post(*_args, **kwargs):
        captured.update(kwargs)
        return object()

    wrapped = _with_default_timeout(fake_post, timeout_seconds=60)
    wrapped("https://example.test")

    assert captured["timeout"] == 60


def test_with_default_timeout_preserves_explicit_timeout() -> None:
    captured = {}

    def fake_post(*_args, **kwargs):
        captured.update(kwargs)
        return object()

    wrapped = _with_default_timeout(fake_post, timeout_seconds=60)
    wrapped("https://example.test", timeout=12)

    assert captured["timeout"] == 12
