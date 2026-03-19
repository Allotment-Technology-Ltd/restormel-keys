export type AAIFTask = "chat" | "completion" | "embedding";

export type AAIFLatency = "low" | "balanced" | "high";

export type AAIFConstraints = {
  maxCost?: number;
  latency?: AAIFLatency;
};

export type AAIFUser = {
  id: string;
  plan?: string;
};

export type AAIFRequest = {
  input: string;
  task?: AAIFTask;
  constraints?: AAIFConstraints;
  user?: AAIFUser;
};

export type AAIFRouting = {
  reason: string;
};

export type AAIFResponse = {
  output: string;
  provider: string;
  model: string;
  cost: number;
  routing: AAIFRouting;
};
