"""Liderlik tablosu önizleme — Flask + Jinja (static/img/arka_plan_resmi.png)."""
from __future__ import annotations

import sqlite3
from pathlib import Path

from flask import Flask, render_template

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "db" / "oyun.db"

BOTLAR = [
    {"isim": "Baron Süleyman", "grup": "Çakır Ailesi", "puan": 2450, "bot": True},
    {"isim": "Kordon Celal", "grup": "Ege Reisleri", "puan": 1800, "bot": True},
    {"isim": "Fırtına Temel", "grup": "Kuzey Lobisi", "puan": 1200, "bot": True},
    {"isim": "Akrep Nuri", "grup": "Gaddarlar Grubu", "puan": 600, "bot": True},
]

app = Flask(__name__, static_folder="static", template_folder="templates")


import re

GRUP_SONEK_RE = re.compile(r"\s+Mafya+a*\s+G[uü]?rubu$", re.IGNORECASE)


def temiz_grup_adi(grup: str | None) -> str:
    if not grup:
        return grup or "—"
    s = str(grup).strip()
    if s == "Bağımsız Reis":
        return s
    return GRUP_SONEK_RE.sub("", s).strip() or "—"


def fmt_puan(value: int) -> str:
    return f"{int(value):,}".replace(",", ".")


def get_leaderboard() -> list[dict]:
    liste: list[dict] = []
    if DB_PATH.exists():
        con = sqlite3.connect(DB_PATH)
        con.row_factory = sqlite3.Row
        try:
            rows = con.execute(
                """
                SELECT u.reis_adi AS isim, u.grup, p.puan, u.id AS user_id
                FROM players p
                JOIN users u ON u.id = p.user_id
                ORDER BY p.puan DESC
                LIMIT 50
                """
            ).fetchall()
            for row in rows:
                liste.append(
                    {
                        "isim": row["isim"],
                        "grup": temiz_grup_adi(row["grup"] or "—"),
                        "puan": row["puan"] or 0,
                        "benim": False,
                        "bot": False,
                    }
                )
        finally:
            con.close()

    for bot in BOTLAR:
        liste.append({**bot, "benim": False})

    liste.sort(key=lambda x: x["puan"], reverse=True)
    out = []
    for i, row in enumerate(liste[:25], start=1):
        medal = ""
        if i == 1:
            medal = "r1"
        elif i == 2:
            medal = "r2"
        elif i == 3:
            medal = "r3"
        out.append(
            {
                **row,
                "sira": i,
                "medal": medal,
                "puan_fmt": fmt_puan(row["puan"]),
            }
        )
    return out


@app.route("/")
@app.route("/liderlik")
def liderlik():
    return render_template("liderlik_tablosu_v3.html", liste=get_leaderboard())


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5001, debug=True)
