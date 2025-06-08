/**
 * Settings module for Veritaminal
 * Handles border settings, game configurations, and contextual information
 * for different game scenarios.
 */

import chalk from 'chalk'; // Using chalk directly for any potential inline styling needed
import path from 'path';
import { fileURLToPath } from 'url';

// Helper to get __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Predefined border settings for the game
const BORDER_SETTINGS = [
    {
        "id": "eastokan_westoria",
        "name": "Eastokan-Westoria Border",
        "situation": "Tense relations due to recent trade disputes. Increased scrutiny on business travelers.",
        "description": "The border between the industrial nation of Eastokan and the agricultural country of Westoria. Recent trade disputes have heightened tensions.",
        "document_requirements": [
            "Permit must start with 'P' followed by 4 digits",
            "Travelers must have both first and last names",
            "Business travelers require a trade visa stamp"
        ],
        "common_issues": [
            "Forged business credentials",
            "Expired permits",
            "Identity mismatches in documentation"
        ]
    },
    {
        "id": "northland_southoria",
        "name": "Northland-Southoria Border",
        "situation": "Post-conflict reconciliation with humanitarian crisis. Focus on refugee documentation.",
        "description": "Following the peace treaty ending the 5-year conflict, this border handles many refugees and humanitarian workers.",
        "document_requirements": [
            "Permit must start with 'P' followed by 4 digits",
            "Humanitarian workers need special H-class authorization",
            "Refugee documents must include origin verification"
        ],
        "common_issues": [
            "Missing refugee documentation",
            "Impersonation of humanitarian workers",
            "Forged origin documentation"
        ]
    },
    {
        "id": "oceania_continent",
        "name": "Oceania-Continent Ferry Checkpoint",
        "situation": "Tourism boom with increasing smuggling concerns. Focus on contraband detection.",
        "description": "This busy checkpoint manages traffic between the island nation of Oceania and the mainland Continent. Tourism is booming, but smuggling is on the rise.",
        "document_requirements": [
            "Permit must start with 'P' followed by 4 digits",
            "Tourist visas require verification stamps",
            "Commercial transport requires cargo manifests"
        ],
        "common_issues": [
            "Overstayed tourist visas",
            "Undeclared commercial activity",
            "Falsified transport documentation"
        ]
    }
];

class SettingsManager {
    /**
     * Manages game settings and border configurations.
     */
    constructor() {
        /** @type {object|null} */
        this.currentSetting = null;
        this.availableSettings = BORDER_SETTINGS;
        /** @type {string[]} */
        this.customRules = [];
        
        // Game configuration settings
        this.gameConfig = {
            totalDays: 10,           // Total days to complete the assignment
            travelersPerDay: 5,      // Number of travelers to process per day
            allowCustomization: true  // Whether players can modify these settings
        };
        // Note: UI instance removed here; display logic belongs in ui.js
    }

    /**
     * Get all available border settings.
     * @returns {object[]} List of available border settings.
     */
    getAvailableSettings() {
        return this.availableSettings;
    }

    /**
     * Select a border setting by ID.
     * @param {string} settingId - The ID of the setting to select.
     * @returns {object} The selected setting.
     */
    selectSetting(settingId) {
        const setting = this.availableSettings.find(s => s.id === settingId);
        if (setting) {
            this.currentSetting = setting;
            this.customRules = []; // Reset custom rules when changing setting
            return setting;
        }

        // If ID not found, default to the first setting
        console.warn(chalk.yellow(`Setting ID '${settingId}' not found. Using default.`));
        this.currentSetting = this.availableSettings[0];
        this.customRules = [];
        return this.currentSetting;
    }

    /**
     * Get the current border setting.
     * @returns {object} The current setting.
     */
    getCurrentSetting() {
        if (!this.currentSetting) {
            // If no setting is selected, use the first one as default
            this.currentSetting = this.availableSettings[0];
            this.customRules = [];
        }
        return this.currentSetting;
    }

    /**
     * Add a custom rule to the current setting.
     * @param {string} ruleDescription - Description of the rule.
     * @returns {boolean} True if the rule was added successfully.
     */
    addCustomRule(ruleDescription) {
        // Ensure a setting is selected
        this.getCurrentSetting();

        if (!this.customRules.includes(ruleDescription)) {
            this.customRules.push(ruleDescription);
            return true;
        }
        return false;
    }

    /**
     * Get all rules for the current setting.
     * @returns {string[]} Combined list of default and custom rules.
     */
    getAllRules() {
        const setting = this.getCurrentSetting();
        return [...setting.document_requirements, ...this.customRules];
    }

    /**
     * Get a formatted context string for the current setting.
     * @returns {string} A formatted context string.
     */
    getSettingContext() {
        const setting = this.getCurrentSetting();
        let context = [];
        context.push(`BORDER: ${setting.name}`);
        context.push(`SITUATION: ${setting.situation}`);

        context.push("\nDOCUMENT REQUIREMENTS:");
        setting.document_requirements.forEach(req => context.push(`- ${req}`));

        if (this.customRules.length > 0) {
            context.push("\nADDITIONAL RULES:");
            this.customRules.forEach(rule => context.push(`- ${rule}`));
        }

        return context.join("\n");
    }

    /**
     * Get current game configuration settings.
     * @returns {object} Current game configuration.
     */
    getGameConfig() {
        return { ...this.gameConfig }; // Return a copy to prevent external modification
    }

    /**
     * Update game configuration settings.
     * @param {object} newConfig - New configuration values { totalDays?, travelersPerDay? }.
     * @returns {boolean} True if configuration was updated successfully.
     */
    updateGameConfig(newConfig) {
        if (!this.gameConfig.allowCustomization) {
            console.warn(chalk.yellow("Game configuration customization is disabled."));
            return false;
        }

        let updated = false;
        
        if (newConfig.totalDays !== undefined) {
            const days = parseInt(newConfig.totalDays);
            if (days >= 1 && days <= 30) { // Reasonable limits
                this.gameConfig.totalDays = days;
                updated = true;
            } else {
                console.warn(chalk.yellow(`Invalid totalDays value: ${newConfig.totalDays}. Must be 1-30.`));
            }
        }

        if (newConfig.travelersPerDay !== undefined) {
            const travelers = parseInt(newConfig.travelersPerDay);
            if (travelers >= 1 && travelers <= 20) { // Reasonable limits
                this.gameConfig.travelersPerDay = travelers;
                updated = true;
            } else {
                console.warn(chalk.yellow(`Invalid travelersPerDay value: ${newConfig.travelersPerDay}. Must be 1-20.`));
            }
        }

        if (updated) {
            console.log(chalk.green(`Game configuration updated: ${this.gameConfig.totalDays} days, ${this.gameConfig.travelersPerDay} travelers per day.`));
        }

        return updated;
    }

    /**
     * Reset game configuration to defaults.
     */
    resetGameConfig() {
        this.gameConfig.totalDays = 10;
        this.gameConfig.travelersPerDay = 5;
        console.log(chalk.blue("Game configuration reset to defaults."));
    }

    /**
     * Get a formatted string of current game configuration for display.
     * @returns {string} Formatted configuration info.
     */
    getGameConfigSummary() {
        return `Assignment Duration: ${this.gameConfig.totalDays} days\nTravelers per Day: ${this.gameConfig.travelersPerDay} people`;
    }
}

export { SettingsManager };