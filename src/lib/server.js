#!/usr/bin/env node

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import pkg from 'selenium-webdriver';
const { Builder, By, Key, until, Actions } = pkg;
import { Options as ChromeOptions } from 'selenium-webdriver/chrome.js';
import { Options as FirefoxOptions } from 'selenium-webdriver/firefox.js';
import { Options as EdgeOptions } from 'selenium-webdriver/edge.js';
import { getMemoryStore } from './memory.js';


// Create an MCP server
const server = new McpServer({
    name: "MCP Selenium",
    version: "1.0.0"
});

// Initialize memory store
const memoryStore = getMemoryStore();

// Server state
const state = {
    drivers: new Map(),
    currentSession: null,
    // Track running sequence for interrupt capability
    runningSequence: null,
    interruptRequested: false,
    // Track current action for teaching mode
    recordingSequence: null,
    recordedActions: []
};

// Helper functions
const getDriver = () => {
    const driver = state.drivers.get(state.currentSession);
    if (!driver) {
        throw new Error('No active browser session');
    }
    return driver;
};

const getLocator = (by, value) => {
    switch (by.toLowerCase()) {
        case 'id': return By.id(value);
        case 'css': return By.css(value);
        case 'xpath': return By.xpath(value);
        case 'name': return By.name(value);
        case 'tag': return By.css(value);
        case 'class': return By.className(value);
        default: throw new Error(`Unsupported locator strategy: ${by}`);
    }
};

// Helper to record action if in recording mode
const recordAction = (toolName, parameters) => {
    if (state.recordingSequence) {
        state.recordedActions.push({
            toolName,
            parameters: { ...parameters }
        });
    }
};

// Helper to check for interrupt
const checkInterrupt = () => {
    if (state.interruptRequested) {
        state.interruptRequested = false;
        throw new Error('Action interrupted by user');
    }
};

// Common schemas
const browserOptionsSchema = z.object({
    headless: z.boolean().optional().describe("Run browser in headless mode"),
    arguments: z.array(z.string()).optional().describe("Additional browser arguments")
}).optional();

const locatorSchema = {
    by: z.enum(["id", "css", "xpath", "name", "tag", "class"]).describe("Locator strategy to find element"),
    value: z.string().describe("Value for the locator strategy"),
    timeout: z.number().optional().describe("Maximum time to wait for element in milliseconds")
};

// Browser Management Tools
server.tool(
    "start_browser",
    "launches browser",
    {
        browser: z.enum(["chrome", "firefox", "edge"]).describe("Browser to launch (chrome or firefox or microsoft edge)"),
        options: browserOptionsSchema
    },
    async ({ browser, options = {} }) => {
        try {
            let builder = new Builder();
            let driver;
            switch (browser) {
                case 'chrome': {
                    const chromeOptions = new ChromeOptions();
                    if (options.headless) {
                        chromeOptions.addArguments('--headless=new');
                    }
                    if (options.arguments) {
                        options.arguments.forEach(arg => chromeOptions.addArguments(arg));
                    }
                    driver = await builder
                        .forBrowser('chrome')
                        .setChromeOptions(chromeOptions)
                        .build();
                    break;
                }
                case 'edge': {
                    const edgeOptions = new EdgeOptions();
                    if (options.headless) {
                        edgeOptions.addArguments('--headless=new');
                    }
                    if (options.arguments) {
                        options.arguments.forEach(arg => edgeOptions.addArguments(arg));
                    }
                    driver = await builder
                        .forBrowser('edge')
                        .setEdgeOptions(edgeOptions)
                        .build();
                    break;
                }
                case 'firefox': {
                    const firefoxOptions = new FirefoxOptions();
                    if (options.headless) {
                        firefoxOptions.addArguments('--headless');
                    }
                    if (options.arguments) {
                        options.arguments.forEach(arg => firefoxOptions.addArguments(arg));
                    }
                    driver = await builder
                        .forBrowser('firefox')
                        .setFirefoxOptions(firefoxOptions)
                        .build();
                    break;
                }
                default: {
                    throw new Error(`Unsupported browser: ${browser}`);
                }
            }
            const sessionId = `${browser}_${Date.now()}`;
            state.drivers.set(sessionId, driver);
            state.currentSession = sessionId;

            return {
                content: [{ type: 'text', text: `Browser started with session_id: ${sessionId}` }]
            };
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error starting browser: ${e.message}` }]
            };
        }
    }
);

server.tool(
    "navigate",
    "navigates to a URL",
    {
        url: z.string().describe("URL to navigate to")
    },
    async ({ url }) => {
        try {
            const driver = getDriver();
            await driver.get(url);
            recordAction('navigate', { url });
            return {
                content: [{ type: 'text', text: `Navigated to ${url}` }]
            };
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error navigating: ${e.message}` }]
            };
        }
    }
);

