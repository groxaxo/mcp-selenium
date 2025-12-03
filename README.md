# MCP Selenium Server

A Model Context Protocol (MCP) server implementation for Selenium WebDriver, enabling browser automation through standardized MCP clients. This enhanced version includes **memory and learning capabilities** that allow LLMs to record, remember, and replay browser automation workflows.

> **Note**: This is a fork of [@angiejones/mcp-selenium](https://github.com/angiejones/mcp-selenium) with additional features for autonomous operation and persistent memory.

## Video Demo (Click to Watch)

[![Watch the video](https://img.youtube.com/vi/mRV0N8hcgYA/sddefault.jpg)](https://youtu.be/mRV0N8hcgYA)

## Features

### Core Browser Automation
- Start browser sessions with customizable options
- Navigate to URLs
- Find elements using various locator strategies
- Click, type, and interact with elements
- Perform mouse actions (hover, drag and drop)
- Handle keyboard input
- Take screenshots
- Upload files
- Support for headless mode

### Memory & Learning
- **Record & Replay**: Record action sequences and replay them later
- **Element Mappings**: Save element locators for sites with friendly names
- **Teachable Workflows**: Teach the LLM new workflows by recording actions
- **Interruptible Sequences**: Stop running sequences at any time
- **Persistent Storage**: All learned data is stored in SQLite (`~/.mcp-selenium/memory.db`)
- **Variable Substitution**: Use `{{variableName}}` placeholders in sequences for dynamic values

## Supported Browsers

- Chrome
- Firefox
- Microsoft Edge

---

## Installation

### Quick Start with NPX

The easiest way to use MCP Selenium is with NPX, which requires no installation:

```bash
npx -y @angiejones/mcp-selenium
```

### Global Installation

For faster startup and offline use, install globally:

```bash
npm install -g @angiejones/mcp-selenium
```

Then run:

```bash
mcp-selenium
```

### Installing via Smithery

To install for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@angiejones/mcp-selenium):

```bash
npx -y @smithery/cli install @angiejones/mcp-selenium --client claude
```

---

## Configuration

### Use with Goose

#### Option 1: One-click install
Copy and paste the link below into a browser address bar to add this extension to Goose Desktop:

```
goose://extension?cmd=npx&arg=-y&arg=%40angiejones%2Fmcp-selenium&id=selenium-mcp&name=Selenium%20MCP&description=automates%20browser%20interactions
```

#### Option 2: Add manually to desktop or CLI

* Name: `Selenium MCP`
* Description: `automates browser interactions`
* Command: `npx -y @angiejones/mcp-selenium`

### Use with Claude Desktop

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "selenium": {
      "command": "npx",
      "args": ["-y", "@angiejones/mcp-selenium"]
    }
  }
}
```

### Use with Other MCP Clients

The same configuration pattern works with any MCP-compatible client:

```json
{
  "mcpServers": {
    "selenium": {
      "command": "npx",
      "args": ["-y", "@angiejones/mcp-selenium"]
    }
  }
}
```

---

## Development

To work on this project locally:

1. Clone the repository:
   ```bash
   git clone https://github.com/groxaxo/mcp-selenium.git
   cd mcp-selenium
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the server:
   ```bash
   npm start
   ```

### Using Docker

Build and run with Docker:

```bash
docker build -t mcp-selenium .
docker run mcp-selenium
```

---

## Tools

### Browser Management

#### start_browser
Launches a browser session.

**Parameters:**
- `browser` (required): Browser to launch
  - Type: string
  - Enum: `["chrome", "firefox", "edge"]`
- `options`: Browser configuration options
  - Type: object
  - Properties:
    - `headless`: Run browser in headless mode
      - Type: boolean
    - `arguments`: Additional browser arguments
      - Type: array of strings

**Example:**
```json
{
  "tool": "start_browser",
  "parameters": {
    "browser": "chrome",
    "options": {
      "headless": true,
      "arguments": ["--no-sandbox"]
    }
  }
}
```

