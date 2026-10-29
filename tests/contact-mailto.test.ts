import { describe, expect, it } from "vitest";
import { t } from "@/i18n";
import { buildContactMailto } from "@/lib/contact-mailto";

const page = t.marketingPages.legal.contact;
const labels = { name: page.fields.name, email: page.fields.email };

/** Decodes the link the way a mail client does, so the assertions read as what the visitor sees. */
function open(href: string) {
  const url = new URL(href);
  return {
    recipient: decodeURIComponent(url.pathname),
    subject: url.searchParams.get("subject"),
    body: url.searchParams.get("body"),
  };
}

describe("contact form mailto link", () => {
  it("goes to the form recipient with the visitor's subject, name, e-mail and message", () => {
    const mail = open(
      buildContactMailto(page.formRecipient, labels, {
        name: "Ola",
        email: "ola@example.com",
        subject: "Pytanie o świat",
        message: "Dzień dobry,\ndruga linia",
      }),
    );

    expect(mail.recipient).toBe(page.formRecipient);
    expect(mail.subject).toBe("Pytanie o świat");
    expect(mail.body).toBe(`${labels.name}: Ola\n${labels.email}: ola@example.com\n\nDzień dobry,\ndruga linia`);
  });

  it("keeps characters that would otherwise split the link (& ? # =) inside their field", () => {
    const mail = open(
      buildContactMailto(page.formRecipient, labels, {
        name: "A&B",
        email: "a@b.pl",
        subject: "Ceny? 10 zł & 20 zł #1",
        message: "x=1&body=hijack",
      }),
    );

    expect(mail.subject).toBe("Ceny? 10 zł & 20 zł #1");
    expect(mail.body).toBe(`${labels.name}: A&B\n${labels.email}: a@b.pl\n\nx=1&body=hijack`);
  });

  it("is sent to an address the contact page also lists", () => {
    expect(page.methods.map(({ email }) => email)).toContain(page.formRecipient);
  });
});