// Element Interaction Tools
server.tool(
    "find_element",
    "finds an element",
    {
        ...locatorSchema
    },
    async ({ by, value, timeout = 10000 }) => {
        try {
            const driver = getDriver();
            const locator = getLocator(by, value);
            await driver.wait(until.elementLocated(locator), timeout);
            recordAction('find_element', { by, value, timeout });
            return {
                content: [{ type: 'text', text: 'Element found' }]
            };
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error finding element: ${e.message}` }]
            };
        }
    }
);

server.tool(
    "click_element",
    "clicks an element",
    {
        ...locatorSchema
    },
    async ({ by, value, timeout = 10000 }) => {
        try {
            const driver = getDriver();
            const locator = getLocator(by, value);
            const element = await driver.wait(until.elementLocated(locator), timeout);
            await element.click();
            recordAction('click_element', { by, value, timeout });
            return {
                content: [{ type: 'text', text: 'Element clicked' }]
            };
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error clicking element: ${e.message}` }]
            };
        }
    }
);

server.tool(
    "send_keys",
    "sends keys to an element, aka typing",
    {
        ...locatorSchema,
        text: z.string().describe("Text to enter into the element")
    },
    async ({ by, value, text, timeout = 10000 }) => {
        try {
            const driver = getDriver();
            const locator = getLocator(by, value);
            const element = await driver.wait(until.elementLocated(locator), timeout);
            await element.clear();
            await element.sendKeys(text);
            recordAction('send_keys', { by, value, text, timeout });
            return {
                content: [{ type: 'text', text: `Text "${text}" entered into element` }]
            };
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error entering text: ${e.message}` }]
            };
        }
    }
);

server.tool(
    "get_element_text",
    "gets the text() of an element",
    {
        ...locatorSchema
    },
    async ({ by, value, timeout = 10000 }) => {
        try {
            const driver = getDriver();
            const locator = getLocator(by, value);
            const element = await driver.wait(until.elementLocated(locator), timeout);
            const text = await element.getText();
            recordAction('get_element_text', { by, value, timeout });
            return {
                content: [{ type: 'text', text }]
            };
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error getting element text: ${e.message}` }]
            };
        }
    }
);

server.tool(
    "hover",
    "moves the mouse to hover over an element",
    {
        ...locatorSchema
    },
    async ({ by, value, timeout = 10000 }) => {
        try {
            const driver = getDriver();
            const locator = getLocator(by, value);
            const element = await driver.wait(until.elementLocated(locator), timeout);
            const actions = driver.actions({ bridge: true });
            await actions.move({ origin: element }).perform();
            recordAction('hover', { by, value, timeout });
            return {
                content: [{ type: 'text', text: 'Hovered over element' }]
            };
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error hovering over element: ${e.message}` }]
            };
        }
    }
);

server.tool(
    "drag_and_drop",
    "drags an element and drops it onto another element",
    {
        ...locatorSchema,
        targetBy: z.enum(["id", "css", "xpath", "name", "tag", "class"]).describe("Locator strategy to find target element"),
        targetValue: z.string().describe("Value for the target locator strategy")
    },
    async ({ by, value, targetBy, targetValue, timeout = 10000 }) => {
        try {
            const driver = getDriver();
            const sourceLocator = getLocator(by, value);
            const targetLocator = getLocator(targetBy, targetValue);
            const sourceElement = await driver.wait(until.elementLocated(sourceLocator), timeout);
            const targetElement = await driver.wait(until.elementLocated(targetLocator), timeout);
            const actions = driver.actions({ bridge: true });
            await actions.dragAndDrop(sourceElement, targetElement).perform();
            recordAction('drag_and_drop', { by, value, targetBy, targetValue, timeout });
            return {
                content: [{ type: 'text', text: 'Drag and drop completed' }]
            };
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error performing drag and drop: ${e.message}` }]
            };
        }
    }
);

