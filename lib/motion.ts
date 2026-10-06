/**
 * The house spring: critically damped (no overshoot), Apple's 0.4s response.
 * Springs start from the on-screen value, so any motion using it can be
 * interrupted and reversed mid-flight.
 */
export const SPRING = { type: "spring", bounce: 0, duration: 0.4 } as const;
