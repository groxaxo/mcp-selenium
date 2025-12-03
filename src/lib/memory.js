/**
 * Memory module for storing and retrieving learned action sequences.
 * Uses SQLite for persistence.
 */

import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

// Default database path in user's home directory
const DEFAULT_DB_PATH = path.join(os.homedir(), '.mcp-selenium', 'memory.db');

// Maximum pattern length for ReDoS protection
const MAX_PATTERN_LENGTH = 200;

/**
 * Memory store for learned actions and sequences
 */
export class MemoryStore {
    constructor(dbPath = DEFAULT_DB_PATH) {
        // Ensure directory exists
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        this.db = new Database(dbPath);
        this.initializeSchema();
    }

    /**
     * Initialize database schema
     */
    initializeSchema() {
        this.db.exec(`
            -- Table for storing action sequences (reusable workflows)
            CREATE TABLE IF NOT EXISTS action_sequences (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                description TEXT,
                trigger_pattern TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- Table for storing individual actions within sequences
            CREATE TABLE IF NOT EXISTS sequence_actions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sequence_id INTEGER NOT NULL,
                step_order INTEGER NOT NULL,
                tool_name TEXT NOT NULL,
                parameters TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (sequence_id) REFERENCES action_sequences(id) ON DELETE CASCADE
            );

            -- Table for storing site-specific element mappings
            CREATE TABLE IF NOT EXISTS element_mappings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                site_pattern TEXT NOT NULL,
                element_name TEXT NOT NULL,
                locator_by TEXT NOT NULL,
                locator_value TEXT NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(site_pattern, element_name)
            );

            -- Table for storing execution history
            CREATE TABLE IF NOT EXISTS execution_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sequence_name TEXT,
                tool_name TEXT NOT NULL,
                parameters TEXT,
                success INTEGER NOT NULL,
                error_message TEXT,
                executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
    }

    /**
     * Save a new action sequence
     * @param {string} name - Unique name for the sequence
     * @param {string} description - Human-readable description
     * @param {string} triggerPattern - Pattern that triggers this sequence
     * @param {Array} actions - Array of action objects {toolName, parameters}
     * @returns {Object} Created sequence
     */
    saveSequence(name, description, triggerPattern, actions) {
        const insertSequence = this.db.prepare(`
            INSERT INTO action_sequences (name, description, trigger_pattern, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(name) DO UPDATE SET
                description = excluded.description,
                trigger_pattern = excluded.trigger_pattern,
                updated_at = CURRENT_TIMESTAMP
        `);

        const deleteActions = this.db.prepare(`
            DELETE FROM sequence_actions WHERE sequence_id = (
                SELECT id FROM action_sequences WHERE name = ?
            )
        `);

        const insertAction = this.db.prepare(`
            INSERT INTO sequence_actions (sequence_id, step_order, tool_name, parameters)
            VALUES ((SELECT id FROM action_sequences WHERE name = ?), ?, ?, ?)
        `);

        const transaction = this.db.transaction(() => {
            insertSequence.run(name, description, triggerPattern);
            deleteActions.run(name);
            
            actions.forEach((action, index) => {
                insertAction.run(
                    name,
                    index + 1,
                    action.toolName,
                    JSON.stringify(action.parameters)
                );
            });
        });

        transaction();

        return this.getSequence(name);
    }

    /**
     * Get a sequence by name
     * @param {string} name - Sequence name
     * @returns {Object|null} Sequence with actions
     */
    getSequence(name) {
        const sequence = this.db.prepare(`
            SELECT * FROM action_sequences WHERE name = ?
        `).get(name);

        if (!sequence) return null;

        const actions = this.db.prepare(`
            SELECT tool_name, parameters, step_order
            FROM sequence_actions
            WHERE sequence_id = ?
            ORDER BY step_order
        `).all(sequence.id);

        return {
            ...sequence,
            actions: actions.map(a => ({
                toolName: a.tool_name,
                parameters: JSON.parse(a.parameters),
                stepOrder: a.step_order
            }))
        };
    }

    /**
     * List all sequences
     * @returns {Array} List of sequences with basic info
     */
    listSequences() {
        return this.db.prepare(`
            SELECT 
                as1.id, 
                as1.name, 
                as1.description, 
                as1.trigger_pattern,
                as1.created_at, 
                as1.updated_at,
                COUNT(sa.id) as action_count
            FROM action_sequences as1
            LEFT JOIN sequence_actions sa ON as1.id = sa.sequence_id
            GROUP BY as1.id
            ORDER BY as1.updated_at DESC
        `).all();
    }

    /**
     * Search sequences by trigger pattern
     * @param {string} query - Search query
     * @returns {Array} Matching sequences
     */
    searchSequences(query) {
        const normalizedQuery = query.toLowerCase();
        return this.db.prepare(`
            SELECT * FROM action_sequences
            WHERE LOWER(name) LIKE ? 
               OR LOWER(description) LIKE ?
               OR LOWER(trigger_pattern) LIKE ?
            ORDER BY updated_at DESC
        `).all(`%${normalizedQuery}%`, `%${normalizedQuery}%`, `%${normalizedQuery}%`);
    }

    /**
     * Delete a sequence
     * @param {string} name - Sequence name
     * @returns {boolean} True if deleted
     */
    deleteSequence(name) {
        const result = this.db.prepare(`
            DELETE FROM action_sequences WHERE name = ?
        `).run(name);
        return result.changes > 0;
    }

    /**
     * Save an element mapping
     * @param {string} sitePattern - URL pattern for the site
     * @param {string} elementName - Human-friendly element name
     * @param {string} locatorBy - Locator strategy
     * @param {string} locatorValue - Locator value
     * @param {string} description - Description of the element
     * @returns {Object} Created mapping
     */
    saveElementMapping(sitePattern, elementName, locatorBy, locatorValue, description = '') {
        this.db.prepare(`
            INSERT INTO element_mappings (site_pattern, element_name, locator_by, locator_value, description, updated_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(site_pattern, element_name) DO UPDATE SET
                locator_by = excluded.locator_by,
                locator_value = excluded.locator_value,
                description = excluded.description,
                updated_at = CURRENT_TIMESTAMP
        `).run(sitePattern, elementName, locatorBy, locatorValue, description);

        return this.getElementMapping(sitePattern, elementName);
    }

    /**
     * Get an element mapping
     * @param {string} sitePattern - URL pattern
     * @param {string} elementName - Element name
     * @returns {Object|null} Element mapping
     */
    getElementMapping(sitePattern, elementName) {
        return this.db.prepare(`
            SELECT * FROM element_mappings 
            WHERE site_pattern = ? AND element_name = ?
        `).get(sitePattern, elementName);
    }

    /**
     * Get all element mappings for a site
     * @param {string} url - Current URL to match against patterns
     * @returns {Array} Matching element mappings
     */
    getElementMappingsForSite(url) {
        const allMappings = this.db.prepare(`
            SELECT * FROM element_mappings ORDER BY site_pattern
        `).all();

        // Filter mappings where the URL matches the pattern
        return allMappings.filter(mapping => {
            try {
                // Limit pattern length to prevent ReDoS
                if (mapping.site_pattern.length > MAX_PATTERN_LENGTH) {
                    return url.includes(mapping.site_pattern.substring(0, MAX_PATTERN_LENGTH));
                }
                
                // Try regex match with timeout protection via pattern simplicity check
                // Reject patterns with excessive quantifiers or nested groups
                const dangerousPattern = /(\+\+|\*\*|\{\d+,\d*\}\+|\{\d+,\d*\}\*|\(\?[^)]*\)\+|\(\?[^)]*\)\*)/;
                if (dangerousPattern.test(mapping.site_pattern)) {
                    // Fall back to substring match for complex patterns
                    return url.includes(mapping.site_pattern);
                }
                
                const pattern = new RegExp(mapping.site_pattern);
                return pattern.test(url);
            } catch {
                // If not a valid regex, do simple substring match
                return url.includes(mapping.site_pattern);
            }
        });
    }

    /**
     * Log an execution to history
     * @param {string} sequenceName - Name of sequence (or null for single action)
     * @param {string} toolName - Tool that was executed
     * @param {Object} parameters - Parameters used
     * @param {boolean} success - Whether execution succeeded
     * @param {string} errorMessage - Error message if failed
     */
    logExecution(sequenceName, toolName, parameters, success, errorMessage = null) {
        this.db.prepare(`
            INSERT INTO execution_history (sequence_name, tool_name, parameters, success, error_message)
            VALUES (?, ?, ?, ?, ?)
        `).run(
            sequenceName,
            toolName,
            JSON.stringify(parameters),
            success ? 1 : 0,
            errorMessage
        );
    }

    /**
     * Get recent execution history
     * @param {number} limit - Number of entries to return
     * @returns {Array} Execution history entries
     */
    getExecutionHistory(limit = 50) {
        return this.db.prepare(`
            SELECT * FROM execution_history
            ORDER BY executed_at DESC
            LIMIT ?
        `).all(limit).map(entry => {
            let parameters = {};
            try {
                parameters = JSON.parse(entry.parameters || '{}');
            } catch (parseError) {
                // Handle corrupted JSON data gracefully with debug info
                parameters = { 
                    _error: 'Invalid JSON in stored parameters',
                    _entryId: entry.id,
                    _rawPreview: (entry.parameters || '').substring(0, 50)
                };
            }
            return {
                ...entry,
                parameters,
                success: entry.success === 1
            };
        });
    }

    /**
     * Close the database connection
     */
    close() {
        this.db.close();
    }
}

// Singleton instance
let memoryStoreInstance = null;

/**
 * Get the memory store instance
 * @param {string} dbPath - Optional custom database path
 * @returns {MemoryStore}
 */
export function getMemoryStore(dbPath) {
    if (!memoryStoreInstance) {
        memoryStoreInstance = new MemoryStore(dbPath);
    }
    return memoryStoreInstance;
}

export default MemoryStore;
