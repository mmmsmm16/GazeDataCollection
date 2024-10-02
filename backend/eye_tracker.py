import asyncio
import websockets
import json
import tobii_research as tr
import logging
import math

logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

async def find_eyetracker():
    eyetrackers = tr.find_all_eyetrackers()
    if len(eyetrackers) == 0:
        logging.error("No eyetrackers found.")
        return None
    logging.info(f"Found eyetracker: {eyetrackers[0].model}")
    return eyetrackers[0]

def encode_nan(obj):
    if isinstance(obj, float) and math.isnan(obj):
        return "NaN"
    return obj

async def send_gaze_data(websocket, path):
    eyetracker = await find_eyetracker()
    if eyetracker is None:
        await websocket.close()
        return

    gaze_data = None
    gaze_data_event = asyncio.Event()

    def gaze_data_callback(gd):
        nonlocal gaze_data
        left_gaze_point = gd['left_gaze_point_on_display_area']
        right_gaze_point = gd['right_gaze_point_on_display_area']
        gaze_data = {
            'timestamp': gd['device_time_stamp'],
            'left_x': left_gaze_point[0],
            'left_y': left_gaze_point[1],
            'right_x': right_gaze_point[0],
            'right_y': right_gaze_point[1]
        }
        gaze_data_event.set()

    eyetracker.subscribe_to(tr.EYETRACKER_GAZE_DATA, gaze_data_callback, as_dictionary=True)

    try:
        while True:
            await gaze_data_event.wait()
            gaze_data_event.clear()
            if gaze_data:
                await websocket.send(json.dumps(gaze_data, default=encode_nan))
                logging.debug(f"Sent gaze data: {gaze_data}")
    except websockets.exceptions.ConnectionClosed:
        logging.info("Client disconnected")
    finally:
        eyetracker.unsubscribe_from(tr.EYETRACKER_GAZE_DATA, gaze_data_callback)

async def main():
    server = await websockets.serve(send_gaze_data, "0.0.0.0", 8765)
    logging.info("WebSocket server started on ws://0.0.0.0:8765")
    await server.wait_closed()

if __name__ == "__main__":
    asyncio.run(main())
