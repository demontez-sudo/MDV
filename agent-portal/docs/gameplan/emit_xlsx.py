"""The review workbook: every date, owner, amount and plan in one file."""
from datetime import timedelta
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill, Border, Side
from openpyxl.utils import get_column_letter
from calc import *
from roster import MODELS, SHOWS
import travel as T
import wellness as W
import owner as O

INK, GOLD, PAPER, SOFT = "1B1713", "D4B077", "FBF7F0", "F1E8D8"
HFONT = Font(name="Calibri", bold=True, color=GOLD, size=11)
HFILL = PatternFill("solid", fgColor=INK)
BODY = Font(name="Calibri", size=10.5)
BOLD = Font(name="Calibri", size=10.5, bold=True)
WRAP = Alignment(wrap_text=True, vertical="top")
HARD = PatternFill("solid", fgColor="F8E3DF")
BAND = PatternFill("solid", fgColor=PAPER)
INPUT = PatternFill("solid", fgColor="FFF4C7")
thin = Side(style="thin", color="E6DCCB")
BOX = Border(bottom=thin)


def sheet(wb, title, headers, rows, widths, freeze="A2", wrap_cols=(), money=(), datefmt=None, hard_col=None, filt=True):
    ws = wb.create_sheet(title)
    ws.append(headers)
    for c in range(1, len(headers) + 1):
        cell = ws.cell(1, c)
        cell.font, cell.fill, cell.alignment = HFONT, HFILL, Alignment(wrap_text=True, vertical="center")
    ws.row_dimensions[1].height = 30
    for r in rows:
        ws.append(r)
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    for row in ws.iter_rows(min_row=2):
        for c in row:
            c.font = BODY
            c.alignment = WRAP
            c.border = BOX
            if c.column in money:
                c.number_format = '"$"#,##0'
    if hard_col is not None:
        for row in ws.iter_rows(min_row=2):
            if row[hard_col - 1].value in ("HARD STOP", "Yes"):
                for c in row:
                    c.fill = HARD
    ws.freeze_panes = freeze
    if filt and rows:
        ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}{len(rows) + 1}"
    return ws


def et_of(day, time, tz):
    dd, tt = convert(day, time, tz, "ET")
    return f"{short_date(dd)} {clock(tt)}"


AUD = {"model": "Model", "staff": "Agent / team", "partner": "Mother agency"}
WHERE = {"model": "Model portal Gameplan + Agent Tasks", "staff": "Agent Tasks board (owner)", "partner": "Mother agency portal"}


