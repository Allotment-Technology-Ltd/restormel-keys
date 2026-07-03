/**
 * Server middleware types. Standard Web API Request/Response; no framework types.
 */

/** Extract user identity from request (e.g. session, JWT). */
export interface Auth {
  getUserId(req: Request): Promise<string | null>;
}
