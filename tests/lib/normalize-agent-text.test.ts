import { describe, expect, it } from "vitest";
import { normalizeAgentText } from "../../src/frontend/lib/normalize-agent-text";

describe("normalizeAgentText", () => {
  it("collapses an assistant reply duplicated end to end", () => {
    const reply = `Here’s a simple reply you can send:

Subject: Re: [Checkly] Your Checkly checks have reached 100% of the free quota

Thanks for the update. I’ll review the account usage and take the necessary action.

Best, Franco`;

    expect(normalizeAgentText(`${reply}\n\n${reply}`)).toBe(reply);
  });

  it("leaves normal non-duplicated text untouched", () => {
    const text = `Here’s a simple reply you can send:

Subject: Re: Quick follow-up

Thanks for the update. I’ll take a look this afternoon.

Best,
Franco`;

    expect(normalizeAgentText(text)).toBe(text);
  });
});
