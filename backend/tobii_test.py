import tobii_research as tr
import time

def gaze_data_callback(gaze_data):
    left_eye = gaze_data['left_gaze_point_on_display_area']
    right_eye = gaze_data['right_gaze_point_on_display_area']
    print(f"Timestamp: {gaze_data['device_time_stamp']}")
    print(f"System time: {gaze_data['system_time_stamp']}")
    print(f"Left eye - X: {left_eye[0]:.4f}, Y: {left_eye[1]:.4f}")
    print(f"Right eye - X: {right_eye[0]:.4f}, Y: {right_eye[1]:.4f}")
    print("--------------------")

def main():
    eyetrackers = tr.find_all_eyetrackers()
    
    if len(eyetrackers) == 0:
        print("No eye trackers found")
        return
    
    eyetracker = eyetrackers[0]
    print(f"Found eye tracker: {eyetracker.model}")
    
    eyetracker.subscribe_to(tr.EYETRACKER_GAZE_DATA, gaze_data_callback, as_dictionary=True)
    
    print("Collecting gaze data. Press Ctrl+C to stop.")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        eyetracker.unsubscribe_from(tr.EYETRACKER_GAZE_DATA, gaze_data_callback)
        print("Stopped gaze data collection.")

if __name__ == "__main__":
    main()
