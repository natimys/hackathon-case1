from datetime import UTC, datetime, time
from types import SimpleNamespace

from modules.notifications.service import in_quiet_hours


def test_quiet_hours_cross_midnight_uses_user_timezone():
    preference = SimpleNamespace(timezone="Asia/Yakutsk", quiet_start=time(22), quiet_end=time(7))

    assert in_quiet_hours(datetime(2026, 1, 1, 13, 30, tzinfo=UTC), preference)
    assert not in_quiet_hours(datetime(2026, 1, 1, 22, 0, tzinfo=UTC), preference)


def test_equal_quiet_hour_endpoints_disable_quiet_hours():
    preference = SimpleNamespace(timezone="Asia/Yakutsk", quiet_start=time(8), quiet_end=time(8))
    assert not in_quiet_hours(datetime(2026, 1, 1, 0, 0, tzinfo=UTC), preference)
