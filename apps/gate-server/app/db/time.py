from sqlalchemy import func, text

PHT_TIMEZONE = "Asia/Manila"
PHT_NOW_SQL = "timezone('Asia/Manila', now())"


def pht_now():
    """Postgres expression for Philippine wall-clock time."""
    return func.timezone(PHT_TIMEZONE, func.now())


def pht_now_server_default():
    """Server default for `timestamp without time zone` PHT wall-clock columns."""
    return text(PHT_NOW_SQL)
