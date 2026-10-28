import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Self-hosted GoTrue (ariom-infra server/supabase/matmaverse/compose.yml) fetches the auth e-mail templates from
// https://matmaverse.ariom.cloud/email-templates/{confirmation,recovery}.html. The runtime image serves them as static
// files only because the Dockerfile copies supabase/templates into dist/client/email-templates; guard that line.
describe("Dockerfile", () => {
  it("copies supabase/templates into dist/client/email-templates", () => {
    const dockerfile = readFileSync(join(process.cwd(), "Dockerfile"), "utf8");
    expect(dockerfile).toMatch(/^COPY --from=build \/app\/supabase\/templates \.\/dist\/client\/email-templates$/m);
  });

  it("keeps supabase/templates in the build context", () => {
    const lines = readFileSync(join(process.cwd(), ".dockerignore"), "utf8").split("\n");
    expect(lines).toContain("!supabase/templates");
  });
});
