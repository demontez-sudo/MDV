"""Builds every dated, owned deadline for the 90-day gameplan (Nov 8, 2026 - Feb 5, 2027) and the hand-off to Block B."""
from datetime import timedelta
from calc import *
from roster import MODELS, SHOWS, TEAM
import travel
import wellness as W

KEY = "g90"                      # prefix on every id / metadata key so a re-run updates instead of duplicating
PUBLISH = d("2026-11-10")        # day the plan goes live in all three portals
ROWS = []                        # every deliverable row (tasks and events)


def due_text(day, time, tz):
    return label_both(day, time, tz)


def row(model, code, audience, owner, title, desc, day, time, tz, kind="task", ttype="agent", hard=False,
        area="Gameplan", end=None, location=None, etype=None, size=None, extra=None):
    r = dict(id=f"{KEY}:{(model['slug'] if model else 'team')}:{code}", model=model["name"] if model else None,
             audience=audience, owner=owner, title=title, desc=desc, day=day, time=time, tz=tz, kind=kind,
             ttype=ttype, hard=hard, area=area, end=end, location=location, etype=etype or "deadline",
             utc=iso_utc(day, time, tz), when=due_text(day, time, tz))
    if extra:
        r.update(extra)
    ROWS.append(r)
    return r


def clampd(x, lo=d("2026-11-12")):
    return x if x >= lo else lo


# ---------------------------------------------------------------- per-model key dates
def model_dates(m):
    sh = m["shows"]
    m["first_show"] = min((SHOWS[s][1] for s in sh), default=None)
    m["showlist"] = [SHOWS[s][0] for s in sh]
    if m["kind"] == "runway":
        if m["arrive_first"]:
            a = m["arrive_first"]
            if m["minor"]:
                m["walkoff"] = d("2027-02-09")
                m["digitals"] = d("2027-01-30")
            else:
                m["walkoff"] = next_bd(a + timedelta(days=1))
                m["digitals"] = min(add_bd(m["walkoff"], 2), prev_bd(m["first_show"] - timedelta(days=3)))
        else:
            m["walkoff"] = next_bd(m["first_show"] - timedelta(days=8))
            m["digitals"] = add_bd(m["walkoff"], 2)
        m["skin3"] = max(snap_monday_back(m["first_show"] - timedelta(days=14)), d("2027-01-04"))
    else:
        m["walkoff"] = m["digitals"] = None
        m["skin3"] = d("2027-01-11")
    m["lt"] = m["tz"]


# ---------------------------------------------------------------- test shoot scheduling
LAGOS_R1 = ["2026-11-30", "2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04"]
LAGOS_R2 = ["2026-12-14", "2026-12-15", "2026-12-16", "2026-12-17", "2026-12-18"]
FIXED = {   # name: (round1, round2) ; Aidan has one test only
    "Sullivan Jordan": ("2026-11-19", "2027-01-06"), "Alex Nicola": ("2026-11-21", "2027-01-09"),
    "Lance Valadie": ("2026-12-02", "2027-01-05"), "Aidan Jake": ("2026-12-08", None),
    "Akvile Kerpauskaite": ("2026-12-08", "2027-01-05"), "Katalina Arango": ("2026-12-08", "2027-01-05"),
    "Clara Wahlqvist": ("2026-12-09", "2027-01-06"), "Feuza Diouf": ("2026-12-03", "2027-01-07"),
    "Mairbek Benoy": ("2026-11-23", "2027-01-08"), "Histria Soler": ("2026-12-04", "2027-01-07"),
    "Fernanda Vega": ("2026-12-07", "2027-01-11"), "Krishita Shetty": ("2026-12-10", "2027-01-12"),
    "Paula Ciaroz": ("2026-12-01", "2027-01-13"), "Sae Kashiwabara": ("2026-12-09", "2027-01-12"),
    "Soni Lobodiuk": ("2026-12-10", "2027-01-13"), "Vayla Bovykina": ("2026-12-11", "2027-01-14"),
    "Violeta Rodo": ("2026-12-02", "2027-01-14"),
}
CITY_LABEL = {"Lagos": "Lagos studio", "Amsterdam": "Amsterdam studio", "Paris": "Paris studio", "London": "London studio",
              "Spain": "Spain studio", "Mexico City": "Mexico City studio", "Atlanta": "Atlanta studio",
              "New York": "New York studio", "Mumbai": "Mumbai studio", "Lima": "Lima studio", "Seoul": "Seoul studio"}


