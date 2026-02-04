import { Router, Request, Response } from 'express';
import { generateActionSequence } from '../services/ai-service.js';
import type { PlanningDocument } from '../services/types.js';

export const actionsRouter = Router();

interface ActionsRequest {
  plan: PlanningDocument;
}

/**
 * POST /api/actions
 * Generate UI action sequence from a planning document
 */
actionsRouter.post('/', async (req: Request<{}, {}, ActionsRequest>, res: Response) => {
  try {
    const { plan } = req.body;

    if (!plan || typeof plan !== 'object') {
      return res.status(400).json({
        error: 'Missing or invalid plan',
        message: 'Please provide a valid planning document',
      });
    }

    if (!plan.keyDimensions || !Array.isArray(plan.keyDimensions)) {
      return res.status(400).json({
        error: 'Invalid plan structure',
        message: 'Plan must include keyDimensions array',
      });
    }

    console.log(`[Actions] Generating actions for: "${plan.designIntent?.slice(0, 50)}..."`);

    const actions = await generateActionSequence(plan);

    res.json({
      success: true,
      actions,
      actionCount: actions.length,
    });
  } catch (error) {
    console.error('[Actions] Error:', error);
    
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    res.status(500).json({
      error: 'Failed to generate actions',
      message,
    });
  }
});

/**
 * GET /api/actions/test
 * Test endpoint that returns sample actions without calling AI
 */
actionsRouter.get('/test', (req: Request, res: Response) => {
  res.json({
    success: true,
    actions: [
      { type: 'CLICK_TAB', tab: 'Variable Studio' },
      { type: 'WAIT', ms: 500 },
      { type: 'CREATE_VARIABLE', name: 'box_length', value: '100', unit: 'mm' },
      { type: 'WAIT', ms: 300 },
      { type: 'CREATE_VARIABLE', name: 'box_width', value: '50', unit: 'mm' },
      { type: 'WAIT', ms: 300 },
      { type: 'CREATE_VARIABLE', name: 'box_height', value: '30', unit: 'mm' },
      { type: 'WAIT', ms: 300 },
      { type: 'CLICK_TAB', tab: 'Part Studio 1' },
      { type: 'WAIT', ms: 500 },
      { type: 'CLICK_BUTTON', button: 'Sketch' },
      { type: 'WAIT', ms: 500 },
      { type: 'SELECT_PLANE', plane: 'Front' },
      { type: 'WAIT', ms: 500 },
      { type: 'CLICK_SKETCH_TOOL', tool: 'Rectangle' },
      { type: 'WAIT', ms: 300 },
      { type: 'DRAW_RECTANGLE', x1: -50, y1: -25, x2: 50, y2: 25 },
      { type: 'WAIT', ms: 300 },
      { type: 'FINISH_SKETCH' },
      { type: 'WAIT', ms: 500 },
      { type: 'CLICK_BUTTON', button: 'Extrude' },
      { type: 'WAIT', ms: 500 },
      { type: 'FILL_INPUT', field: 'Depth', value: '#box_height' },
      { type: 'WAIT', ms: 300 },
      { type: 'CLICK_OK' },
    ],
    actionCount: 23,
  });
});
