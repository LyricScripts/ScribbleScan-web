import { type Child, render } from "../../src/dom";

let latest = 0;

export interface Page {
  render(...children: Child[]): void;
  readonly current: boolean;
}

export function newPage(): Page {
  const id = ++latest;
  return {
    render: (...children) => {
      if (id === latest) render(document.getElementById("view") as HTMLElement, ...children);
    },
    get current() {
      return id === latest;
    },
  };
}
