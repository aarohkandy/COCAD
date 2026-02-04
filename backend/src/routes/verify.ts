import { Router, Request, Response } from 'express';
import { verifyPart } from '../services/ai-service.js';
import type { PlanningDocument } from '../services/types.js';

export const verifyRouter = Router();

interface VerifyRequest {
  screenshots: string[];
  originalRequest: string;
  plan: PlanningDocument;
}

/**
 * POST /api/verify
 * Verify a generated part using screenshots and the plan
 */
verifyRouter.post('/', async (req: Request<{}, {}, VerifyRequest>, res: Response) => {
  try {
    const { screenshots, originalRequest, plan } = req.body;

    if (!originalRequest || typeof originalRequest !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid originalRequest',
        message: 'Please provide the original request text',
      });
    }

    if (!plan || typeof plan !== 'object') {
      return res.status(400).json({
        error: 'Missing or invalid plan',
        message: 'Please provide a valid planning document',
      });
    }

    if (!Array.isArray(screenshots) || screenshots.length === 0) {
      return res.status(400).json({
        error: 'Missing or invalid screenshots',
        message: 'Please provide an array of screenshots',
      });
    }

    console.log(`[Verify] Verifying with ${screenshots.length} screenshots`);

    const result = await verifyPart(screenshots, originalRequest, plan);

    res.json({
      success: true,
      satisfied: result.satisfied,
      issues: result.issues,
      suggestedFixes: result.suggestedFixes,
    });
  } catch (error) {
    console.error('[Verify] Error:', error);

    const message = error instanceof Error ? error.message : 'Unknown error';

    res.status(500).json({
      error: 'Failed to verify part',
      message,
    });
  }
});
