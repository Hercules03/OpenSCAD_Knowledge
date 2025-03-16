// OpenSCAD Documentation Scraper
// This script systematically extracts content from OpenSCAD documentation for LLM training

// Import required libraries
const puppeteer = require('puppeteer');
const fs = require('fs/promises');
const path = require('path');

// Main data structure to hold all extracted content
const trainingData = {
  metadata: {
    description: "OpenSCAD Training Data for fine-tuning LLM",
    version: "1.0",
    date: new Date().toISOString(),
    source: "https://openscad.org/cheatsheet/ and https://en.wikibooks.org/wiki/OpenSCAD_User_Manual"
  },
  cheatSheet: {
    syntax: [],
    primitives2D: [],
    primitives3D: [],
    transformations: [],
    operators: [],
    mathFunctions: [],
    specialVariables: [],
    otherFunctions: []
  },
  userManual: {}
};

// Define the key pages to scrape
const pagesToScrape = [
  { key: "general", name: "General", url: "https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/General" },
  { key: "primitives", name: "Primitive Solids", url: "https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/Primitive_Solids" },
  { key: "primitives2D", name: "2D Primitives", url: "https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/2D_Primitives" },
  { key: "transformations", name: "Transformations", url: "https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/Transformations" },
  { key: "csgModeling", name: "CSG Modeling", url: "https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/CSG_Modelling" },
  { key: "extrusion", name: "Extrusion", url: "https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/2D_to_3D_Extrusion" },
  { key: "conditionalFunctions", name: "Conditional and Iterator Functions", url: "https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/Conditional_and_Iterator_Functions" },
  { key: "mathFunctions", name: "Mathematical Functions", url: "https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/Mathematical_Functions" },
  { key: "stringFunctions", name: "String Functions", url: "https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/String_Functions" },
  { key: "userDefinedFunctions", name: "User Defined Functions", url: "https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/User-Defined_Functions_and_Modules" },
  { key: "listComprehensions", name: "List Comprehensions", url: "https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/List_Comprehensions" },
  { key: "otherLanguageFeatures", name: "Other Language Features", url: "https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/Other_Language_Features" }
];

// Function to scrape the OpenSCAD cheat sheet
async function scrapeCheatSheet(page) {
  console.log("Scraping OpenSCAD cheat sheet...");
  
  await page.goto("https://openscad.org/cheatsheet/", { waitUntil: 'networkidle2' });
  
  // Extract cheat sheet content using the page structure
  const cheatSheetData = await page.evaluate(() => {
    // Extract content from all sections
    const sections = document.querySelectorAll('section > section');
    const cheatSheetCategories = {};
    
    sections.forEach(section => {
      const title = section.querySelector('h2')?.textContent.trim() || 'Unnamed';
      const entries = [];
      
      // Get all code blocks within this section
      const codeBlocks = Array.from(section.querySelectorAll('code'));
      
      codeBlocks.forEach(code => {
        entries.push({
          syntax: code.textContent.trim(),
          html: code.innerHTML.trim(), // Includes links
          // Extract the links from the HTML to get URLs for more info
          links: Array.from(code.querySelectorAll('a')).map(a => ({
            text: a.textContent.trim(),
            href: a.href
          }))
        });
      });
      
      cheatSheetCategories[title] = entries;
    });
    
    return cheatSheetCategories;
  });
  
  console.log("Cheat sheet scraped successfully!");
  return cheatSheetData;
}

