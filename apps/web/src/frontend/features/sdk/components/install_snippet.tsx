interface InstallSnippetProps {
  sdkKey: string;
}

export function InstallSnippet({ sdkKey }: InstallSnippetProps) {
  const snippet = `<script src="https://cdn.releaselayer.app/sdk.js" defer></script>
<script>
  ReleaseLayer.init('${sdkKey}', {
    user: { id: 'USER_ID', traits: { plan: 'pro' } }
  });
</script>`;

  return (
    <section>
      <h2 className="text-sm font-semibold text-[#0f172a]">Install snippet</h2>
      <p className="mt-1 text-xs text-[#64748b]">
        Add this before the closing &lt;/body&gt; tag in your app shell.
      </p>
      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-md border border-[#d6e2f4] bg-[#0f172a] p-3 text-[11px] text-[#93c5fd]">
        {snippet}
      </pre>
    </section>
  );
}
