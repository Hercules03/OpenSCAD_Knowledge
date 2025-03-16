# OpenSCAD Documentation Scraper

This tool systematically extracts content from OpenSCAD documentation sources to create high-quality training data for fine-tuning an LLM that specializes in 3D modeling with OpenSCAD.

## Overview

OpenSCAD is a powerful programming-based 3D modeling tool that uses its own scripting language. This project aims to create a comprehensive dataset from OpenSCAD's online documentation, including:

- The OpenSCAD cheat sheet
- The OpenSCAD user manual (Wikibooks)
- Code examples with their contextual explanations
- Command syntax and usage guidelines

The extracted data is structured in a way that's suitable for LLM fine-tuning, enabling the model to:

1. Understand OpenSCAD syntax and commands
2. Explain OpenSCAD concepts
3. Generate code examples for 3D modeling tasks
4. Assist with OpenSCAD programming challenges

## Features

- **Complete Documentation Coverage**: Extracts content from all essential sections of the OpenSCAD documentation.
- **Context-Aware Code Examples**: Associates code examples with their explanatory context.
- **Structured Data Output**: Organizes the data in a structured JSON format suitable for training.
- **Training Example Generation**: Creates question-answer pairs for more effective fine-tuning.

## Installation

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Setup

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/openscad-documentation-scraper.git
   cd openscad-documentation-scraper
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

Run the scraper:

```bash
node scraper.js
```

This will:
1. Extract content from the OpenSCAD cheat sheet
2. Extract content from all key sections of the OpenSCAD user manual
3. Save the structured data to the `output` directory
4. Generate training examples for LLM fine-tuning

## Output

The scraper generates the following output files:

- `openscad_training_data.json`: Complete dataset with all extracted content
- `openscad_cheatsheet.json`: Extracted content from the cheat sheet
- `openscad_usermanual.json`: Extracted content from the user manual
- `openscad_training_examples.json`: Generated question-answer pairs for training

## Data Structure

The extracted data follows this structure:

```javascript
{
  "metadata": {
    "description": "OpenSCAD Training Data for fine-tuning LLM",
    "version": "1.0",
    "date": "2025-03-16",
    "source": "..."
  },
  "cheatSheet": {
    "syntax": [
      { "name": "command", "description": "explanation", "links": [...] }
    ],
    "primitives2D": [...],
    "primitives3D": [...],
    "transformations": [...],
    // Other categories...
  },
  "userManual": {
    "general": {
      "title": "General",
      "url": "page_url",
      "introduction": "intro_text",
      "content": {
        "section_title": "section_content"
      },
      "codeExamples": [
        { "code": "code_sample", "context": "explanation" }
      ]
    },
    // Additional sections...
  }
}
```

## Training Examples

The generated training examples are structured as question-answer pairs:

```javascript
[
  {
    "query": "What is the syntax for cube in OpenSCAD?",
    "response": "The syntax for cube in OpenSCAD is: `cube(size = [x,y,z], center = true/false);`"
  },
  {
    "query": "Explain Primitive Solids in OpenSCAD",
    "response": "Primitive solids are the basic 3D shapes in OpenSCAD that..."
  },
  // More examples...
]
```

## Customization

You can customize the scraper by modifying:

- `pagesToScrape` array: Add or remove pages to scrape
- `processCheatSheetData` function: Change how cheat sheet data is categorized
- `createTrainingExamples` function: Customize the generated training examples

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- OpenSCAD documentation contributors
- Wikibooks OpenSCAD User Manual authors

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

# OpenSCAD Documentation Verification

This document explains how to use the verification script to ensure your scraped OpenSCAD documentation is complete.

## Overview

The verification script compares your scraped data with the content from the OpenSCAD User Manual print version to identify any missing information. It:

1. Extracts content from the print version of the OpenSCAD documentation
2. Compares it with your scraped data
3. Identifies missing sections, incomplete content, and missing code examples
4. Generates supplementary content to fill in the gaps
5. Creates enhanced training examples using the complete data

## Installation

1. Make sure you have Node.js installed
2. Install the required dependencies:

```bash
npm install puppeteer fs path
```

## Usage

1. Place the verification script in the same directory as your scraped data
2. Make sure your scraped data is saved as `output/openscad_training_data.json`
3. Run the script:

```bash
node verification-script.js
```

## Output

The script generates the following files in the `verification_output` directory:

1. `comparison_results.json` - Detailed comparison of scraped vs. print version content
2. `verification_report.md` - Human-readable report highlighting issues
3. `enhanced_training_data.json` - Your scraped data with missing content filled in
4. `enhanced_usermanual.json` - Just the enhanced user manual portion
5. `enhanced_training_examples.json` - Training examples generated from the enhanced data

## Key Sections Verified

The script focuses on verifying these key sections:

1. **Matrix** - Vector of vectors explanation
2. **Objects** - Object data structure documentation
3. **Retrieving a value from an object** - Object property access methods
4. **Iterating over object members** - How to loop through object properties
5. **Getting input** - OpenSCAD's input capabilities and limitations
6. **Vector operators** - Operations on vectors
7. **concat** - Concatenation function documentation
8. **len** - Length function documentation
9. **Special variables** - Documentation on $fa, $fs, $fn, etc.

## Interpreting the Results

### Missing Sections

These are sections found in the print version but completely missing from your scraped data. The script will:
- List all missing sections
- Show the content from the print version
- Add this content to the enhanced data

### Incomplete Content

These are sections that exist in your scraped data but are significantly shorter than in the print version (less than 70% of the print version length). The script will:
- Show both your scraped content and the print version content
- Replace your content with the print version in the enhanced data

### Missing Code Examples

Code examples found in the print version but missing from your scraped data. The script will:
- List all missing code examples
- Add them to the enhanced data

## Using the Enhanced Data

After running the verification, use the enhanced data files for your LLM training:

1. `enhanced_training_data.json` - Complete dataset with all missing content filled in
2. `enhanced_training_examples.json` - Ready-to-use training examples for your LLM

This ensures your LLM has access to the complete OpenSCAD documentation without any gaps.