import os
import json

FOLDER_PATH = "seygin/videos/rename"
CHUNK_SIZE = 100

FILES = sorted(f"./data/seygin/videos/rename/{f}" for f in os.listdir(FOLDER_PATH) if f.endswith(".mp4"))

for i in range(0, len(FILES), CHUNK_SIZE):
    chunk = FILES[i:i + CHUNK_SIZE]
    chunk_name = f"{i + 1}-{i + len(chunk)}"

    output_file = f"paths_{chunk_name}.json"
    with open(output_file, "w") as f:
        json.dump(chunk, f, indent=2)