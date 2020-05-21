import {
  Z80CpuState,
  MemoryOp,
  IoOp,
  TbBlueOp,
  FlagsSetMask,
} from "./cpu-helpers";
import { CpuApi } from "./api";
import { MemoryHelper } from "./memory-helpers";
import { RunMode } from "../shared/RunMode";

/**
 * Start of the register are in the memory
 */
const REG_AREA_INDEX = 0x1_0000;

/**
 * Start of the CPU state transfer area in the memory
 */
const STATE_TRANSFER_BUFF = 0x1_0040;

/**
 * Buffer for the test CPU I/O input
 */
const TEST_INPUT_BUFF = 0x1_0100;

/**
 * The start of the memory access log
 */
const TEST_MEM_LOG_OFFS = 0x1_0200;

/**
 * The start of the I/O access log
 */
const TEST_IO_LOG_OFFS = 0x1_0600;

/**
 * The start of the TBBLUE access log
 */
const TEST_TBBLUE_LOG_OFFS = 0x1_0a00;

/**
 * This class represents a test machine that can be used for testing the WA machine
 */
export class TestZ80Machine {
  private _cpuStateBeforeRun: Z80CpuState;
  private _memoryBeforeRun: Uint8Array;

  /**
   * Initializes a test machine
   * @param cpuApi Module API obtained by the loader
   */
  constructor(public cpuApi: CpuApi) {
    this.cpuApi.turnOnCpu();
  }

  /**
   * Resets the test machine
   */
  reset(): void {
    this.cpuApi.turnOnCpu();
    this.cpuApi.resetCpu();
    this.cpuApi.enableExtendedInstructions(false);
  }

  /**
   * Enables extended instruction set
   */
  enableExtendedInstructions(): void {
    this.cpuApi.enableExtendedInstructions(true);
  }

  /**
   * Initializes the machine with the specified code
   * @param runMode Machine run mode
   * @param code Intial code
   */
  initCode(code: number[], runMode = RunMode.UntilEnd): Z80CpuState {
    const mem = new Uint8Array(this.cpuApi.memory.buffer, 0, 0x1_0000);
    let codeAddress = 0;
    for (let i = 0; i < code.length; i++) {
      mem[codeAddress++] = code[i];
    }
    this.cpuApi.prepareTest(runMode, codeAddress);

    let ptr = codeAddress;
    while (ptr < 0x10000) {
      mem[ptr++] = 0;
    }

    // --- Init code execution
    this.cpuApi.resetCpu();
    return this.cpuState;
  }

  /**
   * Initializes the input for a test machine run
   * @param input List of input byte values
   */
  initInput(input: number[]): void {
    const mem = new Uint8Array(this.cpuApi.memory.buffer, 0, 0x1_0000);
    for (let i = 0; i < input.length; i++) {
      mem[TEST_INPUT_BUFF + i] = input[i];
    }
    this.cpuApi.setTestInputLength(input.length);
  }

  /**
   * Runs the injected code in test machine
   */
  run(
    state: Z80CpuState | null = null,
    memory: Uint8Array | null = null
  ): Z80CpuState {
    if (state !== null) {
      this.cpuState = state;
    }
    if (memory !== null) {
      this.memory = memory;
    }
    this._cpuStateBeforeRun = this.cpuState;
    this._memoryBeforeRun = new Uint8Array(this.memory);
    this.cpuApi.runTestCode();
    return this.cpuState;
  }

  /**
   * Gets the current CPU state of the test machine.
   * @returns Test machine state
   */
  get cpuState(): Z80CpuState {
    const s = new Z80CpuState();
    this.cpuApi.getCpuState();

    // --- Get register data from the memory
    let mh = new MemoryHelper(this.cpuApi, REG_AREA_INDEX);
    s.af = mh.readUint16(0);
    s.bc = mh.readUint16(2);
    s.de = mh.readUint16(4);
    s.hl = mh.readUint16(6);
    s._af_ = mh.readUint16(8);
    s._bc_ = mh.readUint16(10);
    s._de_ = mh.readUint16(12);
    s._hl_ = mh.readUint16(14);
    s.i = mh.readByte(16);
    s.r = mh.readByte(17);
    s.pc = mh.readUint16(18);
    s.sp = mh.readUint16(20);
    s.ix = mh.readUint16(22);
    s.iy = mh.readUint16(24);
    s.wz = mh.readUint16(26);

    // --- Get state data
    mh = new MemoryHelper(this.cpuApi, STATE_TRANSFER_BUFF);
    s.tactsInFrame = mh.readUint32(0);
    s.allowExtendedSet = mh.readBool(4);
    s.tactsH = mh.readUint32(5);
    s.tactsL = mh.readUint32(9);
    s.stateFlags = mh.readByte(13);
    s.useGateArrayContention = mh.readBool(14);
    s.iff1 = mh.readBool(15);
    s.iff2 = mh.readBool(16);
    s.interruptMode = mh.readByte(17);
    s.isInterruptBlocked = mh.readBool(18);
    s.isInOpExecution = mh.readBool(19);
    s.prefixMode = mh.readByte(20);
    s.indexMode = mh.readByte(21);
    s.maskableInterruptModeEntered = mh.readBool(22);
    s.opCode = mh.readByte(23);

    // --- Done.
    return s;
  }

