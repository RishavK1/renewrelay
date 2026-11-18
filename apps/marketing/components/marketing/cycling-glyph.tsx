import { CalendarDays, CalendarClock, Clock3, MessageSquare, MessagesSquare, Mail, CircleCheck, ListChecks, CheckCheck } from "lucide-react";

const glyphs = {
  renewal: [CalendarDays, CalendarClock, Clock3],
  decision: [MessageSquare, MessagesSquare, Mail],
  progress: [CircleCheck, ListChecks, CheckCheck],
} as const;

/** Decorative changes keep a fixed footprint, leaving the headline readable and still. */
export function CyclingGlyph({ kind }: { kind: keyof typeof glyphs }) {
  return (
    <span className={`hero-glyph hero-glyph--${kind}`} aria-hidden="true">
      {glyphs[kind].map((Icon, index) => (
        <span className={`hero-glyph__frame hero-glyph__frame--${index}`} key={index}>
          <Icon strokeWidth={1.9} />
        </span>
      ))}
    </span>
  );
}
