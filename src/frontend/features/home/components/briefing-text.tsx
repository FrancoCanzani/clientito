export function BriefingText({
  text,
}: {
  text: string;
}) {
  return (
    <p className="text-pretty whitespace-pre-wrap text-sm leading-loose text-muted-foreground">
      {text}
    </p>
  );
}
