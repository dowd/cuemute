import type { ConsoleSettings } from "@cuemute/core";
import type { Console } from "./console.ts";
import { QuConsole } from "./qu.ts";
import { SimConsole } from "./sim.ts";

// Throws with a message for the operator when the settings can't make a desk.
export function createConsole(settings: ConsoleSettings): Console {
  switch (settings.type) {
    case "sim":
      return new SimConsole();
    case "qu":
      if (!settings.host) throw new Error("Set the Qu's IP address under Edit > Desk");
      return new QuConsole(settings.host);
    case "sq":
      throw new Error("SQ support isn't built yet");
  }
}
