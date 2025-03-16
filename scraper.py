#!/usr/bin/env python3
"""
OpenSCAD Documentation Scraper

This script scrapes the OpenSCAD documentation from various sources and organizes it
into a structured format suitable for LLM training.

Sources:
- OpenSCAD Cheat Sheet (https://openscad.org/cheatsheet/)
- OpenSCAD User Manual (https://en.wikibooks.org/wiki/OpenSCAD_User_Manual)
- OpenSCAD Language Reference (sections in the User Manual)
- OpenSCAD Tutorial pages

The script outputs JSON files with structured documentation content.
"""

import requests
from bs4 import BeautifulSoup, NavigableString
import json
import os
import re
import time
import argparse
from urllib.parse import urljoin, urlparse

# Constants
USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
DELAY = 1  # Delay between requests in seconds to be respectful
OUTPUT_DIR = 'openscad_docs'

# Base URLs
CHEATSHEET_URL = 'https://openscad.org/cheatsheet/'
USER_MANUAL_URL = 'https://en.wikibooks.org/wiki/OpenSCAD_User_Manual'
BASE_WIKI_URL = 'https://en.wikibooks.org'

# Configuration
WIKIBOOKS_EXCLUDE_PATTERNS = [
    '/w/', 'action=edit', 'printable=yes', 
    'oldid=', 'Category:', 'Special:', 'Talk:'
]

def setup_directories(base_dir):
    """Create the necessary directories for output files."""
    dirs = [
        base_dir,
        os.path.join(base_dir, 'cheatsheet'),
        os.path.join(base_dir, 'user_manual'),
        os.path.join(base_dir, 'language_reference'),
        os.path.join(base_dir, 'tutorials'),
        os.path.join(base_dir, 'examples')
    ]
    for directory in dirs:
        os.makedirs(directory, exist_ok=True)
    return dirs

def make_request(url):
    """Make an HTTP request with proper headers and error handling."""
    headers = {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml',
        'Accept-Language': 'en-US,en;q=0.9'
    }
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()  # Raise an error for bad status codes
        return response.text
    except requests.exceptions.RequestException as e:
        print(f"Error fetching {url}: {e}")
        return None

def is_valid_wiki_link(link, visited_urls):
    """Check if a wiki link should be followed."""
    if not link or not link.startswith('/wiki/OpenSCAD'):
        return False
        
    # Skip already visited links
    if link in visited_urls:
        return False
        
    # Skip excluded patterns
    for pattern in WIKIBOOKS_EXCLUDE_PATTERNS:
        if pattern in link:
            return False
            
    return True

def extract_code_blocks(element):
    """Extract code blocks from HTML element."""
    code_blocks = []
    
    # Find all <pre> and <code> elements
    pre_elements = element.find_all('pre')
    for pre in pre_elements:
        code_text = pre.get_text(strip=True)
        # Check if it's likely OpenSCAD code (contains typical keywords)
        if re.search(r'(cube|sphere|cylinder|translate|rotate|union|difference|intersection|module|function)', code_text):
            code_blocks.append({
                'code': code_text,
                'type': 'block'
            })
    
    # Find inline code (often in <code> tags)
    code_elements = element.find_all('code')
    for code in code_elements:
        if code.parent.name != 'pre':  # Skip code blocks already captured
            code_text = code.get_text(strip=True)
            code_blocks.append({
                'code': code_text,
                'type': 'inline'
            })
    
    return code_blocks

def extract_parameters(element):
    """Extract parameter descriptions from the documentation."""
    parameters = []
    
    # Look for parameter tables or lists
    tables = element.find_all('table')
    for table in tables:
        # Check if this looks like a parameter table
        headers = table.find_all('th')
        header_text = ' '.join([h.get_text(strip=True) for h in headers]).lower()
        
        if 'parameter' in header_text or 'name' in header_text:
            rows = table.find_all('tr')
            for row in rows[1:]:  # Skip header row
                cells = row.find_all(['td', 'th'])
                if len(cells) >= 2:
                    param_name = cells[0].get_text(strip=True)
                    param_desc = cells[1].get_text(strip=True)
                    
                    # Try to extract type and default value if available
                    param_type = ''
                    default_value = ''
                    
                    if len(cells) >= 3:
                        param_type = cells[2].get_text(strip=True)
                    
                    # Look for default values in the description
                    default_match = re.search(r'default[:\s]+([^\.]+)', param_desc, re.IGNORECASE)
                    if default_match:
                        default_value = default_match.group(1).strip()
                    
                    parameters.append({
                        'name': param_name,
                        'description': param_desc,
                        'type': param_type,
                        'default': default_value
                    })
    
    # Also look for description lists (dl/dt/dd)
    dl_elements = element.find_all('dl')
    for dl in dl_elements:
        dt_elements = dl.find_all('dt')
        for dt in dt_elements:
            param_name = dt.get_text(strip=True)
            # Find the next dd element
            dd = dt.find_next('dd')
            if dd:
                param_desc = dd.get_text(strip=True)
                parameters.append({
                    'name': param_name,
                    'description': param_desc,
                    'type': '',
                    'default': ''
                })
    
    return parameters

