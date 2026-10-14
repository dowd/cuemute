import type { ConsoleSettings } from "@cuemute/core";
import type { Console } from "./console.ts";
import { QuConsole } from "./qu.ts";
import { SimConsole } from "./sim.ts";
import { SqConsole } from "./sq.ts";

// Throws with a message for the operator when the settings can't make a desk.
export function createConsole(settings: ConsoleSettings): Console {
  switch (settings.type) {
    case "sim":
      return new SimConsole();
    case "qu":
      if (!settings.host) throw new Error("Set the Qu's IP address under Edit > Desk");
      return new QuConsole(settings.host);
    case "sq":
      if (!settings.host) throw new Error("Set the SQ's IP address under Edit > Desk");
      return new SqConsole(settings.host, settings.midiChannel);
  }
}