def build_workbook(rows, path):
    tasks, events, master, targets = O.TASKS, O.EVENTS, O.MASTER, None
    wb = Workbook()
    wb.remove(wb.active)
    n_travel = sum(1 for m in MODELS if m["travel"])
    total = sum(m["cost"]["total"] for m in MODELS)

    # ------------------------------------------------------------------ Start here
    ws = wb.create_sheet("Start here")
    ws.sheet_view.showGridLines = False
    ws.column_dimensions["A"].width = 3
    ws.column_dimensions["B"].width = 34
    ws.column_dimensions["C"].width = 110
    lines = [
        ("Maison de Veux: 90-day gameplan", None, "title"),
        ("Block A: Sun Nov 8, 2026 to Fri Feb 5, 2027 (90 days). Block B (the next 90): Sat Feb 6 to Wed May 6, 2027.", None, "sub"),
        ("What this is", "One plan for Demontez, 4 team leads (Emma, Erica, Troy, Sophia), 35 models and their mother agencies. Every deadline has a date, a time and an owner. "
                        f"{len(rows):,} dated rows in the 'All deadlines' tab. The same plan is loaded into your DaySilk, the Agent portal Tasks board, each model's Gameplan and DaySilk calendar, and each mother agency's task list.", None),
        ("Time zones", "Model deadlines are 5:00 PM in the model's own time zone. Team and mother-agency deadlines are 12:00 PM ET unless the row says otherwise. Every row also shows the same moment in ET.", None),
        ("Anchor dates", "Paris Men's Jan 19-24 | Paris Haute Couture Jan 25-28 | NYFW Feb 10-16 (CFDA), Bureau Feb 11-14 | Paris Women's Mar 1-9, 2027. "
                         "Lagos cohort lands in Paris Sun Jan 10. NYFW cohort lands in New York Sat Jan 30.", None),
        ("Money headline", f"Estimated model travel and stay for the season: ${total:,} across {n_travel} traveling models (planning estimates, NOT quotes). "
                           "Biggest line: the 12 Lagos models staying in Paris Jan 10 to Mar 15 on one visa, about $8,000 each. US visa legal fees are quoted separately (Clara O-1 and others).", None),
        ("Decisions I need from you", "1) Lagos Paris stay: keep Jan 10 to Mar 15 (default) or send them home between shows (saves only about $620 each because the extra Lagos-Paris ticket costs nearly as much as 3 weeks of housing). "
                                      "2) Milan: which Lagos models sign in Milan (decide by Dec 4). 3) Paris booker or assistant: Erica carries 25 of 35 models; hire by Dec 11, start Jan 4. "
                                      "4) Fernanda Vega: your earlier note says she may be released for age; this plan follows your Nov 8 list. 5) Zhiyan Li is not on your Nov 8 list; not included.", None),
        ("Protections built in", "No weight or body-measurement targets for any model. Models share only 'cleared' or 'not cleared' for health, never results. Alex Nicola (15): guardian at every session and flight, pediatrician check-up, no skin actives without a doctor and a guardian, NY and Georgia work permits to confirm.", None),
        ("Not medical advice", "Skin and fueling plans are starter plans by climate, travel and show type. A licensed skin professional and a dietitian or doctor should review them. Your own plan: check with your doctor at the Nov 18 physical before the 210 lb push.", None),
        ("Tabs", "Master calendar | Demontez 90 days | Models | All deadlines | Test shoots | Visas | Travel & stay (+ Rates, change yellow cells) | Skin, diet, walk, health | Cadence & alerts | Next 90 days", None),
        ("How it loads", "Run the SQL files in order in the Supabase SQL Editor: 00 (your DaySilk), then 1 to 4 (models), then 5 (team + alerts). Each can be run twice safely.", None),
    ]
    r = 2
    for a, b, kind in lines:
        if kind == "title":
            ws.cell(r, 2, a).font = Font(name="Calibri", size=22, bold=True, color=INK)
            r += 1
        elif kind == "sub":
            ws.cell(r, 2, a).font = Font(name="Calibri", size=12, color="7A6A55")
            r += 2
        else:
            c1, c2 = ws.cell(r, 2, a), ws.cell(r, 3, b)
            c1.font, c2.font = Font(name="Calibri", bold=True, size=11, color=INK), Font(name="Calibri", size=11)
            c1.alignment = c2.alignment = WRAP
            ws.row_dimensions[r].height = max(30, 15 * (len(b) // 105 + 1))
            r += 1

    # ------------------------------------------------------------------ Master calendar
    mrows = []
    anchors = [(SHOWS[k][1], "00:00", "All shows", f"{SHOWS[k][0]} starts ({short_date(SHOWS[k][1])} to {short_date(SHOWS[k][2])})") for k in "MHNW"]
    for day, tm, scope, title in anchors:
        mrows.append([day, dow(day), "All day", "", "", "Everyone", scope, "Fashion Week", title, ""])
    mrows.append([d("2027-01-10"), "Sun", "12:00 PM", "Paris", "6:00 AM ET", "Erica, Troy", "Lagos cohort (16 models)", "Model movement",
                  "Lagos cohort lands in Paris. Pickup, housing and arrival packs ready.", "HARD STOP"])
    mrows.append([d("2027-01-30"), "Sat", "12:00 PM", "New York", "12:00 PM ET", "Emma, Troy", "NYFW cohort", "Model movement",
                  "NYFW cohort lands in New York.", "HARD STOP"])
    for r in rows:
        if r["model"] is None:
            mrows.append([r["day"], dow(r["day"]), clock(r["time"]), "ET", "", r["owner"], "Team", r["area"], r["title"], "HARD STOP" if r["hard"] else ""])
    for m in O.MASTER:
        if m["owner"] == "Demontez" or m["owner"] == "Sophia":
            mrows.append([m["day"], dow(m["day"]), clock(m["time"]) if m["time"] != "00:00" else "All day", "ET", "", m["owner"], "Demontez", m["area"], m["title"], ""])
    mrows.append([d("2026-11-10"), "Tue", "12:00 PM", "ET", "", "Demontez", "Everyone", "Gameplan", "PLAN GOES LIVE in all three portals. Every person gets a notification.", "HARD STOP"])
    mrows.append([d("2027-02-05"), "Fri", "10:00 AM", "ET", "", "Demontez", "Everyone", "Gameplan", "Block A review. Block B (Feb 6 to May 6) published to all three portals.", "HARD STOP"])
    mrows.sort(key=lambda x: (x[0], x[2] if x[2] != "All day" else "00"))
    mrows = [x[:4] + x[5:] for x in mrows]
    sheet(wb, "Master calendar", ["Date", "Day", "Time", "Zone", "Owner", "Applies to", "Area", "What", "Hard stop"],
          mrows, [13, 6, 11, 8, 18, 22, 16, 90, 12], hard_col=9)
    for row in wb["Master calendar"].iter_rows(min_row=2, max_col=1):
        row[0].number_format = "ddd mmm d, yyyy"

    # ------------------------------------------------------------------ Demontez day by day
    loc_ranges = [("2026-11-08", "2026-11-08", "Fly New York to Paris (overnight)"), ("2026-11-09", "2026-11-14", "Paris"),
                  ("2026-11-15", "2026-11-15", "Fly Paris to Atlanta"), ("2026-11-16", "2026-11-29", "Atlanta"),
                  ("2026-11-30", "2026-12-05", "New York"), ("2026-12-06", "2026-12-06", "Fly New York to Paris (overnight)"),
                  ("2026-12-07", "2026-12-12", "Paris"), ("2026-12-13", "2026-12-13", "Fly Paris to Atlanta"),
                  ("2026-12-14", "2027-01-12", "Atlanta"), ("2027-01-13", "2027-01-13", "Fly Atlanta to Paris (overnight)"),
                  ("2027-01-14", "2027-01-28", "Paris"), ("2027-01-29", "2027-01-29", "Fly Paris to Atlanta"),
                  ("2027-01-30", "2027-02-05", "Atlanta")]
    def where(x):
        for a, b, w in loc_ranges:
            if d(a) <= x <= d(b):
                return w
    train = {0: "Upper push", 1: "Lower body and core", 2: "Conditioning, mobility + core finisher", 3: "Upper pull", 4: "Full-body circuit",
             5: "Group session + core finisher", 6: "Active recovery (long walk, stretch)"}
    focus = {0: "MDV heavy scouting 9-11:30; NY board call 1 PM; Casa 2 PM; Cavyre 4 PM", 1: "MDV; Casa; DENTAL PORTAL block 4 PM; 10 CAVYRE agency touches 12:45",
             2: "Models and mother agencies; Casa creative partners; Cavyre onboarding", 3: "CAVYRE walkthroughs 9:45; REAL ESTATE PORTAL block 4 PM; Casa cultural partners",
             4: "Gameplan huddle 9:00; follow-ups from Thursday; Casa past clients; scorecard", 5: "Group session, reset, family/social", 6: "Weigh-in, groceries + meal prep, week set-up"}
    by_day = {}
    for r in rows:
        by_day.setdefault(r["day"], []).append(r)
    mday = {}
    for m in O.MASTER:
        mday.setdefault(m["day"], []).append(m["title"])
    tgt = {d(a): w for a, w in [("2026-11-22", 222.7), ("2026-12-06", 220.4), ("2026-12-20", 218.1), ("2027-01-03", 215.8), ("2027-01-17", 213.5), ("2027-01-31", 211.2), ("2027-02-05", 210.0)]}
    drows = []
    for i in range(90):
        x = TODAY + timedelta(days=i)
        w = 225 - 15 * i / 89
        dl = by_day.get(x, [])
        hard = sum(1 for r in dl if r["hard"])
        drows.append([i + 1, x, dow(x), where(x), train[x.weekday()], focus[x.weekday()], round(w, 1),
                      "; ".join(mday.get(x, [])), len(dl), hard])
    sheet(wb, "Demontez 90 days", ["Day", "Date", "Weekday", "Where", "Training", "Company focus (existing daily blocks)", "Weight line (lb)",
                                   "Your tasks, holds and milestones", "Team/model deadlines due", "Hard stops due"],
          drows, [6, 13, 9, 30, 30, 62, 11, 80, 12, 10])
    for row in wb["Demontez 90 days"].iter_rows(min_row=2, min_col=2, max_col=2):
        row[0].number_format = "ddd mmm d"

    # ------------------------------------------------------------------ Models
    mr = []
    for m in MODELS:
        mr.append([m["name"], m["base"], TZ[m["tz"]][0], "Runway" if m["kind"] == "runway" else "Editorial / print", ", ".join(m["showlist"]) if m["showlist"] else "",
                   m["agent"], m["agent2"],
                   {"schengen": "Schengen visa: file Nov 13, decision Dec 21", "us_o1": "USA O-1: petition Nov 20, in hand Jan 22", "us": "US work visa: file Nov 27, in hand Jan 22",
                    "check_us": "Confirm US work authorization Nov 13", "check_eu": "Confirm Schengen entry status Nov 13", None: ""}[m["visa"]],
                   "Yes" if m["milan"] else "", m["tests"],
                   m["shoots"].get(1), m["shoots"].get(2), m["walkoff"], m["digitals"], m["arrive_first"], m["depart_last"],
                   m["cost"]["total"] if m["travel"] else 0, m["note"]])
    sheet(wb, "Models", ["Model", "Base", "Time zone", "Type", "Shows", "Agent", "Backup agent", "Visa", "May sign in Milan", "Test shoots", "Test shoot 1",
                         "Test shoot 2", "Walk-off", "Digitals", "Arrives", "Departs", "Travel estimate (USD)", "Notes"],
          mr, [24, 12, 12, 16, 46, 9, 11, 40, 9, 8, 13, 13, 13, 13, 13, 13, 14, 60], money=(17,), freeze="B2")
    for row in wb["Models"].iter_rows(min_row=2, min_col=11, max_col=16):
        for c in row:
            c.number_format = "mmm d, yyyy"

    # ------------------------------------------------------------------ All deadlines
    ar = []
    for r in rows:
        ar.append([r["day"], dow(r["day"]), clock(r["time"]), TZ[r["tz"]][0], et_of(r["day"], r["time"], r["tz"]), r["model"] or "Team",
                   r["owner"], AUD[r["audience"]], r["area"], r["title"], "Calendar event" if r["kind"] == "event" else "Task",
                   "HARD STOP" if r["hard"] else "", (WHERE[r["audience"]] if r["kind"] == "task" else "Model DaySilk + calendar")])
    sheet(wb, "All deadlines", ["Date", "Day", "Time", "Zone", "Same moment in ET", "Model", "Owner", "For", "Area", "What", "Type", "Hard stop", "Shows up in"],
          ar, [13, 6, 10, 12, 20, 22, 20, 14, 12, 80, 14, 12, 34], hard_col=12)
    for row in wb["All deadlines"].iter_rows(min_row=2, min_col=1, max_col=1):
        row[0].number_format = "ddd mmm d, yyyy"

    # ------------------------------------------------------------------ Test shoots
    byid = {r["id"]: r for r in rows}
    tr = []
    for m in sorted(MODELS, key=lambda m: min(m["shoots"].values())):
        for n, Tday in sorted(m["shoots"].items()):
            def g(code):
                r = byid.get(f"g90:{m['slug']}:TS{n}{code}")
                return f"{short_date(r['day'])} {clock(r['time'])} {TZ[r['tz']][0]}" if r else ""
            tr.append([Tday, dow(Tday), m["name"], m["base"], n, m["agent"], g("-team"), g("-concept"), g("-callsheet"), g("-confirm"), "9:00 AM to 5:00 PM " + TZ[m["tz"]][0],
                       g("-selects"), g("-approve"), g("-retouch"), g("-package")])
    sheet(wb, "Test shoots", ["Shoot date", "Day", "Model", "Base", "Shoot #", "Agent", "Agent locks team (HARD)", "Mother agency approves concept", "Agent sends call sheet",
                              "Model confirms", "Shoot day", "Agent sends selects", "Model + mother agency approve", "Retouched finals (HARD)", "Package out (HARD)"],
          tr, [13, 6, 24, 12, 7, 9, 26, 26, 26, 26, 26, 26, 28, 26, 26], freeze="D2")
    for row in wb["Test shoots"].iter_rows(min_row=2, min_col=1, max_col=1):
        row[0].number_format = "ddd mmm d, yyyy"

    # ------------------------------------------------------------------ Visas
    vr = []
    for m in MODELS:
        if not m["visa"]:
            continue
        def g(code):
            r = byid.get(f"g90:{m['slug']}:{code}")
            return f"{short_date(r['day'])} {clock(r['time'])} {TZ[r['tz']][0]}" if r else ""
        vr.append([m["name"], m["base"], m["agent"], {"schengen": "Schengen (France)", "us_o1": "USA O-1", "us": "US work visa (type to confirm)", "check_us": "US: confirm if needed",
                                                      "check_eu": "Schengen: confirm entry status"}[m["visa"]], g("V1"), g("V2"), g("V3"), g("V4"), g("V5"), g("V6"), g("V7"), g("TR-tix"),
                   "Yes" if m["milan"] else ""])
    sheet(wb, "Visas", ["Model", "Base", "Agent", "Visa", "V1 passport / evidence / status", "V2 pack or counsel", "V3 filed", "V4 status check", "V5 DECISION DEADLINE",
                        "V6 interview or passport back", "V7 visa in passport", "Tickets issued", "Milan?"], vr, [24, 12, 9, 28, 26, 26, 26, 26, 26, 26, 26, 26, 8], freeze="B2")

    # ------------------------------------------------------------------ Rates + Travel & stay
    wr = wb.create_sheet("Rates")
    wr.append(["Key", "What", "USD"])
    for c in range(1, 4):
        wr.cell(1, c).font, wr.cell(1, c).fill = HFONT, HFILL
    ratecell = {}
    rr = 2
    for grp in ("flight", "night", "perdiem", "other"):
        for k, (desc, val) in T.RATES[grp].items():
            key = k if grp in ("flight",) else f"{grp}:{k}"
            wr.cell(rr, 1, key)
            wr.cell(rr, 2, desc)
            wr.cell(rr, 3, val)
            wr.cell(rr, 3).fill = INPUT
            if grp == "other" and k == "contingency":
                wr.cell(rr, 3).number_format = "0%"
            else:
                wr.cell(rr, 3).number_format = '"$"#,##0'
            ratecell[key] = f"Rates!$C${rr}"
            rr += 1
    wr.cell(rr + 1, 1, "PLANNING ESTIMATES, NOT QUOTES. Troy replaces the yellow cells with real quotes by Dec 2; every model's total on the next tab recalculates.").font = BOLD
    wr.column_dimensions["A"].width = 22
    wr.column_dimensions["B"].width = 80
    wr.column_dimensions["C"].width = 12
    last_rate_row = rr - 1

    hdr = ["Model", "Base", "Shows", "Itinerary", "Route 1", "Qty 1", "Route 2", "Qty 2", "Paris nights", "Paris trips", "NY nights", "NY trips", "Guardian x",
           "Schengen visa?", "Flights", "Housing", "Meals + transport", "Airport transfers", "Visa + insurance", "Contingency", "TOTAL TO APPROVE", "Care allowance (optional)", "Milan add-on (if signed)"]
    wt = wb.create_sheet("Travel & stay")
    wt.append(hdr)
    for c in range(1, len(hdr) + 1):
        wt.cell(1, c).font, wt.cell(1, c).fill, wt.cell(1, c).alignment = HFONT, HFILL, Alignment(wrap_text=True, vertical="center")
    wt.row_dimensions[1].height = 42
    rowi = 2
    first_row = 2
    for m in MODELS:
        if not m["travel"]:
            continue
        it = m["itin"]
        legs = it["legs"]
        pn = sum(T.nights(g) for g in legs if g["city"] == "Paris")
        pt = sum(1 for g in legs if g["city"] == "Paris")
        nn = sum(T.nights(g) for g in legs if g["city"] == "New York")
        nt = sum(1 for g in legs if g["city"] == "New York")
        routes = it["flights"] + [("", 0)] * (2 - len(it["flights"]))
        itin = "; ".join(f"{g['city']} {short_date(g['arrive'])} to {short_date(g['depart'])}" for g in legs)
        r = rowi
        wt.append([m["name"], m["base"], m["shows"], itin, routes[0][0], routes[0][1], routes[1][0], routes[1][1], pn, pt, nn, nt, 2 if m["minor"] else 1,
                   1 if m["visa"] == "schengen" else 0])
        L = lambda col: f"{col}{r}"
        wt[L("O")] = f'=IFERROR(VLOOKUP(E{r},Rates!$A$2:$C${last_rate_row},3,FALSE),0)*F{r}+IFERROR(VLOOKUP(G{r},Rates!$A$2:$C${last_rate_row},3,FALSE),0)*H{r}'
        wt[L("P")] = f'=(I{r}*{ratecell["night:Paris"]}+K{r}*{ratecell["night:New York"]})*M{r}'
        wt[L("Q")] = f'=((I{r}+J{r})*{ratecell["perdiem:Paris"]}+(K{r}+L{r})*{ratecell["perdiem:New York"]})*M{r}'
        wt[L("R")] = f'=(J{r}+L{r})*{ratecell["other:transfer"]}*M{r}'
        wt[L("S")] = f'=N{r}*{ratecell["other:schengen"]}'
        wt[L("T")] = f'=ROUND(SUM(O{r}:S{r})*{ratecell["other:contingency"]},0)'
        wt[L("U")] = f'=SUM(O{r}:T{r})'
        wt[L("V")] = f'={ratecell["other:care"]}'
        wt[L("W")] = f'={ratecell["other:milan_leg"]}' if m["milan"] else 0
        rowi += 1
    last = rowi - 1
    wt.cell(rowi, 1, "TOTAL").font = BOLD
    for col in "OPQRSTUVW":
        wt[f"{col}{rowi}"] = f"=SUM({col}{first_row}:{col}{last})"
        wt[f"{col}{rowi}"].font = BOLD
    for row in wt.iter_rows(min_row=2, max_row=rowi):
        for c in row:
            if not c.font.bold:
                c.font = BODY
            c.border = BOX
            if c.column >= 15:
                c.number_format = '"$"#,##0'
            if c.column == 4:
                c.alignment = WRAP
    for c in range(5, 15):
        for rr_ in range(2, last + 1):
            wt.cell(rr_, c).fill = INPUT
    for i, w in enumerate([24, 12, 8, 60, 14, 6, 14, 6, 8, 7, 8, 7, 9, 9, 11, 11, 12, 11, 11, 11, 15, 13, 13], 1):
        wt.column_dimensions[get_column_letter(i)].width = w
    wt.freeze_panes = "B2"
    wt.cell(rowi + 2, 1, "Yellow cells are inputs (routes, nights, trips). US visa legal fees are quoted separately by counsel and are not in these totals: Clara (O-1) and any model that needs a US work visa.").font = BOLD
    wt.cell(rowi + 3, 1, "Alex Nicola (15): Guardian x = 2 doubles housing, meals and transfers; his flights list already counts two tickets.").font = BODY
    wt.cell(rowi + 4, 1, "Not included: Feuza Diouf (lives in Paris) and the 6 editorial models (Block B).").font = BODY

    # ------------------------------------------------------------------ Skin, diet, walk, health
    sr = []
    for m in MODELS:
        sr.append([m["name"], m["base"], m["agent"], W.skin_plan(m), W.fuel_plan(m), W.walk_plan(m), W.health_layout(m)])
    sheet(wb, "Skin, diet, walk, health", ["Model", "Base", "Agent", "Skin plan (starter; reviewed by a licensed skin professional)", "Fueling plan (not a diet)", "Walk or pose practice", "Health layout"],
          sr, [24, 12, 9, 80, 80, 60, 60], freeze="B2")
    ws2 = wb["Skin, diet, walk, health"]
    for row in ws2.iter_rows(min_row=2):
        ws2.row_dimensions[row[0].row].height = 190

    # ------------------------------------------------------------------ Cadence & alerts
    cr = [[a, b, c] for a, b, c in O.CADENCE]
    cr.append(["", "", ""])
    cr.append(["ALERTS", "What happens", "Who gets it"])
    cr += [[a, b, c] for a, b, c in O.ALERTS]
    sheet(wb, "Cadence & alerts", ["Rhythm", "What", "Who"], cr, [34, 110, 40], filt=False)

    # ------------------------------------------------------------------ Next 90
    nb = [
        ["Sat Feb 6", "Block B starts", "Review Block A results; publish Block B tasks to all three portals", "Demontez"],
        ["Feb 7-17", "NYFW (CFDA Feb 10-16, Bureau Feb 11-14)", "Aidan, Alex, Clara, Lance, Mairbek, Sae, Soni, Sullivan, Violeta. Casa de Veux: 10 meetings. CAVYRE demos in NY.", "Emma, Demontez"],
        ["Feb 12 (draft)", "Paris Women's roster lock", "Final list for Mar 1-9: Lagos H/M/W group, Akvile, Clara, Fernanda, Feuza, Histria, Katalina, Soni, Sullivan, Violeta", "Erica"],
        ["Feb 20", "Women's cohort digitals refresh booked", "Arrive Feb 26; digitals Mar 1 morning is too late, so book Feb 27", "Erica, Troy"],
        ["Feb 26-Mar 10", "Paris Women's (Mar 1-9)", "Same cadence as January: walk-off, digitals, skin check, daily call sheets", "Erica"],
        ["Mar 15 - May 31", "Spring editorial window", "Krishita, Lauryn, Tosin, Paula, Vayla, Soni, Violeta. Visa for spring starts Jan 31.", "Emma, Erica"],
        ["By Mar 14", "CAVYRE season proof", "Agencies run the season on CAVYRE; case study 1 published", "Demontez"],
        ["By May 6", "Block B close", "12 agencies by Jun 30 target tracked; Dental and Real Estate portals: pilots reviewed", "Demontez"],
        ["Body", "Block B body goal", "Hold 210 lb or go to 200; waist down; strength phase continues to Mar 31", "Demontez"],
    ]
    sheet(wb, "Next 90 days", ["When", "Milestone", "What", "Owner"], nb, [18, 40, 100, 20], filt=False)

    order = ["Start here", "Master calendar", "Demontez 90 days", "Models", "All deadlines", "Test shoots", "Visas", "Travel & stay", "Rates",
             "Skin, diet, walk, health", "Cadence & alerts", "Next 90 days"]
    wb._sheets = [wb[n] for n in order]
    wb.save(path)
    return dict(last_travel_row=last, total_row=rowi)
