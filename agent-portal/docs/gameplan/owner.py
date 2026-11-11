"""Demontez's own DaySilk additions for Nov 8, 2026 - Feb 5, 2027: tasks, events, body plan and the cadence map.
Formats match The Rebuild: task {id,title,area,due,time,prio,subs[{t,done}],done,notes}; event {id,title,d,t,e,cat,rep,where,notes,until,skip}."""
from datetime import timedelta
from calc import *

START, END = d("2026-11-08"), d("2027-02-05")
TASKS, EVENTS, MASTER = [], [], []


def iso(x):
    return x.isoformat()


def task(tid, title, area, due, time, prio, subs=None, notes="", who="Demontez"):
    TASKS.append(dict(id=f"g90-{tid}", title=title, area=area, due=iso(d(due)), time=time, prio=prio,
                      subs=[dict(t=s, done=False) for s in (subs or [])], done=False, notes=notes))
    MASTER.append(dict(day=d(due), time=time or "09:00", tz="ET", owner=who, scope="Demontez", area=area, title=title,
                       kind="Task", detail=notes or "; ".join(subs or [])))


def event(eid, title, day, t, e, cat, where="", notes="", rep="", until=None, skip=None, master=True, who="Demontez", area=None):
    ev = dict(id=f"g90-{eid}", title=title, d=iso(d(day)), t=t, e=e, cat=cat, rep=rep, where=where, notes=notes)
    if until:
        ev["until"] = iso(d(until))
    if skip:
        ev["skip"] = [iso(d(s)) for s in skip]
    EVENTS.append(ev)
    if master:
        MASTER.append(dict(day=d(day), time=t or "00:00", tz="ET", owner=who, scope="Demontez", area=area or "Gameplan",
                           title=title, kind="Repeats weekly" if rep == "w" else "Event", detail=notes))


# ------------------------------------------------------------------ where he is
HOME_SUNDAYS = ["2026-11-22", "2026-11-29", "2026-12-20", "2026-12-27", "2027-01-03", "2027-01-10", "2027-01-31"]
HOME_WEDS = ["2026-11-18", "2026-11-25", "2026-12-16", "2026-12-23", "2026-12-30", "2027-01-06", "2027-02-03"]
AWAY = [("2026-11-30", "2026-12-13"), ("2027-01-13", "2027-01-29")]    # NY then Paris; Paris for the January shows
away_days = set()
for a, b in AWAY:
    away_days |= set(daterange(d(a), d(b)))


def away_dates(weekday):
    return [iso(x) for x in sorted(away_days) if x.weekday() == weekday and START <= x <= END]


