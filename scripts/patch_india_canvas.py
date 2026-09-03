"""Replace IndiaCanvas with responsive version that fixes sizing."""
PATH = r"V:\SIH26162\apps\web\src\app\page.tsx"

with open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

# Find start: `function IndiaCanvas`
start = content.find("function IndiaCanvas({ events }: { events: HotspotEvent[] }) {")
assert start > 0, "Could not find IndiaCanvas"

# Find end: next function declaration at same indent
# Find "function CaseStudyCanvas" (next function)
end = content.find("function CaseStudyCanvas", start)
assert end > start, "Could not find end marker"
# Move end back to before any preceding newline/whitespace
while end > 0 and content[end-1] in " \t\n":
    end -= 1
# Add 2 newlines after end so next function is on its own line
end = content.find("\n", end) + 1

NEW_FN = '''function IndiaCanvas({ events }: { events: HotspotEvent[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    let ro: ResizeObserver | null = null;

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const W = Math.max(rect.width, 320);
      const H = Math.max(rect.height, 240);
      if (canvas.width !== W) canvas.width = W;
      if (canvas.height !== H) canvas.height = H;

      const INDIA = { minLat: 6, maxLat: 38, minLon: 68, maxLon: 98 };
      const toCanvas = (lat: number, lon: number) => ({
        x: ((lon - INDIA.minLon) / (INDIA.maxLon - INDIA.minLon)) * W,
        y: H - ((lat - INDIA.minLat) / (INDIA.maxLat - INDIA.minLat)) * H,
      });

      // Background
      ctx.fillStyle = "#04070b";
      ctx.fillRect(0, 0, W, H);

      // Lat/lon grid
      ctx.strokeStyle = "rgba(148,184,220,0.06)";
      ctx.lineWidth = 1;
      for (let lon = 70; lon <= 98; lon += 5) {
        const { x } = toCanvas(20, lon);
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let lat = 10; lat <= 38; lat += 5) {
        const { y } = toCanvas(lat, 80);
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      // Lat/lon labels
      ctx.fillStyle = "rgba(148,184,220,0.35)";
      ctx.font = `${Math.max(9, H * 0.018)}px monospace`;
      ctx.fillText("68°E", 8, H - 8);
      ctx.fillText("98°E", W - 32, H - 8);
      ctx.fillText("38°N", 4, 14);
      ctx.fillText("6°N", 4, H - 4);

      // India outline polygon
      const outline: [number, number][] = [
        [6.5,80],[8.5,77],[9.5,76.5],[12,74.5],[14.5,74.5],
        [15.5,73.5],[16.5,73],[18,73],[19.5,72],[20.5,71],
        [21.5,69],[22.5,69],[22.5,68],[24,68],[25,68.5],
        [27,70],[28,72],[29.5,74],[30.5,76],[32,78],
        [33.5,79],[35,79],[36,80],[37,80.5],[37,82],
        [37.5,84],[37,86],[36,88],[34.5,90],[34,91.5],
        [33,92.5],[31,94],[28,95],[26,95],[24,94.5],
        [22,94],[21,93.5],[20,92.5],[18.5,92.5],[17.5,93],
        [16,94],[15,94.5],[13,94],[11.5,93],[10.5,92.5],
        [9,92.5],[8,92.5],[7,93],[6.5,93.5],[6,93],[6,92],[6.5,80],
      ];

      ctx.beginPath();
      outline.forEach(([lat, lon], i) => {
        const { x, y } = toCanvas(lat, lon);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fillStyle = "rgba(92,198,230,0.04)";
      ctx.fill();
      ctx.strokeStyle = "rgba(92,198,230,0.28)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Facility dots
      const facs: [number, number][] = [
        [22.368,69.832],[22.031,88.082],[29.39,76.963],[17.724,83.265],
        [22.804,86.202],[18.93,72.83],[19.08,72.87],
      ];
      facs.forEach(([lat, lon]) => {
        const { x, y } = toCanvas(lat, lon);
        ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(92,198,230,0.5)"; ctx.fill();
        ctx.strokeStyle = "rgba(92,198,230,0.15)"; ctx.lineWidth = 1; ctx.stroke();
      });

      // Live events
      const displayEvents = events.length > 0
        ? events.slice(0, 8)
        : [FALLBACK_EVENT];

      displayEvents.forEach((ev, idx) => {
        const { x, y } = toCanvas(ev.latitude, ev.longitude);
        const color = ev.is_critical_alert ? "#ef4444" : "#f59e0b";
        const size = 4 + Math.min(idx, 3);

        const pulseR = size + 12 + Math.sin(Date.now() / 300 + idx) * 3;
        ctx.beginPath(); ctx.arc(x, y, pulseR, 0, Math.PI * 2);
        ctx.strokeStyle = ev.is_critical_alert
          ? "rgba(239,68,68,0.25)"
          : "rgba(245,158,11,0.25)";
        ctx.lineWidth = 1.5; ctx.stroke();

        ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = color; ctx.fill();
      });

      // Annotate primary event
      if (displayEvents[0]) {
        const primary = displayEvents[0];
        const { x: ax, y: ay } = toCanvas(primary.latitude, primary.longitude);
        const color = primary.is_critical_alert ? "#ef4444" : "#f59e0b";
        ctx.fillStyle = color; ctx.font = "11px monospace";
        ctx.fillText(`${primary.id} · ${(primary.confidence_score * 100).toFixed(1)}%`, ax + 8, ay - 10);
        ctx.fillStyle = "rgba(232,238,245,0.4)"; ctx.font = "10px monospace";
        ctx.fillText(primary.facility_name ?? primary.classification, ax + 8, ay + 4);
      }

      // Animated scan line
      const scanY = ((Date.now() / 1000) % 5) / 5 * H;
      const grad = ctx.createLinearGradient(0, scanY - 30, 0, scanY + 30);
      grad.addColorStop(0, "transparent");
      grad.addColorStop(0.5, "rgba(92,198,230,0.2)");
      grad.addColorStop(1, "transparent");
      ctx.fillStyle = grad; ctx.fillRect(0, scanY - 30, W, 60);

      frame = requestAnimationFrame(render);
    };

    render();

    ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      render();
    });
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(frame);
      ro?.disconnect();
    };
  }, [events]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block"
      style={{ display: "block", width: "100%", height: "100%" }}
    />
  );
}

'''

new_content = content[:start] + NEW_FN + content[end:]

with open(PATH, "w", encoding="utf-8") as f:
    f.write(new_content)

print(f"Replaced {end-start} chars with {len(NEW_FN)} chars")
print(f"File size: {len(new_content)} chars")
