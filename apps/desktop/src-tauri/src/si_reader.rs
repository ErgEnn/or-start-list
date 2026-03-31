use std::io::{Read, Write};
use std::sync::Mutex;
use std::time::Duration;

use log::{debug, info, warn};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

const SI_CARD_READ_EVENT: &str = "desktop://si-card-read";
const SI_READER_STATUS_EVENT: &str = "desktop://si-reader-status";

// Protocol constants (from sportident-rs)
const WAKEUP: u8 = 0xFF;
const STX: u8 = 0x02;
const ETX: u8 = 0x03;

// Protocol bytes
const ACK: u8 = 0x06; // Single-byte ACK — causes beep on BSx3..6 stations

// Command bytes (from sportident.js constants)
const CMD_SET_MASTER_SLAVE: u8 = 0xF0; // SET_MS: 0x4D=Master, 0x53=Slave
const CMD_SIGNAL: u8 = 0xF9; // SIGNAL: parameter = number of beeps
const CMD_TRANS_REC: u8 = 0xD3; // Autosend timestamp / punch record
const CMD_SI5_DET: u8 = 0xE5; // SI-card 5 inserted
const CMD_SI6_DET: u8 = 0xE6; // SI-card 6 inserted
const CMD_SI_REM: u8 = 0xE7; // SI-card removed
const CMD_SI8_DET: u8 = 0xE8; // SI-card 8/9/10/11/p/t inserted

// SetMasterSlave parameter
const MASTER_MODE: u8 = 0x4D;

const BAUD_RATE_HIGH: u32 = 38400;
const BAUD_RATE_LOW: u32 = 4800;
const READ_TIMEOUT_MS: u64 = 100;
const INIT_TIMEOUT_MS: u64 = 2000;

/// Known USB Vendor IDs for SportIdent readers.
/// 0x10C4 = Silicon Labs CP210x, 0x0525 = PLX Technology (some SI USB sticks).
const SI_VENDOR_IDS: &[u16] = &[0x10C4, 0x0525];

// ---------------------------------------------------------------------------
// SportIdent CRC-16 (polynomial 0x8005, MSB-first)
// Ported from the official C implementation used in sportident-rs.
// ---------------------------------------------------------------------------

fn si_crc16(data: &[u8]) -> u16 {
    let count = data.len();
    // Match sportident.js: short inputs return padded big-endian value
    if count == 0 {
        return 0;
    }
    if count == 1 {
        return (data[0] as u16) << 8;
    }

    let mut crc: u16 = ((data[0] as u16) << 8) | (data[1] as u16);

    if count == 2 {
        return crc;
    }

    let mut pos: usize = 2;
    let mut remaining = (count / 2) as i32;

    while remaining > 0 {
        let mut val: u16 = if remaining > 1 {
            let v = ((data[pos] as u16) << 8) | (data[pos + 1] as u16);
            pos += 2;
            v
        } else if count % 2 != 0 {
            (data[pos] as u16) << 8
        } else {
            0
        };

        for _ in 0..16 {
            if crc & 0x8000 != 0 {
                crc = crc.wrapping_shl(1);
                if val & 0x8000 != 0 {
                    crc = crc.wrapping_add(1);
                }
                crc ^= 0x8005;
            } else {
                crc = crc.wrapping_shl(1);
                if val & 0x8000 != 0 {
                    crc = crc.wrapping_add(1);
                }
            }
            val = val.wrapping_shl(1);
        }

        remaining -= 1;
    }

    crc
}

// ---------------------------------------------------------------------------
// Frame building — matches sportident-rs encoder format:
//   WAKEUP(0xFF) STX(0x02) CMD LEN PARAMS... CRC_HI CRC_LO ETX(0x03)
// CRC is computed over [CMD, LEN, PARAMS...] in big-endian.
// ---------------------------------------------------------------------------

fn build_command_frame(cmd: u8, params: &[u8]) -> Vec<u8> {
    let mut payload = vec![cmd, params.len() as u8];
    payload.extend_from_slice(params);
    let crc = si_crc16(&payload);

    let mut frame = vec![WAKEUP, STX];
    frame.extend_from_slice(&payload);
    frame.push((crc >> 8) as u8);
    frame.push((crc & 0xFF) as u8);
    frame.push(ETX);
    frame
}

fn build_set_master_frame() -> Vec<u8> {
    build_command_frame(CMD_SET_MASTER_SLAVE, &[MASTER_MODE])
}