def extract_content_recursively(element, max_depth=3, current_depth=0):
    """
    Extract content from an element recursively, preserving hierarchy.
    """
    if current_depth > max_depth:
        return None
    
    # Skip unwanted elements
    if element.name in ['script', 'style', 'nav', 'footer', 'header']:
        return None
        
    # For NavigableString, just return the text
    if isinstance(element, NavigableString):
        text = element.strip()
        return text if text else None
    
    # Initialize the content dictionary
    content = {
        'tag': element.name if element.name else 'text',
        'text': element.get_text(strip=True),
        'children': []
    }
    
    # Add attributes for special elements
    if element.name in ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']:
        content['heading_level'] = int(element.name[1])
        content['id'] = element.get('id', '')
    
    # Extract links
    if element.name == 'a' and element.has_attr('href'):
        content['href'] = element['href']
    
    # Recursively process children
    for child in element.children:
        child_content = extract_content_recursively(child, max_depth, current_depth + 1)
        if child_content:
            if isinstance(child_content, list):
                content['children'].extend(child_content)
            else:
                content['children'].append(child_content)
    
    # For leaf nodes with no meaningful children, simplify
    if not content['children'] and not content['text']:
        return None
    
    return content

def extract_section_content(soup, section_id):
    """Extract content from a specific section by ID."""
    section = soup.find(id=section_id)
    if not section:
        return None
        
    # Find the heading element that contains this ID
    heading = section
    while heading and heading.name not in ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']:
        heading = heading.parent
    
    if not heading:
        return None
    
    # Determine the heading level (h1, h2, etc.)
    heading_level = int(heading.name[1])
    
    # Collect all content until the next heading of same or higher level
    content_elements = []
    sibling = heading.next_sibling
    while sibling:
        if sibling.name in ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']:
            sibling_level = int(sibling.name[1])
            if sibling_level <= heading_level:
                break
        content_elements.append(sibling)
        sibling = sibling.next_sibling
    
    # Process the collected elements
    section_content = {
        'title': heading.get_text(strip=True),
        'id': section_id,
        'content': [],
        'code_examples': extract_code_blocks(heading.parent),
        'parameters': extract_parameters(heading.parent)
    }
    
    for element in content_elements:
        if element.name:  # Skip NavigableString
            content = extract_content_recursively(element)
            if content:
                section_content['content'].append(content)
                
                # Add any code examples or parameters found
                section_content['code_examples'].extend(extract_code_blocks(element))
                section_content['parameters'].extend(extract_parameters(element))
    
    return section_content

def scrape_cheatsheet(url, output_dir):
    """Scrape the OpenSCAD Cheat Sheet."""
    print(f"Scraping cheat sheet from {url}")
    html = make_request(url)
    if not html:
        return None
        
    soup = BeautifulSoup(html, 'html.parser')
    
    # The cheat sheet has a unique structure with sections denoted by h2 elements
    sections = []
    
    h2_elements = soup.find_all('h2')
    for h2 in h2_elements:
        section_title = h2.get_text(strip=True)
        section = {
            'title': section_title,
            'content': [],
            'code_examples': [],
            'parameters': []
        }
        
        # Get all content until the next h2
        current = h2.next_sibling
        while current and current.name != 'h2':
            if current.name:  # Skip NavigableString
                content = extract_content_recursively(current)
                if content:
                    section['content'].append(content)
                    
                    # Add any code examples found
                    section['code_examples'].extend(extract_code_blocks(current))
                    section['parameters'].extend(extract_parameters(current))
            current = current.next_sibling
        
        sections.append(section)
    
    # Save the cheat sheet data
    cheatsheet_data = {
        'title': 'OpenSCAD Cheat Sheet',
        'url': url,
        'sections': sections
    }
    
    output_file = os.path.join(output_dir, 'cheatsheet', 'cheatsheet.json')
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(cheatsheet_data, f, indent=2, ensure_ascii=False)
    
    print(f"Cheat sheet saved to {output_file}")
    return cheatsheet_data