  /**
   * Sets the current CPU state of the test machine
   * @param s New state to set
   */
  set cpuState(s: Z80CpuState) {
    let mh = new MemoryHelper(this.cpuApi, REG_AREA_INDEX);
    mh.writeUint16(0, s.af);
    mh.writeUint16(2, s.bc);
    mh.writeUint16(4, s.de);
    mh.writeUint16(6, s.hl);
    mh.writeUint16(8, s._af_);
    mh.writeUint16(10, s._bc_);
    mh.writeUint16(12, s._de_);
    mh.writeUint16(14, s._hl_);
    mh.writeByte(16, s.i);
    mh.writeByte(17, s.r);
    mh.writeUint16(18, s.pc);
    mh.writeUint16(20, s.sp);
    mh.writeUint16(22, s.ix);
    mh.writeUint16(24, s.iy);
    mh.writeUint16(26, s.wz);

    // --- Get state data
    mh = new MemoryHelper(this.cpuApi, STATE_TRANSFER_BUFF);
    mh.writeUint32(0, s.tactsInFrame);
    mh.writeBool(4, s.allowExtendedSet);
    mh.writeUint32(5, s.tactsH);
    mh.writeUint32(9, s.tactsL);
    mh.writeByte(13, s.stateFlags);
    mh.writeBool(14, s.useGateArrayContention);
    mh.writeBool(15, s.iff1);
    mh.writeBool(16, s.iff2);
    mh.writeByte(17, s.interruptMode);
    mh.writeBool(18, s.isInterruptBlocked);
    mh.writeBool(19, s.isInOpExecution);
    mh.writeByte(20, s.prefixMode);
    mh.writeByte(21, s.indexMode);
    mh.writeBool(22, s.maskableInterruptModeEntered);
    mh.writeByte(23, s.opCode);

    // --- Pass data to webAssembly
    this.cpuApi.updateCpuState();
  }

  /**
   * Gets the memory of the test machine
   * @returns Test machine memory contents
   */
  get memory(): Uint8Array {
    const mem = new Uint8Array(this.cpuApi.memory.buffer, 0, 0x1_0000);
    return new Uint8Array(mem);
  }

  /**
   * Updates the memory contents of the test machine
   */
  set memory(mem: Uint8Array) {
    const memory = new Uint8Array(this.cpuApi.memory.buffer, 0, 0x1_0000);
    for (let i = 0; i < mem.length; i++) {
      memory[i] = mem[i];
    }
  }

  /**
   * Gets the memory access log of the test machine
   */
  get memoryAccessLog(): MemoryOp[] {
    const mh = new MemoryHelper(this.cpuApi, TEST_MEM_LOG_OFFS);
    const length = this.cpuApi.getMemLogLength();
    const result: MemoryOp[] = [];
    for (let i = 0; i < length; i++) {
      const l = mh.readUint32(i * 4);
      result.push({
        address: (l >> 16) & 0xffff,
        value: (l >> 8) & 0xff,
        isWrite: (l & 0xff) !== 0,
      });
    }
    return result;
  }

  /**
   * Gets the memory access log of the test machine
   */
  get ioAccessLog(): IoOp[] {
    const mh = new MemoryHelper(this.cpuApi, TEST_IO_LOG_OFFS);
    const length = this.cpuApi.getIoLogLength();
    const result: IoOp[] = [];
    for (let i = 0; i < length; i++) {
      const l = mh.readUint32(i * 4);
      result.push({
        address: (l >> 16) & 0xffff,
        value: (l >> 8) & 0xff,
        isOutput: (l & 0xff) !== 0,
      });
    }
    return result;
  }

