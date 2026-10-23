"""Lecture seule de la base locale de T3 Code, pour relier les worktrees Overload aux threads T3.

Usage :
  python -I t3_threads.py thread-of <claude_session_id>   -> id du thread T3 qui reprend cette session (vide si aucun)
  python -I t3_threads.py status <thread_id> [...]         -> JSON {thread_id: active|settled|archived|deleted|missing}
"""

import json
import sqlite3
import sys
from pathlib import Path

DB = Path.home() / ".t3" / "userdata" / "state.sqlite"


def connect():
    """Cette methode permet d'ouvrir la base T3 en lecture seule lorsque T3 tourne (mode WAL)."""
    return sqlite3.connect(f"file:{DB.as_posix()}?mode=ro", uri=True)


def thread_of(conn, session_id):
    """Cette methode permet de retrouver le thread T3 qui reprend une session Claude donnee."""
    for thread_id, cursor in conn.execute("select thread_id, resume_cursor_json from provider_session_runtime"):
        try:
            if json.loads(cursor or "{}").get("resume") == session_id:
                return thread_id
        except ValueError:
            continue
    return ""


def status(conn, thread_ids):
    """Cette methode permet de connaitre l'etat (actif, settled, archive, supprime, absent) de threads T3 ;
    un thread settled qui a recu un message depuis redevient actif."""
    out = {}
    for thread_id in thread_ids:
        row = conn.execute(
            "select archived_at, deleted_at, settled_override, settled_at, latest_user_message_at"
            " from projection_threads where thread_id = ?",
            (thread_id,),
        ).fetchone()
        if row is None:
            out[thread_id] = "missing"
        elif row[1]:
            out[thread_id] = "deleted"
        elif row[0]:
            out[thread_id] = "archived"
        elif row[2] == "settled" and row[3] and (not row[4] or row[4] <= row[3]):
            out[thread_id] = "settled"
        else:
            out[thread_id] = "active"
    return out


if __name__ == "__main__":
    if not DB.exists() or len(sys.argv) < 3:
        sys.exit(0)
    with connect() as conn:
        if sys.argv[1] == "thread-of":
            print(thread_of(conn, sys.argv[2]))
        elif sys.argv[1] == "status":
            print(json.dumps(status(conn, sys.argv[2:])))
