export function getGreeting(userName?: string | null): string {
  const hour = new Date().getHours();
  const greeting =
    hour >= 5 && hour < 12
      ? "Good morning"
      : hour >= 12 && hour < 18
        ? "Good afternoon"
        : "Good evening";
  const firstName = userName?.split(" ")[0];
  return `${greeting}${firstName ? `, ${firstName}` : ""}`;
}
