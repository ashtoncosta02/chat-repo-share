import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("CSV export", () => {
  it("prefixes formula-looking values with a single quote", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("+15551234567")).toBe("'+15551234567");
    expect(csvCell("-2")).toBe("'-2");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
  });
  it("quotes commas and quotes", () => {
    expect(csvCell('a, "b"')).toBe('"a, ""b"""');
  });
  it("builds rows with CRLF", () => {
    expect(toCsv(["a", "b"], [[1, null]])).toBe("a,b\r\n1,");
  });
});
