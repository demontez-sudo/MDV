"""Travel and stay: itineraries per model and a cost estimate. ALL RATES ARE PLANNING ESTIMATES, not quotes.
Troy replaces them with real quotes on the Rates tab before the offers go out (Dec 7)."""
from datetime import timedelta
from calc import d
from roster import MODELS

RATES = {
    "flight": {  # round trip, economy, per person (USD)
        "LOS-PAR": ("Lagos - Paris round trip", 1150),
        "AMS-PAR": ("Amsterdam - Paris round trip (train)", 140),
        "LON-PAR": ("London - Paris round trip (Eurostar)", 160),
        "MEX-PAR": ("Mexico City - Paris round trip", 1200),
        "ATL-PAR": ("Atlanta - Paris round trip", 1000),
        "NYC-PAR": ("New York - Paris round trip", 900),
        "PAR-NYC": ("Paris - New York round trip", 900),
        "ATL-NYC": ("Atlanta - New York round trip", 300),
        "AMS-NYC": ("Amsterdam - New York round trip", 700),
        "MAD-NYC": ("Spain (Madrid) - New York round trip", 850),
        "ICN-NYC": ("Seoul - New York round trip", 1700),
        "ICN-NYC-PAR": ("Seoul - New York - Paris - Seoul multi-city", 2300),
        "LIM-NYC-PAR": ("Lima - New York - Paris - Lima multi-city", 1800),
    },
    "night": {"Paris": ("Model housing, Paris, per bed per night", 55),
              "New York": ("Model housing, New York, per bed per night", 70),
              "Milan": ("Model housing, Milan, per bed per night", 60)},
    "perdiem": {"Paris": ("Meals and local transport, Paris, per day", 35),
                "New York": ("Meals and local transport, New York, per day", 45),
                "Milan": ("Meals and local transport, Milan, per day", 35)},
    "other": {
        "transfer": ("Airport transfers, per trip (both ends)", 120),
        "schengen": ("Schengen visa fee, service fee and travel insurance", 225),
        "contingency": ("Contingency (percent of subtotal)", 0.10),
        "care": ("Care allowance, optional (skin consult or facial, dental cleaning, vision check)", 250),
        "milan_leg": ("Milan add-on if signed in Milan (Jan 15-19): train, 4 nights, meals, transfers", 600),
        "us_visa_legal": ("US work visa legal and filing (SEPARATE QUOTE from counsel; not in the model's amount)", 8000),
    },
}

P, N = "Paris", "New York"


def L(city, a, b, why):
    return dict(city=city, arrive=d(a), depart=d(b), why=why)


