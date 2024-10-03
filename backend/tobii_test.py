import tobii_research as tr

def check_supported_frequencies():
    eyetrackers = tr.find_all_eyetrackers()
    if len(eyetrackers) == 0:
        print("No eye trackers found")
        return
    
    eyetracker = eyetrackers[0]
    print(f"Found eye tracker: {eyetracker.model}")
    
    try:
        frequencies = eyetracker.get_all_gaze_output_frequencies()
        print(f"Supported frequencies: {frequencies}")
        
        current_frequency = eyetracker.get_gaze_output_frequency()
        print(f"Current frequency: {current_frequency}")
    except Exception as e:
        print(f"Error getting frequencies: {e}")

if __name__ == "__main__":
    check_supported_frequencies()
