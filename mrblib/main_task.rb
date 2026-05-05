require 'littlefs'
require 'vfs'
require 'sandbox'
require 'midi_pico'

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

receiver = SerialKeymapReceiver.new(KEYMAP_PATH)

# メインループ: キーマップ受信を監視し、受信完了時にリロードする。
loop do
  if receiver.poll
    print "Keymap uploaded. Restarting...\r\n"
    # TODO: 既存の Sandbox タスクを停止する方法が確立したら置き換える。
    # 現状は Sandbox を新規作成してキーマップをロードする。
    new_sandbox = Sandbox.new
    new_sandbox.load_file(KEYMAP_PATH, join: false)
    sandbox = new_sandbox
    print "Keymap reloaded.\r\n"
  end
  sleep_ms 100
end