def itinerary(m):
    n = m["name"]
    if m["base"] == "Lagos" and m["shows"]:
        if "W" in m["shows"]:
            return dict(legs=[L(P, "2027-01-10", "2027-03-15", "Paris Men's, Couture and Women's on one visa")],
                        flights=[("LOS-PAR", 1)])
        return dict(legs=[L(P, "2027-01-10", "2027-01-25", "Paris Men's")], flights=[("LOS-PAR", 1)])
    table = {
        "Akvile Kerpauskaite": dict(legs=[L(P, "2027-01-21", "2027-01-29", "Couture"), L(P, "2027-02-26", "2027-03-10", "Women's")],
                                    flights=[("AMS-PAR", 2)]),
        "Katalina Arango": dict(legs=[L(P, "2027-01-21", "2027-01-29", "Couture"), L(P, "2027-02-26", "2027-03-10", "Women's")],
                                flights=[("AMS-PAR", 2)]),
        "Fernanda Vega": dict(legs=[L(P, "2027-01-20", "2027-01-29", "Couture"), L(P, "2027-02-26", "2027-03-10", "Women's")],
                              flights=[("MEX-PAR", 2)]),
        "Feuza Diouf": dict(legs=[], flights=[]),
        "Histria Soler": dict(legs=[L(P, "2027-01-21", "2027-01-29", "Couture"), L(P, "2027-02-26", "2027-03-10", "Women's")],
                              flights=[("LON-PAR", 2)]),
        "Clara Wahlqvist": dict(legs=[L(P, "2027-01-21", "2027-01-29", "Couture"), L(N, "2027-02-04", "2027-02-17", "NYFW (O-1)"),
                                      L(P, "2027-02-26", "2027-03-10", "Women's")], flights=[("AMS-PAR", 2), ("AMS-NYC", 1)]),
        "Sullivan Jordan": dict(legs=[L(P, "2027-01-20", "2027-01-29", "Couture"), L(N, "2027-02-06", "2027-02-17", "NYFW"),
                                      L(P, "2027-02-26", "2027-03-10", "Women's")], flights=[("ATL-PAR", 2), ("ATL-NYC", 1)]),
        "Lance Valadie": dict(legs=[L(P, "2027-01-14", "2027-01-25", "Paris Men's")], flights=[("NYC-PAR", 1)]),
        "Mairbek Benoy": dict(legs=[L(N, "2027-01-30", "2027-02-17", "NYFW")], flights=[("PAR-NYC", 1)]),
        "Aidan Jake": dict(legs=[L(N, "2027-01-30", "2027-02-17", "NYFW")], flights=[("MAD-NYC", 1)]),
        "Alex Nicola": dict(legs=[L(N, "2027-02-08", "2027-02-14", "NYFW castings with guardian")], flights=[("ATL-NYC", 2)]),
        "Sae Kashiwabara": dict(legs=[L(N, "2027-01-30", "2027-02-17", "NYFW")], flights=[("ICN-NYC", 1)]),
        "Soni Lobodiuk": dict(legs=[L(N, "2027-01-30", "2027-02-17", "NYFW"), L(P, "2027-02-26", "2027-03-10", "Women's")],
                              flights=[("ICN-NYC-PAR", 1)]),
        "Violeta Rodo": dict(legs=[L(N, "2027-01-30", "2027-02-17", "NYFW"), L(P, "2027-02-26", "2027-03-10", "Women's")],
                             flights=[("LIM-NYC-PAR", 1)]),
    }
    return table.get(n, dict(legs=[], flights=[]))


def nights(leg):
    return (leg["depart"] - leg["arrive"]).days


def cost(m):
    it = m["itin"]
    mult = 2 if m["minor"] else 1          # a guardian travels with a minor
    flights = sum(RATES["flight"][r][1] * c for r, c in it["flights"])   # Alex: 2 tickets already counted (guardian)
    housing = sum(nights(g) * RATES["night"][g["city"]][1] for g in it["legs"]) * mult
    perdiem = sum((nights(g) + 1) * RATES["perdiem"][g["city"]][1] for g in it["legs"]) * mult
    trips = len(it["legs"])
    transfers = trips * RATES["other"]["transfer"][1] * mult if it["legs"] else 0
    visa = RATES["other"]["schengen"][1] if m["visa"] == "schengen" else 0
    sub = flights + housing + perdiem + transfers + visa
    cont = (sub * 10 + 50) // 100          # 10 percent, rounded half up (matches the spreadsheet ROUND)
    total = sub + cont
    return dict(flights=flights, housing=housing, perdiem=perdiem, transfers=transfers, visa=visa,
                subtotal=sub, contingency=cont, total=total, care=RATES["other"]["care"][1],
                milan_addon=RATES["other"]["milan_leg"][1] if m["milan"] else 0)


for _m in MODELS:
    _m["itin"] = itinerary(_m)
    _m["travel"] = bool(_m["itin"]["legs"])
    _m["cost"] = cost(_m)
    if _m["itin"]["legs"]:
        _m["arrive_first"] = min(g["arrive"] for g in _m["itin"]["legs"])
        _m["depart_last"] = max(g["depart"] for g in _m["itin"]["legs"])
    else:
        _m["arrive_first"] = None
        _m["depart_last"] = None
