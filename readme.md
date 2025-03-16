# OpenSCAD Documentation Scraper

This tool scrapes the OpenSCAD documentation from various sources and organizes it into a structured format suitable for training a Large Language Model (LLM).

## Features

- Scrapes the OpenSCAD cheat sheet from openscad.org
- Scrapes the OpenSCAD User Manual from Wikibooks
- Scrapes the OpenSCAD Language Reference sections
- Scrapes OpenSCAD tutorials and examples
- Extracts code examples, parameters, and descriptions
- Organizes content into a structured JSON format
- Converts the data into a training-friendly text format

## Requirements

- Python 3.6 or higher
- Internet connection

## Installation

1. Clone or download this repository
2. Install the required packages:

```bash
pip install -r requirements.txt
```

## Usage

### Running the Scraper

On Linux/macOS:
```bash
./run_scraper.sh
```

On Windows:
```bash
run_scraper.bat
```

Or run directly with Python:
```bash
python scraper.py --output openscad_docs
```

### Command Line Options

- `--output`: Specify the output directory (default: `openscad_docs`)
- `--skip-cheatsheet`: Skip scraping the cheat sheet
- `--skip-wiki`: Skip scraping the wiki pages

Example:
```bash
python scraper.py --output custom_dir --skip-cheatsheet
```

## Output

The script generates the following directory structure:

```
openscad_docs/
├── cheatsheet/
│   └── cheatsheet.json
├── user_manual/
│   └── [multiple JSON files]
├── language_reference/
│   └── [multiple JSON files]
├── tutorials/
│   └── [multiple JSON files]
├── examples/
│   └── [multiple JSON files]
├── openscad_complete_documentation.json
└── openscad_training_data.txt
```

- Individual JSON files contain structured data for each page
- `openscad_complete_documentation.json` combines all the data into a single file
- `openscad_training_data.txt` formats the data for LLM training

## Training Your Model

The `openscad_training_data.txt` file is formatted specifically for LLM training, with:

1. Hierarchical organization of content (sections, subsections)
2. OpenSCAD code examples in ```scad``` blocks
3. Parameter descriptions and default values
4. Cross-references between related concepts

You can use this file directly as training data for your LLM fine-tuning process.

## Customizing the Scraper

If you need to modify the scraping behavior:

1. Edit the `scraper.py` file to add more sources or change the parsing logic
2. Modify the `format_for_training()` function to change the training data format

## Troubleshooting

If you encounter any issues:

- Make sure you have an active internet connection
- Check that you have the required Python version
- Ensure all dependencies are installed correctly
- If websites have changed their structure, you may need to update the parsing logic

## License

This project is licensed under the MIT License - see the LICENSE file for details.
