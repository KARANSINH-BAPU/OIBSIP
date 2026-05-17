"""
NOVA - Vercel Serverless Entry Point
Wraps the Flask app for Vercel deployment.
"""
import sys
import os

# Add parent directory so we can import app.py
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app

# Vercel expects a variable named 'app' or handler
handler = app