  /**
   * Gets the memory access log of the test machine
   */
  get tbBlueAccessLog(): TbBlueOp[] {
    const mh = new MemoryHelper(this.cpuApi, TEST_TBBLUE_LOG_OFFS);
    const length = this.cpuApi.getTbBlueLogLength();
    const result: TbBlueOp[] = [];
    for (let i = 0; i < length; i++) {
      const l = mh.readUint16(i * 2);
      result.push({
        data: (l >> 8) & 0xff,
        isIndex: (l & 0xff) !== 0,
      });
    }
    return result;
  }

  // ==========================================================================
  // Unit test helper methods

  /**
   * Checks if all registers keep their original values, except the ones
   * listed in `except`
   * @param except Names of registers that may change
   */
  shouldKeepRegisters(except?: string): void {
    const before = this._cpuStateBeforeRun;
    const after = this.cpuState;
    let exclude = except === undefined ? [] : except.split(",");
    exclude = exclude.map((reg) => reg.toUpperCase().trim());
    let differs: string[] = [];

    if (before._af_ !== after._af_ && exclude.indexOf("AF'") < 0) {
      differs.push("AF'");
    }
    if (before._bc_ !== after._bc_ && exclude.indexOf("BC'") < 0) {
      differs.push("BC'");
    }
    if (before._de_ !== after._de_ && exclude.indexOf("DE'") < 0) {
      differs.push("DE'");
    }
    if (before._hl_ !== after._hl_ && exclude.indexOf("HL'") < 0) {
      differs.push("HL'");
    }
    if (
      before.af !== after.af &&
      !(
        exclude.indexOf("AF") > -1 ||
        exclude.indexOf("A") > -1 ||
        exclude.indexOf("F") > -1
      )
    ) {
      differs.push("AF");
    }
    if (
      before.bc !== after.bc &&
      !(
        exclude.indexOf("BC") > -1 ||
        exclude.indexOf("B") > -1 ||
        exclude.indexOf("C") > -1
      )
    ) {
      differs.push("BC");
    }
    if (
      before.de !== after.de &&
      !(
        exclude.indexOf("DE") > -1 ||
        exclude.indexOf("D") > -1 ||
        exclude.indexOf("E") > -1
      )
    ) {
      differs.push("DE");
    }
    if (
      before.hl !== after.hl &&
      !(
        exclude.indexOf("HL") > -1 ||
        exclude.indexOf("H") > -1 ||
        exclude.indexOf("L") > -1
      )
    ) {
      differs.push("HL");
    }
    if (before.sp !== after.sp && exclude.indexOf("SP") < 0) {
      differs.push("SP");
    }
    if (before.ix !== after.ix && exclude.indexOf("IX") < 0) {
      differs.push("IX");
    }
    if (before.iy !== after.iy && exclude.indexOf("IY") < 0) {
      differs.push("IY");
    }
    if (
      before.a !== after.a &&
      exclude.indexOf("A") < 0 &&
      exclude.indexOf("AF") < 0
    ) {
      differs.push("A");
    }
    if (
      before.f !== after.f &&
      exclude.indexOf("F") < 0 &&
      exclude.indexOf("AF") < 0
    ) {
      differs.push("F");
    }
    if (
      before.b !== after.b &&
      exclude.indexOf("B") < 0 &&
      exclude.indexOf("BC") < 0
    ) {
      differs.push("B");
    }
    if (
      before.c !== after.c &&
      exclude.indexOf("C") < 0 &&
      exclude.indexOf("BC") < 0
    ) {
      differs.push("C");
    }
    if (
      before.d !== after.d &&
      exclude.indexOf("D") < 0 &&
      exclude.indexOf("DE") < 0
    ) {
      differs.push("D");
    }
    if (
      before.e !== after.e &&
      exclude.indexOf("E") < 0 &&
      exclude.indexOf("DE") < 0
    ) {
      differs.push("E");
    }
    if (
      before.h !== after.h &&
      exclude.indexOf("H") < 0 &&
      exclude.indexOf("HL") < 0
    ) {
      differs.push("H");
    }
    if (
      before.l !== after.l &&
      exclude.indexOf("L") < 0 &&
      exclude.indexOf("HL") < 0
    ) {
      differs.push("L");
    }
    if (differs.length === 0) {
      return;
    }
    throw new Error(
      "The following registers are expected to remain intact, " +
        `but their values have been changed: ${differs.join(", ")}`
    );
  }

