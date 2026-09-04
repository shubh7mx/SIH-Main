import asyncio
import websockets

async def test_ws():
    for uri in ["ws://127.0.0.1/ws/alerts", "ws://127.0.0.1/api/v1/ws/alerts"]:
        print(f"Testing {uri}...")
        try:
            async with websockets.connect(uri) as ws:
                msg = await ws.recv()
                print(f"✓ {uri} Connected! First frame: {msg[:80]}")
        except Exception as e:
            print(f"✗ {uri} Failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_ws())
