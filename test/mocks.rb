# Runner が叩く C 拡張のスタブ。ホスト VM には picoruby-hid-keyboard /
# picoruby-midi-output が組み込まれていないため、送信されたレポートを
# 配列に記録して検証できるようにする。
#
# mruby/c はクラスレベルのインスタンス変数を持てないので状態はグローバルに置く。
$hid_reports = []
$hid_fail_after = nil
$hid_flaky = 0
$board_millis = 0
$printed = []

class HidKeyboard
  # fail_after: そのレポート数に達して以降ずっと失敗する (ホスト切断相当)
  # flaky: 最初の n 回だけ失敗して以降は成功する (tud_hid_ready 待ち相当)
  def self.reset(fail_after = nil, flaky = 0)
    $hid_reports = []
    $hid_fail_after = fail_after
    $hid_flaky = flaky
    $board_millis = 0
    $printed = []
  end

  def self.reports
    $hid_reports
  end

  def self.press(keycode, modifier = 0)
    return false unless ready?
    $hid_reports << [:press, keycode, modifier]
    true
  end

  def self.release_all
    return false unless ready?
    $hid_reports << [:release]
    true
  end

  def self.ready?
    if $hid_flaky > 0
      $hid_flaky -= 1
      return false
    end
    limit = $hid_fail_after
    limit ? $hid_reports.size < limit : true
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

def print(*args)
  args.each { |a| $printed << a.to_s }
  nil
end
