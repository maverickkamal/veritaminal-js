/**
 * Gameplay module for Veritaminal
 * Handles the core gameplay mechanics including document generation,
 * verification rules, and scoring.
 */

import chalk from 'chalk';
import { MemoryManager } from './memory.js';
import { SettingsManager } from './settings.js';
import {
    generateDocumentForSetting,
    aiJudgeDocument
    // Import other API functions if needed directly by gameplay
} from './api.js';

/**
 * Represents a verification rule for documents.
 */
class Rule {
    /**
     * Initialize a rule.
     * @param {string} name - Name of the rule.
     * @param {string} description - Description of the rule.
     * @param {function(object): boolean} checkFunction - Function that checks if a document follows this rule.
     */
    constructor(name, description, checkFunction) {
        this.name = name;
        this.description = description;
        this.checkFunction = checkFunction; // Primarily for display/reference now
    }

    /**
     * Check if a document follows this rule (primarily for reference, AI makes main decision).
     * @param {object} document - The document to check.
     * @returns {boolean} True if the document follows this rule, False otherwise.
     */
    check(document) {
        try {
            return this.checkFunction(document);
        } catch (e) {
            console.error(chalk.red(`Error checking rule "${this.name}": ${e.message}`));
            return false; // Fail safe
        }
    }
}


class GameplayManager {
    /**
     * Manages the gameplay mechanics.
     */
    constructor() {
        this.score = 0;
        /** @type {object|null} */
        this.currentDocument = null;
        /** @type {Rule[]} */
        this.rules = []; // Basic rules, mainly for display reference
        this.memoryManager = new MemoryManager();
        this.settingsManager = new SettingsManager();
        this._initializeRules();
        /** @type {import('./api.js').AIJudgment | null} */
        this.aiJudgment = null; // Stores the AI's judgment of the current document
        this.gameCompleted = false; // Track if player has completed a full game
        this.travelersProcessedToday = 0;
        // Get travelers per day from settings manager
        this.travelersPerDay = this.settingsManager.getGameConfig().travelersPerDay;
    }

    /** Initialize basic verification rules (mainly for display/reference). */
    _initializeRules() {
        this.rules = [
            new Rule(
                "Permit Format",
                "Permits must start with 'P'.",
                (doc) => typeof doc.permit === 'string' && doc.permit.startsWith("P")
            ),
            new Rule(
                "Permit Number Length",
                "Permit numbers must have 4 digits after the 'P' (total 5 chars).",
                (doc) => typeof doc.permit === 'string' && doc.permit.length === 5
            ),
             new Rule(
                "Permit Digits",
                "Characters after 'P' in permit must be digits.",
                (doc) => typeof doc.permit === 'string' && /^\d{4}$/.test(doc.permit.substring(1))
            ),
            new Rule(
                "Name Format",
                "Traveler names must include at least a first and last name.",
                (doc) => typeof doc.name === 'string' && doc.name.trim().split(/\s+/).length >= 2
            )
        ];
    }

    /**
     * Adds a new rule (primarily for display/memory).
     * @param {Rule} rule - The rule to add.
     */
    addRule(rule) {
        this.rules.push(rule);
        this.memoryManager.addRuleChange(rule.description);
        console.log(chalk.blue(`Gameplay: Added rule - ${rule.description}`));
    }

    /**
     * Initializes a new game or loads state for the selected setting.
     * @param {string} [settingId=null] - ID of the border setting. If null, uses the first available.
     * @returns {object} The selected setting.
     */
    async initializeGame(settingId = null) {
        console.log(chalk.blue("Gameplay: Initializing new game..."));
        // Reset game state for a new career/session
        this.score = 0;
        this.currentDocument = null;
        this.aiJudgment = null;
        this.gameCompleted = false;
        this.travelersProcessedToday = 0;

        // Reset memory but keep used names from previous sessions (optional)
        const usedNames = this.memoryManager.memory.usedNames;
        this.memoryManager.resetMemory();
        this.memoryManager.memory.usedNames = usedNames; // Persist names across careers if desired

        // Select a setting
        const setting = settingId
            ? this.settingsManager.selectSetting(settingId)
            : this.settingsManager.getAvailableSettings()[0]; // Default to first if no ID

        this.settingsManager.selectSetting(setting.id); // Ensure it's set in settings manager

        // Initialize memory with the selected setting
        this.memoryManager.setBorderSetting(setting);
        
        // Update travelers per day from current settings
        this.travelersPerDay = this.settingsManager.getGameConfig().travelersPerDay;
        
        this.memoryManager.addNarrativeEvent(
            `You begin your shift at the ${setting.name}. Day ${this.memoryManager.memory.gameState.day}.`,
            "start"
        );

        // Start a new session with initial save
        await this.memoryManager.startNewSession();

        return setting;
    }

