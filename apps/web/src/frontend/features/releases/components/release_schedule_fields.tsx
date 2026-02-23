interface ReleaseScheduleFieldsProps {
  publishAtName?: string;
  unpublishAtName?: string;
  publishAtValue?: string;
  unpublishAtValue?: string;
  publishAtDefaultValue?: string;
  unpublishAtDefaultValue?: string;
  onPublishAtChange?: (value: string) => void;
  onUnpublishAtChange?: (value: string) => void;
}

export function ReleaseScheduleFields({
  publishAtName,
  unpublishAtName,
  publishAtValue,
  unpublishAtValue,
  publishAtDefaultValue,
  unpublishAtDefaultValue,
  onPublishAtChange,
  onUnpublishAtChange,
}: ReleaseScheduleFieldsProps) {
  const isPublishControlled = publishAtValue !== undefined && typeof onPublishAtChange === "function";
  const isUnpublishControlled = unpublishAtValue !== undefined && typeof onUnpublishAtChange === "function";

  return (
    <div className="rounded-md border border-[#e2e8f0] bg-[#f8fafc] p-3">
      <h3 className="text-xs font-semibold text-[#334155]">Scheduling</h3>
      <p className="mt-1 text-[11px] text-[#64748b]">
        Optional. If set, these control when a published release becomes visible in the SDK.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-[#334155]">Publish at</label>
          <input
            type="datetime-local"
            className="mt-1 block w-full rounded-md border border-[#d6e2f4] px-2.5 py-1.5 text-xs"
            {...(publishAtName ? { name: publishAtName } : {})}
            {...(isPublishControlled
              ? {
                  value: publishAtValue,
                  onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                    onPublishAtChange(event.target.value),
                }
              : { defaultValue: publishAtDefaultValue ?? "" })}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#334155]">Unpublish at</label>
          <input
            type="datetime-local"
            className="mt-1 block w-full rounded-md border border-[#d6e2f4] px-2.5 py-1.5 text-xs"
            {...(unpublishAtName ? { name: unpublishAtName } : {})}
            {...(isUnpublishControlled
              ? {
                  value: unpublishAtValue,
                  onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                    onUnpublishAtChange(event.target.value),
                }
              : { defaultValue: unpublishAtDefaultValue ?? "" })}
          />
        </div>
      </div>
    </div>
  );
}
