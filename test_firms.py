import asyncio
import sys
sys.path.insert(0, ".")
from packages.ingestion.src.firms_poller import FIRMSPoller

async def test():
    p = FIRMSPoller()
    print("Fetching real NASA FIRMS data for India...")
    hotspots = await p.fetch_live_firms()
    print(f"Fetched {len(hotspots)} hotspots")
    if hotspots:
        h = hotspots[0]
        print(f"Sample 1: lat={h['latitude']}, lon={h['longitude']}, frp={h['frp_megawatts']} MW, bt={h['brightness_temp_kelvin']}K, source={h['satellite_source']}")
        if len(hotspots) > 1:
            h2 = hotspots[-1]
            print(f"Sample last: lat={h2['latitude']}, lon={h2['longitude']}, frp={h2['frp_megawatts']} MW")
    return hotspots

hotspots = asyncio.run(test())
print(f"\nResult: {len(hotspots)} real NASA FIRMS observations for India")
