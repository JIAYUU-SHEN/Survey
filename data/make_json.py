import os
import json

FOLDER_PATH = "seygin/videos/rename"
CHUNK_SIZE = 100
START_INDEX = 1  # change this when appending a new folder

FILES = sorted(f"./data/seygin/videos/rename/{f}" for f in os.listdir(FOLDER_PATH) if f.endswith(".mp4"))

for i in range(0, len(FILES), CHUNK_SIZE):
    chunk = FILES[i:i + CHUNK_SIZE]
    start = START_INDEX + i
    end = start + len(chunk) - 1

    output_file = f"paths_{start}-{end}.json"
    with open(output_file, "w") as f:
        json.dump(chunk, f, indent=2)
