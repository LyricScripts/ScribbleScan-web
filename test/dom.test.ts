import { describe, expect, it } from "vitest";
import { h, render } from "../src/dom";

describe("h", () => {
  it("flattens nested children and drops null, undefined and false", () => {
    const el = h("ul", {}, [h("li", {}, "a"), null, [false, [h("li", {}, "b")]], undefined]);
    expect([...el.children].map((li) => li.textContent)).toEqual(["a", "b"]);
  });
  it("sets attributes, skips null/false ones, and wires events", () => {
    let clicked = 0;
    const b = h(
      "button",
      { type: "button", disabled: false, title: null, onclick: () => clicked++ },
      "Go",
      2,
    );
    b.click();
    expect(b.getAttribute("type")).toBe("button");
    expect(b.hasAttribute("disabled")).toBe(false);
    expect(b.hasAttribute("title")).toBe(false);
    expect(b.textContent).toBe("Go2");
    expect(clicked).toBe(1);
  });
});

describe("render", () => {
  it("replaces children and accepts the same shapes as h", () => {
    const box = h("div", {}, "old");
    render(box, null, [h("p", {}, "new")]);
    expect(box.innerHTML).toBe("<p>new</p>");
  });
});
