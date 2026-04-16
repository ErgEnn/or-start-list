import { SerialPort, ClearBuffer } from 'tauri-plugin-serialplugin-api';
import { useSiReaderStore } from '../stores/siReaderStore';

// ---------------------------------------------------------------------------
// SportIdent protocol constants
// ---------------------------------------------------------------------------

const WAKEUP = 0xff;
const STX = 0x02;
const ETX = 0x03;
const ACK = 0x06;

const CMD_SET_MASTER_SLAVE = 0xf0;
const CMD_SIGNAL = 0xf9;
const CMD_TRANS_REC = 0xd3;
const CMD_SI5_DET = 0xe5;
const CMD_SI6_DET = 0xe6;
const CMD_SI_REM = 0xe7;
const CMD_SI8_DET = 0xe8;

const MASTER_MODE = 0x4d;
// Vendor IDs in decimal (plugin returns decimal strings, not hex)
// 0x10C4 = 4292 (Silicon Labs CP210x), 0x0525 = 1317 (PLX Technology)
const SI_VENDOR_IDS = ['4292', '1317'];

// ---------------------------------------------------------------------------
// CRC-16 (polynomial 0x8005, MSB-first) — ported from Rust si_reader.rs
// ---------------------------------------------------------------------------

function siCrc16(data: number[]): number {
  const count = data.length;
  if (count === 0) return 0;
  if (count === 1) return (data[0] << 8) & 0xffff;

  let crc = ((data[0] << 8) | data[1]) & 0xffff;
  if (count === 2) return crc;

  let pos = 2;
  let remaining = Math.floor(count / 2);

  while (remaining > 0) {
    let val: number;
    if (remaining > 1) {
      val = ((data[pos] << 8) | data[pos + 1]) & 0xffff;
      pos += 2;
    } else if (count % 2 !== 0) {
      val = (data[pos] << 8) & 0xffff;
    } else {
      val = 0;
    }

    for (let i = 0; i < 16; i++) {
      if (crc & 0x8000) {
        crc = (crc << 1) & 0xffff;
        if (val & 0x8000) crc = (crc + 1) & 0xffff;
        crc ^= 0x8005;
      } else {
        crc = (crc << 1) & 0xffff;
        if (val & 0x8000) crc = (crc + 1) & 0xffff;
      }
      val = (val << 1) & 0xffff;
    }

    remaining--;
  }

  return crc;
}

// ---------------------------------------------------------------------------
// Frame building
// ---------------------------------------------------------------------------

function buildCommandFrame(cmd: number, params: number[]): number[] {
  const payload = [cmd, params.length, ...params];
  const crc = siCrc16(payload);
  return [WAKEUP, STX, ...payload, (crc >> 8) & 0xff, crc & 0xff, ETX];
}

function buildSetMasterFrame(): number[] {
  return buildCommandFrame(CMD_SET_MASTER_SLAVE, [MASTER_MODE]);
}

function buildSignalFrame(beepCount: number): number[] {
  return buildCommandFrame(CMD_SIGNAL, [beepCount]);
}

function buildAckBytes(): number[] {
  return [WAKEUP, ACK];
}

// ---------------------------------------------------------------------------
// Card number decoding — ported from Rust decode_si_card_number
// ---------------------------------------------------------------------------

