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
  # mruby/c は vm->exception を return / break / ensure の巻き戻しにも使い回すため、
  # 実行中のタスクを見ると未捕捉例外でなくても非 nil が返る。DORMANT まで待つ。
  if sandbox && !keymap_error && sandbox.state == :DORMANT
    err = sandbox.error
    keymap_error = err ? "#{err.class}: #{err.message}" : "keymap task stopped"
  end

  if keymap_error && ticks % ERROR_REPRINT_INTERVAL == 0
    print "Keymap error: #{keymap_error}\r\n"
  end

  if receiver.poll
    print "Keymap uploaded. Restarting...\r\n"
    # TODO: 既存の Sandbox タスクを停止する方法が確立したら置き換える。
    # 現状は Sandbox を新規作成してキーマップをロードする。
    sandbox = Sandbox.new or raise
    keymap_error = load_keymap(sandbox, KEYMAP_PATH)
    print "Keymap reloaded.\r\n"
  end
  ticks += 1
  sleep_ms 100
end
