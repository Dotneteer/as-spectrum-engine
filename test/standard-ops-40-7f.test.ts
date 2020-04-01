import "mocha";
import * as expect from "expect";
import * as fs from "fs";
import * as path from "path";

import { Api } from "../src/shared/api";
import * as loader from "@assemblyscript/loader";
import { TestMachine } from "../src/shared/test-machine";
import { RunMode } from "../src/shared/RunMode";
import { Z80StateFlags } from "../src/shared/cpu-enums";

const wasmBin = fs.readFileSync(
  path.join(__dirname, "../build/optimized.wasm")
);
const module = loader.instantiateSync(wasmBin, {}) as loader.ASUtil & Api;
const testMachine = new TestMachine(module);

describe("Standard ops 40-7f", () => {
  beforeEach(() => {
    testMachine.reset();
  });

  it("generate", () => {
    let str = "";
    for (let q = 0; q < 8; q++) {
      for (let w = 0; w < 8; w++) {
        const opCode = 0x40 + 8 * q + w;
        const func = q === 6 || w === 6 ? "null" : "LdQQ";
        str += `  /* 0x${opCode.toString(16)} */ ${func},\r\n`;
      }
    }
    console.log(str);
  });

  const reg8 = ["b", "c", "d", "e", "h", "l", "(hl)", "a"];
  for (let q = 0; q < 8; q++) {
    if (q === 6) continue;
    for (let w = 0; w < 8; w++) {
      if (w === 6) continue;

      const opCode = 0x40 + 8 * q + w;
      it(`${opCode.toString(16)}: ld ${reg8[q]},${reg8[w]}`, () => {
        let s = testMachine.initCode([opCode]);
        switch (w) {
          case 0:
            s.b = 0x46;
            break;
          case 1:
            s.c = 0x46;
            break;
          case 2:
            s.d = 0x46;
            break;
          case 3:
            s.e = 0x46;
            break;
          case 4:
            s.h = 0x46;
            break;
          case 5:
            s.l = 0x46;
            break;
          case 7:
            s.a = 0x46;
            break;
        }
        s = testMachine.run(s);
        let l: number = 0xff;
        switch (q) {
          case 0:
            l = s.b;
            break;
          case 1:
            l = s.c;
            break;
          case 2:
            l = s.d;
            break;
          case 3:
            l = s.e;
            break;
          case 4:
            l = s.h;
            break;
          case 5:
            l = s.l;
            break;
          case 7:
            l = s.a;
            break;
        }
        testMachine.shouldKeepRegisters(`${reg8[q]},${reg8[w]}`);
        testMachine.shouldKeepMemory();
        expect(l).toBe(0x46);
        expect(s.pc).toBe(0x0001);
        expect(s.tactsL).toBe(4);
      });
    }
  }

  for (let q = 0; q < 8; q++) {
    if (q === 6) continue;
    const opCode = 0x46 + 8 * q;
    it(`${opCode.toString(16)}: ld ${reg8[q]},(hl)`, () => {
      let s = testMachine.initCode([opCode]);
      s.hl = 0x1000;
      const m = testMachine.memory;
      m[s.hl] = 0x46;
      s = testMachine.run(s, m);
      let l: number = 0xff;
      switch (q) {
        case 0:
          l = s.b;
          break;
        case 1:
          l = s.c;
          break;
        case 2:
          l = s.d;
          break;
        case 3:
          l = s.e;
          break;
        case 4:
          l = s.h;
          break;
        case 5:
          l = s.l;
          break;
        case 7:
          l = s.a;
          break;
      }

      testMachine.shouldKeepRegisters(`${reg8[q]}`);
      testMachine.shouldKeepMemory();
      expect(l).toBe(0x46);
      expect(s.pc).toBe(0x0001);
      expect(s.tactsL).toBe(7);
    });
  }

  for (let q = 0; q < 8; q++) {
    if (q === 6) continue;
    const opCode = 0x70 + q;
    it(`${opCode.toString(16)}: ld (hl),${reg8[q]}`, () => {
      let s = testMachine.initCode([opCode]);
      s.hl = 0x1000;
      switch (q) {
        case 0:
          s.b = 0x46;
          break;
        case 1:
          s.c = 0x46;
          break;
        case 2:
          s.d = 0x46;
          break;
        case 3:
          s.e = 0x46;
          break;
        case 7:
          s.a = 0x46;
          break;
      }
      s = testMachine.run(s);
      const m = testMachine.memory;

      testMachine.shouldKeepRegisters();
      testMachine.shouldKeepMemory("1000");
      if (q === 4) {
        expect(m[0x1000]).toBe(0x10);
      } else if (q === 5) {
        expect(m[0x1000]).toBe(0x00);
      } else {
        expect(m[0x1000]).toBe(0x46);
      }
      expect(s.pc).toBe(0x0001);
      expect(s.tactsL).toBe(7);
    });
  }

  it("76: halt", () => {
    let s = testMachine.initCode([0x76], RunMode.UntilHalt);
    s = testMachine.run();

    testMachine.shouldKeepRegisters();
    testMachine.shouldKeepMemory();
    expect(s.stateFlags & Z80StateFlags.Halted).toBeTruthy();
    expect(s.pc).toBe(0x0000);
    expect(s.tactsL).toBe(4);
  });
});
