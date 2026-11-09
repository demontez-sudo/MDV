import os, sys, json
sys.path.insert(0, os.path.dirname(__file__))
import plan, owner, emit_sql, emit_xlsx
from roster import MODELS

OUT = os.path.join(os.path.dirname(__file__), "out")
os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT):
    if f.endswith(".sql") or f.endswith(".xlsx"):
        os.remove(os.path.join(OUT, f))

rows = plan.build()
tasks, events, master, targets = owner.build()
open(f"{OUT}/2026-11-08-gameplan-0-demontez-daysilk.sql", "w").write(emit_sql.boss_sql(tasks, events))
for n, s in emit_sql.portal_sql_files(rows):
    open(f"{OUT}/{n}", "w").write(s)
info = emit_xlsx.build_workbook(rows, f"{OUT}/MDV-90-Day-Gameplan-2026-11-08.xlsx")
json.dump([m["name"] for m in MODELS], open(f"{OUT}/names.json", "w"))
total = sum(m["cost"]["total"] for m in MODELS)
print("rows", len(rows), "tasks", len(tasks), "events", len(events), "total travel", total, info)
json.dump({m["name"]: m["cost"]["total"] for m in MODELS if m["travel"]}, open(f"{OUT}/py_totals.json", "w"))
