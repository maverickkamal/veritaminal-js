/**
 * Memory module for Veritaminal
 * Handles the storage of game history, narrative state, and player decisions.
 * Maintains continuity across game sessions and implements the AI memory system.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

// Helper to get __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Go one level up from src to get the project root
const projectRoot = path.resolve(__dirname, '..');

class MemoryManager {
    /**
     * Manages the game's memory and narrative continuity.
     * @param {string} [saveDir="saves"] - Directory relative to project root to store save files.
     */
    constructor(saveDir = "saves") {
        this.saveDir = saveDir;
        this.savePath = path.join(projectRoot, this.saveDir);
        this.memory = this.getDefaultMemory();
        this._ensureSaveDirectory(); // Call async method without await in constructor (best practice)
    }

    /**
     * Returns the default memory structure.
     * @returns {object} Default memory object.
     */
    getDefaultMemory() {
        return {
            borderSetting: null, // Selected border/country setting
            gameState: {
                day: 1,
                corruption: 0, // Incorrect approves
                trust: 0       // Incorrect denies (represented as negative value)
            },
            travelerHistory: [], // List of previous travelers (limited size)
            decisions: [],       // List of player decisions (limited size)
            narrativeEvents: [], // Key narrative events (limited size)
            ruleChanges: [],     // History of rule changes (limited size)
            usedNames: new Set() // Track used names to prevent repetition
        };
    }

    /**
     * Ensures the save directory exists.
     * @private
     */
    async _ensureSaveDirectory() {
        try {
            await fs.mkdir(this.savePath, { recursive: true });
            // console.log(`Save directory ensured at ${this.savePath}`);
        } catch (e) {
            console.error(chalk.red(`Failed to create or access save directory: ${this.savePath}`), e);
        }
    }

    /**
     * Sets the border/country setting for the game.
     * @param {object} setting - Contains setting info like name, situation, etc.
     */
    setBorderSetting(setting) {
        this.memory.borderSetting = setting;
    }

    /**
     * Adds a traveler to the history with the player's decision.
     * @param {object} travelerData - The traveler document data.
     * @param {string} decision - The player's decision ('approve'/'deny').
     * @param {boolean} isCorrect - Whether the decision was correct.
     * @param {object} aiJudgment - AI's evaluation of the document.
     */
    addTraveler(travelerData, decision, isCorrect, aiJudgment) {
        if (!travelerData || !travelerData.name) {
            console.error(chalk.red("MemoryManager Error: Invalid traveler data provided."));
            return;
        }

        // Add name to used names set
        this.memory.usedNames.add(travelerData.name);

        // Add timestamp
        const timestamp = new Date().toISOString();

        // Add to traveler history (limit size)
        this.memory.travelerHistory.push({
            traveler: { // Store only essential parts if needed to save space
                name: travelerData.name,
                permit: travelerData.permit,
                // backstory: travelerData.backstory // Optional: exclude if too long
            },
            timestamp: timestamp,
            day: this.memory.gameState.day
        });
        if (this.memory.travelerHistory.length > 15) { // Keep last 15 travelers
            this.memory.travelerHistory.shift(); // Remove oldest
        }

        // Add to decisions history (limit size)
        this.memory.decisions.push({
            travelerName: travelerData.name,
            decision: decision,
            correct: isCorrect,
            aiJudgment: { // Store key parts of AI judgment
                decision: aiJudgment?.decision,
                confidence: aiJudgment?.confidence,
                // reasoning: aiJudgment?.reasoning // Optional: exclude if too long
            },
            timestamp: timestamp,
            day: this.memory.gameState.day
        });
         if (this.memory.decisions.length > 15) { // Keep last 15 decisions
            this.memory.decisions.shift();
        }
    }

    /**
     * Adds a narrative event to the history.
     * @param {string} eventText - Description of the event.
     * @param {string} eventType - Type of event (e.g., "milestone", "rule_change", "special", "start", "day_change").
     */
    addNarrativeEvent(eventText, eventType) {
        this.memory.narrativeEvents.push({
            text: eventText,
            type: eventType,
            day: this.memory.gameState.day,
            timestamp: new Date().toISOString()
        });
        // Limit narrative events (keep last 20)
        if (this.memory.narrativeEvents.length > 20) {
            this.memory.narrativeEvents.shift();
        }
    }

    /**
     * Adds a rule change to the history.
     * @param {string} ruleDescription - Description of the rule change.
     */
    addRuleChange(ruleDescription) {
        this.memory.ruleChanges.push({
            description: ruleDescription,
            day: this.memory.gameState.day,
            timestamp: new Date().toISOString()
        });
         // Limit rule changes (keep last 10)
         if (this.memory.ruleChanges.length > 10) {
            this.memory.ruleChanges.shift();
        }
    }

    /**
     * Updates the game state.
     * @param {object} stateUpdates - Updates to apply to the game state (e.g., { corruption: 1 }).
     */
    updateGameState(stateUpdates) {
        this.memory.gameState = { ...this.memory.gameState, ...stateUpdates };
    }

    /**
     * Advances to the next day.
     */
    advanceDay() {
        this.memory.gameState.day += 1;
    }

    /**
     * Gets a formatted context string representing the current memory state
     * for use in AI prompts. Limits the amount of history included.
     * @returns {string} A formatted context string.
     */
    getMemoryContext() {
        const context = [];
        const maxItems = 5; // Max items per history list

        // Add border setting
        if (this.memory.borderSetting) {
            context.push(`BORDER SETTING: ${this.memory.borderSetting.name}`);
            context.push(`POLITICAL SITUATION: ${this.memory.borderSetting.situation}`);
        }

        // Add current game state
        context.push(`\nCURRENT GAME STATE:`);
        context.push(`- Day: ${this.memory.gameState.day}`);
        context.push(`- Corruption Score (Incorrect Approvals): ${this.memory.gameState.corruption}`);
        context.push(`- Trust Score (Starts 0, Incorrect Denials decrease it): ${this.memory.gameState.trust}`);

        // Add recent rules (if any)
        if (this.memory.ruleChanges.length > 0) {
            context.push("\nRECENT RULE CHANGES:");
            this.memory.ruleChanges.slice(-maxItems).forEach(rule => {
                context.push(`- Day ${rule.day}: ${rule.description}`);
            });
        }

        // Add recent narrative events
        if (this.memory.narrativeEvents.length > 0) {
            context.push("\nRECENT NARRATIVE EVENTS:");
            this.memory.narrativeEvents.slice(-maxItems).forEach(event => {
                context.push(`- Day ${event.day} (${event.type}): ${event.text}`);
            });
        }

        // Add recent decisions
        if (this.memory.decisions.length > 0) {
            context.push("\nRECENT DECISIONS:");
            this.memory.decisions.slice(-maxItems).forEach(decision => {
                const correctStr = decision.correct ? "correctly" : "incorrectly";
                context.push(`- Day ${decision.day}: ${decision.travelerName} was ${decision.decision}ed ${correctStr}. (AI: ${decision.aiJudgment?.decision || 'N/A'})`);
            });
        }

        return context.join("\n");
    }

    /**
     * Gets a context string of previously used traveler names to avoid repetition.
     * @returns {string} A formatted string with previously used names.
     */
    getUsedNamesContext() {
        if (this.memory.usedNames.size === 0) {
            return "No previous travelers processed in this session yet.";
        }

        const namesList = Array.from(this.memory.usedNames);
        const recentNames = namesList.slice(-25); // Limit to last 25 names for context

        return `Previously encountered traveler names in this session: ${recentNames.join(", ")}. Please generate a new unique name NOT on this list.`;
    }

    /**
     * Saves the current game state to a file.
     * @async
     * @param {string} [filename=null] - Filename to save to. If null, a timestamped name is used.
     * @returns {Promise<boolean>} True if save was successful, False otherwise.
     */
    async saveGame(filename = null) {
        if (!filename) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            filename = `veritaminal_save_${timestamp}.json`;
        }

        const filePath = path.join(this.savePath, filename);

        try {
            // Ensure save directory exists before writing
            await this._ensureSaveDirectory();

            // Convert Set to Array for JSON serialization
            const memoryToSave = {
                ...this.memory,
                usedNames: Array.from(this.memory.usedNames)
            };

            const data = JSON.stringify(memoryToSave, null, 2); // Pretty print JSON
            await fs.writeFile(filePath, data, 'utf8');
            console.log(chalk.green(`Game saved successfully to ${filename}`));
            return true;
        } catch (e) {
            console.error(chalk.red(`Failed to save game to ${filePath}: ${e.message}`));
            return false;
        }
    }

    /**
     * Loads a saved game from a file.
     * @async
     * @param {string} filepath - Absolute path to the save file.
     * @returns {Promise<boolean>} True if load was successful, False otherwise.
     */
    async loadGame(filepath) {
        try {
            if (!path.isAbsolute(filepath)) {
                 console.error(chalk.red(`Load game error: Filepath must be absolute. Got: ${filepath}`));
                 return false;
            }
             const data = await fs.readFile(filepath, 'utf8');
            const loadedMemory = JSON.parse(data);

            // Convert usedNames list back to Set, handle potential absence in old saves
            loadedMemory.usedNames = new Set(loadedMemory.usedNames || []);

             // Ensure essential keys exist, merging with defaults if necessary
             this.memory = {
                ...this.getDefaultMemory(), // Start with defaults
                ...loadedMemory, // Overwrite with loaded data
                gameState: { // Ensure gameState and its keys exist
                     ...(this.getDefaultMemory().gameState),
                     ...(loadedMemory.gameState || {})
                },
                usedNames: loadedMemory.usedNames // Make sure the Set is preserved
             };


            console.log(chalk.green(`Game loaded successfully from ${path.basename(filepath)}`));
            return true;
        } catch (e) {
            console.error(chalk.red(`Failed to load game from ${filepath}: ${e.message}`));
            // Reset to default memory if load fails? Or leave as is? Let's reset.
            this.resetMemory();
            return false;
        }
    }

    /**
     * Resets the game memory to default values, preserving the save directory path.
     */
    resetMemory() {
        const saveDir = this.saveDir;
        const savePath = this.savePath;
        this.memory = this.getDefaultMemory();
        this.saveDir = saveDir; // Restore these after reset
        this.savePath = savePath;
        console.log("Game memory reset to default state.");
    }
}

export { MemoryManager };