server.tool(
    "double_click",
    "performs a double click on an element",
    {
        ...locatorSchema
    },
    async ({ by, value, timeout = 10000 }) => {
        try {
            const driver = getDriver();
            const locator = getLocator(by, value);
            const element = await driver.wait(until.elementLocated(locator), timeout);
            const actions = driver.actions({ bridge: true });
            await actions.doubleClick(element).perform();
            recordAction('double_click', { by, value, timeout });
            return {
                content: [{ type: 'text', text: 'Double click performed' }]
            };
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error performing double click: ${e.message}` }]
            };
        }
    }
);

server.tool(
    "right_click",
    "performs a right click (context click) on an element",
    {
        ...locatorSchema
    },
    async ({ by, value, timeout = 10000 }) => {
        try {
            const driver = getDriver();
            const locator = getLocator(by, value);
            const element = await driver.wait(until.elementLocated(locator), timeout);
            const actions = driver.actions({ bridge: true });
            await actions.contextClick(element).perform();
            recordAction('right_click', { by, value, timeout });
            return {
                content: [{ type: 'text', text: 'Right click performed' }]
            };
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error performing right click: ${e.message}` }]
            };
        }
    }
);

server.tool(
    "press_key",
    "simulates pressing a keyboard key",
    {
        key: z.string().describe("Key to press (e.g., 'Enter', 'Tab', 'a', etc.)")
    },
    async ({ key }) => {
        try {
            const driver = getDriver();
            const actions = driver.actions({ bridge: true });
            await actions.keyDown(key).keyUp(key).perform();
            recordAction('press_key', { key });
            return {
                content: [{ type: 'text', text: `Key '${key}' pressed` }]
            };
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error pressing key: ${e.message}` }]
            };
        }
    }
);

server.tool(
    "upload_file",
    "uploads a file using a file input element",
    {
        ...locatorSchema,
        filePath: z.string().describe("Absolute path to the file to upload")
    },
    async ({ by, value, filePath, timeout = 10000 }) => {
        try {
            const driver = getDriver();
            const locator = getLocator(by, value);
            const element = await driver.wait(until.elementLocated(locator), timeout);
            await element.sendKeys(filePath);
            recordAction('upload_file', { by, value, filePath, timeout });
            return {
                content: [{ type: 'text', text: 'File upload initiated' }]
            };
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error uploading file: ${e.message}` }]
            };
        }
    }
);

server.tool(
    "take_screenshot",
    "captures a screenshot of the current page",
    {
        outputPath: z.string().optional().describe("Optional path where to save the screenshot. If not provided, returns base64 data.")
    },
    async ({ outputPath }) => {
        try {
            const driver = getDriver();
            const screenshot = await driver.takeScreenshot();
            if (outputPath) {
                const fs = await import('fs');
                await fs.promises.writeFile(outputPath, screenshot, 'base64');
                return {
                    content: [{ type: 'text', text: `Screenshot saved to ${outputPath}` }]
                };
            } else {
                return {
                    content: [
                        { type: 'text', text: 'Screenshot captured as base64:' },
                        { type: 'text', text: screenshot }
                    ]
                };
            }
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error taking screenshot: ${e.message}` }]
            };
        }
    }
);

server.tool(
    "close_session",
    "closes the current browser session",
    {},
    async () => {
        try {
            const driver = getDriver();
            await driver.quit();
            state.drivers.delete(state.currentSession);
            const sessionId = state.currentSession;
            state.currentSession = null;
            return {
                content: [{ type: 'text', text: `Browser session ${sessionId} closed` }]
            };
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error closing session: ${e.message}` }]
            };
        }
    }
);

// ============================================================
// MEMORY & LEARNING TOOLS
// ============================================================

