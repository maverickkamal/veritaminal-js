/**
 * API module for Veritaminal
 * Handles interactions with the Google Gemini AI API for generating game content.
 */

import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import chalk from 'chalk';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// Helper to get __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error(chalk.red('No API key found. Please set GEMINI_API_KEY in your .env file.'));
    process.exit(1); // Exit if no API key
}

const ai = new GoogleGenAI({ apiKey: apiKey });

// Define Model Name
const MODEL_NAME = 'gemini-2.0-flash'; // Or use 'gemini-1.0-pro' or other suitable models

// --- Global Document Context ---
// This stores the current traveler's information for consistent AI context
let currentDocumentContext = {
    name: null,
    permit: null,
    backstory: null,
    additional_fields: null,
    setting: null
};

/**
 * Sets the current document context for global access by AI functions
 * @param {object} document - The current traveler document
 * @param {object} setting - The current border setting
 */
function setCurrentDocumentContext(document, setting) {
    currentDocumentContext = {
        name: document?.name || null,
        permit: document?.permit || null,
        backstory: document?.backstory || null,
        additional_fields: document?.additional_fields || null,
        setting: setting || null
    };
    console.log(chalk.blue(`Document context set for: ${currentDocumentContext.name || 'Unknown'}`));
}

/**
 * Gets the formatted current document context for AI prompts
 * @returns {string} Formatted context string
 */
function getCurrentDocumentContext() {
    if (!currentDocumentContext.name) {
        return "No current traveler document available.";
    }
    
    return `
CURRENT TRAVELER CONTEXT:
Name: ${currentDocumentContext.name}
Permit: ${currentDocumentContext.permit}
Backstory: ${currentDocumentContext.backstory}
Additional Fields: ${JSON.stringify(currentDocumentContext.additional_fields || {})}
Border Setting: ${currentDocumentContext.setting?.name || 'Unknown Setting'}`;
}

/**
 * Clears the current document context (called when starting new document generation)
 */
function clearCurrentDocumentContext() {
    currentDocumentContext = {
        name: null,
        permit: null,
        backstory: null,
        additional_fields: null,
        setting: null
    };
}

// --- JSDoc Typedefs (like Python's TypedDict) ---

/**
 * @typedef {object} TravelerDocument
 * @property {string} name - Full name (first and last).
 * @property {string} backstory - Brief one-sentence backstory mentioning the name.
 * @property {object.<string, any>} [additional_fields] - Any relevant extra fields.
 */

/**
 * @typedef {object} AIJudgment
 * @property {('approve'|'deny')} decision - The judgment decision.
 * @property {number} confidence - Confidence score (0.0 to 1.0).
 * @property {string} reasoning - Explanation for the decision.
 * @property {string[]} suspicious_elements - List of suspicious elements found.
 */

