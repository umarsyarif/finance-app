// Native-app feel: no pinch zoom. iOS Safari ignores `user-scalable=no` in the viewport meta, so its
// pinch gestures and two-finger moves are cancelled here. One-finger scrolling and swipes are untouched.
export function preventZoom(target: Document = document): () => void {
  const cancel = (e: Event) => e.preventDefault();
  const cancelMultiTouch = (e: Event) => {
    if ((e as TouchEvent).touches.length > 1) e.preventDefault();
  };
  // passive: false, or the browser ignores preventDefault on touchmove
  target.addEventListener('gesturestart', cancel, { passive: false });
  target.addEventListener('gesturechange', cancel, { passive: false });
  target.addEventListener('touchmove', cancelMultiTouch, { passive: false });
  return () => {
    target.removeEventListener('gesturestart', cancel);
    target.removeEventListener('gesturechange', cancel);
    target.removeEventListener('touchmove', cancelMultiTouch);
  };
}