// Tool to start recording a sequence of actions (teaching mode)
server.tool(
    "start_recording",
    "Starts recording actions to create a reusable sequence. Use this when you want to teach the system a new workflow that can be replayed later.",
    {
        sequenceName: z.string().describe("Unique name for the sequence being recorded"),
        description: z.string().optional().describe("Human-readable description of what this sequence does"),
        triggerPattern: z.string().optional().describe("Pattern/phrase that should trigger this sequence (e.g., 'login to github')")
    },
    async ({ sequenceName, description = '', triggerPattern = '' }) => {
        try {
            if (state.recordingSequence) {
                return {
                    content: [{ type: 'text', text: `Already recording sequence '${state.recordingSequence}'. Stop it first with stop_recording.` }]
                };
            }
            
            state.recordingSequence = sequenceName;
            state.recordedActions = [];
            state.recordingDescription = description;
            state.recordingTrigger = triggerPattern;
            
            return {
                content: [{ type: 'text', text: `Started recording sequence '${sequenceName}'. All browser actions will be recorded. Call stop_recording when done.` }]
            };
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error starting recording: ${e.message}` }]
            };
        }
    }
);

// Tool to stop recording and save the sequence
server.tool(
    "stop_recording",
    "Stops recording actions and saves the sequence to memory for future use.",
    {},
    async () => {
        try {
            if (!state.recordingSequence) {
                return {
                    content: [{ type: 'text', text: 'No sequence is currently being recorded.' }]
                };
            }
            
            const sequenceName = state.recordingSequence;
            const actions = [...state.recordedActions];
            const description = state.recordingDescription || '';
            const triggerPattern = state.recordingTrigger || '';
            
            // Save to memory
            memoryStore.saveSequence(sequenceName, description, triggerPattern, actions);
            
            // Clear recording state
            state.recordingSequence = null;
            state.recordedActions = [];
            state.recordingDescription = '';
            state.recordingTrigger = '';
            
            return {
                content: [{ 
                    type: 'text', 
                    text: `Sequence '${sequenceName}' saved with ${actions.length} actions. You can replay it using run_sequence.` 
                }]
            };
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error stopping recording: ${e.message}` }]
            };
        }
    }
);

// Tool to cancel recording without saving
server.tool(
    "cancel_recording",
    "Cancels the current recording without saving the sequence.",
    {},
    async () => {
        try {
            if (!state.recordingSequence) {
                return {
                    content: [{ type: 'text', text: 'No sequence is currently being recorded.' }]
                };
            }
            
            const sequenceName = state.recordingSequence;
            state.recordingSequence = null;
            state.recordedActions = [];
            state.recordingDescription = '';
            state.recordingTrigger = '';
            
            return {
                content: [{ type: 'text', text: `Recording of '${sequenceName}' cancelled.` }]
            };
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error cancelling recording: ${e.message}` }]
            };
        }
    }
);

// Tool to save a sequence manually (without recording)
server.tool(
    "save_sequence",
    "Saves a predefined sequence of actions to memory. Use this to programmatically create reusable workflows.",
    {
        name: z.string().describe("Unique name for the sequence"),
        description: z.string().describe("Human-readable description of what this sequence does"),
        triggerPattern: z.string().optional().describe("Pattern/phrase that should trigger this sequence"),
        actions: z.array(z.object({
            toolName: z.string().describe("Name of the tool to execute"),
            parameters: z.record(z.any()).describe("Parameters for the tool")
        })).describe("Array of actions to execute in order")
    },
    async ({ name, description, triggerPattern = '', actions }) => {
        try {
            memoryStore.saveSequence(name, description, triggerPattern, actions);
            return {
                content: [{ 
                    type: 'text', 
                    text: `Sequence '${name}' saved with ${actions.length} actions.` 
                }]
            };
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error saving sequence: ${e.message}` }]
            };
        }
    }
);

