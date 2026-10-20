/**
 * The desktop rail (`[data-rail]`) rests narrow and opens over the page on
 * hover. One timing drives everything that moves with its edge, so the edge,
 * its shadow and the project list stay in lockstep: a short wait before
 * opening (so a passing cursor doesn't flash it), a longer one before closing
 * (so slipping off the edge forgives you), and closing quicker than opening.
 */
export const RAIL_MOTION = "duration-200 delay-150 ease-spring rail-open:duration-300 rail-open:delay-100 motion-reduce:transition-none";

/**
 * Text inside the rail. Icons never move; text glides in once the rail has
 * room and is gone the moment it starts to close, so it is never seen being
 * cut off.
 */
export const RAIL_TEXT = "whitespace-nowrap opacity-0 -translate-x-1 transition-[opacity,translate] duration-75 delay-150 ease-out rail-open:translate-x-0 rail-open:opacity-100 rail-open:duration-200 rail-open:delay-200 motion-reduce:transition-none";

/** Shown only while the rail is narrow: the unread dot on an icon. */
export const RAIL_DOT = "absolute top-1.5 left-6.5 size-2 rounded-full bg-brand-bright ring-2 ring-rail rail-open:hidden";