#### navigate
Navigates to a URL.

**Parameters:**
- `url` (required): URL to navigate to
  - Type: string

**Example:**
```json
{
  "tool": "navigate",
  "parameters": {
    "url": "https://www.example.com"
  }
}
```

#### close_session
Closes the current browser session and cleans up resources.

**Parameters:** None required

**Example:**
```json
{
  "tool": "close_session",
  "parameters": {}
}
```

---

### Element Interaction

#### find_element
Finds an element on the page.

**Parameters:**
- `by` (required): Locator strategy
  - Type: string
  - Enum: `["id", "css", "xpath", "name", "tag", "class"]`
- `value` (required): Value for the locator strategy
  - Type: string
- `timeout`: Maximum time to wait for element in milliseconds
  - Type: number
  - Default: 10000

**Example:**
```json
{
  "tool": "find_element",
  "parameters": {
    "by": "id",
    "value": "search-input",
    "timeout": 5000
  }
}
```

#### click_element
Clicks an element.

**Parameters:**
- `by` (required): Locator strategy
  - Type: string
  - Enum: `["id", "css", "xpath", "name", "tag", "class"]`
- `value` (required): Value for the locator strategy
  - Type: string
- `timeout`: Maximum time to wait for element in milliseconds
  - Type: number
  - Default: 10000

**Example:**
```json
{
  "tool": "click_element",
  "parameters": {
    "by": "css",
    "value": ".submit-button"
  }
}
```

#### send_keys
Sends keys to an element (typing).

**Parameters:**
- `by` (required): Locator strategy
  - Type: string
  - Enum: `["id", "css", "xpath", "name", "tag", "class"]`
- `value` (required): Value for the locator strategy
  - Type: string
- `text` (required): Text to enter into the element
  - Type: string
- `timeout`: Maximum time to wait for element in milliseconds
  - Type: number
  - Default: 10000

**Example:**
```json
{
  "tool": "send_keys",
  "parameters": {
    "by": "name",
    "value": "username",
    "text": "testuser"
  }
}
```

#### get_element_text
Gets the text content of an element.

**Parameters:**
- `by` (required): Locator strategy
  - Type: string
  - Enum: `["id", "css", "xpath", "name", "tag", "class"]`
- `value` (required): Value for the locator strategy
  - Type: string
- `timeout`: Maximum time to wait for element in milliseconds
  - Type: number
  - Default: 10000

**Example:**
```json
{
  "tool": "get_element_text",
  "parameters": {
    "by": "css",
    "value": ".message"
  }
}
```

---

### Mouse Actions

#### hover
Moves the mouse to hover over an element.

**Parameters:**
- `by` (required): Locator strategy
  - Type: string
  - Enum: `["id", "css", "xpath", "name", "tag", "class"]`
- `value` (required): Value for the locator strategy
  - Type: string
- `timeout`: Maximum time to wait for element in milliseconds
  - Type: number
  - Default: 10000

**Example:**
```json
{
  "tool": "hover",
  "parameters": {
    "by": "css",
    "value": ".dropdown-menu"
  }
}
```

#### drag_and_drop
Drags an element and drops it onto another element.

**Parameters:**
- `by` (required): Locator strategy for source element
  - Type: string
  - Enum: `["id", "css", "xpath", "name", "tag", "class"]`
- `value` (required): Value for the source locator strategy
  - Type: string
- `targetBy` (required): Locator strategy for target element
  - Type: string
  - Enum: `["id", "css", "xpath", "name", "tag", "class"]`
- `targetValue` (required): Value for the target locator strategy
  - Type: string
- `timeout`: Maximum time to wait for elements in milliseconds
  - Type: number
  - Default: 10000

**Example:**
```json
{
  "tool": "drag_and_drop",
  "parameters": {
    "by": "id",
    "value": "draggable",
    "targetBy": "id",
    "targetValue": "droppable"
  }
}
```

