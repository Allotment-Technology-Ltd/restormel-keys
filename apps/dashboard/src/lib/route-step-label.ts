/**
 * Route step display label (flow map + inspector). Short cap keeps fixed-height map tiles readable.
 * Keep in sync with API validation on step PATCH/POST.
 */
export const ROUTE_STEP_LABEL_MAX_LENGTH = 48;

export function clampRouteStepLabel(raw: string): string {
  return raw.trim().slice(0, ROUTE_STEP_LABEL_MAX_LENGTH);
}
