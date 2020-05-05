import { Z80Cpu } from "../../Z80Cpu";
import { ExecuteCycleOptions } from "../../../shared/ExecuteCycleOptions";
import { ExecutionCompletionReason } from "../../../shared/ExecutionCompletionReason";
import {
  CpuConfiguration,
  MemoryConfiguration,
  ScreenConfiguration,
  serializeScreenConfiguration,
  restoreScreenConfiguration,
} from "./configuration";
import { AddressLocation, PagedBank } from "../memory/address";
import { RenderingTact } from "../screen/rendering";
import { SpectrumKeyCode } from "../../../shared/SpectrumKeyCode";
import { LiteEvent } from "../../utils/LiteEvent";
import { BinaryReader } from "../../utils/BinaryReader";
import { ScreenConfigurationEx } from "../screen/ScreenConfigurationEx";
import { BinaryWriter } from "../../utils/BinaryWriter";

/**
 * This class represents a ZX Spectrum engine
 */
export class SpectrumEngine {
  private _cpu: Z80Cpu;
  private _ulaIssue: u8;
  private _baseClockFrequency: u32;
  private _clockMultiplier: u8;
  private _screenConfiguration: ScreenConfigurationEx;
  private _currentFrameTact: u32;
  private _frameCount: u32;
  private _frameBegins: u64;
  private _overflow: u32;
  private _contentionAccummulated: u32;
  private _lastExecutionStartTact: u64;
  private _lastExecutionContentionValue: u32;
  private _executeCycleOptions: ExecuteCycleOptions;
  private _executionCompletionReason: ExecutionCompletionReason;

  // ==========================================================================
  // Life cycle methods

  /**
   * Initializes a new machine instance
   */
  constructor() {
    this._cpu = new Z80Cpu();
    this._ulaIssue = 3;
  }

  /**
   * Sets up the machine according to its configuration
   */
  setup(): void {
    // --- Configure the cpu
    const cpuConfig = this.getCpuConfiguration();
    this._baseClockFrequency = cpuConfig.baseClockFrequency;
    this._clockMultiplier = cpuConfig.clockMultiplier;
    this.cpu.allowExtendedInstructionSet  = cpuConfig.supportsNextOperations;

    // --- Configure the screen frame
    const scr = this.getScreenConfiguration();
    this._screenConfiguration = new ScreenConfigurationEx(scr);
    this._frameCount = 0;
    this._frameBegins = 0;
    this._overflow = 0;
    this._contentionAccummulated = 0;
    this._lastExecutionStartTact = 0;
    this._lastExecutionContentionValue = 0;

    // --- Configure audio sample rate
    this.setBeeperSampleRate(24000);

    // --- Reset the devices
    this.resetMemoryDevice();
    this.resetPortDevice();
    this.resetScreenDevice();
    this.resetInterruptDevice();
    this.resetBeeperDevice();
    this.resetKeyboardDevice();
  }

  // ==========================================================================
  // Engine properties

  /**
   * Gets the Z80 CPU of the engine
   */
  get cpu(): Z80Cpu {
    return this._cpu;
  }

  /**
   * Gets or sets the ULA issue of the engine
   */
  get ulaIssue(): u8 {
    return this._ulaIssue;
  }
  set ulaIssue(value: u8) {
    this._ulaIssue = value === 2 || value === 3 ? value : 3;
  }

  /**
   * The base clock frequency of the engine
   */
  get baseClockFrequency(): u32 {
    return this._baseClockFrequency;
  }

  /**
   * Allows to set a clock frequency multiplier value (1, 2, 4, or 8).
   */
  get clockMultiplier(): u8 {
    return this._clockMultiplier;
  }

  /**
   * Gets the screen configuration
   */
  get screenConfiguration(): ScreenConfigurationEx {
    return this._screenConfiguration;
  }

  /**
   * The current tact within the current screen frame
   */
  get currentFrameTact(): u32 {
    return this._currentFrameTact;
  }

  get frameCount(): u32 {
    return this._frameCount;
  }

  get frameBegins(): u64 {
    return this._frameBegins;
  }

  /**
   * Overflow from the previous frame, given in #of tacts
   */
  get overflow(): u32 {
    return this._overflow;
  }

