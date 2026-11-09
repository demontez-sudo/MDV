"""The 35 models, exactly as Demontez described them on Nov 8, 2026."""
from calc import d

SHOWS = {
    "M": ("Paris Men's FW27-28", d("2027-01-19"), d("2027-01-24")),
    "H": ("Paris Haute Couture SS27", d("2027-01-25"), d("2027-01-28")),
    "N": ("New York Fashion Week (CFDA Feb 10-16; Bureau Feb 11-14)", d("2027-02-10"), d("2027-02-16")),
    "W": ("Paris Women's FW27-28", d("2027-03-01"), d("2027-03-09")),
}
SHOW_ORDER = ["M", "H", "N", "W"]

# base city -> (time zone key, climate profile, food profile)
BASES = {
    "Lagos": ("WAT", "hot_humid", "west_africa"),
    "Amsterdam": ("CET", "cool_damp", "europe"),
    "Paris": ("CET", "cool_damp", "europe"),
    "London": ("GMT", "cool_damp", "europe"),
    "Spain": ("CET", "mild", "mediterranean"),
    "Mexico City": ("MX", "altitude_uv", "mexico"),
    "Atlanta": ("ET", "humid_subtropical", "us"),
    "New York": ("ET", "cold_dry", "us"),
    "Mumbai": ("IST", "hot_humid", "india"),
    "Lima": ("PET", "coastal_uv", "peru"),
    "Seoul": ("KST", "cold_dry", "korea"),
}


def M(name, base, shows, kind="runway", agent="Erica", agent2="Emma", visa=None, **kw):
    tz, climate, food = BASES[base]
    r = dict(name=name, base=base, tz=tz, climate=climate, food=food, shows=shows, kind=kind,
             agent=agent, agent2=agent2, visa=visa, milan=False, minor=False, new=False, pair=None,
             tests=2, note="", editorial_push=False)
    r.update(kw)
    return r


MODELS = [
    M("Adenike Aluko", "Lagos", "HMW", visa="schengen", milan=True),
    M("Aidan Jake", "Spain", "N", agent="Emma", agent2="Erica", tests=1, visa="check_us"),
    M("Akvile Kerpauskaite", "Amsterdam", "HW"),
    M("Alex Nicola", "Atlanta", "N", agent="Emma", agent2="Erica", minor=True,
      note="Age 15. Guardian at every session, school first."),
    M("Catherine Olatundun", "Lagos", "HMW", visa="schengen", milan=True),
    M("Chol Ngor", "Lagos", "M", visa="schengen", milan=True),
    M("Clara Wahlqvist", "Amsterdam", "HNW", agent="Emma", agent2="Erica", visa="us_o1",
      note="USA O-1 visa being finalized."),
    M("David Aluko", "Lagos", "M", visa="schengen", milan=True),
    M("Deborah Adegoke", "Lagos", "HMW", visa="schengen", milan=True, pair="Adegoke"),
    M("Dorcas Adegoke", "Lagos", "HMW", visa="schengen", milan=True, pair="Adegoke"),
    M("Enica Seshoka", "Lagos", "HMW", visa="schengen", milan=True),
    M("Fernanda Vega", "Mexico City", "HW",
      note="Earlier DaySilk note says she may be released because of age; this plan follows your Nov 8 list (Couture + Women's)."),
    M("Feuza Diouf", "Paris", "HW"),
    M("Histria Soler", "London", "HW", visa="check_eu",
      note="Earlier note: get a multiple-entry visa in place."),
    M("Katalina Arango", "Amsterdam", "HW"),
    M("Krishita Shetty", "Mumbai", "", kind="editorial", agent="Emma", agent2="Erica"),
    M("Lance Valadie", "New York", "MN", agent="Emma", agent2="Erica"),
    M("Lauryn Alfreda", "Lagos", "", kind="editorial"),
    M("Lovelyn Chinazaekpere", "Lagos", "HMW", visa="schengen", milan=True,
      note="Confirm who her mother agency is first."),
    M("Mairbek Benoy", "Paris", "MN", agent="Erica", agent2="Emma", new=True, visa="check_us"),
    M("Mercy Francis", "Lagos", "HMW", visa="schengen", milan=True),
    M("Olubiyi Omoshewa", "Lagos", "HMW", visa="schengen", milan=True),
    M("Paula Ciaroz", "Lima", "", kind="editorial", agent="Emma", agent2="Erica"),
    M("Precious Meow", "Lagos", "HMW", visa="schengen", milan=True),
    M("Rachel Obaterin", "Lagos", "HMW", visa="schengen", milan=True),
    M("Richard Favor", "Lagos", "HMW", visa="schengen", milan=True),
    M("Sae Kashiwabara", "Seoul", "N", agent="Emma", agent2="Erica", visa="us"),
    M("Samuel Job", "Lagos", "M", visa="schengen", milan=True),
    M("Samuel Yusuf", "Lagos", "M", visa="schengen", milan=True),
    M("Soni Lobodiuk", "Seoul", "NW", agent="Emma", agent2="Erica", visa="check_us", editorial_push=True,
      note="Also pushing for editorial and campaigns."),
    M("Sullivan Jordan", "Atlanta", "HNW", agent="Emma", agent2="Erica",
      note="Also placing her in London, Milan and Spain."),
    M("Tosin Florence", "Lagos", "", kind="editorial"),
    M("Vayla Bovykina", "Seoul", "", kind="editorial", agent="Erica", agent2="Emma",
      note="Currently in Seoul."),
    M("Violeta Rodo", "Lima", "WN", agent="Emma", agent2="Erica", visa="check_us", editorial_push=True,
      note="Also pushing for editorial and campaigns."),
    M("Zainab Adetayo", "Lagos", "HMW", visa="schengen", milan=True),
]
for m in MODELS:
    m["shows"] = "".join(s for s in SHOW_ORDER if s in m["shows"])
    m["slug"] = m["name"].lower().replace(" ", "-")
    m["first"] = m["name"].split()[0]
assert len(MODELS) == 35, len(MODELS)

TEAM = {
    "Demontez": dict(role="Owner. Runs MDV, Casa de Veux, CAVYRE and the Dental and Real Estate portals", tz="ET"),
    "Emma": dict(role="Runs the New York board", tz="ET"),
    "Erica": dict(role="Runs the Paris board", tz="CET"),
    "Troy": dict(role="Books travel, visas logistics and housing", tz="ET"),
    "Sophia": dict(role="Finance, budgets, advances and insurance", tz="ET"),
}
