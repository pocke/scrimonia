require 'littlefs'
require 'vfs'
require 'sandbox'
require 'scrimonia'

KEYMAP_PATH = "/keymap.rb"

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

# キーマップのエラーはラッチして繰り返し出力する。壊れたキーマップは起動直後に
# 落ちるが、その時点では USB CDC が未接続で、cdc_out_chars が出力を捨てるため。
keymap_error = nil #: String?
ERROR_REPRINT_INTERVAL = 50 # ループ 50 回 = 約 5 秒

# 構文エラーは Sandbox#load_file 自身がこのタスクで raise するため、
# 捕まえないとメインループごと落ちてアップロードも受け付けなくなる。
def load_keymap(sandbox, path)
  # join: false で起動。keymap.rb 内の mp.start! は無限ループなので
  # join: true だと Sandbox#wait が STDIN を読もうとして問題になる。
  sandbox.load_file(path, join: false)
  nil
rescue => e
  "#{e.class}: #{e.message}"
end

sandbox = nil
if VFS.exist?(KEYMAP_PATH)
  print "Loading #{KEYMAP_PATH}\r\n"
  sandbox = Sandbox.new
  keymap_error = load_keymap(sandbox, KEYMAP_PATH)
else
  print "No #{KEYMAP_PATH} found. Waiting for upload via WebSerial.\r\n"
end

STDIN.raw!

receiver = SerialKeymapReceiver.new(KEYMAP_PATH)
ticks = 0

# メインループ: キーマップ受信を監視し、受信完了時にリロードする。
loop do
  if sandbox && !keymap_error && sandbox.state == :DORMANT
    keymap_error = "the keymap stopped"
    ticks = 0
    # Sandbox の解放が mrbc_vm_end を呼び、未捕捉例外の内容を出力する。
    # Sandbox#error で読むと、mruby/c 側が incref せずに例外を返すため
    # 参照カウントが早く 0 になり、この解放時に二重 free になる。
    sandbox = nil
  end

  if keymap_error && ticks % ERROR_REPRINT_INTERVAL == 0
    print "Keymap error: #{keymap_error}. Fix keymap.rb and upload it again.\r\n"
  end

  if receiver.poll
    print "Keymap uploaded. Restarting...\r\n"
    # TODO: 既存の Sandbox タスクを停止する方法が確立したら置き換える。
    # 現状は Sandbox を新規作成してキーマップをロードする。
    sandbox = Sandbox.new or raise
    keymap_error = load_keymap(sandbox, KEYMAP_PATH)
    ticks = 0
    print "Keymap reloaded.\r\n"
  end
  ticks += 1
  sleep_ms 100
end
