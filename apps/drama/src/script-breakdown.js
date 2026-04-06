import { callClaude } from './llm-api.js';
import state from '@arc/state.js';

const SYSTEM_PROMPT = `You are a script breakdown assistant for a visual production tool.
Your goal is to read the provided text (a screenplay, story outline, or prose) and extract a highly structured timeline AND a standardized screenplay.

Rules:
1. Extract ALL unique characters and write a physical visual description for each.
2. Extract ALL unique locations and write a visual description of the lighting/setting.
3. Break the script down into Episodes, Scenes, and Shots.
4. An Episode represents the full output. Episode "title" MUST be extremely short (1-3 words max, e.g. "The Arrival" or "Coffee Time").
5. A Scene takes place at exactly ONE location. If the location changes, it is a new Scene.
6. A Shot is a single camera angle/action. Each shot must have a list of character names that appear in it.
7. You must ALSO generate a "screenplay" value: converting the story into a standard FinalDraft-style formatted screenplay (with uppercase SCENE HEADINGS, properly spaced Character names, and Dialogue). Use \\n for line breaks.
8. NEVER use backslashes (\\) for escaping quotes. Just use single quotes for dialogue. DO NOT output literal newlines or tabs inside JSON strings (use \\n). This is strictly required to prevent JSON syntax errors.

Respond ONLY with valid, unbroken JSON matching this schema exactly:
{
  "screenplay": "String (The formatted screenplay text, using \\n for newlines)",
  "newCharacters": [{ "name": "String", "description": "String" }],
  "newLocations": [{ "name": "String", "description": "String" }],
  "episodes": [
    {
      "title": "String (1-3 words max)",
      "scenes": [
        {
          "sceneNumber": 10,
          "baseName": "String",
          "locationName": "String",
          "shots": [
            {
              "shotNumber": 10,
              "suffix": "a",
              "action": "String (Initial Action / Prompt)",
              "characterNames": ["String"]
            }
          ]
        }
      ]
    }
  ]
}`;

export async function generateBreakdown(scriptText, epCount = '', epDuration = '') {
    if (!scriptText || scriptText.trim().length === 0) {
        throw new Error("Script text is empty.");
    }

    let dynamicPrompt = SYSTEM_PROMPT;
    if (epCount || epDuration) {
        dynamicPrompt += `\n\nADDITIONAL CONSTRAINTS FROM DIRECTOR:\n`;
        if (epCount) dynamicPrompt += `- Target number of Episodes: ${epCount}\n`;
        if (epDuration) dynamicPrompt += `- Target average Length/Pacing per Episode: ${epDuration}\n`;
        dynamicPrompt += "Please structure the number of scenes and shots strictly to match this intended pacing and episode count block sizing.\n";
    }

    try {
        const rawResponse = await callClaude(scriptText, dynamicPrompt);
        
        let jsonStr = rawResponse;
        
        // Bulletproof parsing: find the first { and last } to ignore all surrounding markdown
        const firstBrace = jsonStr.indexOf('{');
        const lastBrace = jsonStr.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
             jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
        }

        // Clean up common LLM string failures before JSON.parse
        // 1. Remove invalid JSON escape sequences (e.g. \', \x, \_) leaving the character intact
        jsonStr = jsonStr.replace(/\\([^"\\/bfnrtu])/g, '$1');
        
        // 2. Strip literal unescaped control characters (ASCII 0-31) which break JSON.parse
        jsonStr = jsonStr.replace(/[\x00-\x1F]/g, ' ');

        const data = JSON.parse(jsonStr.trim());
        return matchEntities(data);
    } catch (e) {
        console.error("LLM Breakdown Failed:", e);
        throw e;
    }
}

/**
 * Maps the raw LLM string names to existing IDs if they exist in the workspace,
 * otherwise flags them as "new".
 */
function matchEntities(data) {
    const existingChars = state.workspace?.characters || [];
    const existingLocs = state.workspace?.locations || [];

    // Attach resolution context to characters
    data.newCharacters = (data.newCharacters || []).map(nc => {
        const match = existingChars.find(c => c.name.toLowerCase() === nc.name.toLowerCase());
        return {
            ...nc,
            matchedId: match ? match.id : null,
            isNew: !match
        };
    });

    data.newLocations = (data.newLocations || []).map(nl => {
        const match = existingLocs.find(l => l.name.toLowerCase() === nl.name.toLowerCase());
        return {
            ...nl,
            matchedId: match ? match.id : null,
            isNew: !match
        };
    });

    return data;
}
