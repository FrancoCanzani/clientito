import { parseBriefingSegments } from "@/features/home/utils";
import { useNavigate } from "@tanstack/react-router";
import { LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";

export function BriefingText({
  text,
  animate = false,
}: {
  text: string;
  animate?: boolean;
}) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const segments = parseBriefingSegments(text);

  const tokens: { key: number; node: React.ReactNode }[] = [];
  let tokenIndex = 0;

  for (const segment of segments) {
    if (segment.type === "link") {
      const href = segment.href;
      tokens.push({
        key: tokenIndex++,
        node: (
          <button
            type="button"
            onClick={() => navigate({ to: href })}
            className="inline cursor-pointer bg-transparent p-0 text-foreground underline decoration-foreground/30 underline-offset-2 transition-colors hover:decoration-foreground/60"
          >
            {segment.title}
          </button>
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

  if (!animate || reduceMotion) {
    return (
      <p className="text-pretty text-sm leading-loose text-muted-foreground">
        {tokens.map(({ key, node }) => (
          <span key={key}>{node}</span>
        ))}
      </p>
    );
  }

  return (
    <LazyMotion features={domAnimation}>
      <p className="text-pretty text-sm leading-loose text-muted-foreground">
        {tokens.map(({ key, node }) => (
          <m.span
            key={key}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{
              duration: 0.18,
              delay: key * 0.02,
              ease: [0.23, 1, 0.32, 1],
            }}
          >
            {node}
          </m.span>
        ))}
      </p>
    </LazyMotion>
  );
}
