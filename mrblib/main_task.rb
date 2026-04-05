require 'littlefs'
require 'vfs'
require 'sandbox'
require 'midi_pico'

KEYMAP_PATH = "/keymap.rb"
UPLOAD_CHUNK_SIZE = 256

# LittleFS ファイルシステムをフラッシュ上にマウント
lfs = Littlefs.new(:flash)
begin
  VFS.mount(lfs, "/")
  print "LittleFS mounted\r\n"
rescue => e
  print "LittleFS mount failed, formatting...\r\n"
  lfs.mkfs
  VFS.mount(lfs, "/")
  print "LittleFS formatted and mounted\r\n"
end

# CDC から1行読み取る (改行まで)。タイムアウト付き。
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

# CDC から指定バイト数を正確に読み取る。タイムアウト付き。
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

# UPLOAD_START を検出した後、チャンクを受信してファイルに書き込む。
def receive_upload
  file_data = ""
  while true
    line = read_line(5000)
    if line.nil?
      print "UPLOAD_ERROR timeout\r\n"
      return nil
    end

    if line.start_with?("CHUNK ")
      hex_len = line[6..]
      len = hex_len.to_i(16)
      if len <= 0 || len > UPLOAD_CHUNK_SIZE
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

# CDC 入力バッファを確認し、UPLOAD_START があればファイル受信を開始する。
# 受信成功時は true を返す。
def check_serial_upload
  c = STDIN.read_nonblock(1)
  return false if c.nil?

  # 最初の1文字が来たので、残りの行を読む
  buf = c.to_s
  line = read_line(1000)
  return false if line.nil?
  buf << line

  if buf == "UPLOAD_START"
    print "UPLOAD_READY\r\n"
    data = receive_upload
    if data
      f = File.open(KEYMAP_PATH, "w")
      f.write(data)
      f.close
      print "UPLOAD_OK\r\n"
      return true
    end
  end
  false
end

sandbox = nil
if VFS.exist?(KEYMAP_PATH)
  print "Loading #{KEYMAP_PATH}\r\n"
  sandbox = Sandbox.new
  # join: false で起動。keymap.rb 内の mp.start! は無限ループなので
  # join: true だと Sandbox#wait が STDIN を読もうとして問題になる。
  sandbox.load_file(KEYMAP_PATH, join: false)
else
  print "No #{KEYMAP_PATH} found. Waiting for upload via WebSerial.\r\n"
end

STDIN.raw!

# メインループ: キーマップ受信を監視し、受信完了時にリロードする。
loop do
  if check_serial_upload
    print "Keymap uploaded. Restarting...\r\n"
    # TODO: 既存の Sandbox タスクを停止する方法が確立したら置き換える。
    # 現状は Sandbox を新規作成してキーマップをロードする。
    sandbox = Sandbox.new
    sandbox.load_file(KEYMAP_PATH, join: false)
    print "Keymap reloaded.\r\n"
  end
  sleep_ms 100
end
