/**
 * Red asterisk that marks a required form field. Kept as a single component so
 * the "* = required" affordance renders identically across every form. Hidden
 * from assistive tech — the input's own validation message carries the meaning
 * for screen readers.
 */
export function RequiredMark() {
  return (
    <span className="ml-0.5 text-red-500" aria-hidden="true">
      *
    </span>
  );
}
