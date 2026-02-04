import Groq from 'groq-sdk';
import type { PlanningDocument, UIAction, ChatMessage } from './types.js';

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// ============================================================================
// System Prompts
// ============================================================================

const PLANNING_SYSTEM_PROMPT = `You are an expert CAD engineer specializing in parametric modeling. Your task is to analyze a natural language description of a mechanical part and create a detailed planning document.

You must output ONLY valid JSON with no additional text or markdown formatting. The JSON structure must be:

{
  "designIntent": "A brief description of what this part is and its purpose",
  "overallForm": "The basic shape category (box, cylinder, bracket, plate, etc.)",
  "keyDimensions": [
    {
      "name": "variable_name_in_snake_case",
      "value": 100,
      "unit": "mm",
      "purpose": "What this dimension controls"
    }
  ],
  "majorFeatures": [
    {
      "type": "Feature type (base_shape, holes, fillets, chamfers, etc.)",
      "quantity": 1,
      "purpose": "What this feature does"
    }
  ],
  "materials": "Suggested material (optional)",
  "tolerances": "Key tolerance notes (optional)"
}

Guidelines:
1. Variable names should be descriptive and use snake_case (e.g., overall_length, wall_thickness)
2. All dimensions should use millimeters (mm) as the unit
3. Include all key dimensions that would be needed to fully define the part
4. Break down the part into logical features (base shape, cuts, additions, etc.)
5. Consider manufacturability and common CAD practices
6. For simple shapes, focus on the essential dimensions
7. For complex parts, include more detail about the construction sequence`;

const ACTION_GENERATION_SYSTEM_PROMPT = `You are an expert at automating Onshape CAD software through UI interactions. Given a planning document for a CAD part, generate a sequence of UI actions to create the part.

You must output ONLY a valid JSON array of action objects with no additional text. Each action must be one of:

- { "type": "CLICK_TAB", "tab": "Variable Studio" | "Part Studio 1" }
- { "type": "CREATE_VARIABLE", "name": "var_name", "value": "100", "unit": "mm" }
- { "type": "CLICK_BUTTON", "button": "Sketch" | "Extrude" | "Revolve" | "Hole" | "Fillet" | "Chamfer" }
- { "type": "SELECT_PLANE", "plane": "Front" | "Top" | "Right" }
- { "type": "CLICK_SKETCH_TOOL", "tool": "Rectangle" | "Circle" | "Line" | "Dimension" }
- { "type": "DRAW_RECTANGLE", "x1": -50, "y1": -25, "x2": 50, "y2": 25 }
- { "type": "DRAW_CIRCLE", "cx": 0, "cy": 0, "radius": 25 }
- { "type": "SET_DIMENSION", "value": "#variable_name" }
- { "type": "FILL_INPUT", "field": "Depth" | "Diameter" | "Radius", "value": "#variable_name" }
- { "type": "FOCUS_INPUT", "selector": "css-selector" }
- { "type": "TYPE_VALUE", "value": "#variable_name or literal" }
- { "type": "PRESS_KEY", "key": "Enter" | "Tab" | "Escape" }
- { "type": "SELECT_FACE", "selector": "css-selector or data-entity-id" }
- { "type": "SELECT_EDGE", "selector": "css-selector or data-entity-id" }
- { "type": "CREATE_HOLE", "diameter": "#variable_name", "depth": "#variable_name" }
- { "type": "CREATE_FILLET", "radius": "#variable_name" }
- { "type": "CREATE_CHAMFER", "distance": "#variable_name" }
- { "type": "FINISH_SKETCH" }
- { "type": "CLICK_OK" }
- { "type": "WAIT", "ms": 500 }

Rules:
1. ALWAYS start by creating ALL variables in Variable Studio first
2. Use "#variable_name" syntax to reference variables in dimension/input values
3. Prefer keyboard-based input: use FOCUS_INPUT + TYPE_VALUE + PRESS_KEY where possible
4. Add WAIT actions (300-500ms) after major UI transitions (tab switches, dialog opens)
5. For rectangles, center them at origin unless otherwise specified
6. For a simple box: sketch rectangle on Front plane, extrude with height
7. For a cylinder: sketch circle on Top plane, extrude with height
8. Always FINISH_SKETCH before doing extrude
9. Always CLICK_OK to confirm feature dialogs
10. Keep the sequence minimal but complete

Example for a 100x50x30mm box:
[
  {"type":"CLICK_TAB","tab":"Variable Studio"},
  {"type":"WAIT","ms":500},
  {"type":"CREATE_VARIABLE","name":"box_length","value":"100","unit":"mm"},
  {"type":"WAIT","ms":300},
  {"type":"CREATE_VARIABLE","name":"box_width","value":"50","unit":"mm"},
  {"type":"WAIT","ms":300},
  {"type":"CREATE_VARIABLE","name":"box_height","value":"30","unit":"mm"},
  {"type":"WAIT","ms":300},
  {"type":"CLICK_TAB","tab":"Part Studio 1"},
  {"type":"WAIT","ms":500},
  {"type":"CLICK_BUTTON","button":"Sketch"},
  {"type":"WAIT","ms":500},
  {"type":"SELECT_PLANE","plane":"Front"},
  {"type":"WAIT","ms":500},
  {"type":"CLICK_SKETCH_TOOL","tool":"Rectangle"},
  {"type":"WAIT","ms":300},
  {"type":"DRAW_RECTANGLE","x1":-50,"y1":-25,"x2":50,"y2":25},
  {"type":"WAIT","ms":300},
  {"type":"FINISH_SKETCH"},
  {"type":"WAIT","ms":500},
  {"type":"CLICK_BUTTON","button":"Extrude"},
  {"type":"WAIT","ms":500},
  {"type":"FILL_INPUT","field":"Depth","value":"#box_height"},
  {"type":"WAIT","ms":300},
  {"type":"CLICK_OK"}
]`;

