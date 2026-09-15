/**
 * Tracks whether a two-finger pinch is happening.
 *
 * A pinch ends with both fingers lifting off the globe, which the browser
 * reports as an ordinary click — enough to make the globe picker drop a pin
 * the user never asked for. The camera rig marks the gesture here and the
 * picker ignores clicks that land inside (or just after) it.
 */

let active = false;
let endedAt = 0;

/** Grace period covering the synthetic click that follows the last touchend. */
const TAIL_MS = 400;

export function beginPinch() {
  active = true;
}

export function endPinch() {
  active = false;
  endedAt = performance.now();
}

export function pinchInProgress() {
  return active || performance.now() - endedAt < TAIL_MS;
}
