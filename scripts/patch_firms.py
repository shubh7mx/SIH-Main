"""
Script to patch packages/ingestion/src/firms_poller.py to add real NASA open
data fallback. The new fetch_live_firms() calls the FIRMS API v2 if a key is
configured, else falls back to NASA's free global CSV (no auth required).
"""
import re

PATH = r"V:\SIH26162\packages\ingestion\src\firms_poller.py"

with open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

NEW_METHOD = '''    async def fetch_live_firms(self, day_range: int = 1) -> List[Dict[str, Any]]:
        """
        Fetches real NASA FIRMS VIIRS active fire detections for India.

        Strategy:
          1. If FIRMS_API_KEY is set -> call NASA FIRMS API v2 with India bbox
          2. Otherwise -> fetch NASA open global CSV and filter to India bbox
             (free, no key required, ~433 hotspots/day)
        """
        # Try authenticated NASA API first
        if self.api_key not in ("mock_demo_key", "your_firms_map_key_here", ""):
            url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{self.api_key}/{self.source}/{self.bbox}/{day_range}"
            async with httpx.AsyncClient(timeout=30.0) as client:
                try:
                    response = await client.get(url)
                    if response.status_code == 200 and response.text.strip():
                        print("[FIRMSPoller] Fetched via NASA FIRMS API v2")
                        return self._parse_firms_csv(response.text)
                except Exception as exc:
                    print(f"[FIRMSPoller] API fetch failed ({exc}), falling back to open data")

        # Fallback: NASA open global CSV, filter to India bbox
        return await self._fetch_from_open_data()

    async def _fetch_from_open_data(self) -> List[Dict[str, Any]]:
        """
        Fetches the latest global VIIRS 375m active fire CSV from NASA open
        data endpoint and filters to India bounding box (no API key required).
        """
        try:
            bbox_parts = [float(x.strip()) for x in self.bbox.split(",")]
            min_lat, min_lon, max_lat, max_lon = bbox_parts
        except Exception:
            min_lat, min_lon, max_lat, max_lon = 6.0, 68.0, 38.0, 98.0

        open_urls = [
            ("SUOMI_VIIRS_C2", "https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Global_24h.csv"),
            ("NOAA20_VIIRS_C2", "https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_Global_24h.csv"),
        ]

        for source_label, csv_url in open_urls:
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.get(csv_url)
                    if response.status_code != 200:
                        continue

                    hotspots = self._parse_firms_csv(
                        response.text,
                        bbox=(min_lat, min_lon, max_lat, max_lon),
                    )
                    if hotspots:
                        print(f"[FIRMSPoller] Fetched {len(hotspots)} REAL NASA FIRMS hotspots for India from {source_label} open feed")
                        return hotspots
            except Exception as exc:
                print(f"[FIRMSPoller] {source_label} open fetch failed: {exc}, trying next source...")
                continue

        print("[FIRMSPoller] WARNING: All NASA FIRMS sources unavailable. No data this poll.")
        return []

    def _parse_firms_csv(self, csv_text: str, bbox: tuple = None) -> List[Dict[str, Any]]:
        """
        Parses NASA FIRMS CSV text into hotspot dicts.
        If bbox is provided, filters to that bounding box.
        """
        lines = csv_text.strip().split("\\n")
        if len(lines) <= 1:
            return []

        header = [h.strip().lower() for h in lines[0].split(",")]
        hotspots = []

        for line in lines[1:]:
            if not line.strip():
                continue
            cols = [c.strip() for c in line.split(",")]
            record = dict(zip(header, cols))

            try:
                lat = float(record.get("latitude", 0.0))
                lon = float(record.get("longitude", 0.0))

                if bbox:
                    min_lat, min_lon, max_lat, max_lon = bbox
                    if not (min_lat <= lat <= max_lat and min_lon <= lon <= max_lon):
                        continue

                bright_ti4 = float(record.get("bright_ti4", record.get("brightness", 350.0)))
                frp = float(record.get("frp", 10.0))
                confidence = record.get("confidence", "n")
                if isinstance(confidence, str):
                    if confidence.lower() in ("h", "high"):
                        conf_val = 95
                    elif confidence.lower() in ("n", "nominal"):
                        conf_val = 70
                    elif confidence.lower() in ("l", "low"):
                        conf_val = 30
                    else:
                        conf_val = 50
                else:
                    conf_val = int(confidence)

                acq_date = record.get("acq_date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
                acq_time = record.get("acq_time", "1200")
                daynight = record.get("daynight", "D")

                dt_str = f"{acq_date} {acq_time.zfill(4)}"
                acq_dt = datetime.strptime(dt_str, "%Y-%m-%d %H%M").replace(tzinfo=timezone.utc)

                hotspot_id = self._generate_hotspot_id(self.source, lat, lon, acq_dt.isoformat())
                if self.is_duplicate(hotspot_id):
                    continue

                self.mark_seen(hotspot_id)

                hotspots.append({
                    "firms_id": hotspot_id,
                    "latitude": lat,
                    "longitude": lon,
                    "h3_index": self._compute_h3(lat, lon, 8),
                    "brightness_temp_kelvin": bright_ti4,
                    "frp_megawatts": frp,
                    "confidence_pct": conf_val,
                    "satellite_source": self.source,
                    "day_night": daynight,
                    "scan_angle": float(record.get("scan", 0.0)) if record.get("scan") else None,
                    "track_pixel": float(record.get("track", 0.0)) if record.get("track") else None,
                    "acq_datetime": acq_dt.isoformat(),
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
            except Exception as parse_err:
                continue

        return hotspots
'''

# Find the start of the old function
old_start = content.find('    async def fetch_live_firms(self, day_range: int = 1)')
# Find the end: next method or top-level def
# Look for the next '    def ' or '    async def ' at the same indentation AFTER old_start
search_from = old_start + 1
# The next class-level method after fetch_live_firms is generate_simulated_hotspots
end_marker = '    def generate_simulated_hotspots'
old_end = content.find(end_marker, search_from)
assert old_end > old_start, f"Could not find end marker, start={old_start}"

# Replace
new_content = content[:old_start] + NEW_METHOD + content[old_end:]

with open(PATH, "w", encoding="utf-8") as f:
    f.write(new_content)

print(f"Replaced {old_end - old_start} chars with {len(NEW_METHOD)} chars")
print(f"File size: {len(new_content)} chars")
