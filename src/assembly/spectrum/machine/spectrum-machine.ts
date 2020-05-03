import { ZxSpectrumType } from "../../../shared/ZxSpectrumType";
import { SpectrumEngine } from "./SpectrumEngine";
import { ExecuteCycleOptions } from "../../../shared/ExecuteCycleOptions";
import {
  sp48SetInstance,
  sp48GetCpuConfiguration,
  sp48GetMemoryConfiguration,
  sp48GetScreenConfiguration,
  sp48GetKnownRomAddress,
  sp48ResetMemoryDevice,
  sp48Read,
  sp48Write,
  sp48CloneMemory,
  sp48GetRamBank,
  sp48ReadPort,
  sp48WritePort,
  sp48ResetPortDevice,
  sp48ResetInterruptDevice,
  sp48IsInterruptRaised,
  sp48IsInterruptRevoked,
  sp48CheckForInterrupt,
  sp48ResetScreenDevice,
  sp48StartNewScreenFrame,
  sp48GetRenderingTactTable,
  sp48GetFlashToggleFrames,
  sp48GetBorderColor,
  sp48SetBorderColor,
  sp48RenderScreen,
  sp48GetContentionValue,
  sp48GetPixelBuffer,
} from "./spectrum-48";

const NOT_INITIALIZED = "ZX Spectrum instance is not initialized";

let machineType: ZxSpectrumType = ZxSpectrumType.None;

/**
 * The single instance of ZX Spectrum engine
 */
let spectrum: SpectrumEngine;

/**
 * Creates a new ZX Spectrum model
 * @param type Type of ZX Spectrum machine to create
 */
export function initSpectrumMachine(type: ZxSpectrumType): void {
  if (type === ZxSpectrumType.None) {
    type = ZxSpectrumType.Spectrum48;
  }
  machineType = type;

  // --- Initialize the machine
  spectrum = new SpectrumEngine();

  // --- Configure the machine according to its type
  switch (type) {
    default:
      sp48SetInstance(spectrum);

      // --- Engine configuration
      spectrum.getCpuConfiguration = sp48GetCpuConfiguration;
      spectrum.getMemoryConfiguration = sp48GetMemoryConfiguration;
      spectrum.getScreenConfiguration = sp48GetScreenConfiguration;

      // --- Memory device
      spectrum.resetMemoryDevice = sp48ResetMemoryDevice;
      spectrum.getKnownRomAddress = sp48GetKnownRomAddress;
      spectrum.read = sp48Read;
      spectrum.write = sp48Write;
      spectrum.cloneMemory = sp48CloneMemory;
      spectrum.selectRom = () => {};
      spectrum.getSelectedRomIndex = () => 0;
      spectrum.pageIn = () => {};
      spectrum.getSelectedRomIndex = () => 0;
      spectrum.usesShadowScreen = () => false;
      spectrum.isInAllRamMode = () => false;
      spectrum.isIn8KMode = () => false;
      spectrum.getRamBank = sp48GetRamBank;
      spectrum.getAddressLocation = (addr) =>
        addr < 0x4000
          ? { isInRom: true, index: 0, address: addr }
          : { isInRom: false, index: 0, address: addr - 0x4000 };
      spectrum.isRamBankPagedIn = () => ({
        isPagedIn: false,
        baseAddress: 0x4000,
      });
      spectrum.isContendedBankPagedIn = () => false;

      // --- Port device
      spectrum.resetPortDevice = sp48ResetPortDevice;
      spectrum.readPort = sp48ReadPort;
      spectrum.writePort = sp48WritePort;

      // --- Interrupt device
      spectrum.resetInterruptDevice = sp48ResetInterruptDevice;
      spectrum.isInterruptRaised = sp48IsInterruptRaised;
      spectrum.isInterruptRevoked = sp48IsInterruptRevoked;
      spectrum.checkForInterrupt = sp48CheckForInterrupt;

      // --- Screen device
      spectrum.resetScreenDevice = sp48ResetScreenDevice;
      spectrum.startNewScreenFrame = sp48StartNewScreenFrame;
      spectrum.getRenderingTactTable = sp48GetRenderingTactTable;
      spectrum.getFlashToggleFrames = sp48GetFlashToggleFrames;
      spectrum.getBorderColor = sp48GetBorderColor;
      spectrum.setBorderColor = sp48SetBorderColor;
      spectrum.renderScreen = sp48RenderScreen;
      spectrum.getContentionValue = sp48GetContentionValue;
      spectrum.getPixelBuffer = sp48GetPixelBuffer;

      break;
  }

  // --- Now, we can setup the machine to run
  spectrum.setup();
}

/**
 * Gets the type of the current machine;
 */
export function getCurrentMachineType(): ZxSpectrumType {
  return machineType;
}

/**
 * Turns on the ZX Spectrum machine instance
 */
export function turnOnSpectrumMachine(): void {
  if (!spectrum) {
    throw new Error(NOT_INITIALIZED);
  }
  spectrum.cpu.turnOn();
}

/**
 * Issues a RESET signal to the ZX Spectrum machine
 */
export function resetSpectrumMachine(): void {
  if (!spectrum) {
    throw new Error(NOT_INITIALIZED);
  }
  spectrum.cpu.reset();
  spectrum.resetMemoryDevice();
  spectrum.resetPortDevice();
  spectrum.resetInterruptDevice();
  spectrum.resetScreenDevice();
}

/**
 * Executes a single machine cycle
 * @param mode Execution mode options
 */
export function executeCycle(options: ExecuteCycleOptions): void {
  if (!spectrum) {
    throw new Error(NOT_INITIALIZED);
  }
  // TODO: Implement this method
}