#### double_click
Performs a double click on an element.

**Parameters:**
- `by` (required): Locator strategy
  - Type: string
  - Enum: `["id", "css", "xpath", "name", "tag", "class"]`
- `value` (required): Value for the locator strategy
  - Type: string
- `timeout`: Maximum time to wait for element in milliseconds
  - Type: number
  - Default: 10000

**Example:**
```json
{
  "tool": "double_click",
  "parameters": {
    "by": "css",
    "value": ".editable-text"
  }
}
```

#### right_click
Performs a right click (context click) on an element.

**Parameters:**
- `by` (required): Locator strategy
  - Type: string
  - Enum: `["id", "css", "xpath", "name", "tag", "class"]`
- `value` (required): Value for the locator strategy
  - Type: string
- `timeout`: Maximum time to wait for element in milliseconds
  - Type: number
  - Default: 10000

**Example:**
```json
{
  "tool": "right_click",
  "parameters": {
    "by": "css",
    "value": ".context-menu-trigger"
  }
}
```

---

### Keyboard Input

#### press_key
Simulates pressing a keyboard key.

**Parameters:**
- `key` (required): Key to press (e.g., 'Enter', 'Tab', 'a', etc.)
  - Type: string

**Example:**
```json
{
  "tool": "press_key",
  "parameters": {
    "key": "Enter"
  }
}
```

---

### File Operations

#### upload_file
Uploads a file using a file input element.

**Parameters:**
- `by` (required): Locator strategy
  - Type: string
  - Enum: `["id", "css", "xpath", "name", "tag", "class"]`
- `value` (required): Value for the locator strategy
  - Type: string
- `filePath` (required): Absolute path to the file to upload
  - Type: string
- `timeout`: Maximum time to wait for element in milliseconds
  - Type: number
  - Default: 10000

**Example:**
```json
{
  "tool": "upload_file",
  "parameters": {
    "by": "id",
    "value": "file-input",
    "filePath": "/path/to/file.pdf"
  }
}
```

#### take_screenshot
Captures a screenshot of the current page.

**Parameters:**
- `outputPath` (optional): Path where to save the screenshot. If not provided, returns base64 data.
  - Type: string

**Example:**
```json
{
  "tool": "take_screenshot",
  "parameters": {
    "outputPath": "/path/to/screenshot.png"
  }
}
```

---

## Memory & Learning Tools

These tools enable the LLM to learn and remember action sequences that can be replayed later. The memory is persisted using SQLite, stored in `~/.mcp-selenium/memory.db`.

### Recording Sequences

#### start_recording
Starts recording actions to create a reusable sequence. Use this when teaching the system a new workflow.

**Parameters:**
- `sequenceName` (required): Unique name for the sequence being recorded
  - Type: string
- `description` (optional): Human-readable description of what this sequence does
  - Type: string
- `triggerPattern` (optional): Pattern/phrase that should trigger this sequence
  - Type: string

**Example:**
```json
{
  "tool": "start_recording",
  "parameters": {
    "sequenceName": "github-login",
    "description": "Logs into GitHub",
    "triggerPattern": "login to github"
  }
}
```

#### stop_recording
Stops recording actions and saves the sequence to memory for future use.

**Parameters:** None required

**Example:**
```json
{
  "tool": "stop_recording",
  "parameters": {}
}
```

#### cancel_recording
Cancels the current recording without saving the sequence.

**Parameters:** None required

#### get_recording_status
Gets the current recording status and recorded actions.

**Parameters:** None required

### Sequence Management

#### save_sequence
Saves a predefined sequence of actions to memory programmatically.

**Parameters:**
- `name` (required): Unique name for the sequence
  - Type: string
- `description` (required): Human-readable description
  - Type: string
- `triggerPattern` (optional): Pattern/phrase that should trigger this sequence
  - Type: string
- `actions` (required): Array of actions to execute in order
  - Type: array of objects with `toolName` and `parameters`

