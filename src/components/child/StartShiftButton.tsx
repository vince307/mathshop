import { useState } from "react";
import { Store } from "lucide-react";
import { ChildButton } from "@/components/child/ChildButton";
import { t } from "@/i18n";

/**
 * The start-screen tap affordance (FR-004). Renders the oversized in-world
 * "Czas otworzyć sklep!" button; tapping shows a friendly in-world "coming soon"
 * message — a no-op until the shift loop lands (S-02+). No bare-math framing
 * anywhere (prd-v2.md:158).
 */
export default function StartShiftButton() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col items-center gap-4">
      <ChildButton
        variant="gold"
        aria-expanded={open}
        onClick={() => {
          setOpen(true);
        }}
      >
        <Store />
        {t.start.open}
      </ChildButton>

      {open && (
        <div role="status" className="bg-card border-border max-w-sm rounded-2xl border p-4 text-center shadow-sm">
          <p className="text-foreground font-bold">{t.start.comingSoonTitle}</p>
          <p className="text-muted-foreground mt-1 text-sm">{t.start.comingSoon}</p>
        </div>
      )}
    </div>
  );
}