// --- System Instructions ---
const SYSTEM_INSTRUCTIONS = {
    "document_generation": `
    You are a document generation system for a border control game called Veritaminal.
    Generate ONLY structured JSON data representing a traveler document with the following fields:
    - name: Full name (first and last) with no prefix or label (e.g., "John Doe").
    - backstory: Brief one-sentence backstory that MUST mention the generated name exactly.
    - additional_fields: An object containing any relevant border-specific fields as key-value pairs (can be empty {}).

    RULES:
    - Generate unique names different from previously seen travelers (context will be provided).
    - Keep content appropriate for a general audience and non-political.
    - Occasionally include subtle inconsistencies in the backstory or additional fields that a player might notice.
    - Your entire output MUST be ONLY a single, valid JSON object. Do NOT include any text before or after the JSON object, including markdown formatting like \`\`\`json.
    - DO NOT include labels like "Name:" or "Backstory:" within the JSON values themselves.
    - Ensure the backstory accurately reflects the generated name.
    `,

    "veritas_assistant": `
    You are Veritas, an AI assistant to a border control agent in the game Veritaminal.
    Your role is to:
    - Provide subtle, indirect hints about potential issues or confirmations in a traveler's document.
    - Remain neutral but observant. Do not reveal your own opinions or feelings.
    - Use clear, concise language (1-2 sentences).
    - Occasionally express a slight, dry, observant personality (e.g., "Interesting detail...", "One might note...").
    - Analyze the provided document details (name, permit, backstory, setting context, recent history) to form your hint.
    - Reference the current traveler's specific information when providing hints.

    IMPORTANT: Avoid directly telling the player whether the document is valid/invalid or if they should approve/deny. Guide their attention to specific elements or inconsistencies. For example, instead of "The permit is wrong", say "The permit number format seems unusual for this region." Always refer to the specific traveler by name when relevant.
    `,

    "narrative_generation": `
    You are crafting a branching narrative for Veritaminal, a border control simulation game.
    Create a short, engaging story fragment (1-2 sentences, 25-50 words) that reflects the immediate consequence of the player's recent decision (approve/deny) and its correctness.
    Consider the provided context: player decision, correctness, current game state (day, corruption, trust), border setting, recent history, and the SPECIFIC TRAVELER involved.
    Your response should:
    - Respond directly to the player's action involving the specific traveler (use their name and backstory).
    - Gradually build atmosphere or tension based on the game state.
    - Occasionally hint at wider consequences or moral dilemmas.
    - Maintain consistent world-building based on the border setting.
    - Be concise and focused.
    - Reference the traveler's specific details (name, backstory) to create immersive, personalized consequences.
    `,

    "ai_judgment": `
    You are an expert document verification system for the border control game Veritaminal. Your task is to evaluate a traveler's document based on provided context and determine if it should be approved or denied.

    Consider the following factors in your evaluation:
    - Document details: Name, Permit number, Backstory, any additional fields.
    - Consistency: Check for internal consistency between the document fields. Does the backstory match the name? Are additional fields plausible?
    - Border Setting Context: Current border situation, specific rules, common issues for this location.
    - Game History/Memory: Recent player decisions, narrative events, rule changes. Patterns in traveler documents.
    - Subtle Discrepancies: Look for minor errors, unusual phrasing, or inconsistencies that might indicate forgery or issues.
    - Cross-reference all information about this specific traveler for internal consistency.

    Your output MUST be ONLY a single, valid JSON object with these exact fields:
    - decision: A string, either "approve" or "deny".
    - confidence: A float between 0.0 and 1.0, representing your certainty in the decision.
    - reasoning: A concise string (1-2 sentences) explaining the primary reason for your decision, referencing the specific traveler's details.
    - suspicious_elements: An array of strings listing specific suspicious elements found in the document or context. Can be an empty array [] if nothing is suspicious.

    IMPORTANT: Adhere strictly to the JSON format. Do not include any text before or after the JSON object, including markdown formatting.
    `
};

// --- Helper Functions ---

/**
 * Generates a permit number with controlled validity.
 * Format: Valid = 'P' + 4 digits. Invalid has variations.
 * @param {boolean} [valid=true] - Whether to generate a valid permit number.
 * @returns {string} A permit number (valid or invalid).
 */
function generatePermitNumber(valid = true) {
    const digits = (count) => Array.from({ length: count }, () => Math.floor(Math.random() * 10)).join('');
    const randomLetter = (exclude = '') => {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let letter;
        do {
            letter = alphabet[Math.floor(Math.random() * alphabet.length)];
        } while (letter === exclude);
        return letter;
    };

    if (valid) {
        return 'P' + digits(4);
    } else {
        const errorType = ['wrong_prefix', 'wrong_length', 'non_digit'][Math.floor(Math.random() * 3)];

        if (errorType === 'wrong_prefix') {
            return randomLetter('P') + digits(4);
        } else if (errorType === 'wrong_length') {
            const length = Math.random() < 0.5 ? 3 : 5;
            return 'P' + digits(length);
        } else { // non_digit
            let d = digits(3);
            const nonDigit = Math.random() < 0.5 ? randomLetter() : '!@#$%^&*()_-+=<>?~`'[Math.floor(Math.random() * 20)];
            const position = Math.floor(Math.random() * 4);
            d = d.slice(0, position) + nonDigit + d.slice(position);
            return 'P' + d.slice(0, 4); // Ensure final length is 5
        }
    }
}

/**
 * Attempts to parse JSON, cleaning common non-JSON text around it.
 * @param {string} text - The text potentially containing JSON.
 * @returns {object | null} Parsed JSON object or null if parsing fails.
 */
function cleanAndParseJson(text) {
    if (!text) return null;
    try {
        // Greedily find the outermost curly braces
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        } else {
             // Try parsing directly if no clear braces found (less likely for complex objects)
             return JSON.parse(text);
        }
    } catch (e) {
        console.error(chalk.red(`Failed to parse JSON: ${e.message}`), "\nRaw text:", text);
        return null;
    }
}


// --- Core API Functions ---