def scrape_wiki_page(url, output_dir, visited_urls, section_type='user_manual'):
    """Scrape a Wikibooks page about OpenSCAD."""
    # Skip if already visited
    parsed_url = urlparse(url)
    page_path = parsed_url.path
    if page_path in visited_urls:
        return None
        
    visited_urls.add(page_path)
    
    print(f"Scraping wiki page: {url}")
    html = make_request(url)
    if not html:
        return None
        
    soup = BeautifulSoup(html, 'html.parser')
    
    # Get page title
    title_element = soup.find('h1', {'id': 'firstHeading'})
    if not title_element:
        title = os.path.basename(page_path)
    else:
        title = title_element.get_text(strip=True)
    
    # Extract main content
    content_div = soup.find('div', {'id': 'mw-content-text'})
    if not content_div:
        print(f"No content found for {url}")
        return None
    
    # Find all sections (h2, h3, etc.) in the content
    sections = []
    headings = content_div.find_all(['h2', 'h3', 'h4', 'h5'])
    
    for heading in headings:
        # Skip edit section links
        if heading.find('span', {'class': 'mw-editsection'}):
            heading.find('span', {'class': 'mw-editsection'}).decompose()
        
        section_title = heading.get_text(strip=True)
        section_id = heading.get('id', '')
        
        # Skip certain sections
        if section_title in ['References', 'External links', 'See also', 'Navigation menu']:
            continue
        
        section = {
            'title': section_title,
            'id': section_id,
            'content': [],
            'code_examples': [],
            'parameters': []
        }
        
        # Get all content until the next heading of the same level or higher
        heading_level = int(heading.name[1])  # Extract number from h2, h3, etc.
        
        current = heading.next_sibling
        while current:
            if current.name in ['h2', 'h3', 'h4', 'h5']:
                current_level = int(current.name[1])
                if current_level <= heading_level:
                    break
            
            if current.name:  # Skip NavigableString
                content = extract_content_recursively(current)
                if content:
                    section['content'].append(content)
                    
                    # Add any code examples found
                    section['code_examples'].extend(extract_code_blocks(current))
                    section['parameters'].extend(extract_parameters(current))
            
            current = current.next_sibling
        
        sections.append(section)
    
    # Find links to other OpenSCAD pages
    links_to_follow = []
    for link in content_div.find_all('a'):
        if link.has_attr('href'):
            href = link['href']
            if is_valid_wiki_link(href, visited_urls):
                full_url = urljoin(BASE_WIKI_URL, href)
                links_to_follow.append(full_url)
    
    # Save the page data
    page_data = {
        'title': title,
        'url': url,
        'sections': sections
    }
    
    # Determine the appropriate output directory
    if 'Tutorial' in title:
        output_subdir = os.path.join(output_dir, 'tutorials')
    elif 'Language' in title:
        output_subdir = os.path.join(output_dir, 'language_reference')
    elif 'Example' in title:
        output_subdir = os.path.join(output_dir, 'examples')
    else:
        output_subdir = os.path.join(output_dir, section_type)
    
    # Create a filename from the title
    filename = re.sub(r'[^\w]+', '_', title).lower()
    output_file = os.path.join(output_subdir, f"{filename}.json")
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(page_data, f, indent=2, ensure_ascii=False)
    
    print(f"Page saved to {output_file}")
    
    # Follow links to other OpenSCAD pages (with delay to be respectful)
    for link in links_to_follow:
        time.sleep(DELAY)
        scrape_wiki_page(link, output_dir, visited_urls, section_type)
    
    return page_data

