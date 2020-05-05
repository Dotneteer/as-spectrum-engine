import "mocha";
import * as expect from "expect";
import * as fs from "fs";
import * as path from "path";

import { Api } from "../../src/shared/api";
import * as loader from "@assemblyscript/loader";
import { TestMachine } from "../../src/shared/test-machine";
import { TestZ80MachineState } from "../../src/assembly";

const wasmBin = fs.readFileSync(
  path.join(__dirname, "../../build/optimized.wasm")
);
const moduleInst = loader.instantiateSync(wasmBin, {}) as loader.ASUtil & Api;
const testMachine = new TestMachine(moduleInst);

describe("Bit ops 80-bf", () => {
  beforeEach(() => {
    testMachine.reset();
  });

  const reg8 = ["b", "c", "d", "e", "h", "l", "(hl)", "a"];

  for (let q = 0; q <= 7; q++) {
    if (q === 6) continue;
    for (let n = 0; n <= 7; n++) {
      const opCode = 0x80 + n * 8 + q;
      it(`${opCode.toString(16)}: res ${n},${reg8[q]} #1`, () => {
        let s = testMachine.initCode([0xcb, opCode]);
        setReg8(s, q, 0xff);
        s.f &= 0xfe;
        s = testMachine.run(s);

        expect(getReg8(s, q)).toBe(0xff & ~(1 << n));
        testMachine.shouldKeepRegisters(`${reg8[q]}`);
        testMachine.shouldKeepMemory();

        expect(s.pc).toBe(0x0002);
        expect(s.tactsL).toBe(8);
      });

      it(`${opCode.toString(16)}: res ${n},${reg8[q]} #2`, () => {
        let s = testMachine.initCode([0xcb, opCode]);
        setReg8(s, q, 0xaa);
        s.f &= 0xfe;
        s = testMachine.run(s);

        expect(getReg8(s, q)).toBe(0xaa & ~(1 << n));

        testMachine.shouldKeepRegisters(`${reg8[q]}`);
        testMachine.shouldKeepMemory();

        expect(s.pc).toBe(0x0002);
        expect(s.tactsL).toBe(8);
      });
    }
  }

  for (let n = 0; n <= 7; n++) {
    const opCode = 0x86 + n * 8;
    it(`${opCode.toString(16)}: res ${n},(hl) #1`, () => {
      let s = testMachine.initCode([0xcb, opCode]);
      let m = testMachine.memory;
      s.hl = 0x1000;
      m[s.hl] = 0xff;
      s.f &= 0xfe;
      s = testMachine.run(s, m);
      m = testMachine.memory;

      expect(m[0x1000]).toBe(0xff & ~(1 << n));

      testMachine.shouldKeepRegisters("F");
      testMachine.shouldKeepMemory("1000");

      expect(s.pc).toBe(0x0002);
      expect(s.tactsL).toBe(15);
    });

    it(`${opCode.toString(16)}: res ${n},(hl) #2`, () => {
      let s = testMachine.initCode([0xcb, opCode]);
      let m = testMachine.memory;
      s.hl = 0x1000;
      m[s.hl] = 0xaa;
      s.f &= 0xfe;
      s = testMachine.run(s, m);
      m = testMachine.memory;

      expect(m[0x1000]).toBe(0xaa & ~(1 << n));

      testMachine.shouldKeepRegisters("F");
      testMachine.shouldKeepMemory("1000");

      expect(s.pc).toBe(0x0002);
      expect(s.tactsL).toBe(15);
    });
  }

  it("Generate", () => {
    let result = "";
    for (let i = 0x80; i <= 0xbf; i++) {
      result += `  /* 0x${i.toString(16)} */ ResNQ,\r\n`;
    }
    console.log(result);
  });
});

function setReg8(s: TestZ80MachineState, q: number, val: number): void {
  switch (q) {
    case 0:
      s.b = val;
      break;
    case 1:
      s.c = val;
      break;
    case 2:
      s.d = val;
      break;
    case 3:
      s.e = val;
      break;
    case 4:
      s.h = val;
      break;
    case 5:
      s.l = val;
      break;
    case 7:
      s.a = val;
      break;
  }
}

function getReg8(s: TestZ80MachineState, q: number): number {
  switch (q) {
    case 0:
      return s.b;
    case 1:
      return s.c;
    case 2:
      return s.d;
    case 3:
      return s.e;
    case 4:
      return s.h;
    case 5:
      return s.l;
    case 7:
      return s.a;
  }
  return 0;
}