const CLARIFY_SYSTEM_PROMPT = `You are a CAD assistant. Decide if you need more information before generating a plan.

Return ONLY valid JSON with this shape:
{
  "readyToGenerate": boolean,
  "questions": ["short question 1", "short question 2"]
}

Rules:
1. Ask at most 3 short questions.
2. If the request is already clear and buildable, set readyToGenerate=true and return an empty questions array.
3. Focus on missing dimensions, quantities, or feature details that block a correct model.
4. Do not add extra commentary or formatting.`;

const VERIFY_SYSTEM_PROMPT = `You are a CAD quality inspector. Review the request, plan, and screenshots.

Return ONLY valid JSON with this shape:
{
  "satisfied": boolean,
  "issues": ["short issue 1", "short issue 2"],
  "suggestedFixes": [ /* optional UIAction objects */ ]
}

Rules:
1. Be strict: mark satisfied=false if a major feature is missing or proportions look wrong.
2. If satisfied=true, issues must be an empty array.
3. suggestedFixes should be minimal UI actions to correct obvious mistakes.
4. Do not add extra commentary or formatting.`;

// ============================================================================
// AI Service Functions
// ============================================================================

/**
 * Generate a planning document from a natural language description
 */
export async function generatePlanningDocument(
  description: string
): Promise<PlanningDocument> {
  console.log('[AI] Generating planning document for:', description);

  const completion = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: `${PLANNING_SYSTEM_PROMPT}

User request: "${description}"

Generate the planning document JSON:`,
      },
    ],
  });

  const content = completion.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('No text response from AI');
  }

  // Parse JSON from response
  const jsonText = content.trim();
  
  try {
    // Try to extract JSON if wrapped in markdown code blocks
    const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    const cleanJson = jsonMatch ? jsonMatch[1].trim() : jsonText;
    
    const plan = JSON.parse(cleanJson) as PlanningDocument;
    console.log('[AI] Generated plan:', plan);
    return plan;
  } catch (error) {
    console.error('[AI] Failed to parse planning document:', jsonText);
    throw new Error('Failed to parse AI response as JSON');
  }
}

/**
 * Generate UI action sequence from a planning document
 */
