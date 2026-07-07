import { Store } from "lucide-react";
import { ChildButton } from "@/components/child/ChildButton";
import { t } from "@/i18n";

/**
 * The start-screen tap affordance (FR-004). Renders the oversized in-world
 * "Czas otworzyć sklep!" button; tapping opens the counting task (S-02). No
 * bare-math framing anywhere (prd-v2.md:158).
 */
export default function StartShiftButton() {
  return (
    <ChildButton
      variant="primary"
      onClick={() => {
        window.location.href = "/app/task";
      }}
    >
      <Store />
      {t.start.open}
    </ChildButton>
  );
}
