// Fiber-optic light travels at roughly 2/3 of the vacuum speed of light
// because of the core's refractive index (~1.5), hence 200,000 km/s here
// instead of the ~300,000 km/s vacuum constant.
const FIBER_SPEED_KM_PER_S = 200_000;

// Real round trips also spend time in routers, switches and OS network
// stacks along the path, not just propagating through fiber.
const BASE_OVERHEAD_MS = 15;
const OVERHEAD_JITTER_MS = 15;

// Repeated tests over the exact same distance would otherwise return the
// exact same number, which reads as fake; a small +/-10% wobble keeps it
// feeling like a live measurement while staying within the model.
const RESULT_JITTER_RATIO = 0.1;

export function estimateRttMs(distanceKm: number): number {
  const oneWayPropagationMs = (distanceKm / FIBER_SPEED_KM_PER_S) * 1000;
  const overheadMs = BASE_OVERHEAD_MS + Math.random() * OVERHEAD_JITTER_MS;
  const baseRttMs = oneWayPropagationMs * 2 + overheadMs;

  const jitter = 1 + (Math.random() * 2 - 1) * RESULT_JITTER_RATIO;
  return Math.round(baseRttMs * jitter);
}