  /**
   * Tests if S flag keeps its value while running a test.
   */
  shouldKeepSFlag(): void {
    const before = (this._cpuStateBeforeRun.f & FlagsSetMask.S) !== 0;
    const after = (this.cpuState.f & FlagsSetMask.S) !== 0;
    if (after === before) {
      return;
    }
    throw new Error(
      `S flag expected to keep its value, but it changed from ${before} to ${after}`
    );
  }

  /**
   * Tests if Z flag keeps its value while running a test.
   */
  shouldKeepZFlag(): void {
    const before = (this._cpuStateBeforeRun.f & FlagsSetMask.Z) !== 0;
    const after = (this.cpuState.f & FlagsSetMask.Z) !== 0;
    if (after === before) {
      return;
    }
    throw new Error(
      `Z flag expected to keep its value, but it changed from ${before} to ${after}`
    );
  }

  /**
   * Tests if N flag keeps its value while running a test.
   */
  shouldKeepNFlag(): void {
    const before = (this._cpuStateBeforeRun.f & FlagsSetMask.N) !== 0;
    const after = (this.cpuState.f & FlagsSetMask.N) !== 0;
    if (after === before) {
      return;
    }
    throw new Error(
      `N flag expected to keep its value, but it changed from ${before} to ${after}`
    );
  }

  /**
   * Tests if PV flag keeps its value while running a test.
   */
  shouldKeepPVFlag(): void {
    const before = (this._cpuStateBeforeRun.f & FlagsSetMask.PV) !== 0;
    const after = (this.cpuState.f & FlagsSetMask.PV) !== 0;
    if (after === before) {
      return;
    }
    throw new Error(
      `PV flag expected to keep its value, but it changed from ${before} to ${after}`
    );
  }

  /**
   * Tests if H flag keeps its value while running a test.
   */
  shouldKeepHFlag(): void {
    const before = (this._cpuStateBeforeRun.f & FlagsSetMask.H) !== 0;
    const after = (this.cpuState.f & FlagsSetMask.H) !== 0;
    if (after === before) {
      return;
    }
    throw new Error(
      `PV flag expected to keep its value, but it changed from {before} to {after}`
    );
  }

  /**
   * Tests if C flag keeps its value while running a test.
   */
  shouldKeepCFlag(): void {
    const before = (this._cpuStateBeforeRun.f & FlagsSetMask.C) !== 0;
    const after = (this.cpuState.f & FlagsSetMask.C) !== 0;
    if (after === before) {
      return;
    }
    throw new Error(
      `C flag expected to keep its value, but it changed from ${before} to ${after}`
    );
  }

  // Check if the machine's memory keeps its previous values, except
  // the addresses and address ranges specified in <paramref name="except"/>
  shouldKeepMemory(except?: string): void {
    const cpu = this.cpuState;
    const MAX_DEVS = 10;
    const ranges: { From: number; To: number }[] = [];
    const deviations: number[] = [];

    // --- Parse ranges
    let strRanges = except === undefined ? [] : except.split(",");
    for (let i = 0; i < strRanges.length; i++) {
      const range = strRanges[i];
      const blocks = range.split("-");
      let lower = 0xffff;
      let upper = 0xffff;
      if (blocks.length >= 1) {
        lower = parseInt(blocks[0], 16);
        upper = lower;
      }
      if (blocks.length >= 2) {
        upper = parseInt(blocks[1], 16);
      }
      ranges.push({ From: lower, To: upper });
    }

    // --- Check each byte of memory, ignoring the stack
    let upperMemoryBound = cpu.sp;
    if (upperMemoryBound === 0) {
      upperMemoryBound = 0x10000;
    }
    const memoryAfter = this.memory;
    for (let idx = 0; idx < upperMemoryBound; idx++) {
      if (memoryAfter[idx] === this._memoryBeforeRun[idx]) {
        continue;
      }

      // --- Test allowed deviations
      let found = ranges.some((range) => idx >= range.From && idx <= range.To);
      if (found) {
        continue;
      }

      // --- Report deviation
      deviations.push(idx);
      if (deviations.length >= MAX_DEVS) {
        break;
      }
    }

    if (deviations.length > 0) {
      throw new Error(
        "The following memory locations are expected to remain intact, " +
          "but their values have been changed: " +
          deviations.map((d) => d.toString(16)).join(", ")
      );
    }
  }
}
