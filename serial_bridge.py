"""
==============================================================
Arduino Uno Serial Bridge (Optional Python Fallback)
==============================================================
Description:
  Bridge script using PySerial and WebSockets.
  Use this script if running in a browser environment that doesn't 
  support native Web Serial API.

Usage:
  pip install pyserial websockets
  python serial_bridge.py --port COM3 --baud 9600
==============================================================
"""

import asyncio
import sys
import argparse
try:
    import serial
    import websockets
except ImportError:
    print("[ERROR] Missing dependencies. Run: pip install pyserial websockets")
    sys.exit(1)

connected_clients = set()
ser = None

async def serial_reader_loop():
    global ser
    while True:
        if ser and ser.is_open:
            try:
                if ser.in_waiting > 0:
                    line = ser.readline().decode('utf-8', errors='ignore').strip()
                    if line:
                        print(f"[ARDUINO -> WS] {line}")
                        # Broadcast to all websocket clients
                        if connected_clients:
                            await asyncio.gather(*[client.send(line) for client in connected_clients])
            except Exception as e:
                print(f"[SERIAL READ ERROR] {e}")
        await asyncio.sleep(0.05)

async def websocket_handler(websocket):
    global ser
    connected_clients.add(websocket)
    print(f"[WEBSOCKET] Client connected: {websocket.remote_address}")
    try:
        async for message in websocket:
            print(f"[WS -> ARDUINO] {message}")
            if ser and ser.is_open:
                ser.write((message + "\n").encode('utf-8'))
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        connected_clients.remove(websocket)
        print(f"[WEBSOCKET] Client disconnected")

async def main():
    parser = argparse.ArgumentParser(description="Arduino Serial to WebSocket Bridge")
    parser.add_argument("--port", type=str, default="COM3", help="Serial port (e.g. COM3 or /dev/ttyUSB0)")
    parser.add_argument("--baud", type=int, default=115200, help="Baud rate (default 115200)")
    parser.add_argument("--ws-port", type=int, default=8765, help="WebSocket server port (default 8765)")
    args = parser.parse_args()

    global ser
    try:
        ser = serial.Serial(args.port, args.baud, timeout=1)
        print(f"✅ Connected to Arduino on {args.port} at {args.baud} baud.")
    except Exception as e:
        print(f"⚠️ Could not open serial port {args.port}: {e}")
        print("Running in WS mock server mode.")

    async with websockets.serve(websocket_handler, "localhost", args.ws-port):
        print(f"🚀 WebSocket Bridge running on ws://localhost:{args.ws-port}")
        await serial_reader_loop()

if __name__ == "__main__":
    asyncio.run(main())
