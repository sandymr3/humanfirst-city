// Dictation for the boxes the player types into.
//
// The client asked for voice in the interview, the reviews and the succession
// round. This is browser-native speech-to-text — `SpeechRecognition`, which is
// `webkitSpeechRecognition` everywhere it actually ships — and nothing about it
// reaches the backend. No audio is recorded, stored or uploaded; the browser
// hands back a string and the string goes into the textarea the player was
// already typing into, where they edit it before submitting.
//
// Four rules, and they are the whole design:
//
//  1. It NEVER replaces what the player wrote. A transcript is appended to the
//     end of the draft, so a mis-heard sentence costs a keystroke rather than a
//     paragraph.
//  2. The keyboard always works. Voice is an addition to the box, never a mode
//     the box is put into.
//  3. Unsupported degrades to nothing at all — Firefox has no implementation,
//     and a mic button that does nothing is worse than no mic button.
//  4. Listening is visible. A microphone that might be on is a microphone the
//     player has to think about.

/** The slice of the Web Speech API this uses. The DOM lib does not declare it. */
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  readonly length: number;
  isFinal: boolean;
  [i: number]: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    readonly length: number;
    [i: number]: SpeechRecognitionResultLike;
  };
}
interface SpeechRecognitionErrorEventLike {
  error: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function ctor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Whether dictation is available at all. False on Firefox, and in tests. */
export function speechSupported(): boolean {
  return ctor() !== null;
}

/**
 * Reasons the browser gives for stopping, in words a player can act on.
 *
 * "not-allowed" is the one that matters: the player denied the microphone, and
 * telling them to check their browser settings is the only useful thing to say.
 * Everything else collapses to one line, because the difference between a
 * network error and an audio-capture error is not something they can do
 * anything about.
 */
function reason(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access was declined. You can allow it in your browser settings, or keep typing.";
    case "no-speech":
      return "Nothing was picked up. Try again, or keep typing.";
    default:
      return "Dictation stopped unexpectedly. Your typing is unaffected.";
  }
}

export interface SpeechSession {
  /** Stop listening and release the microphone. Safe to call twice. */
  stop(): void;
}

export interface SpeechHandlers {
  /**
   * Called with each settled phrase, to be APPENDED to the draft. Interim
   * results are not sent here — a box that rewrites itself while someone is
   * still speaking is unreadable, and unusable with a screen reader.
   */
  onPhrase(text: string): void;
  /** Called when listening ends, for any reason including a clean stop. */
  onEnd(message?: string): void;
}

/**
 * Start listening. Returns null when the browser cannot, which is the caller's
 * signal to leave the keyboard path alone and say nothing.
 *
 * `en-US` is deliberate: the Café's content is American English throughout, and
 * a recognizer set to a different variety mis-hears the vocabulary the rubrics
 * are written against.
 */
export function listen(handlers: SpeechHandlers): SpeechSession | null {
  const Recognition = ctor();
  if (!Recognition) return null;

  const rec = new Recognition();
  rec.lang = "en-US";
  rec.continuous = true;
  rec.interimResults = false;

  let done = false;
  const finish = (message?: string) => {
    if (done) return;
    done = true;
    handlers.onEnd(message);
  };

  rec.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const result = e.results[i];
      if (!result?.isFinal) continue;
      const text = result[0]?.transcript?.trim();
      if (text) handlers.onPhrase(text);
    }
  };
  rec.onerror = (e) => {
    // "aborted" is what a deliberate stop() looks like from here, and is not
    // worth telling anyone about.
    finish(e.error === "aborted" ? undefined : reason(e.error));
  };
  rec.onend = () => finish();

  try {
    rec.start();
  } catch {
    // Already running, or blocked before it began. Either way there is nothing
    // listening, and the caller must not be left showing a live microphone.
    finish();
    return null;
  }

  return {
    stop() {
      try {
        rec.stop();
      } catch {
        finish();
      }
    },
  };
}

/**
 * Join a dictated phrase onto an existing draft.
 *
 * Exported because it is the part with a decision in it, and the part worth
 * testing: the phrase goes on the END, separated by a space, and never touches
 * what is already there.
 */
export function appendPhrase(draft: string, phrase: string): string {
  const clean = phrase.trim();
  if (!clean) return draft;
  if (!draft) return clean;
  return /\s$/.test(draft) ? draft + clean : draft + " " + clean;
}
