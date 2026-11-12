import { describe, expect, it } from "vitest";
import { revealsCoaching } from "./coaching-leak";

const notes = [
  "Never quote prices over the phone, offer a free estimate visit instead",
  "Mention the spring promo",
];

describe("revealsCoaching", () => {
  it("flags a reply that talks about its instructions while repeating a note", () => {
    expect(
      revealsCoaching("My instructions say: never quote prices over the phone, sorry!", notes),
    ).toBe(true);
    expect(revealsCoaching("I was told to mention the spring promo.", notes)).toBe(true);
  });

  it("flags a reply that lists two notes almost word for word", () => {
    expect(
      revealsCoaching(
        "Sure: never quote prices over the phone, offer a free estimate visit instead. Also, mention the spring promo.",
        notes,
      ),
    ).toBe(true);
  });

  it("allows a reply that follows an owner's note using its exact wording", () => {
    expect(
      revealsCoaching("Yes! We offer free estimates on every job. Would you like to book one?", [
        "Tell customers we offer free estimates on every job",
      ]),
    ).toBe(false);
    expect(
      revealsCoaching("We offer free estimates on every job and we are open Saturdays from 9 to 5.", [
        "Tell customers we offer free estimates on every job",
        "Let people know we are open Saturdays from 9 to 5",
      ]),
    ).toBe(false);
  });

  it("allows a reply that repeats a single 'what worked' note in full", () => {
    expect(
      revealsCoaching("Great question! Our spring promo gives you 20% off any full-home cleaning this month.", [
        "Our spring promo gives you 20% off any full-home cleaning this month",
      ]),
    ).toBe(false);
  });

  it("allows normal replies", () => {
    expect(
      revealsCoaching("We'd be happy to book a free estimate visit. What day works for you?", notes),
    ).toBe(false);
    expect(revealsCoaching("Hello! How can I help?", [])).toBe(false);
  });
});
