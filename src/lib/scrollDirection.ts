// Shared scroll-direction tracker so reveals can play forward (scrolling down)
// or reverse (scrolling up). One global listener, lazily initialized.

let direction: "up" | "down" = "down";
let lastY = 0;
let initialized = false;

function init() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  lastY = window.scrollY;
  window.addEventListener(
    "scroll",
    () => {
      const y = window.scrollY;
      if (Math.abs(y - lastY) > 1) {
        direction = y > lastY ? "down" : "up";
        lastY = y;
      }
    },
    { passive: true }
  );
}

export function getScrollDirection(): "up" | "down" {
  init();
  return direction;
}
