import { openCompose } from "@/features/email/mail/compose/compose-events";
import { ArrowBendUpLeftIcon, PencilSimpleIcon } from "@phosphor-icons/react";
import { paletteIcon } from "../registry/palette-icon";
import { registerCommands } from "../registry/registry";
import type { Command } from "../registry/types";

const composeCommands: Command[] = [
 {
 id: "compose:new",
 label: "Compose new email",
 icon: paletteIcon(PencilSimpleIcon),
 group: "email",
 shortcut: "C",
 keywords: ["compose", "write", "new", "draft", "send"],
 when: (ctx) => ctx.defaultMailboxId != null && !ctx.composerOpen,
 perform: (ctx, services) => {
 openCompose({ mailboxId: ctx.defaultMailboxId ?? undefined });
 services.close();
 },
 },
 {
 id: "compose:feedback",
 label: "Send feedback",
 icon: paletteIcon(PencilSimpleIcon),
 group: "email",
 keywords: ["feedback", "bug", "support", "franco"],
 when: (ctx) => ctx.defaultMailboxId != null && !ctx.composerOpen,
 perform: (ctx, services) => {
 openCompose({
 mailboxId: ctx.defaultMailboxId ?? undefined,
 to: "francocanzani@gmail.com",
 subject: "Feedback",
 });
 services.close();
 },
 },
 {
 id: "compose:reply",
 label: "Reply to email",
 icon: paletteIcon(ArrowBendUpLeftIcon),
 group: "email",
 keywords: ["reply", "respond", "answer"],
 when: (ctx) => ctx.selectedEmail !== null,
 perform: (ctx, services) => {
 const email = ctx.selectedEmail;
 if (!email) return;
 openCompose({
 mailboxId: email.mailboxId ?? ctx.defaultMailboxId ?? undefined,
 to: email.fromAddr,
 subject: email.subject ? `Re: ${email.subject.replace(/^(Re:\s*)+/i, "")}` : undefined,
 threadId: email.threadId ?? undefined,
 });
 services.close();
 },
 },
];

registerCommands(composeCommands);
