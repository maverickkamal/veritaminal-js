/**
 * Narrative module for Veritaminal
 * Handles the story state, narrative branching, and game-over conditions.
 * Note: Actual narrative text generation is handled by api.js. This manages state.
 */

import chalk from 'chalk';
// Import API function if needed, but it's currently called from main loop
// import { generateNarrativeUpdate } from './api.js';

class NarrativeManager {
    /**
     * Manages the narrative elements and story branching based on game state.
     */
    constructor() {
        this.storyState = {
            corruption: 0,      // Tracks incorrect approves
            trust: 0,           // Tracks incorrect denies (negative value)
            day: 1,             // Current day
            endingPath: "neutral" // Current tendency: "neutral", "corrupt", "strict"
        };

        // Thresholds for state changes and game over
        this.thresholds = {
            corruptionWarning: 2,
            corruptionGameOver: 5,
            trustWarning: -2, // Trust goes negative
            trustGameOver: -5,
            daysToComplete: 10
        };

         // Tracks if warnings have been issued (could be stored in memoryManager if persistence needed)
        this.warningsIssued = {
            corruption: false,
            trust: false
        };
    }

    /**
     * Updates the internal narrative state based on gameplay state changes.
     * This should be called *after* memoryManager updates the state.
     * @param {object} gameState - The current gameState from MemoryManager { day, corruption, trust }.
     */
    syncState(gameState) {
        this.storyState.day = gameState.day;
        this.storyState.corruption = gameState.corruption;
        this.storyState.trust = gameState.trust;
        this._updateEndingPath(); // Recalculate path based on synced state
         // Reset warnings if state drops below warning threshold (optional)
         if (this.storyState.corruption < this.thresholds.corruptionWarning) this.warningsIssued.corruption = false;
         if (this.storyState.trust > this.thresholds.trustWarning) this.warningsIssued.trust = false;
    }

    /**
     * Updates the ending path based on current state.
     * @private
     */
    _updateEndingPath() {
        if (this.storyState.corruption >= this.thresholds.corruptionWarning +1) { // Tend towards corrupt if well past warning
            this.storyState.endingPath = "corrupt";
        } else if (this.storyState.trust <= this.thresholds.trustWarning -1) { // Tend towards strict if well past warning
            this.storyState.endingPath = "strict";
        } else {
            this.storyState.endingPath = "neutral";
        }
    }

    /**
     * Checks for narrative milestones based on the current state.
     * Note: Actual event text generation is separate. This just checks triggers.
     * @returns {string | null} A description of the milestone triggered, or null.
     */
    checkMilestones() {
        // Check corruption warning
        if (this.storyState.corruption >= this.thresholds.corruptionWarning && !this.warningsIssued.corruption) {
            this.warningsIssued.corruption = true;
            console.log(chalk.magenta("Narrative Milestone: Corruption Warning Triggered"));
            return "Your supervisor eyes you suspiciously. \"Keep your record clean, agent.\""; // Example milestone text
        }

        // Check trust warning
        if (this.storyState.trust <= this.thresholds.trustWarning && !this.warningsIssued.trust) {
            this.warningsIssued.trust = true;
            console.log(chalk.magenta("Narrative Milestone: Trust Warning Triggered"));
            return "A dismissed traveler glares back. \"You'll regret this rigidity!\""; // Example milestone text
        }

        // Check for promotion milestone (example)
        if (this.storyState.day === 5 && this.storyState.endingPath === 'neutral') {
             // Could add a flag like `promotion_offered` if needed
             console.log(chalk.magenta("Narrative Milestone: Potential Promotion"));
             return "The station chief nods approvingly. \"Good work ethic, agent.\"";
        }

        // No specific milestone triggered by this check
        return null;
    }


    /**
     * Checks if the game should end based on the current state.
     * @returns {{isGameOver: boolean, endingType: string|null, endingMessage: string|null}}
     */
    checkGameOver() {
        // Check corruption game over
        if (this.storyState.corruption >= this.thresholds.corruptionGameOver) {
            return {
                isGameOver: true,
                endingType: "bad_corrupt",
                endingMessage: "Internal affairs officers escort you away. Your career ends in disgrace due to overwhelming evidence of corruption."
            };
        }

        // Check trust game over
        if (this.storyState.trust <= this.thresholds.trustGameOver) {
            return {
                isGameOver: true,
                endingType: "bad_strict",
                endingMessage: "You are reassigned to a remote outpost. Your overly strict enforcement caused too many diplomatic complaints."
            };
        }

        // Check winning condition (Completed required days) - Handled by gameplayManager checking day > 10

        // Game continues
        return { isGameOver: false, endingType: null, endingMessage: null };
    }

     /**
     * Gets the ending details if the game is completed normally (passed day limit).
     * @returns {{endingType: string, endingMessage: string}}
     */
     getNormalEnding() {
        switch (this.storyState.endingPath) {
            case "corrupt":
                return {
                    endingType: "neutral_corrupt",
                    endingMessage: "You completed your assignment, lining your pockets along the way. You avoided arrest, but live with the compromises you made."
                };
            case "strict":
                return {
                    endingType: "neutral_strict",
                    endingMessage: "You completed your assignment with rigid adherence to the rules. The border is secure, but perhaps at the cost of compassion."
                };
            default: // neutral
                return {
                    endingType: "good",
                    endingMessage: "You skillfully navigated the complexities of the border, balancing security and fairness. Your commendable service earns you recognition."
                };
        }
    }


    /**
     * Gets a summary string of the current narrative state.
     * @returns {string} Summary of the story state.
     */
    getStateSummary() {
        let corruptionDesc = "Low";
        if (this.storyState.corruption >= this.thresholds.corruptionWarning) corruptionDesc = chalk.yellow("Warning");
        if (this.storyState.corruption >= this.thresholds.corruptionGameOver -1) corruptionDesc = chalk.red("Critical");

        let trustDesc = "High";
        if (this.storyState.trust <= this.thresholds.trustWarning) trustDesc = chalk.yellow("Warning");
        if (this.storyState.trust <= this.thresholds.trustGameOver + 1) trustDesc = chalk.red("Critical");


        return `Corruption: ${corruptionDesc} (${this.storyState.corruption}) | Trust: ${trustDesc} (${this.storyState.trust}) | Tendency: ${this.storyState.endingPath}`;
    }
}

export { NarrativeManager };
