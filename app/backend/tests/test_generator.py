from datetime import date

from services import generator


class _FixedDate(date):
    """date subclass with a patched .today() so compute_start_date is deterministic."""
    _fixed: date

    @classmethod
    def today(cls):
        return cls._fixed


def _freeze(monkeypatch, year: int, month: int, day: int) -> None:
    fixed = _FixedDate(year, month, day)
    _FixedDate._fixed = fixed
    monkeypatch.setattr(generator, "date", _FixedDate)


def test_immediate_rolls_to_first_of_next_month(monkeypatch):
    _freeze(monkeypatch, 2026, 1, 15)
    assert generator.compute_start_date("immediate") == "01.02.2026"


def test_immediate_on_first_of_month_still_rolls_forward(monkeypatch):
    _freeze(monkeypatch, 2026, 1, 1)
    assert generator.compute_start_date("immediate") == "01.02.2026"


def test_two_weeks_crosses_into_following_month(monkeypatch):
    _freeze(monkeypatch, 2026, 1, 20)
    # +14 days -> 2026-02-03 -> first of next month -> 01.03.2026
    assert generator.compute_start_date("2_weeks") == "01.03.2026"


def test_one_month_notice(monkeypatch):
    _freeze(monkeypatch, 2026, 1, 15)
    # +1 month -> 2026-02-15 -> first of next month -> 01.03.2026
    assert generator.compute_start_date("1_month") == "01.03.2026"


def test_three_months_notice_crosses_year_boundary(monkeypatch):
    _freeze(monkeypatch, 2026, 11, 15)
    # +3 months -> 2027-02-15 -> first of next month -> 01.03.2027
    assert generator.compute_start_date("3_months") == "01.03.2027"


def test_month_rollover_clamps_to_leap_day(monkeypatch):
    _freeze(monkeypatch, 2024, 1, 31)
    # +1 month -> Feb 31 doesn't exist, clamps to Feb 29 (2024 is a leap year)
    # -> first of next month -> 01.03.2024
    assert generator.compute_start_date("1_month") == "01.03.2024"


def test_custom_date_is_used_verbatim(monkeypatch):
    _freeze(monkeypatch, 2026, 1, 15)
    assert generator.compute_start_date("custom", "2026-05-10") == "10.05.2026"


def test_invalid_custom_date_falls_back_to_immediate(monkeypatch):
    _freeze(monkeypatch, 2026, 1, 15)
    assert generator.compute_start_date("custom", "not-a-date") == "01.02.2026"


def test_unknown_period_falls_back_to_immediate(monkeypatch):
    _freeze(monkeypatch, 2026, 1, 15)
    assert generator.compute_start_date("") == "01.02.2026"
