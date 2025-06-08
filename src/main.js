/**
 * Main module for Veritaminal
 * Entry point for the game that initializes components and runs the main game loop.
 */

import chalk from 'chalk';
import { MainMenuManager } from './mainMenu.js';
import { getVeritasHint, generateNarrativeUpdate } from './api.js'; // Import specific API calls needed in the loop
import { NarrativeManager } from './narrative.js'; // Add missing import for NarrativeManager

// --- Argument Parsing ---
// Basic argument parsing using process.argv
const args = process.argv.slice(2); // Skip 'node' and script path
const options = {
    debug: args.includes('--debug'),
    load: null,
    skipMenu: args.includes('--skip-menu')
};
const loadIndex = args.indexOf('--load');
if (loadIndex !== -1 && args.length > loadIndex + 1) {
    options.load = args[loadIndex + 1]; // TODO: Resolve to absolute path if needed by loadGame
}

// --- Logging Setup ---
// Simple console logging, enhanced if debug flag is set
const logger = {
    info: (message) => console.log(chalk.blue(`[INFO] ${message}`)),
    warn: (message) => console.warn(chalk.yellow(`[WARN] ${message}`)),
    error: (message, error = null) => {
        console.error(chalk.red(`[ERROR] ${message}`));
        if (error && options.debug) {
            console.error(error); // Log full error in debug mode
        }
    },
    debug: (message) => {
        if (options.debug) {
            console.log(chalk.grey(`[DEBUG] ${message}`));
        }
    }
};

// --- Main Game Execution ---

/**
 * Main entry point for the game.
 * @async
 */
async function main() {
    logger.info("Starting Veritaminal...");
    const mainMenuManager = new MainMenuManager();
    const ui = mainMenuManager.ui; // Get UI instance

    // Handle Ctrl+C gracefully
    process.on('SIGINT', async () => {
        logger.warn("\nCaught interrupt signal (Ctrl+C).");
        // Optionally add save prompt here if in gameplay loop
        ui.print("\nExiting Veritaminal. Goodbye!", 'warning');
        process.exit(0);
    });

    try {
        let startGameDirectly = options.skipMenu;
        let gameLoaded = false;

        // Handle --load argument
        if (options.load) {
            logger.info(`Attempting to load game from: ${options.load}`);
            // Note: Assuming loadGame now expects an absolute path
            // If options.load is relative, it needs resolving based on CWD
            // For simplicity, let's assume user provides a usable path or mainMenu handles it
            const loadSuccess = await mainMenuManager.gameplayManager.loadGame(options.load);
            if (loadSuccess) {
                logger.info("Game loaded successfully via --load argument.");
                startGameDirectly = true; // Skip menu if load is successful
                gameLoaded = true;
            } else {
                logger.error(`Failed to load game from ${options.load}. Starting main menu.`);
                startGameDirectly = false; // Fallback to menu if load fails
            }
        }

        // Decide whether to show menu or start game
        if (startGameDirectly && !gameLoaded) {
             // --skip-menu without --load, start a default new game
             logger.info("--skip-menu detected, starting new game with default settings.");
             mainMenuManager.gameplayManager.initializeGame(); // Initialize default game
             await runGameplayLoop(mainMenuManager);
        } else if (startGameDirectly && gameLoaded) {
             // Game loaded via --load, start gameplay
             logger.info("Proceeding directly to gameplay loop after successful load.");
             await runGameplayLoop(mainMenuManager);
        } else {
            // Default: Run the main menu loop
            await runMainMenuLoop(mainMenuManager);
        }

        logger.info("Veritaminal finished gracefully.");
        process.exit(0);

    } catch (error) {
        logger.error("An unexpected error occurred in the main execution:", error);
        ui.print("\nAn unexpected critical error occurred. Check logs if available.", 'error');
        process.exit(1);
    }
}

/**
 * Runs the main menu loop.
 * @async
 * @param {MainMenuManager} menuManager - The main menu manager instance.
 */
async function runMainMenuLoop(menuManager) {
    logger.debug("Entering main menu loop.");
    let keepRunning = true;
    while (keepRunning) {
        const choice = await menuManager.displayMainMenu();
        let startGame = false;

        switch (choice) {
            case '1': // Start New Career
                startGame = await menuManager.startNewCareer();
                break;
            case '2': // Continue Previous Career
                startGame = await menuManager.continuePreviousCareer();
                break;
            case '3': // View Border Settings
                await menuManager.viewBorderSettings();
                break;
            case '4': // View Game Rules
                await menuManager.viewGameRules();
                break;
            case '5': // Game Configuration Settings
                await menuManager.gameConfigurationSettings();
                break;
            case '6': // Quit Game
                keepRunning = false;
                menuManager.ui.print("\nThank you for playing Veritaminal!", 'success');
                break;
            default:
                logger.warn(`Invalid main menu choice: ${choice}`);
                menuManager.ui.print("Invalid selection.", 'error');
                await menuManager.ui.pressEnterToContinue();
        }

        if (startGame) {
            logger.info("Starting gameplay loop from main menu.");
            await runGameplayLoop(menuManager);
            // After gameplay loop finishes (quit/game over), we return here to the main menu
            logger.debug("Returned to main menu loop after gameplay.");
        }
    }
    logger.debug("Exiting main menu loop.");
}

