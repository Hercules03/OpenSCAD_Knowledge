// OpenSCAD Documentation Verification Script
// This script compares scraped content with the print version to identify missing information

const puppeteer = require('puppeteer');
const fs = require('fs/promises');
const path = require('path');

// Configuration
const config = {
  outputDir: path.join(__dirname, 'verification_output'),
  printVersionUrl: 'https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/Print_version',
  languagePrintUrl: 'https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/The_OpenSCAD_Language',
  scrapedDataPath: path.join(__dirname, 'output', 'openscad_training_data.json'),
  keySections: [
    { name: 'Matrix', parentSection: 'general' },
    { name: 'Objects', parentSection: 'general' },
    { name: 'Retrieving a value from an object', parentSection: 'general' },
    { name: 'Iterating over object members', parentSection: 'general' },
    { name: 'Getting input', parentSection: 'general' },
    { name: 'Vector operators', parentSection: 'general' },
    { name: 'concat', parentSection: 'general' },
    { name: 'len', parentSection: 'general' },
    { name: 'Special variables', parentSection: 'general' }
  ]
};

// Main verification function
async function verifyDocumentation() {
  try {
    // Create output directory
    await fs.mkdir(config.outputDir, { recursive: true });
    
    // Load scraped data
    console.log("Loading scraped data...");
    const scrapedData = JSON.parse(await fs.readFile(config.scrapedDataPath, 'utf8'));
    
    // Extract content from print version
    console.log("Extracting content from print version...");
    const printVersionContent = await extractPrintVersionContent();
    
    // Compare scraped data with print version
    console.log("Comparing content...");
    const comparisonResults = compareContent(scrapedData, printVersionContent);
    
    // Save results
    await saveResults(comparisonResults);
    
    // Generate supplementary content for missing sections
    await generateSupplementaryContent(comparisonResults, scrapedData);
    
    console.log("Verification completed. Check the verification_output directory for results.");
    return comparisonResults;
  } catch (error) {
    console.error("Error during verification:", error);
    throw error;
  }
}

// Function to extract content from the print version
async function extractPrintVersionContent() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Extract content from the main print version
    console.log("Navigating to print version...");
    await page.goto(config.printVersionUrl, { waitUntil: 'networkidle2' });
    
    const printContent = await extractStructuredContent(page);
    
    // Extract content from the language print version
    console.log("Navigating to language print version...");
    await page.goto(config.languagePrintUrl, { waitUntil: 'networkidle2' });
    
    const languagePrintContent = await extractStructuredContent(page);
    
    // Combine both sources
    return {
      mainPrint: printContent,
      languagePrint: languagePrintContent
    };
  } finally {
    await browser.close();
  }
}

