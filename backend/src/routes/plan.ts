import { Router, Request, Response } from 'express';
import { generatePlanningDocument } from '../services/ai-service.js';

export const planRouter = Router();

interface PlanRequest {
  description: string;
}

/**
 * POST /api/plan
 * Generate a planning document from a natural language description
 */
planRouter.post('/', async (req: Request<{}, {}, PlanRequest>, res: Response) => {
  try {
    const { description } = req.body;

    if (!description || typeof description !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid description',
        message: 'Please provide a description of the part you want to create',
      });
    }

    if (description.length < 5) {
      return res.status(400).json({
        error: 'Description too short',
        message: 'Please provide a more detailed description',
      });
    }

    if (description.length > 2000) {
      return res.status(400).json({
        error: 'Description too long',
        message: 'Please keep the description under 2000 characters',
      });
    }

    console.log(`[Plan] Generating plan for: "${description.slice(0, 50)}..."`);

    const plan = await generatePlanningDocument(description);

    res.json({
      success: true,
      plan,
    });
  } catch (error) {
    console.error('[Plan] Error:', error);
    
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    // Check for API key issues
    if (message.includes('API key') || message.includes('authentication')) {
      return res.status(500).json({
        error: 'AI service configuration error',
        message: 'The AI service is not properly configured. Please check the API key.',
      });
    }

    res.status(500).json({
      error: 'Failed to generate plan',
      message,
    });
  }
});

/**
 * GET /api/plan/test
 * Test endpoint that returns a sample plan without calling AI
 */
planRouter.get('/test', (req: Request, res: Response) => {
  res.json({
    success: true,
    plan: {
      designIntent: 'A simple rectangular box for testing',
      overallForm: 'box',
      keyDimensions: [
        { name: 'box_length', value: 100, unit: 'mm', purpose: 'Length of the box' },
        { name: 'box_width', value: 50, unit: 'mm', purpose: 'Width of the box' },
        { name: 'box_height', value: 30, unit: 'mm', purpose: 'Height of the box' },
      ],
      majorFeatures: [
        { type: 'base_shape', quantity: 1, purpose: 'Main rectangular body' },
      ],
      materials: 'Aluminum 6061',
      tolerances: 'Standard machining tolerances',
    },
  });
});
