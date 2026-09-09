// The microphone that sits beside a text box.
//
// One component, used by the interview (`QA.tsx`), the scenario scenes and the
// succession round, because those are three places the player writes and they
// must not behave differently. See `lib/speech.ts` for the rules it enforces —
// the short version is that this only ever ADDS to what is in the box.
//
// It renders nothing at all where the browser has no speech recognition. A mic
// that cannot listen is worse than no mic: the player asks it for something and
// it declines silently.
import { useEffect, useRef, useState } from "react";
import { appendPhrase, listen, speechSupported, type SpeechSession } from "@/lib/speech";

export interface DictationProps {
  /** The draft as it stands. */
  value: string;
  /** Called with the draft plus whatever was just heard. */
  onChange(next: string): void;
  /** Named for the screen reader, e.g. "your answer". */
  label?: string;
}

export function Dictation({ value, onChange, label = "your answer" }: DictationProps) {
  const [listening, setListening] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const session = useRef<SpeechSession | null>(null);

  // The draft changes while the microphone is open — the player keeps typing,
  // and each phrase lands on top of the last. A ref keeps the callback reading
  // the current draft without restarting recognition on every keystroke.
  const latest = useRef(value);
  latest.current = value;

  // A microphone that outlives the panel it belongs to is the worst version of
  // this bug, so unmount releases it unconditionally.
  useEffect(() => () => session.current?.stop(), []);

  if (!speechSupported()) return null;

  const stop = () => {
    session.current?.stop();
    session.current = null;
    setListening(false);
  };

  const start = () => {
    setNote(null);
    const s = listen({
      onPhrase: (phrase) => {
        const next = appendPhrase(latest.current, phrase);
        latest.current = next;
        onChange(next);
      },
      onEnd: (message) => {
        session.current = null;
        setListening(false);
        if (message) setNote(message);
      },
    });
    if (!s) {
      setNote("Dictation could not start. Keep typing.");
      return;
    }
    session.current = s;
    setListening(true);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={listening ? stop : start}
        aria-pressed={listening}
        aria-label={listening ? `Stop dictating ${label}` : `Dictate ${label}`}
        className={[
          "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition",
          listening
            ? "border-gold/60 bg-gold/15 text-gold"
            : "border-line/70 bg-surface-2/40 text-muted hover:border-gold/40 hover:text-text",
        ].join(" ")}
      >
        <MicGlyph live={listening} />
        {listening ? "Listening" : "Speak"}
      </button>
      {/*
        Polite, not assertive: this is a status the player may want, never an
        interruption of the question they are answering.
      */}
      <p role="status" aria-live="polite" className="text-[11px] leading-tight text-muted">
        {listening ? "Speak; it will be added to your answer." : (note ?? "")}
      </p>
    </div>
  );
}

function MicGlyph({ live }: { live: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" fill="currentColor">
      <rect x="6" y="2" width="4" height="7.5" rx="2" />
      <path
        d="M4 7.5a4 4 0 0 0 8 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path d="M8 11.5V14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      {/*
        The pulse is the only "is it on" signal that survives being glanced at,
        so it is drawn rather than animated in CSS the panel might override.
      */}
      {live && <circle cx="8" cy="5.5" r="5.5" fill="currentColor" opacity="0.18" />}
    </svg>
  );
}
