import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { EmailThreadItem } from "@/features/email/mail/types";
import { formatEmailDetailDate } from "@/features/email/mail/utils/formatters";
import { CaretDownIcon } from "@phosphor-icons/react";

type Row = { label: string; value: string };

function buildRows(email: EmailThreadItem): Row[] {
  const rows: Row[] = [];
  rows.push({
    label: "From",
    value: email.fromName
      ? `${email.fromName} <${email.fromAddr}>`
      : email.fromAddr,
  });
  if (email.toAddr) rows.push({ label: "To", value: email.toAddr });
  if (email.ccAddr) rows.push({ label: "Cc", value: email.ccAddr });
  rows.push({ label: "Date", value: formatEmailDetailDate(email.date) });
  if (email.subject) rows.push({ label: "Subject", value: email.subject });
  return rows;
}

export function EmailHeaderDetails({ email }: { email: EmailThreadItem }) {
  const rows = buildRows(email);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex shrink-0 items-center text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Show details"
        >
          <CaretDownIcon className="size-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        className="w-auto max-w-[min(32rem,calc(100vw-2rem))] gap-0 p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 p-3">
          {rows.map((row) => (
            <div key={row.label} className="contents">
              <dt className="whitespace-nowrap text-right text-muted-foreground">
                {row.label.toLowerCase()}:
              </dt>
              <dd className="min-w-0 break-words text-foreground">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </PopoverContent>
    </Popover>
  );
}
