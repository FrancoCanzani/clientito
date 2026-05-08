import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSettingsMutations } from "@/features/settings/hooks/use-settings-mutations";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

export default function DangerPage() {
 const navigate = useNavigate();
 const [confirmText, setConfirmText] = useState("");
 const { deleteMutation } = useSettingsMutations({ navigate });

 return (
 <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
 <div className="space-y-0.5">
 <p className="text-xs font-medium">Delete account</p>
 <p className="text-xs text-muted-foreground">
 Type "DELETE" to enable the action.
 </p>
 </div>
 <div className="min-w-0 sm:max-w-[60%]">
 <div className="space-y-3">
 <Input
 value={confirmText}
 onChange={(event) => setConfirmText(event.target.value)}
 placeholder='Type "DELETE" to confirm'
 className="w-full text-xs sm:w-64"
 />
 <div className="flex justify-end sm:justify-start">
 <Button
 variant="destructive"
 size="sm"
 onClick={() => deleteMutation.mutate()}
 disabled={confirmText !== "DELETE" || deleteMutation.isPending}
 >
 {deleteMutation.isPending ? "Deleting..." : "Delete account"}
 </Button>
 </div>
 </div>
 </div>
 </div>
 );
}