/**
 * Runs the main gameplay loop.
 * @async
 * @param {MainMenuManager} menuManager - Contains gameplay/ui/narrative managers.
 */
async function runGameplayLoop(menuManager) {
    logger.debug("Entering gameplay loop.");
    const gameplayManager = menuManager.gameplayManager;
    const ui = menuManager.ui;
    const narrativeManager = new NarrativeManager(); // Create fresh narrative state manager

    let gameRunning = true;

    // Initial sync of narrative state from loaded/initialized memory
    narrativeManager.syncState(gameplayManager.memoryManager.memory.gameState);
    ui.clearScreen();
    ui.print(`Starting Day ${narrativeManager.storyState.day}...`, 'header');
    await ui.pressEnterToContinue();


    while (gameRunning) {
        ui.adjustTerminalSize(); // Adjust for potential resize between turns

        // --- Start of Day / Check Game Over ---
        narrativeManager.syncState(gameplayManager.memoryManager.memory.gameState); // Sync state at start of loop/day
        const { isGameOver, endingType, endingMessage } = narrativeManager.checkGameOver();

        if (isGameOver) {
            try {
                logger.info(`Game Over condition met: ${endingType}`);
                ui.displayGameOver(endingType, endingMessage, gameplayManager.getScore());
                menuManager.updateCareerStats(gameplayManager); // Update session stats
                gameRunning = false; // Exit gameplay loop
                
                ui.clearScreen(); // Clear screen before the prompt
                await new Promise(resolve => setTimeout(resolve, 50)); // Small delay

                try {
                    await ui.pressEnterToContinue("Press Enter to return to main menu...");
                } catch (inputError) {
                    logger.error("CRITICAL: Error during ui.pressEnterToContinue after game over.", inputError);
                    // gameRunning is already false, loop will terminate.
                }
            } catch (error) {
                logger.error("Error handling game over scenario:", error);
                gameRunning = false; // Ensure we exit the gameplay loop even if there was an error
            }
            continue; // Skip rest of the loop
        }

        // Check for normal completion (e.g., finished Day 10)
        if (gameplayManager.gameCompleted && !isGameOver) { // Ensure this doesn't run if already handled by isGameOver
            try {
                logger.info("Normal game completion condition met.");
                const { endingType: normalEndingType, endingMessage: normalEndingMessage } = narrativeManager.getNormalEnding();
                ui.displayGameOver(normalEndingType, normalEndingMessage, gameplayManager.getScore());
                menuManager.updateCareerStats(gameplayManager);
                gameRunning = false; // Exit gameplay loop

                ui.clearScreen(); // Clear screen before the prompt
                await new Promise(resolve => setTimeout(resolve, 50)); // Small delay
                
                try {
                    await ui.pressEnterToContinue("Press Enter to return to main menu...");
                } catch (inputError) {
                    logger.error("CRITICAL: Error during ui.pressEnterToContinue after normal game completion.", inputError);
                    // gameRunning is already false, loop will terminate.
                }
            } catch (error) {
                logger.error("Error handling normal game completion:", error);
                gameRunning = false; // Ensure we exit the gameplay loop even if there was an error
            }
            continue; // Skip rest of the loop
        }

        // --- Process Traveler ---
        logger.debug(`Starting processing for traveler ${gameplayManager.travelersProcessedToday + 1} on day ${narrativeManager.storyState.day}`);
        const document = await gameplayManager.generateDocument();
        if (!document) {
            logger.error("Failed to generate document, cannot continue turn.");
            // Maybe try again or force end day? For now, log and wait.
            await ui.pressEnterToContinue("Error generating document. Press Enter...");
            // Potentially skip to next day or exit loop here
            continue; // Try next iteration (might advance day below)
        }

        ui.displayDocument(document);
        ui.displayStatus(narrativeManager.storyState.day, gameplayManager.getScore(), narrativeManager.getStateSummary());

        // --- Player Command Loop ---
        let decisionMade = false;
        while (!decisionMade && gameRunning) {
            const command = await ui.getUserInput();
            logger.debug(`Player command received: ${command}`);

            switch (command) {
                case 'approve':
                case 'deny':
                    const decisionResult = gameplayManager.makeDecision(command);
                    if (decisionResult) {
                        const { isCorrect } = decisionResult;
                        // Get narrative update based on the decision
                        const memoryContext = gameplayManager.memoryManager.getMemoryContext(); // Get fresh context
                        const narrativeUpdate = await generateNarrativeUpdate(
                            narrativeManager.storyState, // Pass current narrative state
                            command,
                            isCorrect,
                            memoryContext
                        );
                        // Display feedback AFTER generating narrative
                        ui.displayFeedback(isCorrect, narrativeUpdate, gameplayManager.aiJudgment);

                        // Check for milestones triggered by the state change (optional display)
                        const milestone = narrativeManager.checkMilestones();
                         if (milestone) {
                             ui.print(`\n${milestone}`, 'warning'); // Display milestone if triggered
                         }

                        decisionMade = true;
                        await gameplayManager.saveGame(); // Auto-save after each decision
                        await ui.pressEnterToContinue();
                    } else {
                        logger.error("Failed to process decision.");
                        ui.print("Error processing decision.", 'error');
                    }
                    break;

                case 'hint':
                    const memoryContextHint = gameplayManager.memoryManager.getMemoryContext();
                    const hint = await getVeritasHint(document, memoryContextHint);
                    ui.displayVeritasHint(hint);
                    // Re-display document and status after hint
                    ui.displayDocument(document);
                    ui.displayStatus(narrativeManager.storyState.day, gameplayManager.getScore(), narrativeManager.getStateSummary());
                    break;

                case 'rules':
                    const rules = gameplayManager.getAllRules();
                    ui.displayRules(rules);
                    // Re-display after rules screen
                    await ui.pressEnterToContinue(); // Add pause after rules
                    ui.displayDocument(document);
                    ui.displayStatus(narrativeManager.storyState.day, gameplayManager.getScore(), narrativeManager.getStateSummary());
                    break;

                case 'help':
                    ui.displayHelp();
                     // Re-display after help screen
                     await ui.pressEnterToContinue(); // Add pause after help
                    ui.displayDocument(document);
                    ui.displayStatus(narrativeManager.storyState.day, gameplayManager.getScore(), narrativeManager.getStateSummary());
                    break;

                case 'save':
                    const saved = await gameplayManager.saveGame();
                    if (saved) {
                        ui.print("\nGame progress saved successfully.", 'success');
                    } else {
                        ui.print("\nFailed to save game.", 'error');
                    }
                     await ui.pressEnterToContinue();
                     // Re-display
                    ui.displayDocument(document);
                    ui.displayStatus(narrativeManager.storyState.day, gameplayManager.getScore(), narrativeManager.getStateSummary());
                    break;

                case 'quit':
                    logger.info("Player initiated quit from gameplay loop.");
                    // Add confirmation?
                    const confirmQuit = await menuManager.ui.getListChoice(
                         "Are you sure you want to quit to the main menu? (Progress is saved after each decision)",
                         [{name: "Yes, quit", value: true}, {name: "No, continue playing", value: false}]
                    );
                    if (confirmQuit) {
                        gameRunning = false; // Exit gameplay loop, will return to main menu loop
                        decisionMade = true; // Break inner command loop
                        ui.print("\nReturning to main menu...", 'warning');
                        await ui.pressEnterToContinue();
                    } else {
                        // Re-display
                        ui.displayDocument(document);
                        ui.displayStatus(narrativeManager.storyState.day, gameplayManager.getScore(), narrativeManager.getStateSummary());
                    }
                    break;

                // Hidden debug command
                case 'debug_ai':
                     if (options.debug && gameplayManager.aiJudgment) {
                         ui.print("\n--- Last AI Judgment Details ---", 'header');
                         ui.printReasoning(
                            gameplayManager.aiJudgment.reasoning,
                            gameplayManager.aiJudgment.confidence,
                            gameplayManager.aiJudgment.suspicious_elements
                         );
                         console.log(gameplayManager.aiJudgment); // Log full object
                         await ui.pressEnterToContinue();
                         // Re-display
                        ui.displayDocument(document);
                        ui.displayStatus(narrativeManager.storyState.day, gameplayManager.getScore(), narrativeManager.getStateSummary());
                     } else {
                          ui.print("\nInvalid command, or debug not enabled / no judgment available.", 'error');
                     }
                     break;


                default:
                    logger.warn(`Invalid player command: ${command}`);
                    ui.print("\nInvalid command. Type 'help' for options.", 'error');
                    // No need to re-display here, loop continues
            }
        } // End inner command loop

        // --- End of Turn / Advance Day ---
        if (gameRunning && decisionMade) {
             // Check if day should end
             if (gameplayManager.shouldEndDay()) {
                  logger.info(`End of Day ${narrativeManager.storyState.day}.`);
                  const dayMessage = gameplayManager.advanceDay(); // Advances day in memory
                  narrativeManager.syncState(gameplayManager.memoryManager.memory.gameState); // Sync narrative manager day
                  ui.print(`\n${dayMessage}`, 'header');
                  await ui.pressEnterToContinue("Press Enter to start the next day...");
             } else {
                  // Just processed one traveler, continue the current day
                  logger.debug(`Continuing Day ${narrativeManager.storyState.day}, traveler ${gameplayManager.travelersProcessedToday}/${gameplayManager.travelersPerDay}`);
             }
        }

    } // End main gameplay loop (while gameRunning)

    logger.debug("Exiting gameplay loop.");
    try {
      ui.clearScreen(); // Clear screen one last time before returning to main menu
      await new Promise(resolve => setTimeout(resolve, 50)); // Short delay
    } catch (finalUiError) {
      logger.error("Error during final UI cleanup in gameplay loop:", finalUiError);
    }
    // Control returns to the calling loop (mainMenuLoop)
}

// --- Start the application ---
main();
