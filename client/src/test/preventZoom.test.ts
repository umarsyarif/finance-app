import { describe, it, expect, afterEach } from 'vitest';
import { preventZoom } from '@/lib/prevent-zoom';

const touchMove = (fingers: number) => {
  const event = new Event('touchmove', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'touches', { value: Array.from({ length: fingers }, () => ({})) });
  document.body.dispatchEvent(event);
  return event;
};

describe('preventZoom', () => {
  let stop: () => void = () => {};
  afterEach(() => stop());

  it('cancels two-finger moves and iOS pinch gestures', () => {
    stop = preventZoom(document);
    expect(touchMove(2).defaultPrevented).toBe(true);
    for (const type of ['gesturestart', 'gesturechange']) {
      const gesture = new Event(type, { bubbles: true, cancelable: true });
      document.body.dispatchEvent(gesture);
      expect(gesture.defaultPrevented).toBe(true);
    }
  });

  it('leaves one-finger moves alone (scrolling, card swipes, pull-to-refresh)', () => {
    stop = preventZoom(document);
    expect(touchMove(1).defaultPrevented).toBe(false);
  });

  it('stops cancelling once cleaned up', () => {
    preventZoom(document)();
    expect(touchMove(2).defaultPrevented).toBe(false);
  });
});
