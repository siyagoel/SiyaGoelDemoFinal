import { describe, expect, it } from "vitest";
import { nextTheme, resolveTheme } from "./theme";

describe("resolveTheme", () => {
  it("honours an explicit stored choice", () => {
    expect(resolveTheme("light")).toBe("light");
    expect(resolveTheme("dark")).toBe("dark");
  });

  it("defaults to dark when nothing is stored", () => {
    expect(resolveTheme(null)).toBe("dark");
  });

  it("ignores unrecognised stored values", () => {
    expect(resolveTheme("sepia")).toBe("dark");
    expect(resolveTheme("")).toBe("dark");
  });
});

describe("nextTheme", () => {
  it("toggles between the two themes", () => {
    expect(nextTheme("dark")).toBe("light");
    expect(nextTheme("light")).toBe("dark");
  });
});
