"""Per-model skin, fueling, walk and health text. Gender-neutral on purpose; personalised by base city, climate,
show list, travel and age. Nothing here sets a weight or measurement target for a model."""

SKIN_BASE = ("Every day: AM gentle cleanser, moisturizer, broad-spectrum SPF 30+. PM: remove sunscreen and makeup fully "
             "(double cleanse on shoot days), then moisturizer. Once a week: one gentle exfoliation and one hydrating mask. "
             "Patch-test anything new on the jaw for 3 days. Never sleep in makeup. If you shave, use a clean blade, shave "
             "with the grain and finish with an alcohol-free soother.")

SKIN_CLIMATE = {
    "hot_humid": "Climate: heat and humidity. Use a gel or light lotion moisturizer. For breakouts or dark marks after "
                 "breakouts, ask the reviewer about niacinamide in the morning and azelaic acid at night. Reapply SPF every "
                 "2 to 3 hours outdoors and rinse sweat off before it dries.",
    "humid_subtropical": "Climate: warm and humid. A light lotion moisturizer and SPF daily. Rinse after workouts.",
    "cool_damp": "Climate: cool, damp winter and indoor heating. Use a ceramide cream at night, run a humidifier where you "
                 "sleep, and keep SPF on even when it is cloudy.",
    "cold_dry": "Climate: cold, dry winter. Use a richer cream, lip balm at night, lukewarm (not hot) water, and a hydrating "
                "mask twice a week. SPF stays on.",
    "mild": "Climate: mild. Keep the base routine and add a hydrating serum if skin feels tight.",
    "altitude_uv": "Climate: altitude and strong UV. Use SPF 50, a hat in the sun, a hyaluronic serum under moisturizer, and "
                   "drink extra water.",
    "coastal_uv": "Climate: coastal humidity with strong UV. Use SPF 50 and reapply, a light moisturizer, and rinse salt "
                  "and sweat off.",
}

SKIN_TRAVEL = ("Travel days: cleanse, put on a thick moisturizer, no new products, drink water through the flight, and use "
               "a hydrating mask after landing.")

SKIN_PRESHOW = ("Pre-show protocol (starts 14 days before your first show): no new active products, no peels, lasers, "
                "waxing or fillers in the last 7 days, no sunburn or tanning, sleep 8 hours, and remove all makeup at the "
                "end of every day. If anything flares, tell your agent the same day.")

SKIN_SUBMISSION = ("Skin submission = 4 photos in daylight by a window, no makeup, no filter, no retouching: front, left, "
                   "right, and a close-up of any area you want help with. Add three lines: skin type as you see it, any "
                   "concerns, and any product reaction. A licensed skin professional reviews it. You can choose to share "
                   "only the photos and not any medical history.")

FOOD = {
    "west_africa": "Easy local picks: grilled or steamed fish or chicken, beans or moi moi, efo riro or ugu with less oil, "
                   "boiled or grilled plantain, ofada or brown rice, and fruit like pawpaw, oranges and watermelon. "
                   "Jollof and fried snacks are fine in smaller portions with a protein beside them.",
    "europe": "Easy picks: eggs, yogurt or skyr, oats, fish, lentil or bean soups, whole-grain bread, roasted vegetables "
              "and fruit. In Paris, bakeries and markets make it simple to pair a protein with a fruit or vegetable.",
    "mediterranean": "Easy picks: grilled fish, legumes, olive oil, tomato, whole-grain bread, yogurt and fruit.",
    "mexico": "Easy picks: black beans, grilled chicken or fish, corn tortillas, avocado, nopales, lean pozole and fruit.",
    "us": "Easy picks: bowls with a grilled protein, a whole grain and vegetables; eggs, Greek yogurt, oats, fruit and nuts.",
    "india": "Easy picks: dal, roti or rice in a measured portion, sabzi, eggs, curd, paneer or chicken, and fruit.",
    "peru": "Easy picks: ceviche, grilled chicken or fish, quinoa, lentils, avocado and fruit. Lighter lomo saltado is fine.",
    "korea": "Easy picks: bibimbap with extra vegetables and egg, grilled fish, tofu stew, seaweed soup, kimchi and fruit.",
}

FUEL_RULES = ("This is healthy fueling, not dieting. Three meals and two snacks a day, protein at every meal, a vegetable or "
              "fruit at most meals, whole grains or starch for energy on training and walk-practice days, and 2 to 3 liters "
              "of water. No crash dieting, cleanses, diet pills or skipped meals. MDV does not set weight or measurement "
              "targets for any model. If a doctor or dietitian gives you a plan, that plan wins. Tell us any allergies or "
              "food limits in your health intake so this plan fits you.")

FUEL_SHOW = ("Show weeks: carry snacks (nuts, fruit, a protein bar, a sandwich), eat before every call time, keep water "
             "with you, and keep caffeine and alcohol low the night before a casting or show.")


def skin_plan(m):
    parts = [SKIN_BASE, SKIN_CLIMATE[m["climate"]]]
    if m["minor"]:
        parts = ["Guardian-led plan. Keep it to a gentle cleanser, moisturizer and SPF 30+. No acids, retinoids, peels or "
                 "treatments unless a pediatrician or dermatologist and your guardian both approve.",
                 SKIN_CLIMATE[m["climate"]]]
    if m["kind"] == "runway":
        parts.append(SKIN_PRESHOW)
    if m["travel"]:
        parts.append(SKIN_TRAVEL)
    parts.append(SKIN_SUBMISSION)
    return " ".join(parts)


def fuel_plan(m):
    if m["minor"]:
        return ("Guardian-led plan. Regular family meals and snacks with protein, fruit and vegetables, enough food to grow "
                "and train, 8 to 10 hours of sleep and plenty of water. No calorie limits, no weight or measurement targets, "
                "and no supplements without a pediatrician. " + FOOD[m["food"]] + " " + FUEL_SHOW)
    s = FUEL_RULES + " " + FOOD[m["food"]]
    if m["kind"] == "runway":
        s += " " + FUEL_SHOW
    return s


def walk_plan(m):
    if m["kind"] != "runway":
        return ("Editorial practice (no runway push): 10 poses in 3 looks in front of a mirror, plus 5 expressions for "
                "close-ups. Send a 10-pose contact sheet each check date.")
    return ("Walk practice, 30 minutes, Tuesday and Thursday. Warm up 5 minutes. Straight-line walk of 10 to 15 steps with "
            "level eyes and shoulders back, a clean turn at the end, pause, turn back. Practice in the shoe height you "
            "expect to wear. Film one 20-second clip from the front and one from the side, phone at hip height, plain "
            "background, full body in frame. Your agent gives written feedback and one drill for the next week.")


def health_layout(m):
    if m["minor"]:
        return ("Pediatrician check-up, dental cleaning and vision check by the dates in your gameplan, with your guardian. "
                "You share only 'cleared' or 'not cleared' with MDV. School hours and sleep come first.")
    s = ("Physical exam and bloodwork as your clinician advises (iron, vitamin D, B12 and thyroid are common for travel "
         "season), a dental cleaning and a vision check, all by the dates in your gameplan. You choose what to share: "
         "MDV only needs 'cleared' or 'not cleared', never your results.")
    if m["travel"]:
        s += " Travel health: ask your clinician about vaccines or medicines for your route, carry a copy of prescriptions, and bring your insurance card."
    return s
