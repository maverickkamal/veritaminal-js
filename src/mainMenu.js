/**
 * Main menu module for Veritaminal
 * Handles the main menu system, game session management, and career progression.
 */

import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { GameplayManager } from './gameplay.js';
import { SettingsManager } from './settings.js';
import { TerminalUI } from './ui.js';

// Helper to get project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Text formatting utility functions
/**
 * Centers text in a string of the specified width
 * @param {string} text - The text to center
 * @param {number} width - The width to center within
 * @returns {string} Centered text
 */
function centerText(text, width) {
    const padLength = Math.max(0, width - text.length);
    const leftPad = Math.floor(padLength / 2);
    return ' '.repeat(leftPad) + text;
}

/**
 * Left-justifies text in a string of the specified width
 * @param {string} text - The text to justify
 * @param {number} width - The width to justify within
 * @returns {string} Left-justified text
 */
function ljust(text, width) {
    return text.padEnd(width);
}

class MainMenuManager {
    /**
     * Manages the main menu and game sessions.
     */
    constructor() {
        this.ui = new TerminalUI();
        this.gameplayManager = new GameplayManager();
        this.settingsManager = new SettingsManager(); // GameplayManager also has one, maybe share? For now, separate is ok.
        // Basic career stats (not saved persistently yet, reset on each app start)
        this.careerStats = {
            gamesCompleted: 0,
            totalScore: 0,
            bordersServed: new Set(),
            highestDayReached: 0
        };
    }

    /**
     * Displays the main menu and gets user choice using inquirer.
     * @async
     * @returns {Promise<string>} The selected option value ('1', '2', '3', '4', '5').
     */
    async displayMainMenu() {
        this.ui.clearScreen();
        this.ui.drawBorder("VERITAMINAL: Document Verification Game");

        // Display career stats if any games have been played this session
        if (this.careerStats.gamesCompleted > 0) {
            console.log(centerText(this.ui.coloredText("CAREER STATISTICS (Current Session)", 'header'), this.ui.width));
             console.log(centerText(`${this.ui.coloredText('Games Completed:', 'key')} ${this.ui.coloredText(this.careerStats.gamesCompleted, 'value')}`, this.ui.width));
             console.log(centerText(`${this.ui.coloredText('Total Score:', 'key')} ${this.ui.coloredText(this.careerStats.totalScore.toFixed(2), 'value')}`, this.ui.width));
             console.log(centerText(`${this.ui.coloredText('Borders Served:', 'key')} ${this.ui.coloredText(this.careerStats.bordersServed.size, 'value')}`, this.ui.width));
             console.log(centerText(`${this.ui.coloredText('Highest Day:', 'key')} ${this.ui.coloredText(this.careerStats.highestDayReached, 'value')}`, this.ui.width));
            this.ui.drawBorder(null, '-');
        }

        console.log(centerText(this.ui.coloredText("MAIN MENU", 'title'), this.ui.width));

        const choices = [
            { name: 'Start New Career', value: '1' },
            { name: 'Continue Previous Career', value: '2' },
            { name: 'View Border Settings Info', value: '3' },
            { name: 'View Game Rules & Commands', value: '4' },
            { name: 'Game Configuration Settings', value: '5' },
            { name: 'Quit Game', value: '6' },
        ];

        const selection = await this.ui.getListChoice("Select an option:", choices);
        return selection || '5'; // Default to quit if selection fails
    }

