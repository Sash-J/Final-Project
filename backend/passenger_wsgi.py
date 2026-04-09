import sys
import os

# Add the app directory to the path
sys.path.append(os.getcwd())

# Import the Flask app object from your app.py
# If your app object is named 'app' in 'app.py', use:
from app import app as application

# Passenger expects the variable name 'application'
