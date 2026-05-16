import { useMemo } from "react";
import { buildHighlightRegex } from "@/features/email/mail/search/highlight-terms";

export function HighlightedText({
 text,
 terms,
}: {
 text: string;
 terms: string[];
}) {
 const segments = useMemo(() => {
 const regex = buildHighlightRegex(terms);
 if (!regex) return [{ text, match: false }];

 const parts: { text: string; match: boolean }[] = [];
 let lastIndex = 0;
 let match: RegExpExecArray | null;
 while ((match = regex.exec(text)) !== null) {
 if (match.index > lastIndex) {
 parts.push({ text: text.slice(lastIndex, match.index), match: false });
 }
 parts.push({ text: match[0], match: true });
 lastIndex = match.index + match[0].length;
 if (match.index === regex.lastIndex) regex.lastIndex += 1;
 }
 if (lastIndex < text.length) {
 parts.push({ text: text.slice(lastIndex), match: false });
 }
 return parts;
 }, [text, terms]);

 return (
 <>
 {segments.map((segment, index) =>
 segment.match ? (
 <mark
 key={index}
 className="bg-yellow-100 px-0.5 text-foreground dark:bg-yellow-900"
 >
 {segment.text}
 </mark>
 ) : (
 <span key={index}>{segment.text}</span>
 ),
 )}
 </>
 );
}