  /**
   * Gets or sets the value of the contention accummulated since the start of
   * the machine
   */
  get contentionAccummulated(): u32 {
    return this._contentionAccummulated;
  }

  /**
   * The CPU tact at which the last execution cycle started
   */
  get lastExecutionStartTact(): u64 {
    return this._lastExecutionStartTact;
  }

  /**
   * Gets the value of the contention accummulated when the
   * execution cycle started
   */
  get lastExecutionContentionValue(): u32 {
    return this._lastExecutionContentionValue;
  }

  /**
   * The current execution cycle options
   */
  get executeCycleOptions(): ExecuteCycleOptions {
    return this._executeCycleOptions;
  }

  /**
   * Gets the reason why the execution cycle of the SpectrumEngine completed.
   */
  get executionCompletionReason(): ExecutionCompletionReason {
    return this._executionCompletionReason;
  }

  // ==========================================================================
  // Execution cycle
  executeCycle(options: ExecuteCycleOptions): void {
    // TODO: prepare for a new frame
  }

  // ==========================================================================
  // Configurator functions

  /**
   * Serializes the state of the engine
   * @returns The binary stream of the engine state
   */
  serializeEngineState(): u8[] {
    const w = new BinaryWriter();

    // --- Save SpectrumEngine state
    this._cpu.serializeCpuState(w);
    w.writeByte(this._ulaIssue);
    w.writeUint32(this._baseClockFrequency);
    w.writeByte(this._clockMultiplier);
    serializeScreenConfiguration(this._screenConfiguration as ScreenConfiguration, w);
    w.writeUint32(this._currentFrameTact);
    w.writeUint32(this._frameCount);
    w.writeUint64(this._frameBegins);
    w.writeUint32(this._overflow);
    w.writeUint32(this._contentionAccummulated);
    w.writeUint64(this._lastExecutionStartTact);
    w.writeUint32(this._lastExecutionContentionValue);

    // --- Save device state
    this.serializeMachineState(w);
    return w.buffer;
  }

  /**
   * Restrores the state of the engine
   * @param state State to restore
   */
  restoreEngineState(state: u8[]): void {
    const r = new BinaryReader(state);

    // --- Restore engine state
    this._cpu.restoreCpuState(r)
    this._ulaIssue = r.readByte();
    this._baseClockFrequency = r.readUint32();
    this._clockMultiplier = r.readByte();
    const sc = new ScreenConfiguration();
    restoreScreenConfiguration(sc, r);
    this._screenConfiguration = new ScreenConfigurationEx(sc);
    this._currentFrameTact = r.readUint32();
    this._frameCount = r.readUint32();
    this._frameBegins = r.readUint64();
    this._overflow = r.readUint32();
    this._contentionAccummulated = r.readUint32();
    this._lastExecutionStartTact = r.readUint64();
    this._lastExecutionContentionValue = r.readUint32();

    // --- Restore device states
    this.restoreMachineState(r);
  }

  // ==========================================================================
  // Configurator functions

  /**
   * Configuration of the Z80 CPU
   */
  getCpuConfiguration: () => CpuConfiguration;

  /**
   * Configuration of the memory
   */
  getMemoryConfiguration: () => MemoryConfiguration;

  /**
   * Configuration of the screen
   */
  getScreenConfiguration: () => ScreenConfiguration;

  // ==========================================================================
  // Memory device functions

  /**
   * Resets the memory to the state when the machine is turned on.
   */
  resetMemoryDevice: () => void;

  /**
   * Gets a known address of a particular ROM
   * @param key Known address key
   * @param romIndex Index of the ROM, by default, 0
   * @returns Address, if found; otherwise, -1
   */
  getKnownRomAddress: (key: string, romIndex: u8) => i32;

  /**
   * Reads the memory at the specified address
   * @param addr Memory address
   * @param supressContention Should memory contention suppressed?
   * @returns Memory contents
   */
  read: (addr: u16, supressContention?: bool) => u8;

  /**
   * Sets the memory value at the specified address
   * @param addr Memory address
   * @param value Value to write
   * @param supressContention Should memory contention suppressed?
   */
  write: (addr: u16, value: u8, supressContention?: bool) => void;

  /**
   * Gets the buffer that holds memory data
   */
  cloneMemory: () => u8[];