    /**
     * Generates a new document based on the current setting.
     * @async
     * @returns {Promise<object|null>} The generated document or null on error.
     */
    async generateDocument() {
        console.log(chalk.blue("Gameplay: Generating new document..."));
        const setting = this.settingsManager.getCurrentSetting();
        if (!setting) {
            console.error(chalk.red("Gameplay Error: No setting selected. Cannot generate document."));
            return null;
        }

        // Get context for AI
        const usedNamesContext = this.memoryManager.getUsedNamesContext();
        const settingContext = this.settingsManager.getSettingContext();
        const memoryContext = this.memoryManager.getMemoryContext();

        // Generate document content using API
        const documentData = await generateDocumentForSetting(setting, usedNamesContext);

        if (!documentData) {
            console.error(chalk.red("Gameplay Error: Failed to generate document content from API."));
            // Maybe return a predefined error document?
             return { name: "Error", permit: "P0000", backstory: "Document generation failed.", is_valid: false, additional_fields: {} };
        }

        // Use AI to judge the generated document *before* showing to player
        this.aiJudgment = await aiJudgeDocument(documentData, settingContext, memoryContext);

        if (!this.aiJudgment) {
             console.error(chalk.red("Gameplay Error: Failed to get AI judgment. Assuming invalid document."));
             // Assign a fallback judgment if AI fails
             this.aiJudgment = {
                 decision: 'deny',
                 confidence: 0.5,
                 reasoning: 'AI judgment system unavailable.',
                 suspicious_elements: ['AI system unavailable']
             };
        }

        // Store the AI's ground truth decision in the document object (for internal use/scoring)
        // Player does not see this directly.
        documentData.is_valid = this.aiJudgment.decision === "approve";

        this.currentDocument = documentData;
        console.log(chalk.green(`Gameplay: Document generated for ${this.currentDocument.name}. AI decision: ${this.aiJudgment.decision}`));
        return this.currentDocument;
    }

    /**
     * Checks if a document is valid according to the AI's judgment.
     * @param {object} document - The document to check.
     * @returns {boolean} True if the AI judged the document as valid ('approve').
     */
    checkDocumentValidity(document) {
        // The ground truth is now determined by the AI's judgment made during generation.
        if (!this.aiJudgment) {
            console.warn(chalk.yellow("Gameplay Warning: Checking validity without AI judgment available. Assuming invalid."));
            return false; // Fail safe if AI judgment is missing
        }
         // Compare against the stored AI judgment for *this specific document*
         const documentName = document?.name;
         const judgmentName = this.currentDocument?.name; // Ensure judgment matches current doc

         if (documentName === judgmentName) {
            return this.aiJudgment.decision === "approve";
         } else {
             console.error(chalk.red(`Gameplay Error: Attempting to check validity of document "${documentName}" but current AI judgment is for "${judgmentName}".`));
             return false; // Mismatch, assume invalid
         }
    }

    /**
     * Processes the player's decision on the current document.
     * @param {('approve'|'deny')} playerDecision - The player's decision.
     * @returns {{isCorrect: boolean, pointsEarned: number}|null} Result or null if no document.
     */
    makeDecision(playerDecision) {
        if (!this.currentDocument || !this.aiJudgment) {
            console.error(chalk.red("Gameplay Error: No current document or AI judgment to make a decision on."));
            return null;
        }

        const aiDecision = this.aiJudgment.decision;
        const isCorrect = playerDecision === aiDecision;
        const confidence = this.aiJudgment.confidence ?? 0.5;

        // Calculate points (e.g., 1 point * confidence for correct, maybe negative for incorrect?)
        // Simple scoring: 1 point * confidence if correct, 0 if incorrect.
        const pointsEarned = isCorrect ? (1 * confidence) : 0;
        this.score += pointsEarned;
        this.score = Math.round(this.score * 100) / 100; // Keep score tidy

        console.log(chalk.blue(`Gameplay: Player decided ${playerDecision}. AI decided ${aiDecision}. Correct: ${isCorrect}. Points: ${pointsEarned.toFixed(2)}. New Score: ${this.score}`));

        // Update game state (corruption/trust) based on decision correctness
        this.updateGameState(playerDecision, isCorrect);

        // Store the decision and traveler in memory
        this.memoryManager.addTraveler(
            this.currentDocument,
            playerDecision,
            isCorrect,
            this.aiJudgment
        );

        this.travelersProcessedToday += 1;

        // Clear current document and judgment for the next one
        // this.currentDocument = null; // Keep it until end of day? Let's clear after decision.
        // this.aiJudgment = null;

        return { isCorrect, pointsEarned };
    }

