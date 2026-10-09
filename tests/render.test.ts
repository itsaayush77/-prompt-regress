import test from "node:test";
import assert from "node:assert/strict";
import { renderPrompt } from "../src/assertions.ts";

test("substitutes multiple variables", () => {
  assert.equal(renderPrompt("hi {{a}} and {{b}}", { a: "x", b: "y" }), "hi x and y");
});

test("substitutes a repeated variable everywhere", () => {
  assert.equal(renderPrompt("{{a}} + {{a}}", { a: "1" }), "1 + 1");
});

test("missing variable is left as a visible placeholder", () => {
  // Documented behavior: unknown keys stay as {{key}} so the gap is
  // visible in the rendered prompt instead of silently becoming "".
  assert.equal(renderPrompt("hi {{name}}", {}), "hi {{name}}");
});

test("tolerates whitespace inside placeholders", () => {
  assert.equal(renderPrompt("hi {{  name  }}", { name: "A" }), "hi A");
});

test("prompt without placeholders is unchanged", () => {
  assert.equal(renderPrompt("plain text", { a: "x" }), "plain text");
});