    /**
     * Handles starting a new game career, including border selection.
     * @async
     * @returns {Promise<boolean>} True if a game was started, False to return to menu.
     */
    async startNewCareer() {
        this.ui.clearScreen();
        this.ui.drawBorder("SELECT BORDER ASSIGNMENT");

        const settings = this.settingsManager.getAvailableSettings();
        const choices = settings.map((setting, index) => ({
            name: `${setting.name} - ${this.ui.coloredText(setting.description, 'dim')}`,
            value: setting.id
        }));
        choices.push({ name: 'Return to Main Menu', value: 'back' });

        const selectedId = await this.ui.getListChoice("Choose your starting border:", choices);

        if (!selectedId || selectedId === 'back') {
            return false; // Return to main menu
        }

        // Initialize new game with selected border
        const selectedSetting = await this.gameplayManager.initializeGame(selectedId);

        this.ui.clearScreen();
        this.ui.drawBorder("ASSIGNMENT BRIEFING");
        
        this.ui.print(`Assignment: ${this.ui.coloredText(selectedSetting.name, 'header')}`);
        this.ui.print(`Situation: ${this.ui.coloredText(selectedSetting.situation, 'value')}\n`);
        
        // Show game configuration
        const gameConfig = this.settingsManager.getGameConfig();
        this.ui.print("Assignment Details:", 'header');
        this.ui.print(`- Duration: ${this.ui.coloredText(`${gameConfig.totalDays} days`, 'value')}`);
        this.ui.print(`- Travelers per day: ${this.ui.coloredText(`${gameConfig.travelersPerDay} people`, 'value')}`);
        this.ui.print(`- Total travelers: ${this.ui.coloredText(`${gameConfig.totalDays * gameConfig.travelersPerDay} people`, 'value')}\n`);
        
        this.ui.print("Current Rules:", 'header');
        this.settingsManager.getAllRules().forEach(rule => this.ui.print(`- ${rule}`, 'value'));

        await this.ui.pressEnterToContinue("\nPress Enter to begin your first shift...");
        return true; // Proceed to gameplay loop
    }

    /**
     * Handles loading and continuing a previous game career.
     * @async
     * @returns {Promise<boolean>} True if a game was loaded successfully, False otherwise.
     */
    async continuePreviousCareer() {
        this.ui.clearScreen();
        this.ui.drawBorder("LOAD PREVIOUS CAREER");

        const saveFiles = await this._getSaveFiles();

        if (saveFiles.length === 0) {
            this.ui.print("No saved games found in the 'saves' directory.", 'warning');
            await this.ui.pressEnterToContinue();
            return false;
        }

        const choices = saveFiles.map(({ name, path }, index) => ({
            name: `${index + 1}. ${name}`, // Display filename
            value: path // Return the full path
        }));
        choices.push({ name: '0. Return to Main Menu', value: 'back' });


        const selectedPath = await this.ui.getListChoice("Select a saved game to load:", choices);

        if (!selectedPath || selectedPath === 'back') {
            return false; // Return to main menu
        }

        // Load the selected save file
        const success = await this.gameplayManager.loadGame(selectedPath);

        if (success) {
            this.ui.print("\nGame loaded successfully!", 'success');
            const setting = this.gameplayManager.settingsManager.getCurrentSetting();
            const day = this.gameplayManager.memoryManager.memory.gameState.day;
            this.ui.print(`Current Assignment: ${this.ui.coloredText(setting.name, 'header')}`);
            this.ui.print(`Starting Day: ${this.ui.coloredText(day, 'value')}`);
            await this.ui.pressEnterToContinue();
            return true; // Proceed to gameplay loop
        } else {
            this.ui.print("\nFailed to load the selected game file.", 'error');
            await this.ui.pressEnterToContinue();
            return false;
        }
    }

    /**
     * Displays information about all available border settings.
     * @async
     */
    async viewBorderSettings() {
        this.ui.clearScreen();
        this.ui.drawBorder("BORDER SETTINGS OVERVIEW");

        const settings = this.settingsManager.getAvailableSettings();

        settings.forEach(setting => {
            console.log(centerText(this.ui.coloredText(`= ${setting.name} =`, 'title'), this.ui.width));
            this.ui.print(`\nDescription: ${this.ui.coloredText(setting.description, 'value')}`);
            this.ui.print(`Situation: ${this.ui.coloredText(setting.situation, 'value')}`);

            this.ui.print("\nDocument Requirements:", 'header');
            setting.document_requirements.forEach(req => this.ui.print(`- ${req}`, 'value'));

            this.ui.print("\nCommon Issues:", 'header');
            setting.common_issues.forEach(issue => this.ui.print(`- ${issue}`, 'value'));

            this.ui.drawBorder(null, '-');
            console.log(); // Extra newline
        });

        await this.ui.pressEnterToContinue("Press Enter to return to main menu...");
    }