def schedule_tests():
    lagos = [m for m in MODELS if m["base"] == "Lagos"]
    for rnd, pool in ((1, LAGOS_R1), (2, LAGOS_R2)):
        order = lagos if rnd == 1 else list(reversed(lagos))
        # keep the Adegoke pair together: order them side by side
        names = [m["name"] for m in order]
        if "Dorcas Adegoke" in names and "Deborah Adegoke" in names:
            order = [m for m in order if m["pair"] is None]
            pair = [m for m in lagos if m["pair"]]
            order.insert(5 if rnd == 1 else 4, pair[0])
            order.insert(6 if rnd == 1 else 5, pair[1])
        slots = []
        for dd in pool:
            slots += [dd] * 4
        for m, dd in zip(order, slots):
            m.setdefault("shoots", {})[rnd] = d(dd)
    for m in MODELS:
        if m["name"] in FIXED:
            r1, r2 = FIXED[m["name"]]
            m.setdefault("shoots", {})
            m["shoots"][1] = d(r1)
            if r2:
                m["shoots"][2] = d(r2)
    for m in MODELS:
        assert len(m["shoots"]) == m["tests"], (m["name"], m["shoots"])
        for x in m["shoots"].values():
            assert x.weekday() < 5 or m["name"] == "Alex Nicola", (m["name"], x)
            assert x not in HOLIDAYS


def shoot_rows(m):
    mp = m["lt"]
    for n, T in sorted(m["shoots"].items()):
        code = f"TS{n}"
        loc = CITY_LABEL[m["base"]]
        team = clampd(T - timedelta(days=14))
        row(m, f"{code}-team", "staff", m["agent"], f"Test shoot {n}: lock photographer, MUA, stylist and studio ({m['first']})",
            f"Shoot is {long_date(T)}, 9:00 AM {TZ[mp][0]} at {loc}. Book photographer, makeup, hair, stylist and studio, send the "
            f"mood board to {m['first']} and the mother agency, and confirm wardrobe. HARD STOP: shoot cannot slip after this time.",
            team, "12:00", "ET", ttype="testing", hard=True, area="Test shoot")
        con = T - timedelta(days=7)
        con = prev_bd(con) if not is_bd(con) else con
        row(m, f"{code}-concept", "partner", "Mother agency", f"Approve test shoot {n} concept ({m['name']})",
            f"Please approve or comment on the concept and looks for the test shoot on {long_date(T)}.",
            clampd(con), "12:00", "ET", ttype="testing", area="Test shoot")
        cs = prev_bd(T - timedelta(days=3))
        row(m, f"{code}-callsheet", "staff", m["agent"], f"Test shoot {n}: send call sheet ({m['first']})",
            f"Call sheet to {m['first']} and mother agency: address, call time 9:00 AM {TZ[mp][0]}, wardrobe, skin prep and what to eat.",
            clampd(cs), "12:00", "ET", ttype="testing", area="Test shoot")
        cf = prev_bd(T - timedelta(days=2))
        row(m, f"{code}-confirm", "model", m["name"], f"Confirm your test shoot {n} call sheet",
            f"Tap Complete when you have read the call sheet and confirm you can be there at 9:00 AM on {long_date(T)}. "
            f"Skin prep: no new products, no waxing, sleep 8 hours.",
            clampd(cf), "17:00", mp, ttype="testing", area="Test shoot")
        row(m, code, "model", m["name"], f"Test shoot {n}: {m['first']}",
            f"Call time 9:00 AM, wrap about 5:00 PM. {loc}. Bring a clean face, hair as discussed, and snacks.",
            T, "09:00", mp, kind="event", etype="test", end="17:00", location=loc, area="Test shoot")
        sel = add_bd(T, 2)
        row(m, f"{code}-selects", "staff", m["agent"], f"Test shoot {n}: send selects ({m['first']})",
            "Send the first selects to the model and mother agency for approval.", sel, "17:00", "ET",
            ttype="testing", area="Test shoot")
        ap = add_bd(T, 4)
        row(m, f"{code}-approve", "model", m["name"], f"Approve your test shoot {n} selects",
            "Pick your favorites and tell your agent what you do not want used. Tap Complete when done.",
            ap, "17:00", mp, ttype="testing", area="Test shoot")
        row(m, f"{code}-papprove", "partner", "Mother agency", f"Approve test shoot {n} selects ({m['name']})",
            "Approve the selects or send notes so the retouch can start.", ap, "12:00", "ET", ttype="testing",
            area="Test shoot")
        rt = add_bd(T, 7)
        row(m, f"{code}-retouch", "staff", m["agent"], f"Test shoot {n}: retouched finals delivered ({m['first']})",
            "Retouched finals saved to the model's media in the portal.", rt, "17:00", "ET", ttype="testing",
            hard=True, area="Test shoot")
        pk = add_bd(T, 9)
        row(m, f"{code}-package", "staff", m["agent"], f"Test shoot {n}: add to book and push the package ({m['first']})",
            "Add the images to the book and website, then send the package to clients and mother agencies.",
            pk, "17:00", "ET", ttype="testing", hard=True, area="Test shoot")


