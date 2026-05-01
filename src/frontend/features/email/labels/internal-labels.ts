export const TODO_LABEL_NAME = "Duomo/To do";

export function isInternalLabelName(name: string): boolean {
  return name.trim().toLowerCase() === TODO_LABEL_NAME.toLowerCase();
}
