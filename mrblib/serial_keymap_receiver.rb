# CDC シリアル経由でキーマップファイルを受信するクラス。
# typing_game/src/lib/webSerial.ts と対応した stop-and-wait プロトコルを実装する。
#
# プロトコル:
#   PC → Pico: UPLOAD_START\n
#   Pico → PC: UPLOAD_READY\n
#   PC → Pico: CHUNK <hex_len>\n + <raw data>
#   Pico → PC: CHUNK_OK\n  (チャンクごとに繰り返し)
#   PC → Pico: UPLOAD_END\n
#   Pico → PC: UPLOAD_OK\n
class SerialKeymapReceiver
  # CDC RX バッファサイズ (CFG_TUD_CDC_RX_BUFSIZE) に合わせる。
  CHUNK_SIZE = 256

  def initialize(path)
    @path = path
  end

  # STDIN をノンブロッキングに確認し、UPLOAD_START を検出したら受信して
  # @path に保存する。受信成功時 true、それ以外 false。
  def poll
    c = STDIN.read_nonblock(1)
    return false if c.nil?

    # 最初の1文字が来たので、残りの行を読む
    line = read_line(1000)
    return false if line.nil?
    return false unless c.to_s + line == "UPLOAD_START"

    print "UPLOAD_READY\r\n"
    data = receive_chunks
    return false unless data

    File.open(@path, "w") { |f| f.write(data) }
    print "UPLOAD_OK\r\n"
    true
  end

  private

  def read_line(timeout_ms)
    buf = ""
    elapsed = 0
    while elapsed < timeout_ms
      c = STDIN.read_nonblock(1)
      if c.nil?
        sleep_ms 1
        elapsed += 1
        next
      end
      elapsed = 0
      next if c == "\r"
      return buf if c == "\n"
      buf << c
    end
    nil
  end

  def read_exact(len, timeout_ms)
    buf = ""
    elapsed = 0
    while buf.length < len && elapsed < timeout_ms
      remaining = len - buf.length
      chunk = STDIN.read_nonblock(remaining)
      if chunk.nil?
        sleep_ms 1
        elapsed += 1
        next
      end
      elapsed = 0
      buf << chunk
    end
    return nil if buf.length < len
    buf
  end

  def receive_chunks
    file_data = ""
    while true
      line = read_line(5000)
      if line.nil?
        print "UPLOAD_ERROR timeout\r\n"
        return nil
      end

      if line.start_with?("CHUNK ")
        # line.start_with?("CHUNK ") が真なので line[6..] は必ず非 nil。
        # Steep は推論できないため || "" でナローイングする。
        len = (line[6..] || "").to_i(16)
        if len <= 0 || len > CHUNK_SIZE
          print "UPLOAD_ERROR invalid chunk size\r\n"
          return nil
        end
        data = read_exact(len, 5000)
        if data.nil?
          print "CHUNK_ERROR read timeout\r\n"
          return nil
        end
        file_data << data
        print "CHUNK_OK\r\n"
      elsif line.start_with?("UPLOAD_END")
        return file_data
      else
        print "UPLOAD_ERROR unexpected: #{line}\r\n"
        return nil
      end
    end
  end
end
