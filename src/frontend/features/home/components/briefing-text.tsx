import { parseBriefingSegments } from "@/features/home/utils";
import { useNavigate } from "@tanstack/react-router";

export function BriefingText({
  text,
  animate = false,
}: {
  text: string;
  animate?: boolean;
}) {
  const navigate = useNavigate();
  const segments = parseBriefingSegments(text);

  const tokens: { key: number; node: React.ReactNode }[] = [];
  let tokenIndex = 0;

  for (const segment of segments) {
    if (segment.type === "link") {
      const href = segment.href;
      tokens.push({
        key: tokenIndex++,
        node: (
          <a
            href={href}
            onClick={(e) => {
              e.preventDefault();
              navigate({ to: href });
            }}
            className="text-foreground underline decoration-foreground/30 underline-offset-2 transition-colors hover:decoration-foreground/60"
          >
            {segment.title}
          </a>
        ),
      });
    } else {
      // Keep standalone whitespace tokens so spaces around streamed links survive.
      const tokensWithWhitespace = segment.value.match(/\s+|\S+\s*/g) || [];
      for (const word of tokensWithWhitespace) {
        tokens.push({
          key: tokenIndex++,
          node: word,
        });
      }
    }
  }

  return (
    <p className="text-pretty text-sm leading-loose text-muted-foreground">
      {tokens.map(({ key, node }) => (
        <span
          key={key}
          className={animate ? "animate-briefing-fade-in" : undefined}
          style={animate ? { animationDelay: `${key * 30}ms` } : undefined}
        >
          {node}
        </span>
      ))}
    </p>
  );
}