def build():
    TASKS.clear(); EVENTS.clear(); MASTER.clear()

    # ---- body: 225 -> 210, more tone, less belly
    targets = [("2026-11-22", 222.7), ("2026-12-06", 220.4), ("2026-12-20", 218.1), ("2027-01-03", 215.8),
               ("2027-01-17", 213.5), ("2027-01-31", 211.2), ("2027-02-05", 210.0)]
    task("body-base", "Day 1 baseline: weigh-in, waist, three photos", "Health", "2026-11-09", "07:30", 1,
         ["Morning weight before food (write it on the Body page)", "Waist measured at the navel", "Front, side and back photos",
          "Goal in DaySilk is now 210 lb by Feb 5 (about 1.2 lb a week). Judge by the 14-day average, not one morning."],
         "Starting point 225 lb. Aim: 210 lb and a tighter waist by Feb 5.")
    task("core", "Add a 10-minute core finisher (waist and belly focus) twice a week", "Health", "2026-11-11", "07:50", 2,
         ["Wednesday: after conditioning and mobility", "Saturday: after the group session",
          "Plank 3 x 40s, dead bug 3 x 10, cable chop 3 x 12 each side, hanging knee raise 3 x 10",
          "Keep steps at 8,000 a day; walk 20 minutes after dinner on dinner-out days"],
         "Core work tones the waist; the weight loss comes from food, steps and sleep.")
    for i, (dd, w) in enumerate(targets):
        task(f"w{i+1}", f"Check-in: weight about {w:.1f} lb ({'goal' if w == 210.0 else 'on track'} date)", "Health", dd, "08:30", 2,
             [f"Compare your 14-day average with {w:.1f} lb", "More than 1.5 lb above target: cut 150 calories or add 1,500 steps",
              "More than 1.5 lb below target: add 150 calories and keep protein at 175 g", "Waist and photos every 4 weeks"],
         "Targets are a straight line from 225 to 210 over 90 days. Market weeks and holidays will wobble; the average matters.")
    event("weighin", "Sunday weigh-in, waist, photo", "2026-11-15", "08:00", "08:15", "move", "", "Same scale, same time, before food.",
          rep="w", until="2027-02-07", skip=["2026-12-06", "2027-01-17", "2027-01-24"], area="Health")

    # ---- doctor, dental, vision, skin
    task("physical-book", "Book the annual physical and bloodwork", "Health", "2026-11-16", "10:00", 1,
         ["Call your primary doctor or a clinic", "Ask for fasting bloodwork: blood count, metabolic panel, lipids, A1c, vitamin D, thyroid",
          "Mention the car accident follow-up and the new training plan", "Ask the doctor to clear you for the 210 lb plan"],
         "Hold is on Wed Nov 18, 8:00 AM. Move it if the clinic needs another day, but keep it before Nov 20.")
    event("physical", "HOLD: Annual physical + bloodwork (confirm time with clinic)", "2026-11-18", "08:00", "09:30", "close",
          "Atlanta", "Fast 10 to 12 hours before. Water is fine.", area="Health")
    task("physical-results", "Review bloodwork results with the doctor", "Health", "2026-11-25", "10:00", 2,
         ["Ask for the results portal copy", "Write down anything to change in food or supplements"], "Telehealth is fine.")
    task("dental-book", "Book the dental follow-up and cleaning", "Dental", "2026-11-16", "10:30", 1,
         ["Ask for the accident-related check and a cleaning in the same visit", "Bring insurance card and the Cali treatment records"],
         "Hold is Mon Dec 14, 2:00 PM.")
    event("dental", "HOLD: Dental follow-up + cleaning (confirm time)", "2026-12-14", "14:00", "15:30", "close", "Atlanta",
          "Cleaning every 6 months.", area="Dental")
    event("vision", "Eye exam (vision)", "2026-12-15", "11:00", "12:00", "close", "Atlanta", "Order glasses or contacts the same day if needed.",
          area="Health")
    task("vision-book", "Book the eye exam for Dec 15", "Health", "2026-11-30", "10:00", 2, ["Call from New York or the road if easier"],
         "Existing plan item, now with a hold.")
    task("derm-book", "Book the skin check for Jan 5", "Health", "2026-12-15", "10:00", 3, ["Dermatologist full-body skin check", "Ask about SPF and winter travel skin care"],
         "Hold is Tue Jan 5, 11:00 AM. Q1 skin check from the earlier plan.")
    event("derm", "HOLD: Skin check (dermatologist)", "2027-01-05", "11:00", "12:00", "close", "Atlanta", "", area="Health")

    # ---- insurance
    task("ins-compare", "Health, dental and vision insurance: compare three plans", "Health", "2026-11-17", "17:00", 1,
         ["Open the Georgia Access marketplace and one broker quote", "Check that your doctor, dentist and the Cali claim are covered",
          "Write the monthly cost, deductible and out-of-pocket limit for each", "Check the open-enrollment cut-off for a Jan 1 start"],
         "Open enrollment dates change; confirm the exact cut-off on the marketplace page. Enroll before the early-December deadline to have coverage Jan 1.")
    task("ins-pick", "Choose the health plan", "Health", "2026-11-24", "17:00", 1, ["Decide plan, add dental and vision"], "")
    task("ins-enroll", "Enroll and pay the first month", "Health", "2026-12-10", "17:00", 1,
         ["Submit the application", "Save the confirmation", "Set the monthly autopay"], "Must be done before the marketplace cut-off for Jan 1 coverage.")
    task("ins-cards", "Insurance cards in your wallet and Travel profile", "Health", "2026-12-28", "12:00", 2,
         ["Add the member ID to the Travel profile page", "Photo of the card on your phone", "Ask the carrier for international coverage rules before Paris"], "")
    task("ins-life", "Life and disability insurance quotes", "Personal", "2027-01-08", "12:00", 3, ["Two quotes", "Pick one by Feb 5"], "")
    task("ins-biz", "Business insurance bound (liability, E&O, cyber, workers' comp)", "MDV", "2026-12-18", "12:00", 2,
         ["Quotes from Sophia by Dec 4", "Certificates for mother agencies and CAVYRE founding agencies by Jan 8"], "Owner: Sophia.", who="Sophia")

    # ---- groceries and food
    for i, s in enumerate(HOME_SUNDAYS):
        event(f"groc-s{i}", "Groceries + meal prep", s, "15:00", "16:30", "recharge", "Atlanta",
              "No cheese, no pork. Protein at every meal. Prep lunches and dinners for the week.", master=False)
    for i, s in enumerate(HOME_WEDS):
        event(f"groc-w{i}", "Grocery top-up (protein, produce)", s, "18:15", "18:45", "recharge", "Atlanta", "Restock fresh vegetables, fruit and protein for Thu to Sat.", master=False)
    MASTER.append(dict(day=d(HOME_SUNDAYS[0]), time="15:00", tz="ET", owner="Demontez", scope="Demontez", area="Health",
                       title="Groceries + meal prep every home Sunday (3:00 PM) and top-up every home Wednesday (6:15 PM)",
                       kind="Repeats", detail=f"{len(HOME_SUNDAYS)} Sundays and {len(HOME_WEDS)} Wednesdays on the calendar."))
    for tid, day, note in (("fuel-ny", "2026-11-29", "Fly Nov 30"), ("fuel-pa", "2027-01-12", "Fly Jan 13"), ("fuel-ny2", "2027-02-06", "Fly Feb 7")):
        task(tid, f"Pack travel food and water bottle ({note})", "Health", day, "18:00", 3,
             ["6 protein bars or jerky (no pork)", "Nuts, fruit, oats packets", "Hotel: ask for a fridge", "Hotel-gym workout is in the app"], "")

    # ---- cadence blocks for the two new products (Atlanta weeks, 4:00 PM)
    event("dental-portal", "Dental Portal block: pipeline and demo", "2026-11-17", "16:00", "17:30", "focus", "", "Tuesday product block for the Dental Portal.",
          rep="w", until="2027-02-02", skip=away_dates(1) + ["2026-12-22", "2026-12-29"], area="CAVYRE")
    event("re-portal", "Real Estate Portal block: pipeline and demo", "2026-11-19", "16:00", "17:30", "focus", "", "Thursday product block for the Real Estate Portal.",
          rep="w", until="2027-02-04", skip=away_dates(3) + ["2026-11-26", "2026-12-24", "2026-12-31"], area="CAVYRE")

    # ---- team rhythm
    event("huddle", "Gameplan huddle: Emma, Erica, Troy, Sophia", "2026-11-13", "09:00", "09:45", "connect", "Video call",
          "Friday: every deadline due in the next 7 days, who is blocked, and what moves. Open the Tasks board.", rep="w",
          until="2027-02-05", skip=["2026-11-27", "2026-12-25", "2027-01-01"], area="MDV")
    for i, (nm, dd) in enumerate((("Mon", "2026-11-09"), ("Wed", "2026-11-11"), ("Fri", "2026-11-13"))):
        event(f"sweep{i}", "Deadline sweep (15 min)", dd, "12:45", "13:00", "focus", "",
              "Open Tasks: anything due in the next 48 hours that is not done gets a message or a call today.", rep="w", until="2027-02-05",
              skip=["2026-11-27", "2026-12-23", "2026-12-25", "2026-12-30", "2027-01-01"], master=(i == 0), area="MDV")

    # ---- owner decisions and approvals
    task("approve-plan", "Approve the final gameplan (then it goes live in all three portals)", "MDV", "2026-11-09", "12:00", 1,
         ["Read the Master tab and the Models tab", "Pick the travel option on the Travel tab", "Tell Troy and Erica: go"], "Live in the portals Tue Nov 10, 12:00 PM ET.")
    task("milan", "Decide Milan or Paris placement for the Lagos models", "Models", "2026-12-04", "12:00", 1,
         ["Which models sign in Milan, and who is their mother agency", "If Milan: add the Jan 15 to 19 Milan leg and change the visa country",
          "Tell Troy by 5:00 PM"], "")
    task("offers", "Travel offers go out (Troy), you check the totals first", "Travel", "2026-12-07", "09:00", 1, ["Check the grand total against the cash plan with Sophia", "Confirm the visa and legal quote is separate"], "")
    task("approvals", "Chase every travel approval (models and mother agencies)", "Travel", "2026-12-11", "17:00", 1, ["Who has not approved", "Call the top 5 blockers"], "")
    task("visa-day", "Visa decision day: every Lagos case", "Travel", "2026-12-21", "12:00", 1, ["Troy reports each case", "Fallback for any refusal: Milan or Women's only"], "")
    task("hire", "Paris booker or assistant: offer out and start date", "MDV", "2026-12-11", "17:00", 1,
         ["Shortlist by Dec 4", "Offer Dec 11", "Start Mon Jan 4, before the models land", "Erica carries 25 of the 35 models right now"], "")
    task("gonogo", "Go / no-go on every model for January", "Models", "2027-01-04", "10:00", 1,
         ["Walk, skin, visa, health, travel status per model", "Anyone red: decide to push, move to Women's, or hold"], "")
    task("close-review", "Block A review and Block B launch (next 90 days)", "MDV", "2027-02-05", "10:00", 1,
         ["Scorecard: tests done, visas, arrivals, bookings, sign-ups for CAVYRE", "Publish Block B (Feb 6 to May 6) to all three portals", "Reset weight and money goals"], "")

    # ---- the operating day: outreach timed to when each kind of person reads mail in their own city.
    # Same rules as the leads engine (netlify/functions/_lib/reach-windows.mjs).
    # (The weekday outreach windows themselves live in Demontez's DaySilk routine: CO_DAY in daysilk/me/index.html.)
    task("paris-rhythm", "Paris weeks rhythm (Jan 14 to 28)", "MDV", "2027-01-13", "09:00", 2,
         ["Castings and go-sees in person 10 AM to 6 PM Paris", "US outreach 3 to 5 PM Paris (9 to 11 AM New York)",
          "No cold Europe emails: see people at castings and shows instead", "Every new contact goes into Companies the same night"],
         "The Atlanta outreach blocks pause while you are in Paris.")

    # ---- CAVYRE: from five founding agencies to the Block B wave
    task("cav-list", "CAVYRE: 40 target agencies in Companies, tiered A, B, C", "CAVYRE", "2026-11-13", "17:00", 1,
         ["Paris, London, Milan, New York, Lagos", "Type: Model / Talent Agency, city filled in (sets the best time)", "Tier A: could sign this season; B: next season; C: later"],
         "Feeds the Agency hour and Outreach leads.")
    task("cav-demos", "CAVYRE: 8 demos booked", "CAVYRE", "2026-11-20", "17:00", 1, ["2 a day from the Agency hour", "15-minute demo, owner or head booker on the call"], "")
    task("cav-ref", "CAVYRE: ask each founding agency for 2 introductions", "CAVYRE", "2026-12-18", "17:00", 2, ["Ask after onboarding goes well", "Log every intro in Outreach"], "")
    task("cav-wave2", "CAVYRE: wave 2 list of 15 agencies for Block B (12 live by Jun 30)", "CAVYRE", "2027-01-08", "17:00", 2, ["Invite the warmest to the Jan 22 dinner"], "")
    task("cav-after", "CAVYRE: follow up every dinner guest within 72 hours", "CAVYRE", "2027-01-25", "12:00", 1, ["Demo date for each prospect", "Founder quote from one founding agency"], "")
    task("cav-offer", "CAVYRE: wave 2 pricing and offer out", "CAVYRE", "2027-02-02", "17:00", 2, ["Season proof numbers", "Offer valid to Mar 14"], "")

    # ---- Casa de Veux: client pipeline
    task("cdv-list", "Casa de Veux: 20 client targets in Companies (brands, designers, production)", "CDV", "2026-11-13", "17:00", 1,
         ["Tier A: 10 who need content this season", "Contact person and city on each (sets the best time)"], "")
    task("cdv-send", "Casa de Veux: pitch pack to the 10 Tier A brands", "CDV", "2026-11-24", "14:00", 1, ["Tue to Thu, 9 to 11 AM their time", "Follow up after 5 days"], "")
    task("cdv-nyc", "Casa de Veux: 5 New York coffees while you are there (Nov 30 to Dec 13)", "CDV", "2026-12-01", "12:00", 2, ["Brands and studios", "Bring the MDV faces deck"], "")
    task("cdv-prop", "Casa de Veux: first client proposal out", "CDV", "2026-12-15", "17:00", 1, ["Scope, dates, MDV talent, price"], "")
    task("cdv-inv", "Casa de Veux: Paris creator dinner invitations out (dinner Jan 21)", "CDV", "2027-01-08", "12:00", 2, ["Photographers, stylists, directors", "12 seats"], "")
    task("cdv-after", "Casa de Veux: follow up every Paris contact within 72 hours", "CDV", "2027-01-26", "12:00", 1, ["One next step each"], "")

    # ---- the companies
    task("cav-sign", "CAVYRE: sign the five founding agencies", "CAVYRE", "2026-12-04", "17:00", 1,
         ["Five signed agreements", "Data agreement attached", "Onboarding dates set for Dec 7 to 13 in Paris"], "From the existing CAVYRE plan; live by Dec 13.")
    task("cav-live", "CAVYRE: five founding agencies live", "CAVYRE", "2026-12-13", "17:00", 1, ["In-person onboarding in Paris", "Model portal live within 14 days of signing"], "")
    task("cav-proof", "CAVYRE: first case study draft", "CAVYRE", "2027-02-05", "15:00", 2, ["Hours saved", "Castings handled", "Founder quote"], "Season proof runs Jan 4 to Mar 14.")
    event("cav-dinner", "Agency owners dinner (Paris Men's week)", "2027-01-22", "19:30", "22:00", "connect", "Paris",
          "Invite founding agencies and prospects. Bring the Men's week stories.", area="CAVYRE")
    task("dp-1", "Dental Portal: positioning and a list of 25 practices or groups", "CAVYRE", "2026-11-20", "17:00", 2,
         ["One-page pitch", "25 target practices or dental groups", "Three questions to ask every owner"], "Proposed milestone, edit to match where the product is.")
    task("dp-2", "Dental Portal: demo account ready", "CAVYRE", "2026-12-11", "17:00", 2, ["Sample practice, patients, schedule", "Five-minute demo script"], "Proposed milestone.")
    task("dp-3", "Dental Portal: three discovery calls", "CAVYRE", "2027-01-08", "17:00", 2, ["Book from the list", "Write what each practice pays for today"], "Proposed milestone.")
    task("dp-4", "Dental Portal: first pilot practice agreed", "CAVYRE", "2027-02-02", "17:00", 2, ["Pilot terms", "Success measure in 30 days"], "Proposed milestone.")
    task("re-1", "Real Estate Portal: positioning and a list of 25 brokerages or teams", "CAVYRE", "2026-11-24", "17:00", 2,
         ["One-page pitch", "25 target brokerages or teams", "Three questions to ask every broker"], "Proposed milestone, edit to match where the product is.")
    task("re-2", "Real Estate Portal: demo account ready", "CAVYRE", "2026-12-15", "17:00", 2, ["Sample listings, leads, showings", "Five-minute demo script"], "Proposed milestone.")
    task("re-3", "Real Estate Portal: three discovery calls", "CAVYRE", "2027-01-12", "17:00", 2, ["Book from the list", "Write what each team pays for today"], "Proposed milestone.")
    task("re-4", "Real Estate Portal: first pilot team agreed", "CAVYRE", "2027-02-04", "17:00", 2, ["Pilot terms", "Success measure in 30 days"], "Proposed milestone.")
    task("cdv-1", "Casa de Veux: pitch pack with MDV talent for the January shows", "CDV", "2026-11-20", "17:00", 2,
         ["10 brands to pitch", "Bring two MDV faces into every pitch"], "")
    event("cdv-dinner", "Creator dinner (Paris Men's week): photographers, stylists, directors", "2027-01-21", "19:30", "22:00", "connect", "Paris",
          "One creator dinner each market trip.", area="CDV")
    task("cdv-ny", "Casa de Veux: NYFW coffee and studio list (10 meetings)", "CDV", "2027-02-03", "17:00", 2, ["10 booked meetings for Feb 8 to 17"], "")
    task("blockb-1", "Block B skeleton: Feb 6 to May 6", "MDV", "2026-12-18", "16:00", 3,
         ["NYFW Feb 10 to 16", "Paris Women's Mar 1 to 9", "Spring editorial window from Mar 15", "CAVYRE: 12 agencies by Jun 30"], "Rough outline only.")
    task("blockb-2", "Block B model targets: spring editorial and campaigns", "Models", "2027-01-15", "16:00", 3,
         ["Krishita, Lauryn, Tosin, Paula, Vayla", "Soni and Violeta for editorial and campaigns", "Sullivan for London, Milan, Spain"], "")
    task("blockb-3", "Book your own flights and hotels for NYFW and Paris Women's", "Travel", "2027-01-08", "12:00", 2,
         ["NY Feb 7 to 17", "Paris Feb 26 to Mar 10"], "")

    # ---- trips for January and February
    event("fly-pa", "Fly Atlanta to Paris (overnight)", "2027-01-13", "18:00", "", "travel", "Atlanta to Paris", "Land Jan 14. Lagos models arrived Jan 10 with Erica.", area="Travel")
    event("fly-atl", "Fly Paris to Atlanta", "2027-01-29", "12:00", "", "travel", "Paris to Atlanta", "After Couture. NY cohort lands Jan 30 with Emma.", area="Travel")
    event("fly-ny", "Fly Atlanta to New York (NYFW)", "2027-02-07", "12:00", "", "travel", "Atlanta to New York", "NYFW Feb 10 to 16.", area="Travel")

    # ---- fashion week and model movement milestones as all-day markers
    marks = [
        ("2026-11-20", "Skin plans go out to all models", "MDV"), ("2026-11-23", "Fueling plans go out", "MDV"),
        ("2026-12-11", "Test shoot round 1 packages out; travel approvals due", "MDV"),
        ("2027-01-10", "Lagos cohort lands in Paris (Erica receives)", "MDV"), ("2027-01-11", "Walk-offs begin in Paris", "MDV"),
        ("2027-01-13", "Digitals week in Paris", "MDV"),
        ("2027-01-19", "Paris Men's FW27-28 starts (Jan 19-24)", "MDV"), ("2027-01-25", "Paris Haute Couture SS27 starts (Jan 25-28)", "MDV"),
        ("2027-01-30", "NYFW cohort lands in New York (Emma receives)", "MDV"), ("2027-02-10", "NYFW starts (CFDA Feb 10-16; Bureau Feb 11-14)", "MDV"),
    ]
    for i, (dd, t, ar) in enumerate(marks):
        event(f"mk{i}", t, dd, "", "", "connect", "", "", area=ar)

    # ---- day 1 so it shows today
    task("day1", "Day 1: read the 90-day gameplan and set your Big 3 for the week", "MDV", "2026-11-09", "08:45", 1,
         ["Big 3 this week: approve the plan, visas filed Nov 13, skin plans out Nov 20", "Open the Master calendar tab", "Check the Paris desk with Erica"], "")
    MASTER.sort(key=lambda r: (r["day"], r["time"]))
    return TASKS, EVENTS, MASTER, targets


