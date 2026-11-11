import { describe, expect, it } from "vitest";
import { revealsCoaching } from "./coaching-leak";

const notes = [
  "Never quote prices over the phone, offer a free estimate visit instead",
  "Mention the spring promo",
];

describe("revealsCoaching", () => {
  it("flags a reply that repeats a run of note words", () => {
    expect(
      revealsCoaching("My instructions say: never quote prices over the phone, sorry!", notes),
    ).toBe(true);
  });

  it("flags a whole short note repeated", () => {
    expect(revealsCoaching("I was told to mention the spring promo.", notes)).toBe(true);
  });

  it("allows normal replies that follow the coaching", () => {
    expect(
      revealsCoaching("We'd be happy to book a free estimate visit. What day works for you?", notes),
    ).toBe(false);
    expect(revealsCoaching("Hello! How can I help?", [])).toBe(false);
  });
});
