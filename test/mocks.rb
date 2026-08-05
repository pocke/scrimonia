# Runner が叩く C 拡張のスタブ。ホスト VM には picoruby-hid-keyboard /
# picoruby-midi-output が組み込まれていないため、送信されたレポートを
# 配列に記録して検証できるようにする。
#
# mruby/c はクラスレベルのインスタンス変数を持てないので状態はグローバルに置く。
$hid_reports = []
$hid_fail_after = nil
$board_millis = 0

class HidKeyboard
  def self.reset(fail_after = nil)
    $hid_reports = []
    $hid_fail_after = fail_after
    $board_millis = 0
  end

  def self.reports
    $hid_reports
  end

  def self.press(keycode, modifier = 0)
    return false if full?
    $hid_reports << [:press, keycode, modifier]
    true
  end

  def self.release_all
    return false if full?
    $hid_reports << [:release]
    true
  end

  def self.full?
    limit = $hid_fail_after
    limit ? limit <= $hid_reports.size : false
  end
end

class MidiOutput
  def self.note_on(note, velocity)
    true
  end

  def self.note_off(note, velocity = 0)
    true
  end
end

# 呼ばれるたびに 1ms 進む。send_hid_with_retry のタイムアウトを実時間の経過に
# 頼らず決定的に踏ませるため。
module Machine
  def self.board_millis
    $board_millis += 1
  end
end