# ------------------------------------------------------------------ rhythm map for the workbook
CADENCE = [
    ("Every day", "Morning reset, training or active recovery, meals as planned, 8,000 steps, 12 glasses of water, scouting and outreach, Daily Command at 8:45 AM (reads today's deadlines), Daily Review at 9:30 PM", "Demontez"),
    ("Every day", "Skin routine morning and night; walk practice or pose practice on assigned days; food and water; sleep 8 hours", "Models"),
    ("Every day", "Open Tasks and clear anything due in the next 24 hours", "Emma, Erica, Troy, Sophia"),
    ("Every 2 days (Mon, Wed, Fri)", "Deadline sweep 12:45 PM ET: everything due in the next 48 hours. Model movement check: who is traveling, who is blocked", "Demontez + team"),
    ("Every 2 days (Tue, Thu)", "Dental Portal block (Tue 4 PM), Real Estate Portal block (Thu 4 PM), Casa de Veux relationship circle", "Demontez"),
    ("Weekly", "Sunday: weigh-in, waist, photo, groceries and meal prep, wellness check-in for models. Friday 9:00 AM ET: gameplan huddle. Friday: scorecard filled in", "All"),
    ("Every 2 weeks", "Body check-in against the target line; skin and walk reviews on the dates in the plan", "Demontez, agents"),
    ("Monthly", "Monthly review (last Sunday), finance review with Sophia (third Friday), 4-week body check with photos and waist", "Demontez, Sophia"),
    ("Every day (in each model's DaySilk)", "Snack + water at 10:30 AM and 3:30 PM, walk or pose practice Tue and Thu 6:00 PM, Sunday wellness check-in 5:00 PM with the agent, plus four gameplan habits (skin plan, fueling, practice, sleep). Shown beside the model's own routine and never overwrites it. Runs to Feb 5.", "Models"),
    ("Every weekday (outreach, ET)", "Mornings are Europe and Lagos (only open before 11:30 AM ET): Mon and Tue 9:00 CAVYRE + agencies (3 PM Paris), Mon 10:00 editors, Tue 10:00 and Thu 10:30 Europe castings and photographers (4 PM Paris), Wed 9:00 interest calls, Thu 9:00 CAVYRE demo day. Afternoons are the Americas: 2:00 PM Casa de Veux clients every day, 3:00 PM scouting, 4:00 PM US castings, CAVYRE US and LA. Fri: huddle, partner notes by 10, pipeline review, no cold outreach", "Demontez"),
    ("Every weekday (team)", "Emma (NY board): US castings and brands 9:30 to 11 AM New York, walk-ins and go-sees after. Erica (Paris board): castings and photographers 9:30 to 11 AM and 4 to 5:30 PM Paris, model options sent by 8 PM the night before. Troy: travel quotes to agents by 3 PM ET. Sophia: invoices and payments Tuesday and Thursday mornings", "Emma, Erica, Troy, Sophia"),
    ("Show months (models)", "Keep 10 AM to 6 PM local open Tuesday to Thursday for castings and go-sees. The agent sends the next day's options by 8 PM. Digitals and walk videos are due by noon the day the agent pitches them. Routine, meals and sleep stay in the model's DaySilk around these windows", "Models, agents"),
    ("Each company (by tier)", "VIP every 14 days, Tier A every 21, B every 45, C every 75. Outreach leads brings each one back when it is due, with the best time in that person's city", "Demontez + team"),
    ("Each test shoot", "T-14 team locked, T-7 concept approved, T-3 call sheet, T-2 model confirms, T+2 selects, T+4 approvals, T+7 finals, T+9 package out", "Agents, models, mother agencies"),
]