  /**
   * Selects the ROM with the specified index
   * @param romIndex Index of the ROM to select
   */
  selectRom: (romIndex: u8) => void;

  /**
   * Retrieves the index of the selected ROM
   */
  getSelectedRomIndex: () => u8;

  /**
   * Pages in the selected bank into the specified slot
   * @param slot Slot index
   * @param bank Bank to page into the slot
   * @param bank16Mode Do we use 16K mode?
   */
  pageIn: (slot: u8, bank: u8, bank16Mode?: bool) => void;

  /**
   * Gets the bank paged in to the specified slot
   * @param slot Slot index
   * @param bank16Mode Do we use 16K mode?
   * @returns Bank index of the specified slot
   */
  getSelectedBankIndex: (slot: u8, bank16Mode?: bool) => u8;

  /**
   * Indicates if shadow screen should be used
   */
  usesShadowScreen: () => bool;

  /**
   * Indicates special mode: special RAM paging
   */
  isInAllRamMode: () => bool;

  /**
   * Indicates if the device is in 8K mode
   */
  isIn8KMode: () => boolean;

  /**
   * Gets the data for the specfied RAM bank
   * @param bankIndex Bank index
   * @param bank16Mode Do we use 16K mode?
   */
  getRamBank: (bankIndex: u8, bank16Mode?: bool) => u8[];

  /**
   * Gets the location of the address
   * @param addr Memory address
   * @returns Location of the memory address
   */
  getAddressLocation: (addr: u16) => AddressLocation;

  /**
   * Checks if the RAM bank with the specified index is paged in
   * @param index Bank index
   * @returns Location information
   */
  isRamBankPagedIn: (index: u8) => PagedBank;

  /**
   * Tests whether a contended RAM is paged in for 0xC000-0xFFFF
   */
  isContendedBankPagedIn: () => bool;

  // ==========================================================================
  // Port device functions

  /**
   * Resets the port device
   */
  resetPortDevice: () => void;

  /**
   * Reads the port with the specified address
   * @param addr Port address
   * @returns Port value
   */
  readPort: (addr: u16) => u8;

  /**
   * Sends a byte to the port with the specified address
   * @param addr Port address
   * @param data Data to write to the port
   */
  writePort: (addr: u16, data: u8) => void;

  // ==========================================================================
  // Interrupt device functions

  /**
   * Resets the interupt device
   */
  resetInterruptDevice: () => void;

  /**
   * Starts a new interrupt frame
   */
  startNewInterruptFrame: () => void;

  /**
   * Signs that an interrupt has been raised in this frame.
   */
  isInterruptRaised: () => bool;

  /**
   * Signs that the interrupt signal has been revoked
   */
  isInterruptRevoked: () => bool;

  /**
   * Generates an interrupt in the current phase, if time has come.
   * @param currentTact Current frame tact
   */
  checkForInterrupt: (currentTact: u32) => void;

  // ==========================================================================
  // Screen device functions
  
  /**
   * Resets the screen device
   */
  resetScreenDevice: () => void;

  /**
   * Starts rendering a new screen frame
   */
  startNewScreenFrame: () => void;

  /**
   * Table of ULA tact action information entries
   */
  getRenderingTactTable: () => RenderingTact[];

  /**
   * The number of frames when the flash flag should be toggles
   */
  getFlashToggleFrames: () => u32;

  /**
   * Gets the current border color
   */
  getBorderColor: () => u8;

  /**
   * Sets the current border color
   */
  setBorderColor: (color: u8) => void;

  /**
   * Executes the ULA rendering actions between the specified tacts
   * @param fromTact First ULA tact
   * @param toTact Last ULA tact
   */
  renderScreen: (fromTact: u32, toTact: u32) => void;

  /**
   * Gets the memory contention value for the specified tact
   * @param tact ULA tact
   * @returns: The contention value for the ULA tact
   */
  getContentionValue: (tact: u32) => u32;

  /**
   * Gets the buffer that holds the screen pixels
   */
  getPixelBuffer: () => u8[];

  // ==========================================================================
  // Beeper device functions

  /**
   * Resets the beeper device
   */
  resetBeeperDevice: () => void;