export async function generateActionSequence(
  plan: PlanningDocument
): Promise<UIAction[]> {
  console.log('[AI] Generating action sequence for plan:', plan.designIntent);

  const completion = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    max_tokens: 4000,
    messages: [
      {
        role: 'user',
        content: `${ACTION_GENERATION_SYSTEM_PROMPT}

Planning document:
${JSON.stringify(plan, null, 2)}

Generate the UI action sequence JSON array:`,
      },
    ],
  });

  const content = completion.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('No text response from AI');
  }

  // Parse JSON from response
  const jsonText = content.trim();
  
  try {
    // Try to extract JSON if wrapped in markdown code blocks
    const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    const cleanJson = jsonMatch ? jsonMatch[1].trim() : jsonText;
    
    const actions = JSON.parse(cleanJson) as UIAction[];
    console.log('[AI] Generated', actions.length, 'actions');
    return actions;
  } catch (error) {
    console.error('[AI] Failed to parse action sequence:', jsonText);
    throw new Error('Failed to parse AI response as JSON');
  }
}

/**
 * Generate clarifying questions for a description
 */
export async function generateClarifyingQuestions(
  description: string,
  conversation: ChatMessage[] = []
): Promise<{ readyToGenerate: boolean; questions: string[] }> {
  console.log('[AI] Generating clarifying questions for:', description);

  const completion = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    max_tokens: 800,
    messages: [
      {
        role: 'user',
        content: `${CLARIFY_SYSTEM_PROMPT}

User request: "${description}"

Conversation so far:
${JSON.stringify(conversation, null, 2)}

Return the JSON now:`,
      },
    ],
  });

  const content = completion.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('No text response from AI');
  }

  const jsonText = content.trim();

  try {
    const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    const cleanJson = jsonMatch ? jsonMatch[1].trim() : jsonText;
    const parsed = JSON.parse(cleanJson) as { readyToGenerate: boolean; questions: string[] };

    return {
      readyToGenerate: Boolean(parsed.readyToGenerate),
      questions: Array.isArray(parsed.questions) ? parsed.questions : [],
    };
  } catch (error) {
    console.error('[AI] Failed to parse clarifying questions:', jsonText);
    throw new Error('Failed to parse AI response as JSON');
  }
}

/**
 * Verify a part using screenshots and plan context
 */
export async function verifyPart(
  screenshots: string[],
  originalRequest: string,
  plan: PlanningDocument
): Promise<{ satisfied: boolean; issues: string[]; suggestedFixes: UIAction[] }> {
  console.log('[AI] Verifying part with screenshots:', screenshots.length);

  const content: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [
    {
      type: 'text',
      text: `${VERIFY_SYSTEM_PROMPT}

Original request: "${originalRequest}"

Plan:
${JSON.stringify(plan, null, 2)}

Screenshots follow.`,
    },
  ];

  screenshots.forEach((shot) => {
    content.push({
      type: 'image_url',
      image_url: { url: shot },
    });
  });

  const completion = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    max_tokens: 1200,
    messages: [
      {
        role: 'user',
        content: content as unknown as string,
      },
    ],
  });

  const responseContent = completion.choices?.[0]?.message?.content;
  if (!responseContent) {
    throw new Error('No text response from AI');
  }

  const jsonText = responseContent.trim();

  try {
    const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    const cleanJson = jsonMatch ? jsonMatch[1].trim() : jsonText;
    const parsed = JSON.parse(cleanJson) as { satisfied: boolean; issues?: string[]; suggestedFixes?: UIAction[] };

    return {
      satisfied: Boolean(parsed.satisfied),
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      suggestedFixes: Array.isArray(parsed.suggestedFixes) ? parsed.suggestedFixes : [],
    };
  } catch (error) {
    console.error('[AI] Failed to parse verification response:', jsonText);
    throw new Error('Failed to parse AI response as JSON');
  }
}

/**
 * Combined function: Generate both plan and actions in one call
 */
export async function generateFullSequence(
  description: string
): Promise<{ plan: PlanningDocument; actions: UIAction[] }> {
  const plan = await generatePlanningDocument(description);
  const actions = await generateActionSequence(plan);
  return { plan, actions };
}
