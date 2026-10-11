import type { ConsoleSettings } from "@cuemute/core";
import type { Console } from "./console.ts";
import { SimConsole } from "./sim.ts";

// null for a desk type with no driver yet
export function createConsole(settings: ConsoleSettings): Console | null {
  switch (settings.type) {
    case "sim":
      return new SimConsole();
    default:
      return null;
  }
}