// Function to extract structured content from a page
async function extractStructuredContent(page) {
  return await page.evaluate(() => {
    // Helper function to clean text
    const cleanText = (text) => {
      if (!text) return "";
      return text
        .replace(/\[edit\]/g, "")
        .replace(/\[edit source\]/g, "")
        .replace(/\[edit \| edit source\]/g, "")
        .trim();
    };
    
    const content = document.querySelector('.mw-parser-output');
    if (!content) return { error: "Could not find main content" };
    
    // Extract all headings and their content
    const sections = {};
    const headers = Array.from(content.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    
    headers.forEach((header, index) => {
      // Clean the header text
      const title = cleanText(header.textContent);
      
      // Skip empty titles
      if (!title || title.length === 0) return;
      
      const level = parseInt(header.tagName.substring(1));
      const contentText = [];
      const codeExamples = [];
      
      // Find the next heading of the same or higher level
      let nextHeader = null;
      for (let i = index + 1; i < headers.length; i++) {
        const nextLevel = parseInt(headers[i].tagName.substring(1));
        if (nextLevel <= level) {
          nextHeader = headers[i];
          break;
        }
      }
      
      // Extract all content between this header and the next one
      let element = header.nextElementSibling;
      while (element && element !== nextHeader) {
        // Skip navigation elements
        if (!element.classList.contains('navbox') && 
            !element.classList.contains('vertical-navbox') && 
            !element.classList.contains('ambox') &&
            !element.classList.contains('noprint') &&
            element.tagName !== 'STYLE') {
          
          // Extract code examples
          if (element.tagName === 'PRE') {
            codeExamples.push(element.textContent.trim());
          }
          
          const text = cleanText(element.textContent);
          if (text && text.length > 0) {
            contentText.push(text);
          }
        }
        
        element = element.nextElementSibling;
        if (!element) break;
      }
      
      // Add the section if it has content
      if (contentText.length > 0) {
        sections[title] = {
          content: contentText.join('\n\n'),
          codeExamples,
          level
        };
      }
    });
    
    return sections;
  });
}

// Function to compare scraped content with print version
function compareContent(scrapedData, printVersionContent) {
  const results = {
    missingSections: [],
    incompleteContent: [],
    missingCodeExamples: [],
    supplementaryContent: {}
  };
  
  // Check key sections
  for (const keySection of config.keySections) {
    const { name, parentSection } = keySection;
    
    // Check if section exists in scraped data
    const scrapedSectionContent = scrapedData.userManual[parentSection]?.content?.[name];
    
    // Find section in print version (search in both print versions)
    let printSectionContent = null;
    let printCodeExamples = [];
    
    // Try to find in main print version
    if (printVersionContent.mainPrint[name]) {
      printSectionContent = printVersionContent.mainPrint[name].content;
      printCodeExamples = printVersionContent.mainPrint[name].codeExamples || [];
    }
    
    // Also check parent section + subsection patterns (e.g., "Vector operators" might be under "Vectors")
    for (const printSectionName in printVersionContent.mainPrint) {
      if (printSectionName.includes(name) || 
          (parentSection === 'general' && printSectionName.includes('General'))) {
        if (!printSectionContent) {
          printSectionContent = printVersionContent.mainPrint[printSectionName].content;
          printCodeExamples = printVersionContent.mainPrint[printSectionName].codeExamples || [];
        }
      }
    }
    
    // Try language print version as fallback
    if (!printSectionContent && printVersionContent.languagePrint[name]) {
      printSectionContent = printVersionContent.languagePrint[name].content;
      printCodeExamples = printVersionContent.languagePrint[name].codeExamples || [];
    }
    
    // Check for missing or incomplete sections
    if (!scrapedSectionContent) {
      results.missingSections.push({
        name,
        parentSection,
        printContent: printSectionContent
      });
      
      // Add to supplementary content
      if (printSectionContent) {
        if (!results.supplementaryContent[parentSection]) {
          results.supplementaryContent[parentSection] = {};
        }
        results.supplementaryContent[parentSection][name] = printSectionContent;
      }
    } else if (printSectionContent) {
      // Check for incomplete content (significantly shorter than print version)
      const scrapedLength = scrapedSectionContent.length;
      const printLength = printSectionContent.length;
      
      if (scrapedLength < printLength * 0.7) { // If scraped content is less than 70% of print version
        results.incompleteContent.push({
          name,
          parentSection,
          scrapedLength,
          printLength,
          scrapedContent: scrapedSectionContent,
          printContent: printSectionContent
        });
        
        // Add to supplementary content
        if (!results.supplementaryContent[parentSection]) {
          results.supplementaryContent[parentSection] = {};
        }
        results.supplementaryContent[parentSection][name] = printSectionContent;
      }
      
      // Check for missing code examples
      if (printCodeExamples.length > 0) {
        const scrapedExamples = scrapedData.userManual[parentSection]?.codeExamples || [];
        const scrapedExampleTexts = scrapedExamples.map(ex => ex.code);
        
        for (const printExample of printCodeExamples) {
          // Check if this print example is missing from scraped data
          const hasSimilarExample = scrapedExampleTexts.some(scrapedEx => 
            areSimilarCodeExamples(scrapedEx, printExample)
          );
          
          if (!hasSimilarExample) {
            results.missingCodeExamples.push({
              section: name,
              parentSection,
              code: printExample
            });
          }
        }
      }
    }
  }
  
  return results;
}

// Helper function to determine if two code examples are similar
function areSimilarCodeExamples(example1, example2) {
  // Normalize whitespace and compare
  const normalize = text => text.replace(/\s+/g, ' ').trim();
  
  const norm1 = normalize(example1);
  const norm2 = normalize(example2);
  
  return norm1.includes(norm2) || norm2.includes(norm1) || 
         norm1.length > 0 && norm2.length > 0 && 
         (norm1.split(' ').filter(word => norm2.includes(word)).length / 
          norm1.split(' ').length > 0.7);
}

// Function to save comparison results
async function saveResults(comparisonResults) {
  try {
    // Save full comparison results
    await fs.writeFile(
      path.join(config.outputDir, 'comparison_results.json'),
      JSON.stringify(comparisonResults, null, 2),
      'utf8'
    );
    
    // Create a human-readable report
    let report = '# OpenSCAD Documentation Verification Report\n\n';
    
    report += '## Missing Sections\n\n';
    if (comparisonResults.missingSections.length === 0) {
      report += 'No missing sections found.\n\n';
    } else {
      comparisonResults.missingSections.forEach(section => {
        report += `### ${section.name} (in ${section.parentSection})\n\n`;
        if (section.printContent) {
          report += `Content from print version:\n\n\`\`\`\n${section.printContent}\n\`\`\`\n\n`;
        } else {
          report += 'No content found in print version either.\n\n';
        }
      });
    }
    
    report += '## Incomplete Content\n\n';
    if (comparisonResults.incompleteContent.length === 0) {
      report += 'No incomplete content found.\n\n';
    } else {
      comparisonResults.incompleteContent.forEach(section => {
        report += `### ${section.name} (in ${section.parentSection})\n\n`;
        report += `Scraped content (${section.scrapedLength} chars) vs Print version (${section.printLength} chars)\n\n`;
        report += `#### Scraped Content:\n\n\`\`\`\n${section.scrapedContent}\n\`\`\`\n\n`;
        report += `#### Print Version Content:\n\n\`\`\`\n${section.printContent}\n\`\`\`\n\n`;
      });
    }
    
    report += '## Missing Code Examples\n\n';
    if (comparisonResults.missingCodeExamples.length === 0) {
      report += 'No missing code examples found.\n\n';
    } else {
      comparisonResults.missingCodeExamples.forEach(example => {
        report += `### Example from ${example.section} (in ${example.parentSection})\n\n`;
        report += `\`\`\`scad\n${example.code}\n\`\`\`\n\n`;
      });
    }
    
    // Save the report
    await fs.writeFile(
      path.join(config.outputDir, 'verification_report.md'),
      report,
      'utf8'
    );
    
    console.log("Verification results saved to verification_output directory.");
  } catch (error) {
    console.error("Error saving results:", error);
  }
}

// Function to generate supplementary content for missing/incomplete sections
async function generateSupplementaryContent(comparisonResults, scrapedData) {
  try {
    // Create a copy of the scraped data
    const enhancedData = JSON.parse(JSON.stringify(scrapedData));
    
    // Add supplementary content
    for (const parentSection in comparisonResults.supplementaryContent) {
      for (const sectionName in comparisonResults.supplementaryContent[parentSection]) {
        const content = comparisonResults.supplementaryContent[parentSection][sectionName];
        
        // Ensure parent section exists
        if (!enhancedData.userManual[parentSection]) {
          enhancedData.userManual[parentSection] = {
            title: parentSection.charAt(0).toUpperCase() + parentSection.slice(1),
            content: {},
            codeExamples: []
          };
        }
        
        // Add or replace the content
        enhancedData.userManual[parentSection].content[sectionName] = content;
      }
    }
    
    // Add missing code examples
    for (const example of comparisonResults.missingCodeExamples) {
      if (enhancedData.userManual[example.parentSection]) {
        // Add the code example with context
        enhancedData.userManual[example.parentSection].codeExamples.push({
          code: example.code,
          context: `Example from ${example.section} section (supplemented from print version)`
        });
      }
    }
    
    // Save the enhanced data
    await fs.writeFile(
      path.join(config.outputDir, 'enhanced_training_data.json'),
      JSON.stringify(enhancedData, null, 2),
      'utf8'
    );
    
    // Save the enhanced user manual separately
    await fs.writeFile(
      path.join(config.outputDir, 'enhanced_usermanual.json'),
      JSON.stringify(enhancedData.userManual, null, 2),
      'utf8'
    );
    
    // Generate training examples using the enhanced data
    const examples = createTrainingExamples(enhancedData);
    
    // Save the enhanced training examples
    await fs.writeFile(
      path.join(config.outputDir, 'enhanced_training_examples.json'),
      JSON.stringify(examples, null, 2),
      'utf8'
    );
    
    console.log("Enhanced data and training examples generated with supplementary content.");
  } catch (error) {
    console.error("Error generating supplementary content:", error);
  }
}

// Function to create training examples from the enhanced data
function createTrainingExamples(data) {
  const examples = [];
  
  // Create examples from the user manual
  for (const section in data.userManual) {
    const sectionData = data.userManual[section];
    
    // Create examples from the introduction
    if (sectionData.introduction && sectionData.introduction.length > 50) {
      examples.push({
        query: `Explain ${sectionData.title} in OpenSCAD`,
        response: sectionData.introduction
      });
    }
    
    // Create examples from each section's content
    for (const subSection in sectionData.content) {
      const content = sectionData.content[subSection];
      
      // Validate content quality
      if (content && content.length > 50 && 
          !content.match(/^\[edit(\s*\|\s*edit\s+source)?\]$/)) {
        examples.push({
          query: `What is ${subSection} in OpenSCAD?`,
          response: content
        });
        
        // Create variation with "how" question
        examples.push({
          query: `How does ${subSection} work in OpenSCAD?`,
          response: content
        });
      }
    }
    
    // Create examples from code examples
    sectionData.codeExamples.forEach(example => {
      // Validate example context
      if (example.code && example.context && 
          example.context.length > 10 && 
          !example.context.match(/^\[edit(\s*\|\s*edit\s+source)?\]$/)) {
        
        examples.push({
          query: `Give me an example of ${sectionData.title.toLowerCase()} in OpenSCAD`,
          response: `Here's an example of ${sectionData.title.toLowerCase()} in OpenSCAD:\n\n\`\`\`scad\n${example.code}\n\`\`\`\n\n${example.context}`
        });
        
        // Create variation with "show me" question
        examples.push({
          query: `Show me how to use ${example.section || sectionData.title.toLowerCase()} in OpenSCAD`,
          response: `Here's how to use ${example.section || sectionData.title.toLowerCase()} in OpenSCAD:\n\n\`\`\`scad\n${example.code}\n\`\`\`\n\n${example.context}`
        });
      }
    });
  }
  
  // Filter out examples with minimal or problematic responses
  const validExamples = examples.filter(ex => 
    ex.response && 
    ex.response.length > 30 && 
    !ex.response.includes('[edit') && 
    !ex.response.match(/^\[edit(\s*\|\s*edit\s+source)?\]$/)
  );
  
  return validExamples;
}

// Run the verification if this script is executed directly
if (require.main === module) {
  console.log("Starting OpenSCAD documentation verification...");
  
  verifyDocumentation()
    .then(() => {
      console.log("Verification completed successfully!");
    })
    .catch(error => {
      console.error("Verification failed:", error);
      process.exit(1);
    });
}

module.exports = { verifyDocumentation };
