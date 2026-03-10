require 'filesystem-fat'
require 'vfs'
require 'sandbox'
require 'midi_pico'

KEYMAP_PATH = "/keymap.rb"

# FAT ファイルシステムをフラッシュ上にマウント
fat = FAT.new(:flash, label: "MidiPico")
begin
  VFS.mount(fat, "/")
  print "FAT mounted\r\n"
rescue => e
  print "FAT mount failed, formatting...\r\n"
  fat.mkfs
  VFS.mount(fat, "/")
  print "FAT formatted and mounted\r\n"
end

if VFS.exist?(KEYMAP_PATH)
  print "Loading #{KEYMAP_PATH}\r\n"
  sandbox = Sandbox.new
  # join: false で起動。keymap.rb 内の mp.start! は無限ループなので
  # join: true だと Sandbox#wait が STDIN を読もうとして問題になる。
  sandbox.load_file(KEYMAP_PATH, join: false)
else
  print "No #{KEYMAP_PATH} found.\r\n"
  print "Drop keymap.rb onto the MidiPico USB drive.\r\n"
end

# keymap.rb が Sandbox タスクとして動いている間、main_task は idle で待機。
# sleep はスケジューラに制御を返す (Machine.delay_ms はCPUをブロックするので使わない)。
loop do
  sleep 1
end