  /**
   * Starts a new beeper frame;
   */
  startNewBeeperFrame: () => void;

  /**
   * Completes a beeper frame
   */
  completeBeeperFrame: () => void;

  /**
   * Gets the beeper samples created in the current screen frame
   */
  getBeeperSamples: () => f32[];

  /**
   * Gets the current audio sample rate
   */
  getBeeperSampleRate: () => u32;

  /**
   * Sets the beeper sample rate
   */
  setBeeperSampleRate: (rate: u32) => void;

  /**
   * Gets the latest EAR bit value;
   */
  getLastEarBit: () => bool;

  /**
   * This device processes so many samples in a single frame
   */
  getSamplesPerFrame: () => f32;

  /**
   * Number of CPU tacts between samples
   */
  getTactsPerSample: () => u32;

  /**
   * Processes the change of the EAR bit value
   * @param fromTape False: EAR bit comes from an OUT instruction, True: EAR bit comes from tape
   * @param earBit EAR bit value
   */
  processEarBitValue: (fromTape: bool, earbit: bool) => void;

  /**
   * This method signs that tape should override the OUT instruction's EAR bit
   * @param useTape True: Override the OUT instruction with the tape's EAR bit value
   */
  setTapeOverride: (useTape: bool) => void;

  // ==========================================================================
  // Keyboard device functions

  /**
   * Resets the keyboard device
   */
  resetKeyboardDevice: () => void;

  /**
   * Sets the status of the specified Spectrum keyboard key
   * @param key Key code
   * @param isDown True, if the key is down; otherwise, false
   */
  setKeyStatus: (key: SpectrumKeyCode, isDown: bool) => void;

  /**
   * Gets the status of the specified Spectrum keyboard key.
   * @param key Key code
   * @returns True, if the key is down; otherwise, false
   */
  getKeyStatus: (key: SpectrumKeyCode) => bool;

  /**
   * Gets the byte we would get when querying the I/O address with the
   * specified byte as the highest 8 bits of the address line
   * @param lines The highest 8 bits of the address line
   * @returns The status value to be received when querying the I/O
   */
  getKeyLineStatus: (lines: u8) => u8;

  // ==========================================================================
  // Tape device functions

  /**
   * This flag indicates if the tape is in load mode (EAR bit is set by the tape)
   */
  isInLoadMode: () => bool;

  /**
   * Gets the EAR bit read from the tape
   * @param cpuTicks Number of CPU ticks for the sample
   */
  getEarBit: (cpuTicks: u64) => bool;

  /**
   * Sets the current tape mode according to the current PC register
   * and the MIC bit state
   */
  setTapeMode: () => void;

  /**
   * Processes the the change of the MIC bit
   * @param micBit Current MIC bit value
   */
  processMicBit: (micBit: bool) => void;

  /**
   * External entities can respond to the event when a fast load completed.
   */
  loadCompletedEvent: () => LiteEvent;

  /**
   * Signs that the device entered LOAD mode
   */
  enteredLoadModeEvent: () => LiteEvent;

  /**
   * Signs that the device has just left LOAD mode
   */
  leftLoadModeEvent: () => LiteEvent;

  /**
   * Signs that the device entered SAVE mode
   */
  enteredSaveModeEvent: () => LiteEvent;

  /**
   * Signs that the device has just left SAVE mode
   */
  leftSaveModeEvent: () => LiteEvent;

  // ==========================================================================
  // Tape provider functions

  /**
   * Sets the tape data to use
   */
  setTapeContents: (data: u8[]) => void;

  /**
   * Gets a binary reader that provides tape content
   */
  getTapeContents: () => BinaryReader;

  /**
   * Starts saving a file
   */
  startSave: () => void;

  /**
   * Saves a data block
   */
  saveTapeBlock: (block: u8[]) => void;

  /**
   * Finalizes the save operation
   */
  finalizeSave: () => void;

  /**
   * Gets the saved contents
   */
  getSavedContents: () => u8[];

  // ==========================================================================
  // Machine state serialization

  /**
   * Serializes the current state of the machine
   */
  serializeMachineState: (w: BinaryWriter) => void;

  /**
   * Restores the machine state from the specified binary stream
   */
  restoreMachineState: (s: BinaryReader) => void;
}