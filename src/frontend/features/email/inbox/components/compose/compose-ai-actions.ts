import {
  ArrowsInIcon,
  PencilSimpleIcon,
  SmileyIcon,
  SuitcaseSimpleIcon,
  TextAaIcon,
} from "@phosphor-icons/react";
import type { ComponentType } from "react";
import { toast } from "sonner";
import {
  getComposerBody,
  getComposerEditor,
  getComposerSelection,
  plainTextToHtml,
  setComposerBody,
} from "./compose-editor-ref";

export type ComposerAiActionId =
  | "grammar"
  | "improve"
  | "formal"
  | "casual"
  | "shorten";

type ComposerAiActionDefinition = {
  id: ComposerAiActionId;
  label: string;
  icon: ComponentType<{ className?: string }>;
  keywords: string[];
};

type ComposerAiTarget =
  | { kind: "body" }
  | { kind: "selection"; from: number; to: number };

export type ComposerAiReview = {
  action: ComposerAiActionId;
  original: string;
  corrected: string;
  target: ComposerAiTarget;
};

export const COMPOSER_AI_ACTIONS: ComposerAiActionDefinition[] = [
  {
    id: "grammar",
    label: "Fix grammar",
    icon: TextAaIcon,
    keywords: ["grammar", "spelling", "proofread", "fix"],
  },
  {
    id: "improve",
    label: "Improve writing",
    icon: PencilSimpleIcon,
    keywords: ["improve", "better", "enhance", "rewrite"],
  },
  {
    id: "formal",
    label: "Make more formal",
    icon: SuitcaseSimpleIcon,
    keywords: ["formal", "professional", "tone"],
  },
  {
    id: "casual",
    label: "Make more casual",
    icon: SmileyIcon,
    keywords: ["casual", "friendly", "informal", "tone"],
  },
  {
    id: "shorten",
    label: "Make more concise",
    icon: ArrowsInIcon,
    keywords: ["shorten", "concise", "brief", "shorter"],
  },
];

async function grammarCheck(text: string): Promise<string | null> {
  const response = await fetch("/api/ai/grammar-check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) return null;
  const json: { corrected: string } = await response.json();
  return json.corrected;
}

async function rewrite(
  text: string,
  instruction: "improve" | "formal" | "casual" | "shorten",
): Promise<string | null> {
  const response = await fetch("/api/ai/rewrite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, instruction }),
  });
  if (!response.ok) return null;
  const json: { rewritten: string } = await response.json();
  return json.rewritten;
}

function getComposerInput(): { text: string; target: ComposerAiTarget } | null {
  const selection = getComposerSelection();
  const editor = getComposerEditor();

  if (selection && editor) {
    const { from, to } = editor.state.selection;
    return {
      text: selection,
      target: { kind: "selection", from, to },
    };
  }

  const text = getComposerBody();
  if (!text) return null;

  return {
    text,
    target: { kind: "body" },
  };
}

function applyToComposer(result: string | null, target?: ComposerAiTarget) {
  if (result == null) {
    toast.error("AI operation failed");
    return false;
  }

  const editor = getComposerEditor();

  if (target?.kind === "selection" && editor) {
    editor.commands.insertContentAt(
      { from: target.from, to: target.to },
      plainTextToHtml(result),
    );
    editor.commands.focus();
  } else {
    setComposerBody(result);
    editor?.commands.focus();
  }

  return true;
}

export function getComposerAiLabel(action: ComposerAiActionId) {
  const hasSelection = Boolean(getComposerSelection());

  switch (action) {
    case "grammar":
      return "Fix grammar";
    case "improve":
      return hasSelection ? "Improve selection" : "Improve writing";
    case "formal":
      return "Make more formal";
    case "casual":
      return "Make more casual";
    case "shorten":
      return "Make more concise";
  }
}

export async function previewComposerAiAction(
  action: ComposerAiActionId,
): Promise<ComposerAiReview | "no_changes" | false> {
  const input = getComposerInput();
  if (!input?.text.trim()) {
    toast.info("Write something in the composer first");
    return false;
  }

  const text = input.text;
  let result: string | null = null;

  switch (action) {
    case "grammar":
      result = await grammarCheck(text);
      break;
    case "improve":
      result = await rewrite(text, "improve");
      break;
    case "formal":
      result = await rewrite(text, "formal");
      break;
    case "casual":
      result = await rewrite(text, "casual");
      break;
    case "shorten":
      result = await rewrite(text, "shorten");
      break;
  }

  if (result == null) {
    toast.error("AI operation failed");
    return false;
  }

  if (result === text) {
    return "no_changes";
  }

  return {
    action,
    original: text,
    corrected: result,
    target: input.target,
  };
}

export function applyComposerAiReview(review: ComposerAiReview): boolean {
  return applyToComposer(review.corrected, review.target);
}

export async function runComposerAiAction(
  action: ComposerAiActionId,
): Promise<boolean> {
  const review = await previewComposerAiAction(action);
  if (!review || review === "no_changes") {
    if (review === "no_changes") {
      toast.info("No changes suggested");
    }
    return false;
  }

  return applyComposerAiReview(review);
}
