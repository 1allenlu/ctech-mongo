import os
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()
client = MongoClient(os.environ["MONGODB_URI"])
client.admin.command("ping")

runs = client["hackathon"]["runs"]
runs.insert_one({"task": "app connection test", "status": "working"})
print("App connected to Atlas")