// Tool to list all saved sequences
server.tool(
    "list_sequences",
    "Lists all saved action sequences available for execution.",
    {},
    async () => {
        try {
            const sequences = memoryStore.listSequences();
            
            if (sequences.length === 0) {
                return {
                    content: [{ type: 'text', text: 'No saved sequences found. Use start_recording or save_sequence to create one.' }]
                };
            }
            
            const sequenceList = sequences.map(s => 
                `• ${s.name} (${s.action_count} actions)\n  Description: ${s.description || 'No description'}\n  Trigger: ${s.trigger_pattern || 'No trigger pattern'}`
            ).join('\n\n');
            
            return {
                content: [{ type: 'text', text: `Saved sequences:\n\n${sequenceList}` }]
            };
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error listing sequences: ${e.message}` }]
            };
        }
    }
);

// Tool to get details of a specific sequence
server.tool(
    "get_sequence",
    "Gets the details of a saved sequence including all its actions.",
    {
        name: z.string().describe("Name of the sequence to retrieve")
    },
    async ({ name }) => {
        try {
            const sequence = memoryStore.getSequence(name);
            
            if (!sequence) {
                return {
                    content: [{ type: 'text', text: `Sequence '${name}' not found.` }]
                };
            }
            
            const actionList = sequence.actions.map((a, i) => 
                `  ${i + 1}. ${a.toolName}: ${JSON.stringify(a.parameters)}`
            ).join('\n');
            
            return {
                content: [{ 
                    type: 'text', 
                    text: `Sequence: ${sequence.name}\nDescription: ${sequence.description || 'No description'}\nTrigger: ${sequence.trigger_pattern || 'No trigger pattern'}\nActions:\n${actionList}` 
                }]
            };
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error getting sequence: ${e.message}` }]
            };
        }
    }
);

// Tool to search for sequences
server.tool(
    "search_sequences",
    "Searches for saved sequences by name, description, or trigger pattern.",
    {
        query: z.string().describe("Search query to find matching sequences")
    },
    async ({ query }) => {
        try {
            const sequences = memoryStore.searchSequences(query);
            
            if (sequences.length === 0) {
                return {
                    content: [{ type: 'text', text: `No sequences found matching '${query}'.` }]
                };
            }
            
            const sequenceList = sequences.map(s => 
                `• ${s.name}: ${s.description || 'No description'}`
            ).join('\n');
            
            return {
                content: [{ type: 'text', text: `Found ${sequences.length} sequence(s):\n${sequenceList}` }]
            };
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error searching sequences: ${e.message}` }]
            };
        }
    }
);

// Tool to delete a sequence
server.tool(
    "delete_sequence",
    "Deletes a saved sequence from memory.",
    {
        name: z.string().describe("Name of the sequence to delete")
    },
    async ({ name }) => {
        try {
            const deleted = memoryStore.deleteSequence(name);
            
            if (!deleted) {
                return {
                    content: [{ type: 'text', text: `Sequence '${name}' not found.` }]
                };
            }
            
            return {
                content: [{ type: 'text', text: `Sequence '${name}' deleted.` }]
            };
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error deleting sequence: ${e.message}` }]
            };
        }
    }
);

// Tool to run a saved sequence
server.tool(
    "run_sequence",
    "Executes a saved sequence of actions. The sequence runs autonomously but can be interrupted using interrupt_sequence.",
    {
        name: z.string().describe("Name of the sequence to run"),
        variables: z.record(z.string()).optional().describe("Variables to substitute in action parameters (use {{variableName}} in sequence)")
    },
    async ({ name, variables = {} }) => {
        try {
            const sequence = memoryStore.getSequence(name);
            
            if (!sequence) {
                return {
                    content: [{ type: 'text', text: `Sequence '${name}' not found.` }]
                };
            }
            
            state.runningSequence = name;
            state.interruptRequested = false;
            
            const results = [];
            let completedSteps = 0;
            
            for (const action of sequence.actions) {
                // Check for interrupt
                if (state.interruptRequested) {
                    state.runningSequence = null;
                    state.interruptRequested = false;
                    memoryStore.logExecution(name, 'INTERRUPTED', { completedSteps }, false, 'User interrupted sequence');
                    return {
                        content: [{ 
                            type: 'text', 
                            text: `Sequence '${name}' interrupted after ${completedSteps}/${sequence.actions.length} steps.\nCompleted actions:\n${results.join('\n')}` 
                        }]
                    };
                }
                
                // Substitute variables in parameters
                let params = JSON.stringify(action.parameters);
                for (const [key, value] of Object.entries(variables)) {
                    params = params.replace(new RegExp(`{{${key}}}`, 'g'), value);
                }
                params = JSON.parse(params);
                
                // Execute the action (simplified - in practice would need to call the actual tool)
                try {
                    const result = await executeAction(action.toolName, params);
                    results.push(`✓ ${action.toolName}: ${result}`);
                    memoryStore.logExecution(name, action.toolName, params, true);
                    completedSteps++;
                } catch (actionError) {
                    memoryStore.logExecution(name, action.toolName, params, false, actionError.message);
                    results.push(`✗ ${action.toolName}: ${actionError.message}`);
                    state.runningSequence = null;
                    return {
                        content: [{ 
                            type: 'text', 
                            text: `Sequence '${name}' failed at step ${completedSteps + 1}.\nResults:\n${results.join('\n')}` 
                        }]
                    };
                }
            }
            
            state.runningSequence = null;
            return {
                content: [{ 
                    type: 'text', 
                    text: `Sequence '${name}' completed successfully (${completedSteps} steps).\nResults:\n${results.join('\n')}` 
                }]
            };
        } catch (e) {
            state.runningSequence = null;
            return {
                content: [{ type: 'text', text: `Error running sequence: ${e.message}` }]
            };
        }
    }
);