ALERTS = [
    ("Plan goes live (Nov 10, 12:00 PM ET)", "Everyone: a notification that their gameplan and tasks are in", "Demontez, Emma, Erica, Troy, Sophia, every model, every mother agency"),
    ("24 hours before a deadline", "In-app notification and push to the person who owns it", "Task owner"),
    ("2 hours before a HARD STOP", "Push to the owner and the agent of record", "Task owner + agent"),
    ("1 hour after a missed deadline", "Overdue alert to the owner; same-day escalation to Demontez if it was a hard stop", "Owner, then Demontez"),
    ("Monday 8:00 AM ET", "Week-ahead digest: everything due this week", "Demontez, Emma, Erica, Troy, Sophia"),
    ("Friday 9:00 AM ET huddle", "Open overdue list and next week's hard stops", "Team"),
    ("Mother agency: plan goes live, then 24 hours, 2 hours (hard stops) and overdue", "Same alerts as staff, sent to everyone linked to that agency (partner_user_links). Monday week-ahead summary too", "Mother agency"),
    ("Model changes a task (reschedule request, completed, note)", "Agent of record is told in the Tasks board", "Agent of record"),
    ("Mother agency completes or comments on a task", "Agent of record and Demontez on visa, travel and sign-off tasks", "Agent of record"),
]