/// SIGNAL command (0xF9) with beep count — the proper way to trigger beeps.
fn build_signal_frame(beep_count: u8) -> Vec<u8> {
    build_command_frame(CMD_SIGNAL, &[beep_count])
}

/// Simple ACK — single byte 0x06 prefixed with WAKEUP.
/// Per sportident.js: "When sent to BSx3..6, causes beep until SI-card taken out."
fn build_ack_bytes() -> Vec<u8> {
    vec![WAKEUP, ACK]
}

/// Send a command frame and drain any response (with a longer timeout for init).
fn send_command(
    port: &mut Box<dyn serialport::SerialPort>,
    frame: &[u8],
    label: &str,
) -> Result<(), String> {
    let hex: String = frame.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(" ");
    debug!("[TX {}] {}", label, hex);

    port.write_all(frame).map_err(|e| format!("Write {label}: {e}"))?;
    port.flush().map_err(|e| format!("Flush {label}: {e}"))?;
    Ok(())
}

/// Send command and wait for a response frame (reads until ETX or timeout).
fn send_command_and_wait(
    port: &mut Box<dyn serialport::SerialPort>,
    frame: &[u8],
    label: &str,
) -> Result<(), String> {
    // Use longer timeout for init commands
    let original_timeout = port.timeout();
    port.set_timeout(Duration::from_millis(INIT_TIMEOUT_MS))
        .map_err(|e| format!("Set timeout: {e}"))?;

    send_command(port, frame, label)?;

    // Read response until we see ETX or timeout
    let mut buf = [0u8; 256];
    let mut response = Vec::new();
    loop {
        match port.read(&mut buf) {
            Ok(n) if n > 0 => {
                response.extend_from_slice(&buf[..n]);
                if response.contains(&ETX) {
                    let hex: String = response.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(" ");
                    debug!("[RX {} response] {}", label, hex);
                    break;
                }
            }
            Ok(_) => break,
            Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut => break,
            Err(e) => {
                let _ = port.set_timeout(original_timeout);
                return Err(format!("Read {label} response: {e}"));
            }
        }
    }

    port.set_timeout(original_timeout)
        .map_err(|e| format!("Restore timeout: {e}"))?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

#[derive(Default)]
pub struct SiReaderState {
    pub connected: Mutex<bool>,
    pub cancel_flag: Mutex<bool>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SiCardReadPayload {
    pub card_number: u32,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SiReaderStatusPayload {
    pub connected: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Decode a 4-byte SI card number according to the SportIdent protocol.
fn decode_si_card_number(b0: u8, b1: u8, b2: u8, b3: u8) -> u32 {
    if b0 != 0 {
        return ((b0 as u32) << 24) | ((b1 as u32) << 16) | ((b2 as u32) << 8) | (b3 as u32);
    }

    let nr = ((b1 as u32) << 16) | ((b2 as u32) << 8) | (b3 as u32);

    if nr < 500_000 {
        let series = b1 as u32;
        let card_num = ((b2 as u32) << 8) | (b3 as u32);
        if series < 2 {
            card_num
        } else {
            series * 100_000 + card_num
        }
    } else {
        nr
    }
}

/// Find a SportIdent reader serial port by scanning for known USB vendor IDs.
pub fn find_si_port() -> Result<String, String> {
    let ports = serialport::available_ports()
        .map_err(|e| format!("Failed to list serial ports: {e}"))?;

    for port in &ports {
        if let serialport::SerialPortType::UsbPort(usb_info) = &port.port_type {
            if SI_VENDOR_IDS.contains(&usb_info.vid) {
                info!(
                    "Found SI reader at {} (VID={:#06x}, PID={:#06x})",
                    port.port_name, usb_info.vid, usb_info.pid
                );
                return Ok(port.port_name.clone());
            }
        }
    }

    if ports.is_empty() {
        Err("No serial ports found".to_string())
    } else {
        let port_list: Vec<String> = ports
            .iter()
            .map(|p| match &p.port_type {
                serialport::SerialPortType::UsbPort(usb) => {
                    format!("{} (VID={:#06x}, PID={:#06x})", p.port_name, usb.vid, usb.pid)
                }
                _ => p.port_name.clone(),
            })
            .collect();
        Err(format!(
            "No SportIdent reader found. Available ports: {}",
            port_list.join(", ")
        ))
    }
}

/// Open, configure, and initialize the serial port with the SI reader.
/// Sends SetMasterSlave(Master) to put the reader into the correct mode.
pub fn open_si_port(port_name: &str) -> Result<Box<dyn serialport::SerialPort>, String> {
    let mut port = serialport::new(port_name, BAUD_RATE_HIGH)
        .timeout(Duration::from_millis(READ_TIMEOUT_MS))
        .open()
        .map_err(|e| format!("{e}"))?;

    // Set DTR/RTS — required for CP210x to start transmitting
    if let Err(e) = port.write_data_terminal_ready(true) {
        warn!("Failed to set DTR: {}", e);
    }
    if let Err(e) = port.write_request_to_send(true) {
        warn!("Failed to set RTS: {}", e);
    }

    // Clear any stale data
    if let Err(e) = port.clear(serialport::ClearBuffer::All) {
        warn!("Failed to clear port buffer: {}", e);
    }

    info!("SI port opened on {}, initializing...", port_name);

    // Initialize: send SetMasterSlave(Master) — try high speed first, then low
    let master_frame = build_set_master_frame();
    if let Err(e) = send_command_and_wait(&mut port, &master_frame, "SetMaster") {
        info!("SetMaster at 38400 failed ({}), trying 4800 baud...", e);
        port.set_baud_rate(BAUD_RATE_LOW)
            .map_err(|e| format!("Set baud rate: {e}"))?;

        if let Err(e) = send_command_and_wait(&mut port, &master_frame, "SetMaster@4800") {
            warn!("SetMaster at 4800 also failed: {}. Continuing anyway.", e);
        }

        // Switch back to high speed
        port.set_baud_rate(BAUD_RATE_HIGH)
            .map_err(|e| format!("Restore baud rate: {e}"))?;
    }

    info!("SI reader initialized on {}", port_name);
    Ok(port)
}

/// Read SI card data in a blocking loop. Must be called with an already-opened port
/// on a blocking thread via `tokio::task::spawn_blocking`.
pub fn read_loop(app: AppHandle, mut port: Box<dyn serialport::SerialPort>) {
    let _ = emit_si_status(&app, true, None);

    let mut buffer: Vec<u8> = Vec::new();
    let mut read_buf = [0u8; 256];

    loop {
        {
            let cancelled = {
                let state = app.state::<SiReaderState>();
                state.cancel_flag.lock().map(|f| *f).unwrap_or(false)
            };
            if cancelled {
                info!("SI reader loop cancelled");
                break;
            }
        }

        match port.read(&mut read_buf) {
            Ok(n) if n > 0 => {
                let hex: String = read_buf[..n]
                    .iter()
                    .map(|b| format!("{:02X}", b))
                    .collect::<Vec<_>>()
                    .join(" ");
                debug!("[RX RAW] {} bytes: {}", n, hex);
                buffer.extend_from_slice(&read_buf[..n]);
                process_buffer(&mut buffer, &app, &mut port);
            }
            Ok(_) => {}
            Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut => {
                continue;
            }
            Err(e) => {
                warn!("SI reader read error: {}", e);
                let _ = emit_si_status(&app, false, Some(format!("Read error: {e}")));
                break;
            }
        }
    }

    set_connected(&app, false);
    let _ = emit_si_status(&app, false, None);
    info!("SI reader loop ended");
}

fn process_buffer(
    buffer: &mut Vec<u8>,
    app: &AppHandle,
    port: &mut Box<dyn serialport::SerialPort>,
) {
    loop {
        // Skip WAKEUP (0xFF) bytes before STX, matching the decoder in sportident-rs
        while !buffer.is_empty() && buffer[0] == WAKEUP {
            buffer.remove(0);
        }

        let stx_index = match buffer.iter().position(|&b| b == STX) {
            Some(i) => i,
            None => {
                if buffer.len() > 50 {
                    buffer.clear();
                }
                return;
            }
        };

        if stx_index > 0 {
            buffer.drain(..stx_index);
        }

        let etx_index = match buffer.iter().position(|&b| b == ETX) {
            Some(i) => i,
            None => return,
        };

        let frame: Vec<u8> = buffer.drain(..=etx_index).collect();

        // Frame: STX(0) CMD(1) LEN(2) SN_HI(3) SN_LO(4) DATA(5..) CRC_HI CRC_LO ETX
        if frame.len() < 6 {
            continue;
        }

        let cmd = frame[1];
        let frame_hex: String = frame
            .iter()
            .map(|b| format!("{:02X}", b))
            .collect::<Vec<_>>()
            .join(" ");
        debug!("[Frame] CMD={:02X} Len={} Data={}", cmd, frame.len(), frame_hex);

        // Extract card number from card detection / punch frames
        // Frame layout: STX(0) CMD(1) LEN(2) SN_HI(3) SN_LO(4) DATA(5..) CRC ETX
        // Card number is in the DATA portion starting at frame[5]
        let card_number = match cmd {
            CMD_TRANS_REC | CMD_SI5_DET | CMD_SI6_DET | CMD_SI8_DET
                if frame.len() >= 9 =>
            {
                Some(decode_si_card_number(frame[5], frame[6], frame[7], frame[8]))
            }
            CMD_SI_REM => {
                debug!("SI card removed");
                None
            }
            _ => None,
        };

        if let Some(cn) = card_number {
            if cn > 0 {
                info!("SI card read: {} (CMD={:02X})", cn, cmd);

                // Trigger beep: try SIGNAL command first, then simple ACK as fallback
                let signal = build_signal_frame(1);
                if let Err(e) = send_command(port, &signal, "Signal") {
                    warn!("Signal failed ({}), trying ACK...", e);
                    let ack = build_ack_bytes();
                    if let Err(e2) = send_command(port, &ack, "ACK") {
                        warn!("ACK also failed: {}", e2);
                    }
                }

                let _ = app.emit(SI_CARD_READ_EVENT, SiCardReadPayload { card_number: cn });
            }
        }
    }
}

fn emit_si_status(app: &AppHandle, connected: bool, error: Option<String>) -> Result<(), String> {
    app.emit(
        SI_READER_STATUS_EVENT,
        SiReaderStatusPayload { connected, error },
    )
    .map_err(|e| e.to_string())
}

fn set_connected(app: &AppHandle, value: bool) {
    let state = app.state::<SiReaderState>();
    let _ = state.connected.lock().map(|mut guard| *guard = value);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_decode_si5_series0() {
        assert_eq!(decode_si_card_number(0, 0, 0x30, 0x39), 12345);
    }

    #[test]
    fn test_decode_si5_series2() {
        assert_eq!(decode_si_card_number(0, 2, 0x04, 0xD2), 201234);
    }

    #[test]
    fn test_decode_si6_plus() {
        assert_eq!(decode_si_card_number(0x00, 0x0F, 0x42, 0x40), 1000000);
    }

    // CRC test vectors from sportident.js siProtocol.test.ts
    #[test]
    fn test_crc16_empty() {
        assert_eq!(si_crc16(&[]), 0x0000);
    }

    #[test]
    fn test_crc16_one_byte() {
        // CRC16([0x01]) = [0x01, 0x00] = 0x0100
        assert_eq!(si_crc16(&[0x01]), 0x0100);
    }

    #[test]
    fn test_crc16_two_bytes() {
        // CRC16([0x12, 0x34]) = [0x12, 0x34] = 0x1234
        assert_eq!(si_crc16(&[0x12, 0x34]), 0x1234);
    }

    #[test]
    fn test_crc16_three_bytes() {
        // CRC16([0x12, 0x34, 0x56]) = [0xBA, 0xBB] = 0xBABB
        assert_eq!(si_crc16(&[0x12, 0x34, 0x56]), 0xBABB);
    }

    #[test]
    fn test_crc16_four_bytes() {
        // CRC16([0x12, 0x34, 0x56, 0x78]) = [0x1E, 0x83] = 0x1E83
        assert_eq!(si_crc16(&[0x12, 0x34, 0x56, 0x78]), 0x1E83);
    }

    #[test]
    fn test_signal_frame() {
        // SIGNAL: CMD=0xF9, params=[0x01] (1 beep)
        let frame = build_signal_frame(1);
        assert_eq!(frame[0], WAKEUP);
        assert_eq!(frame[1], STX);
        assert_eq!(frame[2], CMD_SIGNAL); // 0xF9
        assert_eq!(frame[3], 0x01); // LEN
        assert_eq!(frame[4], 0x01); // 1 beep
        assert_eq!(*frame.last().unwrap(), ETX);
    }

    #[test]
    fn test_ack_bytes() {
        assert_eq!(build_ack_bytes(), vec![WAKEUP, ACK]);
    }

    #[test]
    fn test_set_master_frame() {
        // SetMaster: CMD=0xF0, params=[0x4D]
        let frame = build_set_master_frame();
        assert_eq!(frame[0], WAKEUP);
        assert_eq!(frame[1], STX);
        assert_eq!(frame[2], CMD_SET_MASTER_SLAVE); // 0xF0
        assert_eq!(frame[3], 0x01); // LEN
        assert_eq!(frame[4], MASTER_MODE); // 0x4D
        // CRC bytes at [5..6], ETX at [7]
        assert_eq!(frame[7], ETX);
        assert_eq!(frame.len(), 8);
    }
}
