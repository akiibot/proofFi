import type { components } from '@/lib/schema';

export type OptimizerResult = components['schemas']['OptimizerResult'];
export type PlanResponse = components['schemas']['PlanResponse'];
export type ParsedIntent = components['schemas']['ParsedIntent'];
export type VerificationResult = components['schemas']['VerificationResult'];

/** How the planner that produced the suggestions is described to a person. */
export const MODE_LABEL: Record<PlanResponse['mode'], string> = { live_llm: 'Live AI planner', deterministic_demo: 'Deterministic demo planner' };