// Function to scrape a wiki page from the user manual with improved content extraction
async function scrapeWikiPage(page, pageInfo) {
  console.log(`Scraping ${pageInfo.name} page...`);
  await page.goto(pageInfo.url, { waitUntil: 'networkidle2' });
  
  // Extract page content with improved content extraction
  const pageData = await page.evaluate(() => {
    const data = {
      title: document.title,
      url: window.location.href,
      introduction: "",
      sections: [],
      codeExamples: []
    };
    
    // Get the main content
    const content = document.querySelector('.mw-parser-output');
    if (!content) return { error: "Could not find main content" };
    
    // Extract the introduction
    const introText = [];
    let currentElement = content.firstElementChild;
    
    // Process elements until we hit the first section header
    while (currentElement && !currentElement.matches('h1, h2, h3, h4, h5, h6')) {
      // Skip navigation or edit elements
      if (!currentElement.classList.contains('navbox') && 
          !currentElement.classList.contains('vertical-navbox') && 
          !currentElement.classList.contains('ambox') &&
          !currentElement.classList.contains('noprint') &&
          currentElement.tagName !== 'STYLE') {
        
        const text = currentElement.textContent.trim();
        // Skip empty or edit-only text
        if (text && !text.match(/^\[edit( \| edit source)?\]$/) && text !== '') {
          introText.push(text);
        }
      }
      currentElement = currentElement.nextElementSibling;
      if (!currentElement) break;
    }
    
    if (introText.length > 0) {
      data.introduction = introText.join('\n\n');
    }
    
    // Extract all sections with their actual content
    const sections = [];
    const headers = Array.from(content.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    
    headers.forEach((header, index) => {
      // Get clean title without edit links
      const headline = header.querySelector('.mw-headline');
      const title = headline ? headline.textContent.trim() : 
                   header.textContent.replace(/\[edit\]|\[edit source\]|\[edit \| edit source\]/g, '').trim();
      
      const level = parseInt(header.tagName.substring(1));
      const sectionContentElements = [];
      
      // Get all content until the next header
      let sibling = header.nextElementSibling;
      while (sibling && !sibling.matches('h1, h2, h3, h4, h5, h6')) {
        // Skip navigation or edit elements
        if (!sibling.classList.contains('navbox') && 
            !sibling.classList.contains('vertical-navbox') && 
            !sibling.classList.contains('ambox') &&
            !sibling.classList.contains('noprint') &&
            sibling.tagName !== 'STYLE') {
          
          // Save the element for content extraction
          sectionContentElements.push(sibling);
        }
        sibling = sibling.nextElementSibling;
        if (!sibling) break;
      }
      
      // Process the content elements to extract text and code
      const sectionText = [];
      const sectionCodeBlocks = [];
      
      sectionContentElements.forEach(element => {
        if (element.tagName === 'PRE') {
          // Code block
          sectionCodeBlocks.push({
            code: element.textContent.trim(),
            context: "Part of section: " + title
          });
        } else {
          // Regular text content
          const text = element.textContent.trim();
          if (text && !text.match(/^\[edit( \| edit source)?\]$/) && text !== '') {
            sectionText.push(text);
          }
        }
      });
      
      sections.push({
        title: title,
        level: level,
        content: sectionText.join('\n\n'),
        codeBlocks: sectionCodeBlocks
      });
    });
    
    data.sections = sections;
    
    // Improved code example extraction with better context
    const allCodeBlocks = Array.from(content.querySelectorAll('pre'));
    data.codeExamples = allCodeBlocks.map(pre => {
      // Look for context in preceding elements
      let contextElement = pre.previousElementSibling;
      let contextText = "";
      let contextAttempts = 0;
      
      // Try up to 3 previous elements to find meaningful context
      while (contextElement && contextAttempts < 3 && !contextText) {
        if (contextElement.tagName !== 'H1' && contextElement.tagName !== 'H2' && 
            contextElement.tagName !== 'H3' && contextElement.tagName !== 'H4' && 
            contextElement.tagName !== 'H5' && contextElement.tagName !== 'H6') {
          
          const text = contextElement.textContent.trim();
          if (text && text.length > 10 && !text.match(/^\[edit( \| edit source)?\]$/)) {
            contextText = text;
          }
        }
        contextElement = contextElement.previousElementSibling;
        contextAttempts++;
      }
      
      // If no good context found, get the section header
      if (!contextText) {
        let heading = pre;
        while (heading && !heading.matches('h1, h2, h3, h4, h5, h6')) {
          heading = heading.previousElementSibling;
        }
        
        if (heading) {
          const headline = heading.querySelector('.mw-headline');
          contextText = "Part of section: " + (headline ? 
                       headline.textContent.trim() : 
                       heading.textContent.replace(/\[edit\]|\[edit source\]|\[edit \| edit source\]/g, '').trim());
        }
      }
      
      return {
        code: pre.textContent.trim(),
        context: contextText || "No specific context available"
      };
    });
    
    return data;
  });
  
  console.log(`${pageInfo.name} page scraped successfully!`);
  return pageData;
}

// Process the cheat sheet data and organize it into categories
function processCheatSheetData(cheatSheetData) {
  // Map the raw sections to our structured format
  if (cheatSheetData.Syntax) {
    trainingData.cheatSheet.syntax = cheatSheetData.Syntax.map(entry => ({
      name: entry.syntax,
      description: "Syntax element",
      links: entry.links
    }));
  }
  
  // Map other categories accordingly
  if (cheatSheetData["2D"]) {
    trainingData.cheatSheet.primitives2D = cheatSheetData["2D"].map(entry => ({
      name: entry.syntax,
      description: "2D primitive",
      links: entry.links
    }));
  }
  
  if (cheatSheetData["3D"]) {
    trainingData.cheatSheet.primitives3D = cheatSheetData["3D"].map(entry => ({
      name: entry.syntax,
      description: "3D primitive",
      links: entry.links
    }));
  }
  
  if (cheatSheetData.Transformations) {
    trainingData.cheatSheet.transformations = cheatSheetData.Transformations.map(entry => ({
      name: entry.syntax,
      description: "Transformation",
      links: entry.links
    }));
  }
  
  // Add other categories based on what's available in the cheat sheet
  console.log("Cheat sheet data processed and categorized.");
}

// Process the page data from the wiki
function processWikiPage(pageInfo, pageData) {
  // Add the page to our structured data
  trainingData.userManual[pageInfo.key] = {
    title: pageInfo.name,
    url: pageInfo.url,
    introduction: pageData.introduction,
    content: {},
    codeExamples: pageData.codeExamples
  };
  
  // Convert the sections array to a structured object
  pageData.sections.forEach(section => {
    if (section.title && section.title.trim() !== '' && section.content) {
      // Make sure we're not storing empty content or just edit links
      if (!section.content.match(/^\[edit( \| edit source)?\]$/)) {
        trainingData.userManual[pageInfo.key].content[section.title] = section.content;
      }
    }
  });
  
  console.log(`${pageInfo.name} data processed and added to the training data.`);
}

// Main function to run the entire scraping process
async function runScraper() {
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Step 1: Scrape the cheat sheet
    const cheatSheetData = await scrapeCheatSheet(page);
    processCheatSheetData(cheatSheetData);
    
    // Step 2: Scrape each wiki page
    for (const pageInfo of pagesToScrape) {
      const pageData = await scrapeWikiPage(page, pageInfo);
      processWikiPage(pageInfo, pageData);
      
      // Optional: Add delay between requests to avoid overloading the server
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Step 3: Save the extracted data
    await saveTrainingData();
    
    console.log("Scraping completed successfully!");
  } catch (error) {
    console.error("Error during scraping:", error);
  } finally {
    await browser.close();
  }
}

// Function to save the training data to disk
async function saveTrainingData() {
  try {
    // Create output directory if it doesn't exist
    const outputDir = path.join(__dirname, 'output');
    await fs.mkdir(outputDir, { recursive: true });
    
    // Save the complete dataset
    await fs.writeFile(
      path.join(outputDir, 'openscad_training_data.json'),
      JSON.stringify(trainingData, null, 2),
      'utf8'
    );
    
    // Also save individual components for easier handling
    await fs.writeFile(
      path.join(outputDir, 'openscad_cheatsheet.json'),
      JSON.stringify(trainingData.cheatSheet, null, 2),
      'utf8'
    );
    
    await fs.writeFile(
      path.join(outputDir, 'openscad_usermanual.json'),
      JSON.stringify(trainingData.userManual, null, 2),
      'utf8'
    );
    
    console.log("Training data saved successfully to output directory.");
  } catch (error) {
    console.error("Error saving training data:", error);
  }
}

// Optional: Function to create training examples for the LLM
function createTrainingExamples() {
  const examples = [];
  
  // Create examples from the user manual
  for (const section in trainingData.userManual) {
    const sectionData = trainingData.userManual[section];
    
    // Create examples from the introduction if it's substantial
    if (sectionData.introduction && sectionData.introduction.length > 50) {
      examples.push({
        query: `Explain ${sectionData.title} in OpenSCAD`,
        response: sectionData.introduction
      });
    }
    
    // Create examples from each section's content if it's substantial
    for (const subSection in sectionData.content) {
      const content = sectionData.content[subSection];
      if (content && content.length > 50 && !content.match(/^\[edit( \| edit source)?\]$/)) {
        examples.push({
          query: `What is ${subSection} in OpenSCAD?`,
          response: content
        });
      }
    }
    
    // Create examples from code examples with good context
    sectionData.codeExamples.forEach(example => {
      if (example.context && example.context !== "No specific context available" && 
          !example.context.match(/^\[edit( \| edit source)?\]$/)) {
        examples.push({
          query: `Give me an example of ${sectionData.title.toLowerCase()} in OpenSCAD`,
          response: `Here's an example of ${sectionData.title.toLowerCase()} in OpenSCAD:\n\n\`\`\`scad\n${example.code}\n\`\`\`\n\n${example.context}`
        });
      }
    });
  }
  
  // Filter out examples with minimal or problematic responses
  return examples.filter(ex => 
    ex.response.length > 50 && 
    !ex.response.includes('[edit') && 
    !ex.response.match(/^\[edit( \| edit source)?\]$/)
  );
}

// Function to save training examples
async function saveTrainingExamples() {
  try {
    const examples = createTrainingExamples();
    
    // Create output directory if it doesn't exist
    const outputDir = path.join(__dirname, 'output');
    await fs.mkdir(outputDir, { recursive: true });
    
    // Save the training examples
    await fs.writeFile(
      path.join(outputDir, 'openscad_training_examples.json'),
      JSON.stringify(examples, null, 2),
      'utf8'
    );
    
    console.log(`${examples.length} training examples saved successfully.`);
  } catch (error) {
    console.error("Error saving training examples:", error);
  }
}

// Run the scraper if this file is executed directly
if (require.main === module) {
  console.log("Starting OpenSCAD documentation scraper...");
  runScraper()
    .then(() => {
      console.log("Scraping completed.");
      return saveTrainingExamples();
    })
    .then(() => {
      console.log("Examples created and saved.");
      console.log("All done!");
    })
    .catch(error => {
      console.error("Error running scraper:", error);
      process.exit(1);
    });
}