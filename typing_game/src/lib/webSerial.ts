/**
 * WebSerial wrapper for communicating with Scrimonia.
 *
 * Implements both directions:
 *
 *   1. Chunked keymap upload protocol:
 *        PC → Pico: UPLOAD_START\n
 *        Pico → PC: UPLOAD_READY\n
 *        PC → Pico: CHUNK <hex_len>\n + <raw data>  (repeat)
 *        Pico → PC: CHUNK_OK\n
 *        PC → Pico: UPLOAD_END\n
 *        Pico → PC: UPLOAD_OK\n
 *
 *   2. Continuous CDC log stream from the device. Every line received
 *      while connected is forwarded to the `onLine` callback registered
 *      at connect() time. Lines that look like upload protocol responses
 *      are also routed to whichever uploadFile() invocation is currently
 *      awaiting them, so log lines emitted during an upload do not
 *      desynchronize the stop-and-wait protocol.
 */

const CHUNK_SIZE = 256
const RESPONSE_TIMEOUT_MS = 10000

export type UploadProgress = {
  sentBytes: number
  totalBytes: number
}

export interface ConnectOptions {
  onLine?: (line: string) => void
}

interface PendingLine {
  resolve: (line: string) => void
  reject: (err: Error) => void
  cancelled: boolean
  timer: ReturnType<typeof setTimeout> | null
}

export class ScrimoniaSerial {
  private port: SerialPort | null = null
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null
  private readBuffer = ''
  private readLoopPromise: Promise<void> | null = null
  private onLine: ((line: string) => void) | null = null
  private pendingLines: PendingLine[] = []

  static isSupported(): boolean {
    return 'serial' in navigator
  }

  get connected(): boolean {
    return this.port !== null
  }

  async connect(opts: ConnectOptions = {}): Promise<void> {
    const port = await navigator.serial.requestPort({
      filters: [{ usbVendorId: 0xcafe, usbProductId: 0x4005 }],
    })
    await port.open({ baudRate: 115200 })

    this.port = port
    this.reader = port.readable!.getReader()
    this.writer = port.writable!.getWriter()
    this.readBuffer = ''
    this.onLine = opts.onLine ?? null
    this.readLoopPromise = this.readLoop()
  }

  async disconnect(): Promise<void> {
    for (const pending of this.pendingLines) {
      if (pending.cancelled) continue
      pending.cancelled = true
      if (pending.timer !== null) clearTimeout(pending.timer)
      pending.reject(new Error('Disconnected'))
    }
    this.pendingLines = []

    try {
      // cancel() unblocks the read loop so it can exit; without this
      // releaseLock + close can hang waiting for a pending read().
      await this.reader?.cancel().catch(() => {})
      await this.readLoopPromise?.catch(() => {})
      this.writer?.releaseLock()
      await this.port?.close()
    } finally {
      this.reader = null
      this.writer = null
      this.port = null
      this.readBuffer = ''
      this.onLine = null
      this.readLoopPromise = null
    }
  }

  async uploadFile(
    content: string,
    onProgress?: (progress: UploadProgress) => void,
  ): Promise<void> {
    if (!this.writer) throw new Error('Not connected')

    const data = new TextEncoder().encode(content)
    const totalBytes = data.byteLength

    await this.sendLine('UPLOAD_START')
    const ready = await this.waitForProtocolResponse()
    if (ready !== 'UPLOAD_READY') {
      throw new Error(`Expected UPLOAD_READY, got: ${ready}`)
    }

    let offset = 0
    while (offset < totalBytes) {
      const end = Math.min(offset + CHUNK_SIZE, totalBytes)
      const chunk = data.slice(offset, end)
      const hexLen = chunk.byteLength.toString(16)

      await this.sendLine(`CHUNK ${hexLen}`)
      await this.sendBytes(chunk)

      const ack = await this.waitForProtocolResponse()
      if (ack !== 'CHUNK_OK') {
        throw new Error(`Expected CHUNK_OK, got: ${ack}`)
      }

      offset = end
      onProgress?.({ sentBytes: offset, totalBytes })
    }

    await this.sendLine('UPLOAD_END')
    const result = await this.waitForProtocolResponse()
    if (result !== 'UPLOAD_OK') {
      throw new Error(`Expected UPLOAD_OK, got: ${result}`)
    }
  }

  private async sendLine(line: string): Promise<void> {
    await this.writer!.write(new TextEncoder().encode(line + '\n'))
  }

  private async sendBytes(data: Uint8Array): Promise<void> {
    await this.writer!.write(data)
  }

  private async readLoop(): Promise<void> {
    const reader = this.reader
    if (!reader) return
    const decoder = new TextDecoder()
    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        if (!value) continue
        this.readBuffer += decoder.decode(value, { stream: true })
        let idx = this.readBuffer.indexOf('\n')
        while (idx !== -1) {
          const line = this.readBuffer.slice(0, idx).replace(/\r$/, '')
          this.readBuffer = this.readBuffer.slice(idx + 1)
          this.dispatchLine(line)
          idx = this.readBuffer.indexOf('\n')
        }
      }
    } catch {
      // stream cancelled or closed by the peer
    } finally {
      try { reader.releaseLock() } catch { /* lock already released by disconnect */ }
    }
  }

  private dispatchLine(line: string): void {
    this.onLine?.(line)
    while (this.pendingLines.length > 0) {
      const entry = this.pendingLines.shift()!
      if (entry.cancelled) continue
      entry.cancelled = true
      if (entry.timer !== null) clearTimeout(entry.timer)
      entry.resolve(line)
      return
    }
  }

  private async waitForProtocolResponse(): Promise<string> {
    const deadline = Date.now() + RESPONSE_TIMEOUT_MS
    while (true) {
      const remaining = deadline - Date.now()
      if (remaining <= 0) throw new Error('Timeout waiting for device response')
      const line = await this.waitForNextLine(remaining)
      if (this.isProtocolLine(line)) return line
    }
  }

  private waitForNextLine(timeoutMs: number): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const entry: PendingLine = { resolve, reject, cancelled: false, timer: null }
      entry.timer = setTimeout(() => {
        if (entry.cancelled) return
        entry.cancelled = true
        reject(new Error('Timeout waiting for device response'))
      }, timeoutMs)
      this.pendingLines.push(entry)
    })
  }

  private isProtocolLine(line: string): boolean {
    return line === 'UPLOAD_READY' ||
      line === 'CHUNK_OK' ||
      line === 'UPLOAD_OK' ||
      line.startsWith('UPLOAD_ERROR') ||
      line.startsWith('CHUNK_ERROR')
  }
}
