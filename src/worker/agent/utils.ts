import { makeMemoryTools } from "./tools/memory-tools";
import { makeReadTools } from "./tools/read-tools";
import { makeWriteTools } from "./tools/write-tools";

export type AgentTools = ReturnType<typeof makeReadTools> &
  ReturnType<typeof makeWriteTools> &
  ReturnType<typeof makeMemoryTools>;

export function safeSerialize(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
