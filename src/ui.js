/**
 * UI module for Veritaminal
 * Handles the terminal-based user interface using chalk for styling
 * and readline-sync for interactive prompts (more compatible with Bun).
 */

import chalk from 'chalk';
import readlineSync from 'readline-sync';
import os from 'os';

// Helper function for centering text
function centerText(text, width) {
    const textLength = text.replace(/\x1b\[[0-9;]*m/g, '').length; // Remove ANSI codes for length calculation
    const padding = Math.max(0, Math.floor((width - textLength) / 2));
    return ' '.repeat(padding) + text;
}

// Helper function for left-justifying text
function ljust(text, width) {
     const textLength = text.replace(/\x1b\[[0-9;]*m/g, '').length;
     const padding = Math.max(0, width - textLength);
     return text + ' '.repeat(padding);
}

class TerminalUI {
    /**
     * Manages the terminal-based user interface.
     */
    constructor() {
        this.width = this._getTerminalWidth();

        // Define color styles using chalk
        this.colors = {
            title: chalk.bold.yellow.bgBlue, // Bold Yellow on Blue
            header: chalk.bold.blue,
            normal: chalk.white,
            error: chalk.bold.red,
            success: chalk.bold.green,
            warning: chalk.yellow,
            hint: chalk.cyan.italic,
            command: chalk.magenta,
            veritas: chalk.bold.green,
            border_info: chalk.yellow,
            border: chalk.blue,
            key: chalk.cyan,
            value: chalk.white,
            dim: chalk.dim, // Dim style for less important info
            // Add more as needed
        };
    }

    /** Get terminal width, defaulting if unavailable. */
    _getTerminalWidth() {
        try {
            return process.stdout.columns || 80;
        } catch (e) {
            return 80;
        }
    }

    /** Adjusts UI width based on current terminal size. */
    adjustTerminalSize() {
        this.width = this._getTerminalWidth();
    }

    /** Clears the terminal screen. */
    clearScreen() {
        console.clear();
    }

    /**
     * Returns text formatted with the specified chalk style.
     * @param {string} text - Text to format.
     * @param {keyof this.colors} styleName - Name of the style to apply.
     * @returns {string} Formatted text.
     */
    coloredText(text, styleName) {
        const style = this.colors[styleName] || this.colors.normal;
        return style(text);
    }

    /**
     * Prints text with the specified color style.
     * @param {string} text - Text to print.
     * @param {keyof this.colors} [styleName='normal'] - Name of the style to apply.
     */
    print(text, styleName = 'normal') {
        console.log(this.coloredText(text, styleName));
    }

    /**
     * Draws a border line with an optional title.
     * @param {string} [title=null] - Title to display, centered.
     * @param {string} [char='='] - Character to use for the border.
     * @param {keyof this.colors} [style='border'] - Style for the border line.
     * @param {keyof this.colors} [titleStyle='title'] - Style for the title.
     */
    drawBorder(title = null, char = '=', style = 'border', titleStyle = 'title') {
        const borderLine = this.coloredText(char.repeat(this.width), style);
        console.log("\n" + borderLine);
        if (title) {
            console.log(centerText(this.coloredText(title, titleStyle), this.width));
            console.log(borderLine + "\n");
        } else {
            console.log(); // Just an empty line if no title
        }
    }

    /** Displays the welcome message. */
    displayWelcome() {
        this.clearScreen();
        this.drawBorder("VERITAMINAL: Document Verification Game");

        const welcomeText = [
            "Welcome, Agent.",
            "",
            "Your task: Verify traveler documents.",
            "Approve or Deny entry based on regulations and observation.",
            "",
            "Veritas, your AI assistant, may offer insights.",
            "Decisions have consequences.",
            "",
            "Type 'help' for commands.",
        ];

        welcomeText.forEach(line => console.log(centerText(this.coloredText(line, 'normal'), this.width)));
        this.drawBorder();
    }

    /**
     * Displays a document to the player.
     * @param {object} document - The document object { name, permit, backstory, additional_fields? }.
     */
    displayDocument(document) {
        if (!document) {
            this.print("Error displaying document.", 'error');
            return;
        }
        this.clearScreen();
        this.drawBorder("TRAVELER DOCUMENT");

        console.log(`${this.coloredText(ljust('Name:', 10), 'key')} ${this.coloredText(document.name || 'N/A', 'value')}`);
        console.log(`${this.coloredText(ljust('Permit:', 10), 'key')} ${this.coloredText(document.permit || 'N/A', 'value')}`);
        console.log(`\n${this.coloredText('Backstory:', 'key')}`);
        console.log(this.coloredText(document.backstory || 'No backstory provided.', 'value'));

        const additionalFields = document.additional_fields || {};
        const fieldKeys = Object.keys(additionalFields);

        if (fieldKeys.length > 0) {
            console.log(`\n${this.coloredText('Additional Information:', 'header')}`);
            fieldKeys.forEach(field => {
                const keyText = field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) + ':'; // Format key nicely
                console.log(`${this.coloredText(ljust(keyText, 20), 'key')} ${this.coloredText(additionalFields[field], 'value')}`);
            });
        }

        this.drawBorder(null, '-'); // Use different char for internal separator
    }

    /**
     * Displays a hint from Veritas.
     * @param {string} hint - The hint text.
     */
    displayVeritasHint(hint) {
        this.drawBorder("VERITAS ASSISTANT", '=', 'veritas', 'veritas');
        console.log(centerText(this.coloredText(`"${hint}"`, 'hint'), this.width));
        this.drawBorder(null, '=', 'veritas');
    }

    /**
     * Displays the current verification rules.
     * @param {import('./gameplay.js').Rule[]} rules - List of Rule objects.
     */
    displayRules(rules) {
        this.clearScreen();
        this.drawBorder("VERIFICATION RULES");

        if (!rules || rules.length === 0) {
            this.print("No specific rules currently active.", 'warning');
        } else {
            rules.forEach((rule, index) => {
                console.log(`${this.coloredText(String(index + 1) + '. ' + rule.name + ':', 'key')} ${this.coloredText(rule.description, 'normal')}`);
            });
        }
        this.drawBorder(null, '-');
    }

    /** Displays help information. */
    displayHelp() {
        this.clearScreen();
        this.drawBorder("HELP - AVAILABLE COMMANDS");

        const commands = [
            { cmd: "approve", desc: "Approve the current traveler's entry." },
            { cmd: "deny", desc: "Deny the current traveler's entry." },
            { cmd: "hint", desc: "Request a hint from Veritas AI assistant." },
            { cmd: "rules", desc: "Display current verification rules for this border." },
            { cmd: "save", desc: "Save your current game progress." },
            { cmd: "quit", desc: "Quit the current game and return to the main menu." },
            { cmd: "help", desc: "Show this help information." },
        ];

        commands.forEach(({ cmd, desc }) => {
            console.log(`${this.coloredText(ljust(cmd, 10), 'command')} - ${this.coloredText(desc, 'normal')}`);
        });
        this.drawBorder(null, '-');
    }

    /**
     * Displays feedback based on the player's decision.
     * @param {boolean} isCorrect - Whether the decision was correct.
     * @param {string} narrativeUpdate - The narrative update text.
     * @param {object|null} aiJudgment - The AI's judgment for comparison.
     */
    displayFeedback(isCorrect, narrativeUpdate, aiJudgment) {
        console.log("\n" + this.coloredText("-".repeat(this.width), 'border')); // Separator
        if (isCorrect) {
            this.print("✓ Correct Decision!", 'success');
        } else {
            this.print("✗ Incorrect Decision!", 'error');
            if (aiJudgment) {
                 this.print(`  (AI would have decided: ${this.coloredText(aiJudgment.decision.toUpperCase(), 'warning')})`, 'dim');
            }
        }

        this.print(`\n${narrativeUpdate}`, 'normal'); // Display narrative consequence

        if (!isCorrect && aiJudgment) {
            this.print("\n--- AI Assessment ---", 'header');
            this.printReasoning(aiJudgment.reasoning, aiJudgment.confidence, aiJudgment.suspicious_elements);
        }
         console.log(this.coloredText("-".repeat(this.width), 'border') + "\n");
    }

     /**
     * Displays AI reasoning details.
     * @param {string} reasoning - The AI's reasoning text.
     * @param {number} confidence - The AI's confidence score (0-1).
     * @param {string[]} suspiciousElements - List of suspicious elements.
     */
     printReasoning(reasoning, confidence, suspiciousElements) {
        const confidencePct = (confidence * 100).toFixed(0);
        let confidenceStyle = 'success';
        if (confidencePct < 75) confidenceStyle = 'warning';
        if (confidencePct < 50) confidenceStyle = 'error';

        this.print(`${this.coloredText('Confidence:', 'key')} ${this.coloredText(confidencePct + '%', confidenceStyle)}`);
        this.print(`${this.coloredText('Reasoning:', 'key')} ${this.coloredText(reasoning || 'N/A', 'normal')}`);
        if (suspiciousElements && suspiciousElements.length > 0) {
            this.print(`${this.coloredText('Suspicious:', 'key')}`, 'normal');
            suspiciousElements.forEach(el => this.print(`  - ${this.coloredText(el, 'warning')}`));
        }
    }

    /**
     * Displays the game over screen.
     * @param {string} endingType - Type of ending ('good', 'bad_corrupt', 'bad_strict', 'neutral_corrupt', etc.).
     * @param {string} endingMessage - The final message.
     * @param {number} finalScore - The player's final score.
     */
    displayGameOver(endingType, endingMessage, finalScore) {
        this.clearScreen();
        this.drawBorder("ASSIGNMENT COMPLETE / CAREER OVER");

        const endingStyle = endingType.startsWith('good') ? 'success' : endingType.includes('corrupt') ? 'error' : endingType.includes('strict') ? 'warning' : 'normal';

        console.log(centerText(this.coloredText(endingMessage, endingStyle), this.width));
        console.log("\n" + centerText(this.coloredText(`Final Score: ${finalScore.toFixed(2)}`, 'value'), this.width) + "\n");

        this.drawBorder();
    }

    /**
     * Displays status information (Day, Score, Narrative State).
     * @param {number} day - Current day.
     * @param {number} score - Current score.
     * @param {string} stateSummary - Summary string from NarrativeManager.
     */
    displayStatus(day, score, stateSummary) {
        this.drawBorder(null, '-'); // Separator before status
        const dayStr = `${this.coloredText('Day:', 'key')} ${this.coloredText(String(day), 'value')}`;
        const scoreStr = `${this.coloredText('Score:', 'key')} ${this.coloredText(score.toFixed(2), 'value')}`;
        const stateStr = this.coloredText(stateSummary, 'border_info');

        console.log(`${dayStr} | ${scoreStr}`);
        console.log(stateStr);
        this.drawBorder(null, '='); // Main border after status
    }

    /**
     * Uses readline-sync to get the user's next command.
     * @async
     * @param {string} [message='Enter command > '] - The prompt message.
     * @returns {Promise<string>} The user's command (lowercase, trimmed).
     */
    async getUserInput(message = 'Enter command (approve, deny, hint, rules, save, quit, help) > ') {
        try {
            const input = readlineSync.question(this.coloredText(message, 'hint'));
            return input.trim().toLowerCase();
        } catch (error) {
            console.error(chalk.red("\nInput error occurred."), error);
            return "quit"; // Default to quit on error
        }
    }

    /**
     * Uses readline-sync to present a list of choices.
     * @async
     * @param {string} message - The question to ask.
     * @param {Array<string|object>} choices - Array of choices. Can be strings or objects {name, value}.
     * @param {string} [name='selection'] - Internal name for the answer (not used in readline-sync).
     * @returns {Promise<any>} The value of the selected choice.
     */
    async getListChoice(message, choices, name = 'selection') {
        try {
            console.log(this.coloredText(message, 'header'));
            
            // Format choices to display properly
            const formattedChoices = choices.map(choice => {
                if (typeof choice === 'string') {
                    return choice;
                } else if (choice && choice.name) {
                    return choice.name;
                }
                return String(choice);
            });
            
            // Display choices
            formattedChoices.forEach((choiceName, index) => {
                console.log(`${index + 1}. ${choiceName}`);
            });
            
            // Get selection (1-based for user, convert to 0-based for array)
            const index = readlineSync.questionInt(this.coloredText('Select option number: ', 'hint'), {
                limitMessage: this.coloredText('Please enter a number between 1 and ' + formattedChoices.length, 'error'),
                limit: [1, formattedChoices.length]
            }) - 1;
            
            // Return the value (if object with value property) or the choice itself
            return (choices[index] && typeof choices[index] === 'object' && 'value' in choices[index]) 
                ? choices[index].value 
                : choices[index];
        } catch (error) {
            console.error(chalk.red("\nChoice selection error occurred."), error);
            return null; // Indicate error or cancellation
        }
    }

    /**
     * Simple prompt to wait for the user to press Enter.
     * @async
     * @param {string} [message='Press Enter to continue...']
     */
    async pressEnterToContinue(message = 'Press Enter to continue...') {
        try {
            readlineSync.question(this.coloredText(message, 'hint'));
        } catch (error) {
            console.error(chalk.red("\nInput error occurred."), error);
            // Continue anyway on error
        }
    }
}

export { TerminalUI };