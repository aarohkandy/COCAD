import { waitForAnyElement, sleep } from './waiter';
import { CANVAS } from './selectors';

const PIXELS_PER_DEGREE = 2;

async function getViewportCanvas(): Promise<HTMLCanvasElement> {
  const element = await waitForAnyElement(CANVAS.VIEWPORT.concat(CANVAS.SKETCH_CANVAS), { timeout: 5000 });
  if (element instanceof HTMLCanvasElement) {
    return element;
  }
  throw new Error('Viewport canvas not found');
}

/**
 * Rotate the viewport by drag simulation.
 * angleH: horizontal rotation in degrees (positive = drag right)
 * angleV: vertical rotation in degrees (positive = drag up)
 */
export async function rotateViewport(angleH: number, angleV: number): Promise<void> {
  const canvas = await getViewportCanvas();
  const rect = canvas.getBoundingClientRect();
  const startX = rect.left + rect.width * 0.5;
  const startY = rect.top + rect.height * 0.5;

  const endX = startX + angleH * PIXELS_PER_DEGREE;
  const endY = startY - angleV * PIXELS_PER_DEGREE;

  canvas.dispatchEvent(new MouseEvent('mousedown', {
    bubbles: true,
    cancelable: true,
    clientX: startX,
    clientY: startY,
    button: 0,
  }));
  await sleep(50);
  canvas.dispatchEvent(new MouseEvent('mousemove', {
    bubbles: true,
    cancelable: true,
    clientX: endX,
    clientY: endY,
    button: 0,
  }));
  await sleep(50);
  canvas.dispatchEvent(new MouseEvent('mouseup', {
    bubbles: true,
    cancelable: true,
    clientX: endX,
    clientY: endY,
    button: 0,
  }));

  await sleep(200);
}

/**
 * Capture the viewport canvas as base64 PNG.
 */
export async function captureViewportScreenshot(): Promise<string> {
  const canvas = await getViewportCanvas();
  await sleep(200);
  return canvas.toDataURL('image/png');
}

/**
 * Capture 8 angles: 4 from top tilt, 4 from bottom tilt.
 */
export async function capture8Angles(): Promise<string[]> {
  const screenshots: string[] = [];

  // Top tilt
  await rotateViewport(0, 20);
  for (let i = 0; i < 4; i += 1) {
    screenshots.push(await captureViewportScreenshot());
    await rotateViewport(90, 0);
  }

  // Bottom tilt (invert from top)
  await rotateViewport(0, -40);
  for (let i = 0; i < 4; i += 1) {
    screenshots.push(await captureViewportScreenshot());
    await rotateViewport(90, 0);
  }

  return screenshots;
}