// Helper function to execute an action
async function executeAction(toolName, params) {
    const driver = getDriver();
    
    switch (toolName) {
        case 'navigate':
            await driver.get(params.url);
            return `Navigated to ${params.url}`;
            
        case 'click_element': {
            const locator = getLocator(params.by, params.value);
            const element = await driver.wait(until.elementLocated(locator), params.timeout || 10000);
            await element.click();
            return 'Element clicked';
        }
            
        case 'send_keys': {
            const locator = getLocator(params.by, params.value);
            const element = await driver.wait(until.elementLocated(locator), params.timeout || 10000);
            await element.clear();
            await element.sendKeys(params.text);
            return `Text "${params.text}" entered`;
        }
            
        case 'find_element': {
            const locator = getLocator(params.by, params.value);
            await driver.wait(until.elementLocated(locator), params.timeout || 10000);
            return 'Element found';
        }
            
        case 'get_element_text': {
            const locator = getLocator(params.by, params.value);
            const element = await driver.wait(until.elementLocated(locator), params.timeout || 10000);
            const text = await element.getText();
            return `Text: ${text}`;
        }
            
        case 'hover': {
            const locator = getLocator(params.by, params.value);
            const element = await driver.wait(until.elementLocated(locator), params.timeout || 10000);
            const actions = driver.actions({ bridge: true });
            await actions.move({ origin: element }).perform();
            return 'Hovered over element';
        }
            
        case 'double_click': {
            const locator = getLocator(params.by, params.value);
            const element = await driver.wait(until.elementLocated(locator), params.timeout || 10000);
            const actions = driver.actions({ bridge: true });
            await actions.doubleClick(element).perform();
            return 'Double clicked';
        }
            
        case 'right_click': {
            const locator = getLocator(params.by, params.value);
            const element = await driver.wait(until.elementLocated(locator), params.timeout || 10000);
            const actions = driver.actions({ bridge: true });
            await actions.contextClick(element).perform();
            return 'Right clicked';
        }
            
        case 'press_key': {
            const actions = driver.actions({ bridge: true });
            await actions.keyDown(params.key).keyUp(params.key).perform();
            return `Key '${params.key}' pressed`;
        }
            
        case 'drag_and_drop': {
            const sourceLocator = getLocator(params.by, params.value);
            const targetLocator = getLocator(params.targetBy, params.targetValue);
            const sourceElement = await driver.wait(until.elementLocated(sourceLocator), params.timeout || 10000);
            const targetElement = await driver.wait(until.elementLocated(targetLocator), params.timeout || 10000);
            const actions = driver.actions({ bridge: true });
            await actions.dragAndDrop(sourceElement, targetElement).perform();
            return 'Drag and drop completed';
        }
            
        case 'upload_file': {
            const locator = getLocator(params.by, params.value);
            const element = await driver.wait(until.elementLocated(locator), params.timeout || 10000);
            await element.sendKeys(params.filePath);
            return 'File upload initiated';
        }
            
        default:
            throw new Error(`Unknown action: ${toolName}`);
    }
}

