"""Date, time-zone and formatting helpers for the 90-day gameplan generator."""
from datetime import date, datetime, timedelta, timezone

TODAY = date(2026, 11, 8)            # Day 1 (a Sunday)
DAY90 = TODAY + timedelta(days=89)   # 2027-02-05
BLOCK_B_END = TODAY + timedelta(days=179)

HOLIDAYS = {date(2026, 11, 26), date(2026, 12, 24), date(2026, 12, 25), date(2026, 12, 31), date(2027, 1, 1)}


def d(s):
    return date.fromisoformat(s)


def is_bd(x):
    return x.weekday() < 5 and x not in HOLIDAYS


def next_bd(x):
    while not is_bd(x):
        x += timedelta(days=1)
    return x


def prev_bd(x):
    while not is_bd(x):
        x -= timedelta(days=1)
    return x


def add_bd(x, n):
    """Add n business days (skips weekends and the holidays above)."""
    step = 1 if n >= 0 else -1
    k = abs(n)
    while k:
        x += timedelta(days=step)
        if is_bd(x):
            k -= 1
    return x


def snap_monday_back(x):
    return x - timedelta(days=x.weekday())


def dow(x):
    return x.strftime("%a")


def long_date(x):
    return f"{x.strftime('%a')} {x.strftime('%b')} {x.day}, {x.year}"


def short_date(x):
    return f"{x.strftime('%a')} {x.strftime('%b')} {x.day}"


def clock(t):
    h, m = map(int, t.split(":"))
    ap = "AM" if h < 12 else "PM"
    return f"{(h % 12) or 12}:{m:02d} {ap}"


# ---------- time zones (offsets are for the winter dates this plan uses; DST changes handled by date) ----------
def off_et(x):
    return -5 if x < date(2027, 3, 14) else -4


def off_cet(x):
    return 1 if x < date(2027, 3, 28) else 2


def off_gmt(x):
    return 0 if x < date(2027, 3, 28) else 1


TZ = {
    "ET": ("ET", off_et),
    "WAT": ("Lagos", lambda x: 1),
    "CET": ("Paris", off_cet),
    "GMT": ("London", off_gmt),
    "MX": ("Mexico City", lambda x: -6),
    "KST": ("Seoul", lambda x: 9),
    "PET": ("Lima", lambda x: -5),
    "IST": ("Mumbai", lambda x: 5.5),
}


def utc_dt(day, hhmm, tz):
    h, m = map(int, hhmm.split(":"))
    off = TZ[tz][1](day)
    local = datetime(day.year, day.month, day.day, h, m)
    return (local - timedelta(hours=off)).replace(tzinfo=timezone.utc)


def iso_utc(day, hhmm, tz):
    return utc_dt(day, hhmm, tz).strftime("%Y-%m-%dT%H:%M:%SZ")


def convert(day, hhmm, tz_from, tz_to):
    """Return (date, 'HH:MM') in tz_to for a moment given in tz_from."""
    u = utc_dt(day, hhmm, tz_from)
    off = TZ[tz_to][1](day)
    loc = (u + timedelta(hours=off))
    # offsets can differ by date at DST edges; recompute once with the local date
    off2 = TZ[tz_to][1](loc.date())
    loc = u + timedelta(hours=off2)
    return loc.date(), loc.strftime("%H:%M")


def label(day, hhmm, tz):
    """'Fri Nov 13, 5:00 PM Lagos'"""
    return f"{short_date(day)}, {clock(hhmm)} {TZ[tz][0]}"


def label_both(day, hhmm, tz):
    """Local label plus the same moment in New York."""
    if tz == "ET":
        return label(day, hhmm, "ET")
    ed, et = convert(day, hhmm, tz, "ET")
    return f"{label(day, hhmm, tz)} ({short_date(ed)} {clock(et)} ET)"


def daterange(a, b):
    x = a
    while x <= b:
        yield x
        x += timedelta(days=1)
