// Allen & Heath SQ MIDI protocol (SQ MIDI Protocol Issue 4, firmware 1.5+),
// the parts cuemute uses: input mutes, and getting their state.
// https://www.allen-heath.com/content/uploads/2023/05/SQ-MIDI-Protocol-Issue4.pdf

export const SQ_PORT = 51325;
export const SQ_INPUTS = 48;

// NRPN controllers
const CC_NRPN_MSB = 0x63;
const CC_NRPN_LSB = 0x62;
const CC_DATA_MSB = 0x06; // VC
const CC_DATA_LSB = 0x26; // VF
const CC_DATA_INCREMENT = 0x60; // used as "get" with value 7F

// Mute parameters: MSB 00, LSB = input - 1 (Input 1-48 = 00..2F)
const MUTE_MSB = 0x00;

function cc(midiChannel: number, controller: number, value: number): number[] {
  return [0xb0 | (midiChannel & 0x0f), controller, value];
}

// Mute: BN 63 00 BN 62 <ch-1> BN 06 00 BN 26 <01 on / 00 off>
export function encodeSqMute(midiChannel: number, input: number, muted: boolean): Uint8Array {
  return Uint8Array.of(
    ...cc(midiChannel, CC_NRPN_MSB, MUTE_MSB),
    ...cc(midiChannel, CC_NRPN_LSB, input - 1),
    ...cc(midiChannel, CC_DATA_MSB, 0x00),
    ...cc(midiChannel, CC_DATA_LSB, muted ? 0x01 : 0x00),
  );
}

// Get: BN 63 MB BN 62 LB BN 60 7F. The desk answers with the full NRPN.
export function encodeSqGetMute(midiChannel: number, input: number): Uint8Array {
  return Uint8Array.of(
    ...cc(midiChannel, CC_NRPN_MSB, MUTE_MSB),
    ...cc(midiChannel, CC_NRPN_LSB, input - 1),
    ...cc(midiChannel, CC_DATA_INCREMENT, 0x7f),
  );
}

export interface Nrpn {
  msb: number;
  lsb: number;
  vc: number;
  vf: number;
}

// Assembles NRPN messages from a stream of CCs on one MIDI channel. The desk
// may use running status, and may skip the parameter CCs when they haven't
// changed, so the last parameter is remembered.
export class NrpnAssembler {
  #msb = -1;
  #lsb = -1;
  #vc = 0;

  // returns a complete NRPN when the data LSB (VF) arrives
  cc(controller: number, value: number): Nrpn | null {
    switch (controller) {
      case CC_NRPN_MSB:
        this.#msb = value;
        return null;
      case CC_NRPN_LSB:
        this.#lsb = value;
        return null;
      case CC_DATA_MSB:
        this.#vc = value;
        return null;
      case CC_DATA_LSB:
        if (this.#msb < 0 || this.#lsb < 0) return null;
        return { msb: this.#msb, lsb: this.#lsb, vc: this.#vc, vf: value };
      default:
        return null;
    }
  }

  reset(): void {
    this.#msb = -1;
    this.#lsb = -1;
    this.#vc = 0;
  }
}

// an input mute carried by an NRPN, or null for any other parameter
export function decodeSqMute(n: Nrpn): { input: number; muted: boolean } | null {
  if (n.msb !== MUTE_MSB) return null;
  const input = n.lsb + 1;
  if (input < 1 || input > SQ_INPUTS) return null;
  return { input, muted: (n.vf & 0x01) === 1 };
}