    /**
     * Updates the game state (corruption/trust) based on the player's decision.
     * @param {string} decision - The player's decision.
     * @param {boolean} isCorrect - Whether the decision was correct.
     */
    updateGameState(decision, isCorrect) {
        const stateUpdates = {};
        let currentCorruption = this.memoryManager.memory.gameState.corruption;
        let currentTrust = this.memoryManager.memory.gameState.trust;
        
        // Get the running stats for consecutive decisions
        let correctStreak = this.memoryManager.memory.gameState.correctStreak || 0;
        let incorrectStreak = this.memoryManager.memory.gameState.incorrectStreak || 0;
        
        if (isCorrect) {
            // Reset incorrect streak on correct decision
            incorrectStreak = 0;
            // Increment correct streak
            correctStreak += 1;
            
            // Increase trust after 2 correct decisions
            if (correctStreak >= 2) {
                stateUpdates.trust = currentTrust + 1;
                correctStreak = 0; // Reset streak after applying bonus
                console.log(chalk.green(`Gameplay State: Trust increased to ${stateUpdates.trust} after 2 correct decisions`));
            }
        } else {
            // Reset correct streak on incorrect decision
            correctStreak = 0;
            // Increment incorrect streak
            incorrectStreak += 1;
            
            // Always decrease trust on any incorrect decision
            stateUpdates.trust = currentTrust - 1;
            console.log(chalk.yellow(`Gameplay State: Trust decreased to ${stateUpdates.trust} after incorrect decision`));
            
            // Increase corruption after 2 wrong decisions
            if (incorrectStreak >= 2) {
                stateUpdates.corruption = currentCorruption + 1;
                incorrectStreak = 0; // Reset streak after applying penalty
                console.log(chalk.red(`Gameplay State: Corruption increased to ${stateUpdates.corruption} after 2 incorrect decisions`));
            }
            
            // Additional context based on decision type
            if (decision === "approve") {
                console.log(chalk.yellow(`Gameplay State: Incorrectly approving a suspicious traveler has greater impact on corruption.`));
                // Could add additional effects here if desired
            } else if (decision === "deny") {
                console.log(chalk.yellow(`Gameplay State: Incorrectly denying a valid traveler has greater impact on trust.`));
                // Could add additional effects here if desired
            }
        }
        
        // Store the streak values in game state
        stateUpdates.correctStreak = correctStreak;
        stateUpdates.incorrectStreak = incorrectStreak;
        
        // Apply the updates via memory manager
        if (Object.keys(stateUpdates).length > 0) {
            this.memoryManager.updateGameState(stateUpdates);
        }
        
        // Check for game over conditions based on corruption/trust
        this.checkGameOverConditions();
    }

    /**
     * Checks if game over conditions are met based on corruption/trust levels.
     * @returns {boolean} True if a game over condition is met.
     */
    checkGameOverConditions() {
        const gameState = this.memoryManager.memory.gameState;
        const corruption = gameState.corruption;
        const trust = gameState.trust;
        
        // Game over thresholds
        const corruptionThreshold = 5;  // Game over if corruption reaches 5
        const trustThreshold = -5;      // Game over if trust falls to -5
        
        // Check for corruption-based game over
        if (corruption >= corruptionThreshold) {
            console.log(chalk.red(`Gameplay: GAME OVER - Corruption level (${corruption}) exceeded threshold (${corruptionThreshold}).`));
            this.gameCompleted = true;
            this.memoryManager.addNarrativeEvent(
                "Your continued tolerance of suspicious travelers has led to an investigation. Your career at border control is over.",
                "game_over_corruption"
            );
            return true;
        }
        
        // Check for trust-based game over
        if (trust <= trustThreshold) {
            console.log(chalk.red(`Gameplay: GAME OVER - Trust level (${trust}) fell below threshold (${trustThreshold}).`));
            this.gameCompleted = true;
            this.memoryManager.addNarrativeEvent(
                "Your excessive suspicion and denials have damaged relations. You've been reassigned away from border control.",
                "game_over_trust"
            );
            return true;
        }
        
        return false;
    }

    /**
     * Checks if the current day should end.
     * @returns {boolean} True if the day should end.
     */
    shouldEndDay() {
        return this.travelersProcessedToday >= this.travelersPerDay;
    }


    /**
     * Advances to the next day in the game. Checks for game completion.
     * @returns {string} The day announcement message.
     */
    advanceDay() {
         console.log(chalk.blue(`Gameplay: Advancing day. Processed ${this.travelersProcessedToday} travelers.`));
        this.memoryManager.advanceDay();
        const day = this.memoryManager.memory.gameState.day;
        this.travelersProcessedToday = 0; // Reset counter for the new day

        // Check if player has completed the target number of days
        const totalDays = this.settingsManager.getGameConfig().totalDays;
        if (day > totalDays) {
            this.gameCompleted = true;
            return `Assignment Complete: You have finished your ${totalDays}-day assignment.`;
        }

        // Example Day-specific events (can be expanded)
        let message = "";
        if (day === 3) {
            message = `Day ${day}: New regulations are in effect. Increased scrutiny expected.`;
            // Example: Add a temporary rule or just let narrative/AI handle it
            this.memoryManager.addRuleChange("Increased scrutiny protocols active.");
        } else if (day === 7) {
            message = `Day ${day}: Border tensions are high. Security measures tightened.`;
             this.memoryManager.addNarrativeEvent("Border tensions spike.", "event");
        } else {
            const settingName = this.settingsManager.getCurrentSetting()?.name || "the border";
            message = `Day ${day}: Another shift begins at the ${settingName}.`;
        }

        this.memoryManager.addNarrativeEvent(message, "day_change");
        return message;
    }

