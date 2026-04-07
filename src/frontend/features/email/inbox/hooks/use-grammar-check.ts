import { useCallback, useState } from "react";

type GrammarCheckState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "reviewing"; original: string; corrected: string }
  | { status: "error"; message: string };

export function useGrammarCheck() {
  const [state, setState] = useState<GrammarCheckState>({ status: "idle" });

  const check = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setState({ status: "loading" });

    try {
      const response = await fetch("/api/ai/grammar-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const json: { error?: string } = await response
          .json()
          .catch(() => ({}));
        setState({
          status: "error",
          message: json.error ?? "Grammar check failed",
        });
        return;
      }

      const json: { corrected: string } = await response.json();
      const corrected = json.corrected;

      if (corrected === text) {
        setState({ status: "idle" });
        return "no_changes";
      }

      setState({ status: "reviewing", original: text, corrected });
    } catch {
      setState({ status: "error", message: "Grammar check failed" });
    }
  }, []);

  const accept = useCallback(() => {
    if (state.status !== "reviewing") return null;
    const { corrected } = state;
    setState({ status: "idle" });
    return corrected;
  }, [state]);

  const discard = useCallback(() => {
    setState({ status: "idle" });
  }, []);

  return { state, check, accept, discard };
}
