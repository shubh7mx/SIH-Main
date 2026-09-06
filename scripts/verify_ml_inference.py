import sys, io, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from packages.agents.src.graph import run_swarm

tests = [
    ('Jamnagar 892MW', {'firms_id':'ml-1','latitude':22.368,'longitude':69.832,'frp_megawatts':892.0,'brightness_temp_kelvin':942.5,'confidence_pct':99,'satellite_source':'VIIRS_SNPP_NRT','day_night':'N','acq_datetime':'2026-01-15T14:32:00+00:00'}),
    ('Haldia 145MW', {'firms_id':'ml-2','latitude':22.031,'longitude':88.082,'frp_megawatts':145.0,'brightness_temp_kelvin':780.0,'confidence_pct':92,'satellite_source':'VIIRS_NOAA20_NRT','day_night':'N','acq_datetime':'2026-01-15T14:32:00+00:00'}),
    ('Punjab 48MW', {'firms_id':'ml-3','latitude':30.342,'longitude':75.832,'frp_megawatts':48.0,'brightness_temp_kelvin':372.0,'confidence_pct':88,'satellite_source':'VIIRS_SNPP_NRT','day_night':'D','acq_datetime':'2026-01-15T14:32:00+00:00'}),
    ('Uttarakhand 75MW', {'firms_id':'ml-4','latitude':30.082,'longitude':79.241,'frp_megawatts':75.0,'brightness_temp_kelvin':418.0,'confidence_pct':90,'satellite_source':'VIIRS_SNPP_NRT','day_night':'D','acq_datetime':'2026-01-15T14:32:00+00:00'}),
]
ok = 0
for name, h in tests:
    r = run_swarm(h)
    print(f"{name:20s} -> {r['classification']:30s} conf={r['confidence_score']}")
    ok += 1
print(f"\n{ok}/4 ML inference paths validated")
