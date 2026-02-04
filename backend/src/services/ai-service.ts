import Anthropic from '@anthropic-ai/sdk';
import type { PlanningDocument, UIAction } from './types.js';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
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
- { "type": "FINISH_SKETCH" }
- { "type": "CLICK_OK" }
- { "type": "WAIT", "ms": 500 }

Rules:
1. ALWAYS start by creating ALL variables in Variable Studio first
2. Use "#variable_name" syntax to reference variables in dimension/input values
3. Add WAIT actions (300-500ms) after major UI transitions (tab switches, dialog opens)
4. For rectangles, center them at origin unless otherwise specified
5. For a simple box: sketch rectangle on Front plane, extrude with height
6. For a cylinder: sketch circle on Top plane, extrude with height
7. Always FINISH_SKETCH before doing extrude
8. Always CLICK_OK to confirm feature dialogs
9. Keep the sequence minimal but complete

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

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
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

  // Extract text content
  const textContent = message.content.find((c) => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from AI');
  }

  // Parse JSON from response
  const jsonText = textContent.text.trim();
  
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

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
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

  // Extract text content
  const textContent = message.content.find((c) => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from AI');
  }

  // Parse JSON from response
  const jsonText = textContent.text.trim();
  
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
 * Combined function: Generate both plan and actions in one call
 */
export async function generateFullSequence(
  description: string
): Promise<{ plan: PlanningDocument; actions: UIAction[] }> {
  const plan = await generatePlanningDocument(description);
  const actions = await generateActionSequence(plan);
  return { plan, actions };
}