/**
 * Generates text using the Google Gemini AI API with specific system instructions.
 * @async
 * @param {string} prompt - The prompt to send to the API.
 * @param {keyof SYSTEM_INSTRUCTIONS} [systemType="document_generation"] - Type of system instruction to use.
 * @param {number} [maxTokens=200] - Maximum number of tokens for the response.
 * @param {number} [temperature=0.9] - Generation temperature.
 * @param {string | null} [responseMimeType=null] - Optional response MIME type (e.g., 'application/json').
 * @param {object | null} [responseSchema=null] - Optional response schema (use Type from @google/genai).
 * @returns {Promise<string | object | null>} Generated text, parsed JSON object, or null on error.
 */
async function generateApiResponse(
    prompt,
    systemType = "document_generation",
    maxTokens = 200,
    temperature = 0.9,
    responseMimeType = null,
    responseSchema = null
) {
    const systemInstruction = SYSTEM_INSTRUCTIONS[systemType] || SYSTEM_INSTRUCTIONS["document_generation"];

    try {
       

        // console.log("Sending request to AI:", JSON.stringify(request, null, 2)); // Debugging

        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            config: {
              maxOutputTokens: maxTokens,
              temperature: temperature,
              systemInstruction: systemInstruction,
              responseMimeType: responseMimeType,
              responseSchema: responseSchema,
            }
          });
        // console.log("Received response from AI:", JSON.stringify(response, null, 2)); // Debugging

        // if (!response || !response.candidates || response.candidates.length === 0) {
        //      console.error(chalk.red(`API Error: No response or candidates found. Finish reason: ${response?.promptFeedback?.blockReason || response?.candidates?.[0]?.finishReason || 'Unknown'}`));
        //      if (response?.promptFeedback?.blockReason) {
        //          console.error(chalk.red(`Prompt Feedback Block Reason: ${response.promptFeedback.blockReason}`));
        //          console.error(chalk.red(`Safety Ratings: ${JSON.stringify(response.promptFeedback.safetyRatings)}`));
        //      } else if (response?.candidates?.[0]?.finishReason !== 'STOP') {
        //          console.error(chalk.red(`Candidate Finish Reason: ${response.candidates[0].finishReason}`));
        //          console.error(chalk.red(`Safety Ratings: ${JSON.stringify(response.candidates[0].safetyRatings)}`));
        //      }
        //      return null;
        // }

        // const content = response.candidates[0].content;
        // if (!content || !content.parts || content.parts.length === 0) {
        //      console.error(chalk.red("API Error: No content parts in the response candidate."));
        //      return null;
        // }

        const responseText = response.text;

        if (responseMimeType === 'application/json') {
            const jsonData = cleanAndParseJson(responseText);
            if (!jsonData) {
                 console.error(chalk.red("API Error: Expected JSON response but failed to parse."));
                 return null; // Or return a default error object
            }
             return jsonData;
        } else {
            return responseText.trim();
        }

    } catch (error) {
        console.error(chalk.red(`Error generating content (${systemType}): ${error.message}`));
        // console.error(error.stack); // Optionally log stack trace
        return null; // Return null or throw error depending on desired handling
    }
}


/**
 * Generates a unique traveler document for a specific border setting.
 * @async
 * @param {object} setting - The border setting details.
 * @param {string} usedNamesContext - Context about previously used names.
 * @returns {Promise<{name: string, permit: string, backstory: string, additional_fields: object} | null>} Document object or null on error.
 */
