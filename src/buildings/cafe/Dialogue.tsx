import { useState } from "react";
import { useCafeStore, chooseOption, closeConsequence } from "./cafeStore";
import { castById } from "./cast";

/** The only interactive surface in the café: one question, one answer, one consequence. */
export function Dialogue() {
  const dialogue = useCafeStore((s) => s.dialogue);
  const consequence = useCafeStore((s) => s.consequence);
  const [askingAi, setAskingAi] = useState(false);

  if (!dialogue && !consequence) return null;

  const speaker = dialogue && dialogue.speaker !== "room" ? castById(dialogue.speaker as never) : null;

  async function answer(optionId: string) {
    if (!dialogue || askingAi) return;
    setAskingAi(true);
    chooseOption(optionId);
    try {
      const option = dialogue.options.find((item) => item.id === optionId);
      const response = await fetch("/api/v1/ai/consequence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: dialogue.prompt, answer: option?.text ?? optionId }),
      });
      if (response.ok) {
        const data = (await response.json()) as { consequence?: string };
        if (data.consequence) useCafeStore.setState({ consequence: data.consequence });
      }
    } catch {
      // The authored consequence remains visible when AI is unavailable.
    } finally {
      setAskingAi(false);
    }
  }

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 flex justify-center p-4">
      <section role="dialog" aria-label="Blueprint question" aria-live="polite" className="w-[min(38rem,100%)] rounded-2xl border border-line/70 bg-surface/95 p-6 shadow-2xl backdrop-blur animate-slide-up">
        {consequence ? (
          <>
            <p className="text-sm leading-relaxed text-text">{consequence}</p>
            <button onClick={closeConsequence} className="mt-5 w-full rounded-xl border border-line/70 px-4 py-3 text-sm text-text transition hover:border-gold/60">Continue</button>
          </>
        ) : dialogue ? (
          <>
            {dialogue.stage && <p className="mb-4 text-sm leading-relaxed text-muted">{dialogue.stage}</p>}
            <p className="text-sm leading-relaxed text-text">{speaker && <span className="font-semibold text-gold">{speaker.name}: </span>}{speaker ? `“${dialogue.prompt}”` : dialogue.prompt}</p>
            <div className="mt-5 flex flex-col gap-2">
              {dialogue.options.map((option) => <button key={option.id} disabled={askingAi} onClick={() => void answer(option.id)} className="w-full rounded-xl border border-line/70 bg-surface-2/60 px-4 py-3 text-left text-sm leading-relaxed text-text transition hover:border-gold/60 disabled:cursor-wait disabled:opacity-60">{option.text}</button>)}
            </div>
            {askingAi && <p className="mt-4 text-xs text-muted" role="status">Considering the consequence…</p>}
          </>
        ) : null}
      </section>
    </div>
  );
}

export default Dialogue;