// Tool to interrupt a running sequence
server.tool(
    "interrupt_sequence",
    "Interrupts the currently running sequence. The sequence will stop after completing the current action.",
    {},
    async () => {
        try {
            if (!state.runningSequence) {
                return {
                    content: [{ type: 'text', text: 'No sequence is currently running.' }]
                };
            }
            
            state.interruptRequested = true;
            return {
                content: [{ type: 'text', text: `Interrupt requested for sequence '${state.runningSequence}'. It will stop after the current action completes.` }]
            };
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error interrupting sequence: ${e.message}` }]
            };
        }
    }
);

// Tool to save element mappings
server.tool(
    "save_element",
    "Saves an element mapping for a site, allowing you to reference elements by friendly names.",
    {
        sitePattern: z.string().describe("URL pattern to match (e.g., 'github.com' or regex like '.*\\.github\\.com.*')"),
        elementName: z.string().describe("Friendly name for the element (e.g., 'login_button')"),
        by: z.enum(["id", "css", "xpath", "name", "tag", "class"]).describe("Locator strategy"),
        value: z.string().describe("Locator value"),
        description: z.string().optional().describe("Description of the element")
    },
    async ({ sitePattern, elementName, by, value, description = '' }) => {
        try {
            memoryStore.saveElementMapping(sitePattern, elementName, by, value, description);
            return {
                content: [{ type: 'text', text: `Element '${elementName}' saved for site pattern '${sitePattern}'.` }]
            };
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error saving element: ${e.message}` }]
            };
        }
    }
);

// Tool to get element mappings for current site
server.tool(
    "get_elements",
    "Gets all saved element mappings for the current page or a specified URL.",
    {
        url: z.string().optional().describe("URL to get elements for. If not provided, uses current page URL.")
    },
    async ({ url }) => {
        try {
            let targetUrl = url;
            if (!targetUrl) {
                const driver = getDriver();
                targetUrl = await driver.getCurrentUrl();
            }
            
            const elements = memoryStore.getElementMappingsForSite(targetUrl);
            
            if (elements.length === 0) {
                return {
                    content: [{ type: 'text', text: `No saved elements found for URL: ${targetUrl}` }]
                };
            }
            
            const elementList = elements.map(e => 
                `• ${e.element_name}: ${e.locator_by}="${e.locator_value}"${e.description ? ` (${e.description})` : ''}`
            ).join('\n');
            
            return {
                content: [{ type: 'text', text: `Saved elements for ${targetUrl}:\n${elementList}` }]
            };
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error getting elements: ${e.message}` }]
            };
        }
    }
);

// Tool to click using saved element name
server.tool(
    "click_saved_element",
    "Clicks an element using a previously saved element name.",
    {
        elementName: z.string().describe("Friendly name of the saved element"),
        timeout: z.number().optional().describe("Maximum time to wait for element in milliseconds")
    },
    async ({ elementName, timeout = 10000 }) => {
        try {
            const driver = getDriver();
            const currentUrl = await driver.getCurrentUrl();
            const elements = memoryStore.getElementMappingsForSite(currentUrl);
            
            const element = elements.find(e => e.element_name === elementName);
            if (!element) {
                return {
                    content: [{ type: 'text', text: `Element '${elementName}' not found for current site.` }]
                };
            }
            
            const locator = getLocator(element.locator_by, element.locator_value);
            const webElement = await driver.wait(until.elementLocated(locator), timeout);
            await webElement.click();
            
            recordAction('click_element', { by: element.locator_by, value: element.locator_value, timeout });
            
            return {
                content: [{ type: 'text', text: `Clicked element '${elementName}'` }]
            };
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error clicking element: ${e.message}` }]
            };
        }
    }
);

