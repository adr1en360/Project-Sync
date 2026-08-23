/**
 * A switch where the state is the control.
 *
 * The old arrangement showed the state three times: a pill that said ON, a
 * button that said "Turn off", and a second button beside it. A person had to
 * read all three to learn one fact. This is one object. The knob is on the right
 * when the thing is on and on the left when it is off, and the press moves it.
 *
 * The state does not ride on the colour. The knob moves, which is a position, and
 * the name of the control says the state in words. So the switch answers WCAG
 * 1.4.1 with two channels that are not colour.
 *
 * It takes `role="switch"` and `aria-checked`, which is the pair a browser and a
 * screen reader already know. `Switch.tsx` beside this one is a different object:
 * it is a button with a word, for a choice that shows more of a screen.
 */

type Props = {
  on: boolean;
  /** True while the service is writing the change. */
  busy?: boolean;
  /** What the control does, in words. It is the name of the control. */
  label: string;
  onToggle: () => void;
};

export function Toggle({ on, busy = false, label, onToggle }: Props) {
  return (
    <button
      type="button"
      className="toggle"
      role="switch"
      aria-checked={on}
      aria-busy={busy || undefined}
      aria-label={label}
      title={label}
      onClick={onToggle}
    />
  );
}
