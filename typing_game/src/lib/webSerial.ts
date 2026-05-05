/**
 * WebSerial wrapper for communicating with MidiPico.
 *
 * Implements the chunked upload protocol:
 *   PC → Pico: UPLOAD_START\n
 *   Pico → PC: UPLOAD_READY\n
 *   PC → Pico: CHUNK <hex_len>\n + <raw data>  (repeat)
 *   Pico → PC: CHUNK_OK\n
 *   PC → Pico: UPLOAD_END\n
 *   Pico → PC: UPLOAD_OK\n
 */

const CHUNK_SIZE = 256
const RESPONSE_TIMEOUT_MS = 10000

export type UploadProgress = {
  sentBytes: number
  totalBytes: number
}

export class MidiPicoSerial {
  private port: SerialPort | null = null
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null
  private readBuffer = ''

  static isSupported(): boolean {
    return 'serial' in navigator
  }

  get connected(): boolean {
    return this.port !== null
  }

  async connect(): Promise<void> {
    const port = await navigator.serial.requestPort({
      filters: [{ usbVendorId: 0xcafe, usbProductId: 0x4005 }],
    })
    await port.open({ baudRate: 115200 })

    this.port = port
    this.reader = port.readable!.getReader()
    this.writer = port.writable!.getWriter()
    this.readBuffer = ''
  }

  async disconnect(): Promise<void> {
    try {
      this.reader?.releaseLock()
      this.writer?.releaseLock()
      await this.port?.close()
    } finally {
      this.reader = null
      this.writer = null
      this.port = null
      this.readBuffer = ''
    }
  }

  async uploadFile(
    content: string,
    onProgress?: (progress: UploadProgress) => void,
  ): Promise<void> {
    if (!this.writer || !this.reader) {
      throw new Error('Not connected')
    }

    const data = new TextEncoder().encode(content)
    const totalBytes = data.byteLength

    // 1. Send UPLOAD_START
    await this.sendLine('UPLOAD_START')
    const ready = await this.readLine()
    if (ready !== 'UPLOAD_READY') {
      throw new Error(`Expected UPLOAD_READY, got: ${ready}`)
    }

    // 2. Send chunks
    let offset = 0
    while (offset < totalBytes) {
      const end = Math.min(offset + CHUNK_SIZE, totalBytes)
      const chunk = data.slice(offset, end)
      const hexLen = chunk.byteLength.toString(16)

      await this.sendLine(`CHUNK ${hexLen}`)
      await this.sendBytes(chunk)

      const ack = await this.readLine()
      if (ack !== 'CHUNK_OK') {
        throw new Error(`Expected CHUNK_OK, got: ${ack}`)
      }

      offset = end
      onProgress?.({ sentBytes: offset, totalBytes })
    }

    // 3. Send UPLOAD_END
    await this.sendLine('UPLOAD_END')
    const result = await this.readLine()
    if (result !== 'UPLOAD_OK') {
      throw new Error(`Expected UPLOAD_OK, got: ${result}`)
    }
  }

  private async sendLine(line: string): Promise<void> {
    const data = new TextEncoder().encode(line + '\n')
    await this.writer!.write(data)
  }

  private async sendBytes(data: Uint8Array): Promise<void> {
    await this.writer!.write(data)
  }

  private async readLine(): Promise<string> {
    const deadline = Date.now() + RESPONSE_TIMEOUT_MS

    while (true) {
      const newlineIdx = this.readBuffer.indexOf('\n')
      if (newlineIdx !== -1) {
        const line = this.readBuffer.slice(0, newlineIdx).replace(/\r$/, '')
        this.readBuffer = this.readBuffer.slice(newlineIdx + 1)
        return line
      }

      const remaining = deadline - Date.now()
      if (remaining <= 0) {
        throw new Error('Timeout waiting for device response')
      }

      const { value, done } = await Promise.race([
        this.reader!.read(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout waiting for device response')), remaining),
        ),
      ])

      if (done || !value) {
        throw new Error('Serial port closed unexpectedly')
      }

      this.readBuffer += new TextDecoder().decode(value)
    }
  }
}
