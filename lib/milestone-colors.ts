/**
 * Each milestone's colour, by its place in date order: the eight chart series
 * in their validated order. Identity only: done, late and missed are said in
 * words and icons, never by this colour.
 */
export const milestoneColor = (index: number) => `var(--series-${(index % 8) + 1})`;