def merge_data_into_single_file(output_dir):
    """Merge all JSON files into a single comprehensive file."""
    all_data = {
        'title': 'OpenSCAD Complete Documentation',
        'cheatsheet': {},
        'user_manual': [],
        'language_reference': [],
        'tutorials': [],
        'examples': []
    }
    
    # Load cheatsheet
    cheatsheet_dir = os.path.join(output_dir, 'cheatsheet')
    for filename in os.listdir(cheatsheet_dir):
        if filename.endswith('.json'):
            with open(os.path.join(cheatsheet_dir, filename), 'r', encoding='utf-8') as f:
                all_data['cheatsheet'] = json.load(f)
    
    # Load user manual
    for section_type in ['user_manual', 'language_reference', 'tutorials', 'examples']:
        section_dir = os.path.join(output_dir, section_type)
        if os.path.exists(section_dir):
            for filename in os.listdir(section_dir):
                if filename.endswith('.json'):
                    with open(os.path.join(section_dir, filename), 'r', encoding='utf-8') as f:
                        all_data[section_type].append(json.load(f))
    
    # Save the merged data
    with open(os.path.join(output_dir, 'openscad_complete_documentation.json'), 'w', encoding='utf-8') as f:
        json.dump(all_data, f, indent=2, ensure_ascii=False)
    
    print(f"Complete documentation saved to {os.path.join(output_dir, 'openscad_complete_documentation.json')}")

def format_for_training(output_dir):
    """Format the scraped data for LLM training."""
    # Load the complete documentation
    with open(os.path.join(output_dir, 'openscad_complete_documentation.json'), 'r', encoding='utf-8') as f:
        all_data = json.load(f)
    
    # Create a text file with properly formatted training data
    training_file = os.path.join(output_dir, 'openscad_training_data.txt')
    
    with open(training_file, 'w', encoding='utf-8') as f:
        # Add header information
        f.write("# OpenSCAD Documentation Training Data\n\n")
        
        # Process cheatsheet
        f.write("## CHEATSHEET\n\n")
        if all_data.get('cheatsheet'):
            for section in all_data['cheatsheet'].get('sections', []):
                f.write(f"### {section['title']}\n\n")
                
                # Write content
                for content in section.get('content', []):
                    if isinstance(content, dict) and content.get('text'):
                        f.write(f"{content['text']}\n\n")
                
                # Write code examples
                for example in section.get('code_examples', []):
                    f.write(f"```scad\n{example['code']}\n```\n\n")
                
                # Write parameters
                for param in section.get('parameters', []):
                    f.write(f"- {param['name']}: {param['description']}")
                    if param.get('type'):
                        f.write(f" (Type: {param['type']})")
                    if param.get('default'):
                        f.write(f" (Default: {param['default']})")
                    f.write("\n")
                f.write("\n")
        
        # Process other sections
        for section_type in ['language_reference', 'user_manual', 'tutorials', 'examples']:
            f.write(f"## {section_type.upper()}\n\n")
            
            for page in all_data.get(section_type, []):
                f.write(f"### {page['title']}\n\n")
                
                for section in page.get('sections', []):
                    f.write(f"#### {section['title']}\n\n")
                    
                    # Write content
                    for content in section.get('content', []):
                        if isinstance(content, dict) and content.get('text'):
                            f.write(f"{content['text']}\n\n")
                    
                    # Write code examples
                    for example in section.get('code_examples', []):
                        f.write(f"```scad\n{example['code']}\n```\n\n")
                    
                    # Write parameters
                    for param in section.get('parameters', []):
                        f.write(f"- {param['name']}: {param['description']}")
                        if param.get('type'):
                            f.write(f" (Type: {param['type']})")
                        if param.get('default'):
                            f.write(f" (Default: {param['default']})")
                        f.write("\n")
                    f.write("\n")
    
    print(f"Training data saved to {training_file}")

def main():
    """Main function to run the scraper."""
    parser = argparse.ArgumentParser(description='Scrape OpenSCAD documentation')
    parser.add_argument('--output', default=OUTPUT_DIR, help=f'Output directory (default: {OUTPUT_DIR})')
    parser.add_argument('--skip-cheatsheet', action='store_true', help='Skip scraping the cheatsheet')
    parser.add_argument('--skip-wiki', action='store_true', help='Skip scraping the wiki pages')
    args = parser.parse_args()
    
    # Setup directories
    dirs = setup_directories(args.output)
    
    # Track visited URLs to avoid duplicates
    visited_urls = set()
    
    # Scrape the cheat sheet
    if not args.skip_cheatsheet:
        scrape_cheatsheet(CHEATSHEET_URL, args.output)
    
    # Scrape the user manual and related pages
    if not args.skip_wiki:
        scrape_wiki_page(USER_MANUAL_URL, args.output, visited_urls)
    
    # Merge data into a single file
    merge_data_into_single_file(args.output)
    
    # Format for training
    format_for_training(args.output)
    
    print("Scraping completed successfully!")

if __name__ == "__main__":
    main()