# ---------------------------------------------------------------- everything else per model
def model_rows(m):
    mp, first, nm = m["lt"], m["first"], m["name"]
    runway = m["kind"] == "runway"
    ag = m["agent"]

    row(m, "G1", "model", nm, "Confirm your gameplan and shows",
        f"Open your gameplan, read the dates, and tap Complete to confirm. Shows: {', '.join(m['showlist']) or 'editorial and print focus'}.",
        d("2026-11-13"), "17:00", mp, area="Gameplan")
    row(m, "PA1", "partner", "Mother agency", f"Confirm representation and show list ({nm})",
        "Confirm who represents the model for each market and which shows are approved." +
        (" If the model is signing in Milan, tell us by Dec 4." if m["milan"] else ""),
        d("2026-11-18"), "12:00", "ET", area="Gameplan")
    row(m, "PA3", "partner", "Mother agency", f"Sign off the gameplan and test shoot plan ({nm})",
        "Review the gameplan, test shoot dates and image rules, then approve or comment.",
        d("2026-11-25"), "12:00", "ET", area="Gameplan")

    # skin
    skin_dates = {1: d("2026-11-16"), 2: d("2026-12-14"), 3: m["skin3"], 4: d("2027-02-01")}
    names = {1: "baseline", 2: "progress", 3: "pre-show" if runway else "spring", 4: "check"}
    for k, dd in skin_dates.items():
        row(m, f"SK{k}", "model", nm, f"Skin submission #{k} ({names[k]}): photos due",
            f"{W.SKIN_SUBMISSION} Due {due_text(dd, '17:00', mp)}.", dd, "17:00", mp, ttype="progress_submission", area="Skin")
        row(m, f"SK{k}e", "model", nm, f"Skin submission #{k} due", "Upload your skin photos in the portal today.",
            dd, "17:00", mp, kind="event", etype="deadline", area="Skin", extra=dict(event_kind="model meeting"))
    row(m, "SKP", "model", nm, "Start your skin plan: read and confirm",
        W.skin_plan(m), d("2026-11-23"), "17:00", mp, ttype="progress_submission", area="Skin")
    # diet
    row(m, "FUEL", "model", nm, "Your fueling plan: read it and send allergies or food limits",
        W.fuel_plan(m), d("2026-11-25"), "17:00", mp, ttype="training", area="Diet")
    # walk or posing
    if runway:
        wk = {1: d("2026-11-23"), 2: d("2026-12-14"), 3: m["skin3"]}
        for k, dd in wk.items():
            row(m, f"WK{k}", "model", nm, f"Walk video #{k}: send your 20-second walk",
                f"{W.walk_plan(m)} Due {due_text(dd, '17:00', mp)}.", dd, "17:00", mp, ttype="training", area="Walk")
            row(m, f"WK{k}e", "model", nm, f"Walk practice video #{k} due", "Send your walk video in the portal today.",
                dd, "17:00", mp, kind="event", etype="training", area="Walk", extra=dict(event_kind="walk practice"))
        row(m, "WKOFF", "model", nm, f"Walk-off with your agent ({first})",
            "In-person walk check with your agent: straight walk, turns, pace and shoes. About 45 minutes.",
            m["walkoff"], "10:00", "CET" if m["walkoff"] < d("2027-02-01") and m["first_show"] < d("2027-02-01") else "ET",
            kind="event", etype="training", end="10:45", location="Paris" if m["first_show"] < d("2027-02-01") else "New York",
            area="Walk", extra=dict(event_kind="walk practice"))
    else:
        for k, dd in {1: d("2026-11-23"), 2: d("2026-12-14")}.items():
            row(m, f"PO{k}", "model", nm, f"Pose sheet #{k}: send your 10 poses",
                f"{W.walk_plan(m)} Due {due_text(dd, '17:00', mp)}.", dd, "17:00", mp, ttype="training", area="Walk")

    # health layout
    row(m, "H1", "model", nm, "Health intake: allergies, food limits, injuries",
        "Fill in the short intake form: allergies, food limits, injuries and anything you want us to plan around. "
        "You choose what to share. We never ask for weight or body-measurement targets.", d("2026-11-20"), "17:00", mp,
        ttype="progress_submission", area="Health")
    row(m, "H2", "model", nm, "Physical exam and bloodwork: done and cleared",
        W.health_layout(m) + f" Due {due_text(d('2026-12-18'), '17:00', mp)}.", d("2026-12-18"), "17:00", mp,
        ttype="progress_submission", hard=True, area="Health")
    row(m, "H3", "model", nm, "Dental cleaning and vision check: done",
        "Book both and tell your agent 'done'. Bring glasses or contact prescriptions if you use them.",
        d("2026-12-18"), "17:00", mp, ttype="progress_submission", area="Health")
    row(m, "H2e", "model", nm, "Health layout due: physical, dental, vision", "Tell your agent you are cleared.",
        d("2026-12-18"), "17:00", mp, kind="event", etype="deadline", area="Health", extra=dict(event_kind="model meeting"))
    row(m, "CK1", "model", nm, "Mid-season check-in call with your agent",
        "30 minutes: how you feel, sleep, food, skin, walk and travel. Bring questions.", d("2027-01-06"), "17:00", mp,
        kind="event", etype="meeting", end="17:30", area="Health", extra=dict(event_kind="model meeting"))

    # digitals
    if runway:
        dg = m["digitals"]
        loc = "Paris" if dg < d("2027-02-01") and m["itin"]["legs"] and m["itin"]["legs"][0]["city"] == "Paris" else (
            "Atlanta" if m["minor"] else ("New York" if m["itin"]["legs"] and m["itin"]["legs"][0]["city"] == "New York" else "Paris"))
        zone = "ET" if loc in ("New York", "Atlanta") else "CET"
        row(m, "DG", "model", nm, f"Digitals session ({first})",
            "Fresh digitals for casting: clean face, fitted plain clothes, hair back, no jewelry. Front, profile, back, "
            "full length, smile and walk video.", dg, "11:00", zone, kind="event", etype="test", end="13:00",
            location=loc, area="Digitals", extra=dict(event_kind="digitals"))
        row(m, "DGu", "staff", ag, f"Digitals up and comp card updated ({nm})",
            "Upload the digitals, update the comp card and measurements, and tell the mother agency.",
            add_bd(dg, 2), "17:00", "ET", ttype="progress_submission", hard=True, area="Digitals")
        row(m, "DGs", "staff", ag, f"Digitals sent to mother agency and top clients ({nm})",
            "Send the new digitals to the mother agency and the casting directors on this season's list.",
            add_bd(dg, 3), "17:00", "ET", ttype="casting_show", area="Digitals")

    # travel
    if m["travel"]:
        it = m["itin"]
        amt = m["cost"]["total"]
        lines = "; ".join(f"{g['city']} {short_date(g['arrive'])} to {short_date(g['depart'])} ({g['why']})" for g in it["legs"])
        c = m["cost"]
        row(m, "TR-offer", "staff", "Troy", f"Send travel and stay offer to {nm} and mother agency",
            f"Itinerary: {lines}. Estimated total ${amt:,} (flights ${c['flights']:,}, housing ${c['housing']:,}, meals and transport "
            f"${c['perdiem']:,}, transfers ${c['transfers']:,}, visa and insurance ${c['visa']:,}, 10% contingency). Replace the estimate "
            f"with real quotes first.", d("2026-12-07"), "12:00", "ET", ttype="visa_travel", hard=True, area="Travel")
        row(m, "TR-approve", "model", nm, f"Approve your travel and stay plan: about ${amt:,}",
            f"Your season itinerary: {lines}. Estimated total ${amt:,}: flights ${c['flights']:,}, housing ${c['housing']:,}, meals and local "
            f"transport ${c['perdiem']:,}, airport transfers ${c['transfers']:,}, visa and insurance ${c['visa']:,}, contingency "
            f"${c['contingency']:,}. This is an estimate until tickets are booked; final numbers are shown before anything is charged. "
            f"Tap Complete to approve, or request a change with a note. Due {due_text(d('2026-12-11'), '17:00', mp)}.",
            d("2026-12-11"), "17:00", mp, ttype="visa_travel", hard=True, area="Travel",
            extra=dict(amount=amt))
        row(m, "TR-approve-e", "model", nm, "Travel plan approval due", f"Approve the travel and stay estimate (about ${amt:,}).",
            d("2026-12-11"), "17:00", mp, kind="event", etype="deadline", area="Travel", extra=dict(event_kind="travel"))
        row(m, "PA4", "partner", "Mother agency", f"Co-sign travel advance and recoup terms ({nm})",
            f"Estimated travel and stay about ${amt:,}. Please confirm you accept the advance and how it is recouped.",
            d("2026-12-11"), "12:00", "ET", ttype="visa_travel", area="Travel")
        row(m, "TR-fund", "staff", "Sophia", f"Release travel advance after approvals ({nm})",
            f"Only after the model and mother agency approve. Estimated ${amt:,}.", d("2026-12-14"), "12:00", "ET",
            ttype="visa_travel", area="Travel")
        tick = d("2026-12-30") if m["visa"] == "schengen" else (d("2027-01-25") if m["visa"] in ("us_o1", "us") else d("2026-12-18"))
        if m["visa"] == "schengen":
            tick_d = d("2026-12-30")
        elif m["visa"] in ("us_o1", "us", "check_us"):
            tick_d = d("2027-01-25")
        else:
            tick_d = d("2026-12-18")
        row(m, "TR-tix", "staff", "Troy", f"Tickets issued for {nm}",
            "Book flights only when the visa (if needed) is in the passport and the travel plan is approved. Send e-tickets to the model and mother agency.",
            tick_d, "12:00", "ET", ttype="visa_travel", hard=True, area="Travel")
        a = m["arrive_first"]
        row(m, "TR-house", "staff", "Troy", f"Housing confirmed and address sent ({nm})",
            "Confirm the bed, key pickup and house rules and send them to the model and mother agency.",
            prev_bd(a - timedelta(days=6)), "12:00", "ET", ttype="visa_travel", area="Travel")
        row(m, "PA6", "partner", "Mother agency", f"Confirm arrival date and emergency contact ({nm})",
            f"Arrival {long_date(a)}. Confirm the contact and, for anyone under 18, the guardian.",
            prev_bd(a - timedelta(days=6)), "12:00", "ET", ttype="visa_travel", area="Travel")
        row(m, "TR-ready", "model", nm, "Pre-flight check: documents, health and packing",
            "Passport, visa, tickets, insurance card, prescriptions, charger, walking shoes and your skin kit. Confirm "
            "you are ready.", prev_bd(a - timedelta(days=3)), "17:00", mp, ttype="visa_travel", area="Travel")
        row(m, "TR-arr", "model", nm, f"Arrival: {first} lands",
            f"Landing in {it['legs'][0]['city']}. Airport pickup and address are in your gameplan.", a, "12:00",
            "CET" if it["legs"][0]["city"] == "Paris" else "ET", kind="event", etype="travel", area="Travel",
            location=it["legs"][0]["city"], extra=dict(event_kind="arrival"))
        if m["milan"]:
            pass

    # visas
    if m["visa"] == "schengen":
        row(m, "V1", "model", nm, "Passport check and scans",
            "Passport valid at least 6 months after your return with 2 blank pages. Upload a clear scan today.",
            d("2026-11-10"), "17:00", mp, ttype="visa_travel", hard=True, area="Visa")
        row(m, "V2", "staff", "Troy", f"Visa pack complete for {nm}",
            "Support letter, accommodation proof, travel insurance, finances, flight reservation, photos.",
            d("2026-11-11"), "12:00", "ET", ttype="visa_travel", hard=True, area="Visa")
        row(m, "PA2", "partner", "Mother agency", f"Send visa support documents ({nm})",
            "Invitation or agency letter and any contract pages needed for the Schengen application.",
            d("2026-11-11"), "12:00", "ET", ttype="visa_travel", hard=True, area="Visa")
        row(m, "V3", "model", nm, "Visa application filed and biometrics done",
            "Attend your visa centre appointment with every document. Tell your agent the moment it is done.",
            d("2026-11-13"), "17:00", mp, ttype="visa_travel", hard=True, area="Visa")
        row(m, "V3e", "model", nm, "Visa filing day", "Visa application and biometrics.", d("2026-11-13"), "10:00", mp,
            kind="event", etype="visa", end="12:00", area="Visa", extra=dict(event_kind="visa appointment"))
        row(m, "V4", "staff", "Troy", f"Visa status check #1 ({nm})", "Check the tracking. If the case is stuck, escalate to Demontez.",
            d("2026-12-01"), "12:00", "ET", ttype="visa_travel", area="Visa")
        row(m, "V5", "staff", "Troy", f"VISA DECISION DEADLINE ({nm})",
            "If there is no decision today, escalate to Demontez the same hour and switch to the fallback (Milan placement, or Women's only).",
            d("2026-12-21"), "12:00", "ET", ttype="visa_travel", hard=True, area="Visa")
        row(m, "V6", "model", nm, "Collect your passport and check the visa",
            "Check name, dates, number of entries and the dates you can stay. Send a photo of the visa page.",
            d("2026-12-28"), "17:00", mp, ttype="visa_travel", hard=True, area="Visa")
    elif m["visa"] in ("us_o1", "us"):
        o1 = m["visa"] == "us_o1"
        row(m, "V1", "model", nm, "Passport check and evidence pack" if o1 else "Passport check and visa documents",
            "Passport valid 6+ months after return. Send press, past work and references your attorney asked for." if o1 else
            "Passport valid 6+ months after return. Send the documents your attorney asked for.",
            d("2026-11-13"), "17:00", mp, ttype="visa_travel", hard=True, area="Visa")
        row(m, "V2", "staff", "Sophia", f"US counsel engaged and retainer paid ({nm})",
            "Engage the immigration attorney and agree the fee. The legal fee is quoted separately and is not part of the model's travel amount.",
            d("2026-11-13"), "12:00", "ET", ttype="visa_travel", hard=True, area="Visa")
        row(m, "V3", "staff", "Troy", f"US work visa {'O-1 petition' if o1 else 'filed'} ({nm})",
            "Petition or application filed with counsel; save the receipt number in the portal.",
            d("2026-11-20") if o1 else d("2026-11-27"), "12:00", "ET", ttype="visa_travel", hard=True, area="Visa")
        row(m, "V5", "staff", "Troy", f"US VISA DECISION DEADLINE ({nm})", "No decision by now: escalate to Demontez and counsel.",
            d("2026-12-18"), "12:00", "ET", ttype="visa_travel", hard=True, area="Visa")
        row(m, "V6", "staff", "Troy", f"US consular interview booked and done ({nm})", "Interview done and passport returned.",
            d("2027-01-15"), "12:00", "ET", ttype="visa_travel", hard=True, area="Visa")
        row(m, "V7", "staff", "Troy", f"US visa in the passport ({nm})", "Visa verified: name, dates, category. Then tickets.",
            d("2027-01-22"), "12:00", "ET", ttype="visa_travel", hard=True, area="Visa")
    elif m["visa"] in ("check_us", "check_eu"):
        us = m["visa"] == "check_us"
        row(m, "V1", "model", nm, "Tell us your passport and work-permit status",
            "Send your passport photo page and the entry or work permits you already hold." if us else
            "Send your passport photo page and any Schengen visa you already hold.", d("2026-11-13"), "17:00", mp,
            ttype="visa_travel", area="Visa")
        row(m, "V2", "staff", "Troy", f"Confirm {'US work authorization' if us else 'Schengen entry status'} ({nm})",
            "If something must be filed, file it by Nov 27 and add the case to the portal. If the model already has it, note the expiry.",
            d("2026-11-17"), "12:00", "ET", ttype="visa_travel", area="Visa")
        row(m, "V7", "staff", "Troy", f"Visa or authorization in hand ({nm})", "In the passport or confirmed valid for the whole trip.",
            d("2027-01-22") if us else d("2026-12-18"), "12:00", "ET", ttype="visa_travel", hard=True, area="Visa")

    # internal plan issuance (cohort-level tasks are added separately)
    shoot_rows(m)
    row(m, "PLAN", "staff", ag, f"Gameplan live for {nm}",
        "Check that the model sees the gameplan, the mother agency has partner tasks, and the DaySilk events appear.",
        d("2026-11-10"), "12:00", "ET", ttype="agent", hard=True, area="Gameplan")