// Tool to type using saved element name
server.tool(
    "type_in_saved_element",
    "Types text into an element using a previously saved element name.",
    {
        elementName: z.string().describe("Friendly name of the saved element"),
        text: z.string().describe("Text to type"),
        timeout: z.number().optional().describe("Maximum time to wait for element in milliseconds")
    },
    async ({ elementName, text, timeout = 10000 }) => {
        try {
            const driver = getDriver();
            const currentUrl = await driver.getCurrentUrl();
            const elements = memoryStore.getElementMappingsForSite(currentUrl);
            
            const element = elements.find(e => e.element_name === elementName);
            if (!element) {
                return {
                    content: [{ type: 'text', text: `Element '${elementName}' not found for current site.` }]
                };
            }
            
            const locator = getLocator(element.locator_by, element.locator_value);
            const webElement = await driver.wait(until.elementLocated(locator), timeout);
            await webElement.clear();
            await webElement.sendKeys(text);
            
            recordAction('send_keys', { by: element.locator_by, value: element.locator_value, text, timeout });
            
            return {
                content: [{ type: 'text', text: `Typed "${text}" into element '${elementName}'` }]
            };
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error typing in element: ${e.message}` }]
            };
        }
    }
);

// Tool to get execution history
server.tool(
    "get_execution_history",
    "Gets the history of executed actions and sequences.",
    {
        limit: z.number().optional().describe("Maximum number of entries to return (default: 50)")
    },
    async ({ limit = 50 }) => {
        try {
            const history = memoryStore.getExecutionHistory(limit);
            
            if (history.length === 0) {
                return {
                    content: [{ type: 'text', text: 'No execution history found.' }]
                };
            }
            
            const historyList = history.map(h => {
                const status = h.success ? '✓' : '✗';
                const seq = h.sequence_name ? `[${h.sequence_name}] ` : '';
                const error = h.error_message ? ` - ${h.error_message}` : '';
                return `${status} ${seq}${h.tool_name}${error} (${h.executed_at})`;
            }).join('\n');
            
            return {
                content: [{ type: 'text', text: `Execution history (last ${history.length} entries):\n${historyList}` }]
            };
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error getting history: ${e.message}` }]
            };
        }
    }
);

// Tool to get recording status
server.tool(
    "get_recording_status",
    "Gets the current recording status and recorded actions.",
    {},
    async () => {
        try {
            if (!state.recordingSequence) {
                return {
                    content: [{ type: 'text', text: 'Not currently recording.' }]
                };
            }
            
            const actionList = state.recordedActions.map((a, i) => 
                `  ${i + 1}. ${a.toolName}: ${JSON.stringify(a.parameters)}`
            ).join('\n');
            
            return {
                content: [{ 
                    type: 'text', 
                    text: `Recording: ${state.recordingSequence}\nDescription: ${state.recordingDescription || 'No description'}\nTrigger: ${state.recordingTrigger || 'No trigger pattern'}\nRecorded actions (${state.recordedActions.length}):\n${actionList || '  (none yet)'}` 
                }]
            };
        } catch (e) {
            return {
                content: [{ type: 'text', text: `Error getting recording status: ${e.message}` }]
            };
        }
    }
);

// Resources
server.resource(
    "browser-status",
    new ResourceTemplate("browser-status://current"),
    async (uri) => ({
        contents: [{
            uri: uri.href,
            text: state.currentSession
                ? `Active browser session: ${state.currentSession}`
                : "No active browser session"
        }]
    })
);

server.resource(
    "memory-status",
    new ResourceTemplate("memory-status://current"),
    async (uri) => {
        const sequences = memoryStore.listSequences();
        const recordingStatus = state.recordingSequence 
            ? `Recording: ${state.recordingSequence} (${state.recordedActions.length} actions)`
            : "Not recording";
        const runningStatus = state.runningSequence 
            ? `Running: ${state.runningSequence}`
            : "No sequence running";
        
        return {
            contents: [{
                uri: uri.href,
                text: `Memory Status:\n- Saved sequences: ${sequences.length}\n- ${recordingStatus}\n- ${runningStatus}`
            }]
        };
    }
);

server.resource(
    "sequences-list",
    new ResourceTemplate("sequences-list://all"),
    async (uri) => {
        const sequences = memoryStore.listSequences();
        
        if (sequences.length === 0) {
            return {
                contents: [{
                    uri: uri.href,
                    text: "No saved sequences"
                }]
            };
        }
        
        const list = sequences.map(s => 
            `• ${s.name} (${s.action_count} actions) - ${s.description || 'No description'}`
        ).join('\n');
        
        return {
            contents: [{
                uri: uri.href,
                text: `Saved Sequences:\n${list}`
            }]
        };
    }
);

// Cleanup handler
async function cleanup() {
    // Close memory store
    try {
        memoryStore.close();
    } catch (e) {
        console.error('Error closing memory store:', e);
    }
    
    for (const [sessionId, driver] of state.drivers) {
        try {
            await driver.quit();
        } catch (e) {
            console.error(`Error closing browser session ${sessionId}:`, e);
        }
    }
    state.drivers.clear();
    state.currentSession = null;
    process.exit(0);
}

process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);