import { Button } from "@/components/ui/button";
import { useCompletion } from "@ai-sdk/react";
import { useEffect } from "react";

export function DashboardBriefingStream() {
  const { completion, complete, error, isLoading, setCompletion } =
    useCompletion({
      id: "dashboard-briefing",
      api: "/api/ai/briefing/stream",
      streamProtocol: "text",
    });

  useEffect(() => {
    setCompletion("");
    void complete("Generate dashboard briefing");
  }, [complete, setCompletion]);

  const text = completion ?? "";

  if (isLoading) {
    return (
      <p className="text-sm leading-relaxed text-muted-foreground animate-pulse">
        Briefing...
      </p>
    );
  }

  if (!text && error) {
    return (
      <div className="flex items-center gap-2">
        <p className="text-sm text-muted-foreground">
          Briefing unavailable right now.
        </p>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setCompletion("");
            void complete("Generate dashboard briefing");
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <p className="text-sm leading-relaxed text-pretty text-muted-foreground">
      {text}
    </p>
  );
}
