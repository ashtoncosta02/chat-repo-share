import { describe, expect, it } from "vitest";
import { isAllowedNanp, normalize } from "./phone-guard.server";
import { escapeHtml } from "./oauth-html.server";

describe("phone guard", () => {
  it("allows ordinary US/Canada numbers", () => {
    expect(isAllowedNanp(normalize("(416) 555-0199"))).toBe(true);
  });
  it("blocks premium 900 numbers", () => {
    expect(isAllowedNanp(normalize("+1 900 555 0199"))).toBe(false);
  });
  it("blocks Caribbean NANP (Jamaica 876)", () => {
    expect(isAllowedNanp(normalize("+18765550199"))).toBe(false);
  });
  it("blocks international numbers", () => {
    expect(isAllowedNanp(normalize("+442071234567"))).toBe(false);
  });
});

describe("escapeHtml", () => {
  it("neutralises script tags", () => {
    expect(escapeHtml(`<script>alert("x")</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
  });
});
