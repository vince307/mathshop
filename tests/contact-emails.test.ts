import { describe, expect, it } from "vitest";
import { t } from "@/i18n";

/**
 * The contact page publishes these addresses and its form opens `mailto:` to one of
 * them. They must be on a domain that receives mail: `matmaverse.app` has no DNS, so
 * anything sent there bounces. hello@ariom.cloud is the mailbox the app already sends from.
 */
describe("contact page e-mail addresses", () => {
  it("are all on ariom.cloud", () => {
    const emails = t.marketingPages.legal.contact.methods.map(({ email }) => email);
    expect(emails.length).toBeGreaterThan(0);
    for (const email of emails) expect(email).toMatch(/@ariom\.cloud$/);
  });
});
