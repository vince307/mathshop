export interface ContactMessage {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export interface ContactBodyLabels {
  name: string;
  email: string;
}

/**
 * The `mailto:` link the contact form opens. The page has no backend for the form: it hands a
 * prefilled message to the visitor's own mail client, so the visitor's address goes in the body
 * (a mailto link cannot set the sender).
 */
export function buildContactMailto(recipient: string, labels: ContactBodyLabels, contact: ContactMessage): string {
  const body = [`${labels.name}: ${contact.name}`, `${labels.email}: ${contact.email}`, "", contact.message].join("\n");
  return `mailto:${recipient}?subject=${encodeURIComponent(contact.subject)}&body=${encodeURIComponent(body)}`;
}