    /**
     * Gets all current rules (basic + setting-specific).
     * @returns {Rule[]} List of all rules.
     */
    getAllRules() {
        // Combine basic rules with setting-specific descriptions
        const settingRules = this.settingsManager.getAllRules();
        const combinedRules = [...this.rules]; // Start with basic checkable rules

        // Add setting rules as descriptive rules
        settingRules.forEach((desc, index) => {
             // Avoid adding duplicates if basic rules cover setting rules
             if (!combinedRules.some(r => r.description === desc)) {
                 combinedRules.push(new Rule(`Setting Rule ${index + 1}`, desc, () => true)); // Non-checking function
             }
        });
        return combinedRules;
    }

    /** Gets the current score. */
    getScore() {
        return this.score;
    }

    /**
     * Gets the AI's reasoning for the current judgment.
     * @returns {string} The AI's reasoning or a default message.
     */
    getAiReasoning() {
        if (this.aiJudgment?.reasoning) {
            return this.aiJudgment.reasoning;
        }
        return "No AI reasoning available for the last document.";
    }

     /**
     * Gets the AI's suspicious elements list for the current judgment.
     * @returns {string[]} The AI's list or an empty array.
     */
     getAiSuspiciousElements() {
        return this.aiJudgment?.suspicious_elements || [];
    }

    /**
     * Saves the current game state.
     * @async
     * @returns {Promise<boolean>} True if save was successful.
     */
    async saveGame() {
        console.log(chalk.blue("Gameplay: Attempting to save game..."));
        
        // Save complete settings state before saving to file
        const settingsData = {
            currentSetting: this.settingsManager.getCurrentSetting(),
            customRules: this.settingsManager.customRules,
            gameConfig: this.settingsManager.getGameConfig()
        };
        this.memoryManager.updateSettings(settingsData);
        
        return await this.memoryManager.saveGame(); // Filename handled by memory manager
    }

    /**
     * Loads a saved game.
     * @async
     * @param {string} filepath - Absolute path to the save file.
     * @returns {Promise<boolean>} True if load was successful.
     */
    async loadGame(filepath) {
        console.log(chalk.blue(`Gameplay: Attempting to load game from ${filepath}...`));
        const success = await this.memoryManager.loadGame(filepath);
        if (success) {
            // Restore gameplay state from loaded memory
            this.score = this.memoryManager.memory.decisions.reduce((totalScore, decision) => {
                 // Recalculate score based on loaded history if needed, or just load a saved score
                 // For simplicity, let's assume score is saved/loaded directly if added to memory save format
                 // Or we reset score on load and rely on future points. Let's reset.
                 return 0; // Reset score on load for now.
             }, 0);

            // Restore complete settings state from saved data
            const savedSettings = this.memoryManager.getSavedSettings();
            
            // Restore game configuration
            if (savedSettings.gameConfig) {
                this.settingsManager.gameConfig = { ...savedSettings.gameConfig };
                this.travelersPerDay = savedSettings.gameConfig.travelersPerDay;
            }
            
            // Restore custom rules
            if (savedSettings.customRules) {
                this.settingsManager.customRules = [...savedSettings.customRules];
            }
            
            // Set the correct border setting
            if (savedSettings.currentSettingId) {
                this.settingsManager.selectSetting(savedSettings.currentSettingId);
            } else {
                // Fallback to legacy border setting data or first setting
                const loadedSetting = this.memoryManager.memory.borderSetting;
                if (loadedSetting && loadedSetting.id) {
                    this.settingsManager.selectSetting(loadedSetting.id);
                } else {
                    this.settingsManager.selectSetting(this.settingsManager.getAvailableSettings()[0].id);
                }
            }

            // Set game_completed flag if loaded day is past the limit
            const totalDays = this.settingsManager.getGameConfig().totalDays;
            this.gameCompleted = this.memoryManager.memory.gameState.day > totalDays;
            this.travelersProcessedToday = 0; // Reset for the loaded day

            console.log(chalk.green("Gameplay: Game loaded. State restored."));
            return true;
        } else {
            console.error(chalk.red("Gameplay: Failed to load game."));
            return false;
        }
    }
}

export { GameplayManager, Rule };