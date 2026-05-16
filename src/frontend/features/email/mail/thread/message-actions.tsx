import type { EmailThreadItem } from "@/features/email/mail/shared/types";
import {
 ArrowBendDoubleUpLeftIcon,
 ArrowBendUpLeftIcon,
 ArrowBendUpRightIcon,
} from "@phosphor-icons/react";

type Props = {
 message: EmailThreadItem;
 onReply: (message: EmailThreadItem) => void;
 onReplyAll: (message: EmailThreadItem) => void;
 onForward: (message: EmailThreadItem) => void;
};

export function MessageActions({
 message,
 onReply,
 onReplyAll,
 onForward,
}: Props) {
 return (
 <div className="flex items-center gap-1 border-t border-border/40 px-3 py-1.5">
 <ActionButton
 label="Reply"
 onClick={() => onReply(message)}
 icon={<ArrowBendUpLeftIcon className="size-3.5" />}
 />
 <ActionButton
 label="Reply all"
 onClick={() => onReplyAll(message)}
 icon={<ArrowBendDoubleUpLeftIcon className="size-3.5" />}
 />
 <ActionButton
 label="Forward"
 onClick={() => onForward(message)}
 icon={<ArrowBendUpRightIcon className="size-3.5" />}
 />
 </div>
 );
}

function ActionButton({
 label,
 onClick,
 icon,
}: {
 label: string;
 onClick: () => void;
 icon: React.ReactNode;
}) {
 return (
 <button
 type="button"
 onClick={(e) => {
 e.stopPropagation();
 onClick();
 }}
 className="inline-flex items-center gap-1 px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
 >
 {icon}
 <span>{label}</span>
 </button>
 );
}
