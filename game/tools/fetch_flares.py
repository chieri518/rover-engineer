#!/usr/bin/env python3
"""Print the strongest real solar flares in NASA's DONKI database as JSON for game/data/events.json.

Offline helper: run it once and paste the output into events.json under flare.realFlares.
The game never calls DONKI live.

Source: NASA Space Weather Database Of Notifications, Knowledge, Information (DONKI),
Community Coordinated Modeling Center (CCMC), https://ccmc.gsfc.nasa.gov/tools/DONKI/
Web service: https://ccmc.gsfc.nasa.gov/DONKI/WS/get/FLR (queries are limited to 60 days).

Usage: python3 fetch_flares.py [--count 20] [--start 2010-04-01] [--end 2026-11-14]
Keeps the strongest X-class flare of each day, then the top --count by class, sorted by date.
"""
import argparse
import datetime as dt
import json
import time
import urllib.request

URL = "https://ccmc.gsfc.nasa.gov/DONKI/WS/get/FLR?startDate={start}&endDate={end}"
SCALE = {"A": 1e-8, "B": 1e-7, "C": 1e-6, "M": 1e-5, "X": 1e-4}


def flux(cls: str) -> float:
    try:
        return SCALE[cls[0]] * float(cls[1:])
    except (KeyError, ValueError, IndexError):
        return 0.0


def fetch(start: dt.date, end: dt.date) -> list:
    flares = []
    day = start
    while day <= end:
        stop = min(day + dt.timedelta(days=59), end)
        with urllib.request.urlopen(URL.format(start=day, end=stop), timeout=120) as res:
            body = res.read().decode().strip()
        if body:
            flares += json.loads(body)
        day = stop + dt.timedelta(days=1)
        time.sleep(0.2)
    return flares


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--count", type=int, default=20)
    ap.add_argument("--start", default="2010-04-01")
    ap.add_argument("--end", default=dt.date.today().isoformat())
    args = ap.parse_args()
    flares = fetch(dt.date.fromisoformat(args.start), dt.date.fromisoformat(args.end))
    strongest = sorted((f for f in flares if f.get("classType", "").startswith("X")), key=lambda f: -flux(f["classType"]))
    picked, days = [], set()
    for f in strongest:
        day = f["peakTime"][:10]
        if day in days:
            continue
        days.add(day)
        picked.append({"date": day, "peakUtc": f["peakTime"][11:16], "class": f["classType"], "donkiId": f["flrID"]})
        if len(picked) == args.count:
            break
    picked.sort(key=lambda f: f["date"])
    print(json.dumps(picked, indent=2))


if __name__ == "__main__":
    main()
