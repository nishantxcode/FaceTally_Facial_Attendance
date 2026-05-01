from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo


IST = ZoneInfo("Asia/Kolkata")


def now_ist():
    return datetime.now(IST)


def today_ist_string():
    return now_ist().strftime("%Y-%m-%d")


def current_time_ist_string():
    return now_ist().strftime("%H:%M:%S")


def format_time_ampm(value):
    if not value:
        return ""

    if isinstance(value, timedelta):
        total_seconds = int(value.total_seconds())
        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60
        seconds = total_seconds % 60
        value = time(hours % 24, minutes, seconds)

    if isinstance(value, time):
        return value.strftime("%I:%M:%S %p")

    text = str(value)
    for fmt in ("%H:%M:%S", "%H:%M"):
        try:
            return datetime.strptime(text, fmt).strftime("%I:%M:%S %p")
        except ValueError:
            continue

    return text
