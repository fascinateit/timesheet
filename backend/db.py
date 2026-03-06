"""db.py – thin PyMySQL connection helper."""
import os
import pymysql
import pymysql.cursors


def get_conn():
    """Return a new PyMySQL connection using env vars."""
    return pymysql.connect(
        host=os.environ.get("DB_HOST", "127.0.0.1"),
        port=int(os.environ.get("DB_PORT", 3306)),
        user=os.environ.get("DB_USER", "ppuser"),
        password=os.environ.get("DB_PASSWORD", "pppassword"),
        database=os.environ.get("DB_NAME", "projectpulse"),
        cursorclass=pymysql.cursors.DictCursor,
        charset="utf8mb4",
        autocommit=False,
    )


def query(sql: str, args=None, fetch="all"):
    """Execute a SELECT and return rows."""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, args or ())
            return cur.fetchall() if fetch == "all" else cur.fetchone()
    finally:
        conn.close()


def execute(sql: str, args=None):
    """Execute INSERT/UPDATE/DELETE, return lastrowid."""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, args or ())
            conn.commit()
            return cur.lastrowid
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def execute_many(sql: str, args_list):
    """Bulk INSERT/UPDATE."""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.executemany(sql, args_list)
            conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