function decodeSiCardNumber(b0: number, b1: number, b2: number, b3: number): number {
  if (b0 !== 0) {
    return ((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) >>> 0;
  }

  const nr = (b1 << 16) | (b2 << 8) | b3;

  if (nr < 500_000) {
    const series = b1;
    const cardNum = (b2 << 8) | b3;
    return series < 2 ? cardNum : series * 100_000 + cardNum;
  }

  return nr;
}

// ---------------------------------------------------------------------------
// Frame parsing buffer
// ---------------------------------------------------------------------------

function processBuffer(buffer: number[]): number[] {
  const cardNumbers: number[] = [];

  while (true) {
    // Skip leading WAKEUP bytes
    while (buffer.length > 0 && buffer[0] === WAKEUP) {
      buffer.shift();
    }

    const stxIndex = buffer.indexOf(STX);
    if (stxIndex === -1) {
      if (buffer.length > 50) buffer.length = 0;
      break;
    }

    if (stxIndex > 0) {
      buffer.splice(0, stxIndex);
    }

    const etxIndex = buffer.indexOf(ETX);
    if (etxIndex === -1) break;

    const frame = buffer.splice(0, etxIndex + 1);
    if (frame.length < 6) continue;

    const cmd = frame[1];
    const hex = frame.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
    console.log(`[SI Frame] CMD=0x${cmd.toString(16).toUpperCase()} len=${frame.length} data=${hex}`);

    // D3 (punch record) and E5 (SI5 detect): 4-byte card number at frame[5:9]
    if ((cmd === CMD_TRANS_REC || cmd === CMD_SI5_DET) && frame.length >= 9) {
      const cn = decodeSiCardNumber(frame[5], frame[6], frame[7], frame[8]);
      console.log(`[SI] D3/E5 bytes: ${frame[5].toString(16)} ${frame[6].toString(16)} ${frame[7].toString(16)} ${frame[8].toString(16)} => ${cn}`);
      if (cn > 0) cardNumbers.push(cn);
    }

    // E6 (SI6) and E8 (SI8/9/10/11/SIAC): series byte at frame[5], 3-byte card number at frame[6:9]
    if ((cmd === CMD_SI6_DET || cmd === CMD_SI8_DET) && frame.length >= 9) {
      const cn = decodeSiCardNumber(0, frame[6], frame[7], frame[8]);
      console.log(`[SI] E6/E8 series=0x${frame[5].toString(16)} bytes: 00 ${frame[6].toString(16)} ${frame[7].toString(16)} ${frame[8].toString(16)} => ${cn}`);
      if (cn > 0) cardNumbers.push(cn);
    }

    if (cmd === CMD_SI_REM) {
      console.log('[SI] Card removed');
    }
  }

  return cardNumbers;
}

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let currentPort: SerialPort | null = null;
let unlistenData: (() => void) | null = null;
const rxBuffer: number[] = [];

// ---------------------------------------------------------------------------
// Port discovery
// ---------------------------------------------------------------------------

async function findSiPort(): Promise<string> {
  const ports = await SerialPort.available_ports();

  for (const [path, info] of Object.entries(ports)) {
    if (info.vid && info.vid !== 'Unknown') {
      const vid = info.vid.toUpperCase();
      if (SI_VENDOR_IDS.includes(vid)) {
        console.log(`[SI] Found SI reader at ${path} (VID=${info.vid}, PID=${info.pid})`);
        return path;
      }
    }
  }

  const portList = Object.entries(ports)
    .map(([path, info]) => `${path} (VID=${info.vid}, PID=${info.pid})`)
    .join(', ');

  if (portList) {
    throw new Error(`No SportIdent reader found. Available ports: ${portList}`);
  }
  throw new Error('No serial ports found');
}

// ---------------------------------------------------------------------------
// Data handler
// ---------------------------------------------------------------------------

function onData(data: Uint8Array): void {
  rxBuffer.push(...data);

  const cardNumbers = processBuffer(rxBuffer);

  for (const cn of cardNumbers) {
    console.log(`[SI] Card read: ${cn}`);
    useSiReaderStore.getState().setBufferedCard(cn);

    // Send beep signal to reader
    if (currentPort) {
      currentPort.writeBinary(buildSignalFrame(1)).catch(() => {
        currentPort?.writeBinary(buildAckBytes()).catch(() => {});
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Connect / Disconnect
// ---------------------------------------------------------------------------

export async function siConnect(): Promise<void> {
  if (currentPort) {
    throw new Error('SI reader already connected');
  }

  const portPath = await findSiPort();

  const port = new SerialPort({ path: portPath, baudRate: 38400 });
  await port.open();

  // Set DTR/RTS — required for CP210x
  try {
    await port.writeDataTerminalReady(true);
  } catch {
    console.warn('[SI] Failed to set DTR');
  }
  try {
    await port.writeRequestToSend(true);
  } catch {
    console.warn('[SI] Failed to set RTS');
  }

  // Clear stale data
  try {
    await port.clearBuffer(ClearBuffer.All);
  } catch {
    console.warn('[SI] Failed to clear buffer');
  }

  // Send SetMasterSlave(Master) initialization command
  try {
    await port.writeBinary(buildSetMasterFrame());
  } catch (e) {
    console.warn('[SI] SetMaster command failed:', e);
  }

  // Small delay for reader to process init command
  await new Promise((r) => setTimeout(r, 500));

  // Start listening for data
  await port.startListening();
  const unlisten = await port.listen((data: Uint8Array) => onData(data), false);
  unlistenData = unlisten;

  // Handle disconnect
  await port.disconnected(() => {
    console.log('[SI] Reader disconnected');
    cleanup();
  });

  currentPort = port;
  rxBuffer.length = 0;
  useSiReaderStore.getState().setConnected(true);
  useSiReaderStore.getState().setError('');
}

export async function siDisconnect(): Promise<void> {
  if (!currentPort) return;

  try {
    await currentPort.close();
  } catch (e) {
    console.warn('[SI] Error closing port:', e);
  }

  cleanup();
}

function cleanup(): void {
  if (unlistenData) {
    try {
      unlistenData();
    } catch {
      // ignore
    }
    unlistenData = null;
  }
  currentPort = null;
  rxBuffer.length = 0;
  useSiReaderStore.getState().setConnected(false);
}
