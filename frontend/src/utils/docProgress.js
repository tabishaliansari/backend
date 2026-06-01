/**
 * Shared utility for documentation generation progress stages.
 * Maps progress percentage to a human-readable stage description.
 */
export function getProgressStage(percent) {
  if (percent <= 5) return 'Loading source record...'
  if (percent <= 15) return 'Resolving vector collection & graph index...'
  if (percent <= 20) return 'Starting documentation agent...'
  if (percent <= 60) return 'Agent analyzing codebase (LLM)...'
  if (percent <= 85) return 'Validating and formatting output...'
  if (percent <= 95) return 'Saving document to database...'
  return 'Generation complete!'
}
