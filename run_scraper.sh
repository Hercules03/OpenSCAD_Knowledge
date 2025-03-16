#!/bin/bash
# run_scraper.sh - Script to run the OpenSCAD documentation scraper

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "Python 3 is required but not found. Please install Python 3."
    exit 1
fi

# Create and activate virtual environment
echo "Setting up virtual environment..."
python3 -m venv venv

# Activate virtual environment (platform-dependent)
if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    source venv/Scripts/activate
else
    source venv/bin/activate
fi

# Install required packages
echo "Installing required packages..."
pip install requests beautifulsoup4

# Run the scraper
echo "Starting the OpenSCAD documentation scraper..."
python scraper.py --output openscad_docs

# Generate training data format
echo "Generating training data..."
python scraper.py --output openscad_docs --skip-cheatsheet --skip-wiki

echo "Scraping completed! Results are in the 'openscad_docs' directory."
echo "The main training file is 'openscad_docs/openscad_training_data.txt'"