    /**
     * Displays and manages game configuration settings.
     * @async
     */
    async gameConfigurationSettings() {
        let keepConfiguring = true;
        
        while (keepConfiguring) {
            this.ui.clearScreen();
            this.ui.drawBorder("GAME CONFIGURATION SETTINGS");

            const config = this.settingsManager.getGameConfig();
            
            this.ui.print("Current Configuration:", 'header');
            this.ui.print(`Assignment Duration: ${this.ui.coloredText(`${config.totalDays} days`, 'value')}`);
            this.ui.print(`Travelers per Day: ${this.ui.coloredText(`${config.travelersPerDay} people`, 'value')}`);
            this.ui.print(`Total Travelers: ${this.ui.coloredText(`${config.totalDays * config.travelersPerDay} people`, 'value')}\n`);

            const choices = [
                { name: `Change Assignment Duration (Currently: ${config.totalDays} days)`, value: 'days' },
                { name: `Change Travelers per Day (Currently: ${config.travelersPerDay} people)`, value: 'travelers' },
                { name: 'Reset to Defaults (10 days, 5 travelers/day)', value: 'reset' },
                { name: 'Return to Main Menu', value: 'back' }
            ];

            const selection = await this.ui.getListChoice("Select an option:", choices);

            switch (selection) {
                case 'days':
                    await this._configureDays();
                    break;
                case 'travelers':
                    await this._configureTravelers();
                    break;
                case 'reset':
                    this.settingsManager.resetGameConfig();
                    this.ui.print("\nConfiguration reset to defaults!", 'success');
                    await this.ui.pressEnterToContinue();
                    break;
                case 'back':
                default:
                    keepConfiguring = false;
                    break;
            }
        }
    }

    /**
     * Configure the number of days for the assignment.
     * @async
     * @private
     */
    async _configureDays() {
        this.ui.clearScreen();
        this.ui.drawBorder("CONFIGURE ASSIGNMENT DURATION");
        
        this.ui.print("Enter the number of days for your assignment:", 'header');
        this.ui.print("Valid range: 1-30 days", 'dim');
        this.ui.print("Recommended: 5-15 days for balanced gameplay\n", 'dim');

        const input = await this.ui.getUserInput("Days (1-30): ");
        const days = parseInt(input);

        if (isNaN(days) || days < 1 || days > 30) {
            this.ui.print("Invalid input. Please enter a number between 1 and 30.", 'error');
            await this.ui.pressEnterToContinue();
            return;
        }

        const success = this.settingsManager.updateGameConfig({ totalDays: days });
        if (success) {
            this.ui.print(`\nAssignment duration set to ${days} days!`, 'success');
        } else {
            this.ui.print("\nFailed to update configuration.", 'error');
        }
        await this.ui.pressEnterToContinue();
    }

    /**
     * Configure the number of travelers per day.
     * @async
     * @private
     */
    async _configureTravelers() {
        this.ui.clearScreen();
        this.ui.drawBorder("CONFIGURE TRAVELERS PER DAY");
        
        this.ui.print("Enter the number of travelers to process each day:", 'header');
        this.ui.print("Valid range: 1-20 travelers", 'dim');
        this.ui.print("Recommended: 3-8 travelers for balanced gameplay\n", 'dim');

        const input = await this.ui.getUserInput("Travelers per day (1-20): ");
        const travelers = parseInt(input);

        if (isNaN(travelers) || travelers < 1 || travelers > 20) {
            this.ui.print("Invalid input. Please enter a number between 1 and 20.", 'error');
            await this.ui.pressEnterToContinue();
            return;
        }

        const success = this.settingsManager.updateGameConfig({ travelersPerDay: travelers });
        if (success) {
            this.ui.print(`\nTravelers per day set to ${travelers}!`, 'success');
        } else {
            this.ui.print("\nFailed to update configuration.", 'error');
        }
        await this.ui.pressEnterToContinue();
    }

