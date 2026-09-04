/**
 * The Gemini key — bring your own, or borrow the demo's.
 *
 * One key, one provider. It used to be two: Gemini for media, Claude for
 * analysing a session into a workflow. Two providers meant two keys to obtain,
 * two SDKs in the bundle and two ways for one feature to fail, for a single
 * structured-JSON call that Gemini does natively. Analysis moved to Gemini and
 * the second key went away.
 *
 * The key is held in module memory for the lifetime of the tab and never
 * written to IndexedDB, localStorage, the URL, a project file or a tool result.
 * It goes straight to Google; no server of ours sees it.
 *
 * The control is always present, but it changes weight with how much it
 * matters. While the shared demo key is covering things it is a bare key icon
 * with a tooltip — discoverable for anyone who wants their own key, silent for
 * everyone else. Hiding it outright was worse: it left the "add your own key"
 * message pointing at a button that did not exist, and gave a self-hosted
 * build no way in at all.
 */

import { useState, useSyncExternalStore } from "react";
import { KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import { clearApiKey, hasApiKey, setApiKey, usingSharedKey } from "@/local/gemini";
import { isSharedKeyExhausted, subscribeSharedKey } from "@/local/shared-key";

export function ApiKeysDialog() {
  const [open, setOpen] = useState(false);
  const [isSet, setIsSet] = useState(hasApiKey());
  const [value, setValue] = useState("");
  const exhausted = useSyncExternalStore(subscribeSharedKey, isSharedKeyExhausted, isSharedKeyExhausted);

  /*
   * Icon-only while the shared key is doing the work — nobody needs to be
   * asked for a credential before they have tried anything. It grows a label
   * the moment a key actually matters: when the budget runs out, when one is
   * set and worth managing, or when there is no proxy at all.
   */
  const optional = usingSharedKey() && !exhausted && !isSet;
  const label = isSet
    ? "Gemini key set"
    : exhausted
      ? "Add a key to continue"
      : "Add Gemini key";

  const save = () => {
    if (!value.trim()) return;
    setApiKey(value);
    setIsSet(true);
    setValue("");
    toast({ title: "Gemini key added", description: "Held in this tab only." });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={optional ? "size-8 px-0 text-muted-foreground" : "h-8 gap-1.5 px-2 text-xs"}
                aria-label={optional ? "Add your Gemini API key (optional)" : label}
              >
                <KeyRound className="h-3.5 w-3.5" />
                {!optional && (
                  <>
                    <span className="hidden sm:inline">{label}</span>
                    <span className={`h-1.5 w-1.5 rounded-full ${isSet ? "bg-foreground" : "bg-muted-foreground/40"}`} />
                  </>
                )}
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {optional ? "Add your Gemini API key — optional" : label}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Gemini API key</DialogTitle>
          <DialogDescription>
            {exhausted
              ? "The shared demo key is used up for now. Add your own to carry on."
              : "Optional. The editor works fully without one — a key is only needed for generating, indexing, captioning and capturing workflows."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={isSet ? "Replace key" : "Paste your key"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); }}
          />
          {isSet && (
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0"
              onClick={() => {
                clearApiKey();
                setIsSet(false);
                toast({ title: "Gemini key removed" });
              }}
            >
              Forget
            </Button>
          )}
          <Button size="sm" className="shrink-0" onClick={save} disabled={!value.trim()}>
            Save
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Kept in memory for this tab only — never saved to disk, put in a URL, or returned to an
          agent. Closing the tab clears it.
        </p>

        <DialogFooter>
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