# ---------------------------------------------------------------- cohort (team) tasks
def cohort_rows():
    by = {}
    for m in MODELS:
        by.setdefault(m["agent"], []).append(m)
    team_rows = []

    def agent_task(ag, code, title, desc, day, time, hard=False, ttype="agent", area="Gameplan", models=None):
        ms = models if models is not None else by[ag]
        names = ", ".join(x["name"] for x in ms)
        r = row(None, f"{code}-{ag.lower()}", "staff", ag, title + f" ({len(ms)} models)", f"{desc} Models: {names}.",
                day, time, "ET", ttype=ttype, hard=hard, area=area, extra=dict(models=[x["name"] for x in ms]))
        return r

    for ag in ("Emma", "Erica"):
        agent_task(ag, "SK1R", "Review skin submission #1", "Review each baseline set with the skin reviewer and note concerns.",
                   d("2026-11-19"), "12:00", area="Skin")
        agent_task(ag, "SK1I", "Issue skin plans", "Send each model their starter skin plan after review. No prescription products without a licensed provider.",
                   d("2026-11-20"), "12:00", hard=True, area="Skin")
        agent_task(ag, "FUELI", "Issue fueling plans", "Plans go out after reading the health intakes. No weight or measurement targets.",
                   d("2026-11-23"), "12:00", hard=True, area="Diet")
        agent_task(ag, "H1R", "Review health intakes", "Note allergies, food limits and injuries. Keep private details private.",
                   d("2026-11-24"), "12:00", area="Health")
        agent_task(ag, "WK1F", "Walk feedback round 1", "Written feedback and one drill per model.", d("2026-11-25"), "12:00", area="Walk",
                   models=[x for x in by[ag] if x["kind"] == "runway"])
        agent_task(ag, "SK2R", "Review skin submission #2", "Compare to the baseline. Escalate anything that got worse.",
                   d("2026-12-16"), "12:00", area="Skin")
        agent_task(ag, "WK2F", "Walk feedback round 2", "Written feedback; flag models who are not show-ready.", d("2026-12-16"), "12:00",
                   area="Walk", models=[x for x in by[ag] if x["kind"] == "runway"])
        agent_task(ag, "H2R", "Health clearances in", "Every model cleared, or a plan for who is not. Only 'cleared' or 'not cleared'.",
                   d("2026-12-21"), "12:00", hard=True, area="Health")
        agent_task(ag, "TS1S", "Test shoot round 1 status", "All round 1 packages out; book updated.", d("2026-12-23"), "12:00",
                   area="Test shoot")
        agent_task(ag, "TS2S", "Test shoot round 2 status", "All round 2 retouches done and packages out.", d("2027-01-15"), "12:00",
                   area="Test shoot")
        # skin 3 / walk 3 reviews grouped by date
        groups = {}
        for x in by[ag]:
            groups.setdefault(x["skin3"], []).append(x)
        for dd, ms in sorted(groups.items()):
            code = f"SK3R{dd.strftime('%m%d')}"
            agent_task(ag, code, f"Review pre-show skin and walk videos ({short_date(dd)} set)",
                       "Skin check with the reviewer, walk feedback, and a go or no-go for show readiness.",
                       add_bd(dd, 2), "12:00", hard=True, area="Walk", models=ms)
        agent_task(ag, "SK4R", "Review skin submission #4", "Check progress and plan Block B skin care.", d("2027-02-03"), "12:00",
                   area="Skin")

    # Troy / Sophia / Demontez cohort tasks
    S = lambda code, owner, title, desc, day, time, hard=False, tt="visa_travel", area="Travel": row(
        None, code, "staff", owner, title, desc, day, time, "ET", ttype=tt, hard=hard, area=area)
    sch = [m["name"] for m in MODELS if m["visa"] == "schengen"]
    S("travel-rates", "Troy", "Replace the estimate rates with real quotes", "Update the Rates tab (flights, housing, per diem) from real quotes so every model's amount is correct before offers go out.",
      d("2026-12-02"), "12:00", True)
    S("travel-offers", "Troy", f"All {sum(1 for m in MODELS if m['travel'])} travel offers sent", "Offers to models and mother agencies with itinerary and amount.",
      d("2026-12-07"), "12:00", True)
    S("travel-approved", "Demontez", "Travel approvals check: who has not approved", "Chase every model and mother agency still pending.",
      d("2026-12-11"), "17:00", True)
    S("budget-ok", "Sophia", "Season budget approved", "Approve the total model travel and stay advance and the cash plan.",
      d("2026-12-04"), "12:00", True, area="Finance")
    S("visa-cohort", "Troy", f"Schengen visa cohort: all {len(sch)} filed", "Every Schengen application filed and biometrics done.",
      d("2026-11-13"), "17:00", True, area="Visa")
    S("milan-decision", "Demontez", "Decision: which models are signed in Milan, and visa country", "Final answer per model (Paris only, or Milan leg Jan 15-19). Changes the visa country and adds a Milan travel leg.",
      d("2026-12-04"), "12:00", True, area="Visa")
    S("arrival-pack", "Troy", "Arrival packs ready (SIM, metro pass, address, house rules)", "One pack per arriving model.",
      d("2027-01-07"), "12:00", False)
    S("hire-booker", "Demontez", "Paris booker or assistant: shortlist, offer, start", "Shortlist Dec 4, offer Dec 11, start Jan 4 before models land. Erica currently carries 25 models.",
      d("2026-12-11"), "17:00", True, tt="agent", area="Team")
    S("insurance-biz", "Sophia", "Business insurance bound", "General liability, professional (E&O), cyber for CAVYRE, workers' comp if needed. Certificates to mother agencies.",
      d("2026-12-18"), "12:00", False, tt="agent", area="Finance")
    S("go-nogo", "Demontez", "Go / no-go on every model for January", "Walk, skin, visa, health and travel status per model. Decide who moves.",
      d("2027-01-04"), "10:00", True, tt="agent", area="Gameplan")
    S("arrivals-ok", "Troy", "All January arrivals confirmed (flights, housing, pickup)", "Lagos cohort lands Sun Jan 10.", d("2027-01-08"), "12:00", True)
    S("nyfw-ready", "Emma", "NYFW cohort ready: housing, castings list, call sheets", "Everyone arriving Jan 30 has a bed, a casting list and a walk-off slot.",
      d("2027-01-22"), "12:00", True, tt="casting_show", area="Gameplan")
    S("block-a-review", "Demontez", "Block A close-out review and Block B launch", "Review results, publish the next 90 days.",
      d("2027-02-05"), "10:00", True, tt="agent", area="Gameplan")


def build():
    for m in MODELS:
        model_dates(m)
    schedule_tests()
    for m in MODELS:
        model_rows(m)
    cohort_rows()
    ROWS.sort(key=lambda r: (utc_dt(r["day"], r["time"], r["tz"]), r["id"]))
    return ROWS


if __name__ == "__main__":
    rs = build()
    from collections import Counter
    print(len(rs), Counter((r["audience"], r["kind"]) for r in rs))
    print(min(r["day"] for r in rs), max(r["day"] for r in rs))
    early = [r for r in rs if r["day"] < PUBLISH]
    print("before publish:", len(early))
    for r in early[:10]:
        print(r["id"], r["day"], r["title"])
    ids = Counter(r["id"] for r in rs)
    print("dupe ids:", [k for k, v in ids.items() if v > 1][:5])