**Example:**
```json
{
  "tool": "save_sequence",
  "parameters": {
    "name": "search-google",
    "description": "Searches Google for a query",
    "triggerPattern": "search google for",
    "actions": [
      { "toolName": "navigate", "parameters": { "url": "https://google.com" } },
      { "toolName": "send_keys", "parameters": { "by": "name", "value": "q", "text": "{{query}}" } },
      { "toolName": "press_key", "parameters": { "key": "Enter" } }
    ]
  }
}
```

#### list_sequences
Lists all saved action sequences available for execution.

**Parameters:** None required

#### get_sequence
Gets the details of a saved sequence including all its actions.

**Parameters:**
- `name` (required): Name of the sequence to retrieve
  - Type: string

#### search_sequences
Searches for saved sequences by name, description, or trigger pattern.

**Parameters:**
- `query` (required): Search query to find matching sequences
  - Type: string

#### delete_sequence
Deletes a saved sequence from memory.

**Parameters:**
- `name` (required): Name of the sequence to delete
  - Type: string

### Executing Sequences

#### run_sequence
Executes a saved sequence of actions autonomously. The sequence can be interrupted using `interrupt_sequence`.

**Parameters:**
- `name` (required): Name of the sequence to run
  - Type: string
- `variables` (optional): Variables to substitute in action parameters (use `{{variableName}}` in sequence)
  - Type: object (key-value pairs)

**Example:**
```json
{
  "tool": "run_sequence",
  "parameters": {
    "name": "search-google",
    "variables": {
      "query": "MCP selenium automation"
    }
  }
}
```

#### interrupt_sequence
Interrupts the currently running sequence. The sequence will stop after completing the current action.

**Parameters:** None required

### Element Mappings

#### save_element
Saves an element mapping for a site, allowing you to reference elements by friendly names.

**Parameters:**
- `sitePattern` (required): URL pattern to match (e.g., 'github.com' or regex)
  - Type: string
- `elementName` (required): Friendly name for the element (e.g., 'login_button')
  - Type: string
- `by` (required): Locator strategy
  - Type: string
  - Enum: `["id", "css", "xpath", "name", "tag", "class"]`
- `value` (required): Locator value
  - Type: string
- `description` (optional): Description of the element
  - Type: string

**Example:**
```json
{
  "tool": "save_element",
  "parameters": {
    "sitePattern": "github.com",
    "elementName": "login_button",
    "by": "css",
    "value": ".HeaderMenu-link--sign-in",
    "description": "The sign in button on GitHub header"
  }
}
```

#### get_elements
Gets all saved element mappings for the current page or a specified URL.

**Parameters:**
- `url` (optional): URL to get elements for. If not provided, uses current page URL.
  - Type: string

#### click_saved_element
Clicks an element using a previously saved element name.

**Parameters:**
- `elementName` (required): Friendly name of the saved element
  - Type: string
- `timeout` (optional): Maximum time to wait for element in milliseconds
  - Type: number
  - Default: 10000

#### type_in_saved_element
Types text into an element using a previously saved element name.

**Parameters:**
- `elementName` (required): Friendly name of the saved element
  - Type: string
- `text` (required): Text to type
  - Type: string
- `timeout` (optional): Maximum time to wait for element in milliseconds
  - Type: number
  - Default: 10000

### Execution History

#### get_execution_history
Gets the history of executed actions and sequences.

**Parameters:**
- `limit` (optional): Maximum number of entries to return
  - Type: number
  - Default: 50

---

## Resources

The server provides the following MCP resources for monitoring:

- `browser-status://current` - Current browser session status
- `memory-status://current` - Memory store status (sequences, recording state)
- `sequences-list://all` - List of all saved sequences

---

## License

MIT

---

## Credits

Based on the original [mcp-selenium](https://github.com/angiejones/mcp-selenium) by [Angie Jones](https://github.com/angiejones).