async function generateDocumentForSetting(setting, usedNamesContext) {
    // Clear previous document context before generating new one
    clearCurrentDocumentContext();
    
    // Decide validity locally
    const shouldBeValidPermit = Math.random() < 0.7; // 70% chance of valid permit format

    const contextPrompt = `
Border Setting: ${setting.name}
Situation: ${setting.situation}
Current Document Requirements: ${setting.document_requirements.join(', ')}
Common Issues at this Border: ${setting.common_issues.join(', ')}

${usedNamesContext}

Generate a traveler document JSON object for someone crossing this border, following the rules outlined in the system instruction. Ensure the backstory mentions the name exactly and that all fields are internally consistent.
`;

    const maxTokens = 300; // Increased token limit for potentially complex JSON
    const temperature = 0.95; // Slightly higher temp for more variety

    // First, try to use Gemini API to generate a document
    try {
        const jsonData = await generateApiResponse(
            contextPrompt,
            "document_generation",
            maxTokens,
            temperature,
            'application/json',
            // Define the expected JSON schema (matching Python TypedDict/System Instruction)
            {
                type: Type.OBJECT,
                properties: {
                    'name': { type: Type.STRING, description: "Full name (first and last)" },
                    'backstory': { type: Type.STRING, description: "One-sentence backstory mentioning the name" },
                    'additional_fields': {
                        type: Type.OBJECT,
                        description: "Key-value pairs for extra info, can be empty object {}",
                        properties: {
                            'note': { type: Type.STRING, description: "Optional note about the traveler" }
                        }
                    }
                },
                required: ['name', 'backstory', 'additional_fields']
            }
        );

        if (jsonData && typeof jsonData === 'object' && jsonData.name && jsonData.backstory) {
            // Clean the received data just in case
            const name = String(jsonData.name).trim().replace(/^name:\s*/i, '');
            const backstory = String(jsonData.backstory).trim();
            const additional_fields = (typeof jsonData.additional_fields === 'object' && jsonData.additional_fields !== null) 
                ? jsonData.additional_fields 
                : {};

            // Basic consistency check: Does backstory mention the name? (Case-insensitive)
            if (!backstory.toLowerCase().includes(name.toLowerCase().split(' ')[0])) { // Check first name at least
                console.warn(chalk.yellow(`Generated backstory might not contain the name "${name}". Backstory: "${backstory}"`));
            }

            // Generate permit number locally based on calculated validity
            const permit = generatePermitNumber(shouldBeValidPermit);

            // Create final document
            const finalDocument = { name, permit, backstory, additional_fields };
            
            // Set global context for this document
            setCurrentDocumentContext(finalDocument, setting);

            console.log(chalk.green(`Generated document successfully for ${name}`));
            return finalDocument;
        }
    } catch (error) {
        console.error(chalk.red(`Error during document generation: ${error.message}`));
    }

    // If we reach here, the API call failed or returned invalid data - use fallback
    console.error(chalk.red("Failed to generate valid document from API. Using fallback."));
    
    // Generate a completely fallback document with random names and simple backstory
    const fallbackName = await generateCleanName(usedNamesContext);
    const permit = generatePermitNumber(shouldBeValidPermit);
    
    // Create a simple backstory that mentions the name
    const backstoryOptions = [
        `${fallbackName} is seeking entry under standard procedures.`,
        `${fallbackName} claims to be visiting family in the area.`,
        `${fallbackName} is traveling for business purposes.`,
        `${fallbackName} wishes to attend a local cultural event.`,
        `${fallbackName} states they are here for a brief tourism visit.`
    ];
    const fallbackBackstory = backstoryOptions[Math.floor(Math.random() * backstoryOptions.length)];
    
    // Create some simple additional fields based on the border setting
    const fallbackAdditionalFields = {};
    
    // Add a random field based on setting
    const possibleFields = {
        "visaType": ["Tourist", "Business", "Family", "Diplomatic"],
        "stayDuration": ["3 days", "1 week", "10 days", "30 days"],
        "visaExpiry": ["2025-06-01", "2025-07-15", "2025-05-30", "2025-08-22"],
        "entryCount": ["Single", "Multiple"]
    };
    
    // Add 1-2 random fields
    const fieldKeys = Object.keys(possibleFields);
    const numFields = Math.floor(Math.random() * 2) + 1; // 1-2 fields
    
    for (let i = 0; i < numFields; i++) {
        const randomKey = fieldKeys[Math.floor(Math.random() * fieldKeys.length)];
        const values = possibleFields[randomKey];
        fallbackAdditionalFields[randomKey] = values[Math.floor(Math.random() * values.length)];
    }
    
    console.log(chalk.blue(`Gameplay: Document generated for ${fallbackName}`));
    
    // Create final fallback document
    const fallbackDocument = {
        name: fallbackName,
        permit: permit,
        backstory: fallbackBackstory,
        additional_fields: fallbackAdditionalFields
    };
    
    // Set global context for this fallback document
    setCurrentDocumentContext(fallbackDocument, setting);
    
    return fallbackDocument;
}

/**
 * Generates a clean name (first and last) without prefixes.
 * @async
 * @param {string} usedNamesContext - Context of previously used names.
 * @returns {Promise<string>} A clean name, or a fallback name on error.
 */
