from routers.leads import _verdict


def test_poor_match_always_skips_regardless_of_score():
    assert _verdict(100, is_poor_match=True) == "skip"


def test_strong_at_threshold():
    assert _verdict(70, is_poor_match=False) == "strong"


def test_strong_above_threshold():
    assert _verdict(95, is_poor_match=False) == "strong"


def test_maybe_at_lower_threshold():
    assert _verdict(50, is_poor_match=False) == "maybe"


def test_maybe_just_below_strong():
    assert _verdict(69, is_poor_match=False) == "maybe"


def test_skip_below_maybe_threshold():
    assert _verdict(49, is_poor_match=False) == "skip"


def test_skip_at_zero():
    assert _verdict(0, is_poor_match=False) == "skip"
