"""Verify FastAPI app loads correctly."""
import sys
sys.path.insert(0, "V:/SIH26162")
sys.path.insert(0, ".")

from apps.api.main import app

print("FastAPI app loaded successfully")
print(f"Routes registered: {len(app.routes)}")
for r in app.routes:
    path = getattr(r, "path", "?")
    methods = getattr(r, "methods", "?")
    print(f"  {methods} {path}")