async function generateCleanName(usedNamesContext) {
    const prompt = `
${usedNamesContext}

Generate a unique full name (first and last) for a traveler.
Return ONLY the name with no additional text, labels, or formatting. Example: "Jane Smith"
`;
    const systemInstruction = "Return ONLY a name with first and last name. No additional text or explanation.";
    const nameText = await generateApiResponse(prompt, "document_generation", 50, 0.95, null, null, systemInstruction); // Use custom system instruction

    if (nameText && typeof nameText === 'string') {
        let name = nameText.trim();
        // Remove common prefixes and unwanted characters
        name = name.replace(/^(Name:|Full name:|Traveler:|Traveler name:)\s*/i, '');
        name = name.replace(/["*_`]/g, ''); // Remove quotes, asterisks, underscores, backticks
        // Basic check for plausible format (at least two words)
        if (name.split(' ').length >= 2) {
            return name;
        } else {
             console.warn(chalk.yellow(`Generated name "${name}" might not be a full name. Using fallback.`));
        }
    }

    console.error(chalk.red("Failed to generate clean name from API. Using fallback."));
    // Fallback random name generation
    const firstNames = ["Alex", "Sam", "Jordan", "Morgan", "Casey", "Taylor", "Chris", "Dana"];
    const lastNames = ["Smith", "Jones", "Garcia", "Chen", "Patel", "Müller", "Kim", "Singh"];
    return `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
}


/**
 * Gets a hint from Veritas about the document.
 * @async
 * @param {object} doc - The document to analyze { name, permit, backstory, ... }.
 * @param {string} memoryContext - Context from the memory manager.
 * @returns {Promise<string>} A hint from Veritas, or a default message on error.
 */
async function getVeritasHint(doc, memoryContext) {
    const currentContext = getCurrentDocumentContext();
    
    const prompt = `
${memoryContext}

${currentContext}

Analyze this traveler's complete information:
Name: ${doc.name}
Permit: ${doc.permit}
Backstory: ${doc.backstory}
Additional Fields: ${JSON.stringify(doc.additional_fields || {})}

Provide a subtle hint about potential issues or confirmations based on the document's internal consistency, the current border setting context, and recent history. Reference the traveler by name (${doc.name}) in your hint when appropriate. Follow the Veritas persona guidelines.
`;

    const hintText = await generateApiResponse(prompt, "veritas_assistant", 100, 0.8);

    if (hintText && typeof hintText === 'string') {
        return hintText;
    } else {
        console.error(chalk.red("Failed to get Veritas hint."));
        return "Veritas remains silent for now.";
    }
}

/**
 * Uses AI to judge if a document should be approved or denied.
 * @async
 * @param {object} doc - The document to judge { name, permit, backstory, ... }.
 * @param {string} settingContext - Context about the border setting.
 * @param {string} memoryContext - Context about game history.
 * @returns {Promise<AIJudgment>} Judgment results.
 */
async function aiJudgeDocument(doc, settingContext, memoryContext) {
    // --- Local Permit Format Check (as in Python) ---
    const permitValidFormat = typeof doc.permit === 'string' &&
                              doc.permit.length === 5 &&
                              doc.permit[0] === 'P' &&
                              /^\d{4}$/.test(doc.permit.substring(1));

    if (!permitValidFormat) {
        console.log(chalk.blue("AI Judge: Denying based on local permit format check."));
        return {
            decision: "deny",
            confidence: 0.95, // High confidence for clear format violation
            reasoning: `The permit number '${doc.permit}' does not follow the required format of 'P' followed by 4 digits.`,
            suspicious_elements: [`Invalid permit format: ${doc.permit}`]
        };
    }

    // --- Proceed with AI Judgment for potentially valid formats ---
    const currentContext = getCurrentDocumentContext();
    
    const prompt = `
${settingContext}

${memoryContext}

${currentContext}

DOCUMENT TO EVALUATE:
Name: ${doc.name}
Permit: ${doc.permit}
Backstory: ${doc.backstory}
Additional Fields: ${JSON.stringify(doc.additional_fields || {})}

Evaluate this document based on all provided context (rules, situation, history, document details, and internal consistency).
Cross-reference the traveler's name (${doc.name}) across all fields to ensure consistency.
Determine if this traveler should be approved or denied entry according to the Veritaminal game rules and setting.
Return ONLY the JSON judgment object as specified in the system instructions.
`;

    const maxTokens = 300;
    const temperature = 0.7; // Lower temp for more deterministic judgment

    const judgmentJson = await generateApiResponse(
        prompt,
        "ai_judgment",
        maxTokens,
        temperature,
        'application/json',
        // Define the expected JSON schema
        {
            type: Type.OBJECT,
            properties: {
                'decision': { type: Type.STRING, enum: ["approve", "deny"] },
                'confidence': { type: Type.NUMBER, format: "float" },
                'reasoning': { type: Type.STRING },
                'suspicious_elements': {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            },
            required: ['decision', 'confidence', 'reasoning', 'suspicious_elements']
        }
    );

    // --- Fallback and Post-Processing ---
    let finalJudgment;

    if (judgmentJson && typeof judgmentJson === 'object' && judgmentJson.decision && judgmentJson.confidence !== undefined) {
        finalJudgment = {
            decision: judgmentJson.decision === "approve" ? "approve" : "deny", // Ensure valid enum
            confidence: Math.max(0.0, Math.min(1.0, Number(judgmentJson.confidence) || 0.5)), // Clamp and default confidence
            reasoning: String(judgmentJson.reasoning || "No specific reasoning provided by AI."),
            suspicious_elements: Array.isArray(judgmentJson.suspicious_elements)
                ? judgmentJson.suspicious_elements.map(String) // Ensure elements are strings
                : []
        };

        // Gameplay Balance Override (as in Python) - 30% chance to flip
        if (Math.random() < 0.30) {
             console.log(chalk.magenta("AI Judge: Applying gameplay balance flip."));
             const originalDecision = finalJudgment.decision;
             finalJudgment.decision = originalDecision === "approve" ? "deny" : "approve";
             finalJudgment.reasoning = `[Balanced] ${finalJudgment.reasoning}`; // Indicate flip for debugging
             // Lower confidence slightly when flipping
             finalJudgment.confidence = Math.max(0.1, Math.min(0.7, finalJudgment.confidence * 0.8));
         }

    } else {
        console.error(chalk.red("Failed to get valid AI judgment JSON. Using fallback judgment."));
        // Fallback judgment with balanced probability
        const fallbackDecision = Math.random() > 0.4 ? "approve" : "deny"; // 60% approve bias fallback
        finalJudgment = {
            decision: fallbackDecision,
            confidence: Math.random() * 0.3 + 0.5, // Confidence between 0.5 and 0.8
            reasoning: "AI judgment failed or was invalid. Standard verification procedures applied.",
            suspicious_elements: []
        };
    }

     console.log(chalk.blue(`AI Judge Result: ${finalJudgment.decision} (Confidence: ${finalJudgment.confidence.toFixed(2)})`));
     return finalJudgment;
}

/**
 * Generates a narrative update based on player decisions.
 * @async
 * @param {object} currentState - Current story state { day, corruption, trust }.
 * @param {string} decision - Player's decision ('approve'/'deny').
 * @param {boolean} isCorrect - Whether the decision was correct.
 * @param {string} memoryContext - Context from the memory manager.
 * @returns {Promise<string>} A narrative update, or a default message on error.
 */
async function generateNarrativeUpdate(currentState, decision, isCorrect, memoryContext) {
    const corruption = currentState.corruption ?? 0;
    const trust = currentState.trust ?? 0;
    const currentContext = getCurrentDocumentContext();

    const prompt = `
${memoryContext}

${currentContext}

Player decision: ${decision} (for traveler: ${currentDocumentContext.name || 'Unknown'})
Decision correctness: ${isCorrect ? 'correct' : 'incorrect'}
Current corruption level: ${corruption}
Current trust level: ${trust}

Generate a brief narrative update (1-2 sentences) describing the immediate consequence or observation related to this specific decision involving ${currentDocumentContext.name || 'the traveler'}. Reference the traveler's name and backstory when creating the narrative. Consider the game context and traveler details provided. Follow the narrative generation guidelines.
`;

    const narrativeText = await generateApiResponse(prompt, "narrative_generation", 100, 0.9);

    if (narrativeText && typeof narrativeText === 'string') {
        return narrativeText;
    } else {
        console.error(chalk.red("Failed to generate narrative update."));
        // Simple fallback based on correctness
        // Better fallback that uses current context if available
        const travelerName = currentDocumentContext.name || "the traveler";
        return isCorrect
            ? `The processing queue moves along smoothly as ${travelerName} proceeds.`
            : `A moment of hesitation, but you proceed with ${travelerName}.`;
    }
}


// Export the functions needed by other modules
export {
    generatePermitNumber,
    generateDocumentForSetting,
    getVeritasHint,
    aiJudgeDocument,
    generateNarrativeUpdate,
    generateCleanName, // Export if needed elsewhere, e.g., for fallbacks
    setCurrentDocumentContext,
    getCurrentDocumentContext,
    clearCurrentDocumentContext
};