    /**
     * Displays the core game rules and commands.
     * @async
     */
    async viewGameRules() {
        this.ui.clearScreen();
        this.ui.drawBorder("GAME RULES & COMMANDS");

        const rules = [
            "Verify travel documents as a border control agent.",
            "Each traveler presents: Name, Permit Number, Backstory.",
            "Decide to APPROVE or DENY based on document validity and rules.",
            "Base Rules: Permit 'P' + 4 digits, Name First + Last.",
            "Border-specific rules will apply.",
            "Process multiple travelers each day.",
            "Correct decisions improve your score.",
            "AI judgments determine the 'correct' answer.",
            "Your career lasts 10 days.",
        ];

        this.ui.print("Core Gameplay:", 'header');
        rules.forEach(rule => this.ui.print(`• ${rule}`, 'value'));

        this.ui.drawBorder(null, '-');

        this.ui.print("\nCommands During Gameplay:", 'header');
        const commands = [
            { cmd: "approve", desc: "Approve the current traveler" },
            { cmd: "deny", desc: "Deny the current traveler" },
            { cmd: "hint", desc: "Request a hint from Veritas AI" },
            { cmd: "rules", desc: "Display current verification rules" },
            { cmd: "save", desc: "Save your current game progress" },
            { cmd: "help", desc: "Show this help information" },
            { cmd: "quit", desc: "Quit game and return to main menu" }
        ];

        commands.forEach(({ cmd, desc }) => {
            console.log(`${this.ui.coloredText(ljust(cmd, 10), 'command')} - ${this.ui.coloredText(desc, 'value')}`);
        });

        this.ui.drawBorder(null, '-');
        await this.ui.pressEnterToContinue();
    }

    /**
     * Updates career stats based on a completed game session.
     * NOTE: These stats are currently not persistent between app runs.
     * @param {GameplayManager} completedGameManager - The gameplay manager instance from the completed game.
     */
    updateCareerStats(completedGameManager) {
        this.careerStats.gamesCompleted += 1;
        this.careerStats.totalScore += completedGameManager.score;

        const setting = completedGameManager.settingsManager.getCurrentSetting();
        if (setting) {
            this.careerStats.bordersServed.add(setting.name);
        }

        const dayReached = completedGameManager.memoryManager.memory.gameState.day;
        // If game ended because day > 10, use 10, otherwise use the day it ended.
        const finalDay = dayReached > completedGameManager.thresholds.daysToComplete
                       ? completedGameManager.thresholds.daysToComplete
                       : dayReached;

        this.careerStats.highestDayReached = Math.max(
            this.careerStats.highestDayReached,
            finalDay
        );
         console.log(chalk.blue("MainMenu: Career stats updated for this session."));
    }

    /**
     * Gets a list of available save files.
     * @async
     * @private
     * @returns {Promise<Array<{name: string, path: string}>>} List of save file objects.
     */
    async _getSaveFiles() {
        const savesDirPath = path.join(projectRoot, this.gameplayManager.memoryManager.saveDir);
        try {
            const files = await fs.readdir(savesDirPath);
            const jsonFiles = files.filter(file => file.toLowerCase().endsWith('.json'));
            return jsonFiles.map(file => ({
                name: file,
                path: path.join(savesDirPath, file) // Store absolute path
            })).sort((a, b) => b.name.localeCompare(a.name)); // Sort newest first potentially
        } catch (error) {
            // If directory doesn't exist or other error
            if (error.code !== 'ENOENT') {
                console.error(chalk.red(`Error reading save directory ${savesDirPath}:`), error);
            }
            return []; // Return empty list if directory not found or error
        }
    }
}

export { MainMenuManager };
