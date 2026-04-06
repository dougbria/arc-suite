import { promptUser } from '@arc/utils.js';

export async function callClaude(prompt, systemPrompt = '', model = 'claude-sonnet-4-6') {
    let apiKey = localStorage.getItem('arcdrama-anthropic-key');
    
    // If not set, prompt the user right away
    if (!apiKey) {
        apiKey = await promptUser("Enter your Anthropic API Key (sk-ant-...):");
        if (apiKey) {
            apiKey = String(apiKey).trim();
            localStorage.setItem('arcdrama-anthropic-key', apiKey);
        } else {
            throw new Error("Anthropic API key is required to perform Script Breakdowns.");
        }
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            model: model,
            max_tokens: 8192,
            system: systemPrompt,
            messages: [
                { role: 'user', content: prompt }
            ]
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) localStorage.removeItem('arcdrama-anthropic-key'); // Clear if invalid
        throw new Error(errorData.error?.message || `Anthropic API Error: ${response.status}`);
    }

    const data = await response.json();
    return data.content[0].text;
}

export async function generateEntityVGL(type, name, description) {
    const sysPrompt = `You are an expert Visual Generative Language (VGL) designer. Your job is to convert natural language descriptions of characters or locations into a highly structured JSON property block.
Do NOT wrap the output in markdown code blocks. Output ONLY raw, valid JSON.

If type is 'character', use keys like: "primarySubject", "expression", "clothing", "lighting", "cameraAngle", "colorPalette".
Ensure the character is centrally framed on a clean, solid background.

If type is 'location', use keys like: "setting", "architecture", "lighting", "atmosphere", "timeOfDay", "colorPalette".

Focus on highly detailed physical and visual attributes to maintain absolute IP consistency.`;

    const userPrompt = `Type: ${type}\nName: ${name}\nDescription: ${description}\n\nGenerate the VGL JSON block now.`;

    const resultStr = await callClaude(userPrompt, sysPrompt);
    
    // Clean up potential markdown blocks if the LLM ignores instructions
    let cleanStr = resultStr.trim();
    if (cleanStr.startsWith('\`\`\`json')) {
        cleanStr = cleanStr.substring(7);
        if (cleanStr.endsWith('\`\`\`')) cleanStr = cleanStr.slice(0, -3);
    } else if (cleanStr.startsWith('\`\`\`')) {
        cleanStr = cleanStr.substring(3);
        if (cleanStr.endsWith('\`\`\`')) cleanStr = cleanStr.slice(0, -3);
    }
    
    cleanStr = cleanStr.trim();
    return JSON.parse(cleanStr);
}
