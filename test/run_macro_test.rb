class RunMacroTest < Picotest::Test
  LSHIFT = 0x02

  def setup
    HidKeyboard.reset
    @runner = Scrimonia::Runner.new([[:default, {}]])
  end

  def run_macro(text)
    @runner.run_macro(Scrimonia::Action::Macro.new(text), 60) # steep:ignore NoMethod
  end

  # 各テストの末尾の [:release] は、マクロ完走後に押下中の修飾キー状態を
  # ホストへ送り直す send_hid_release のぶん。
  def test_sends_press_and_release_for_each_character
    run_macro("ab")
    assert_equal [[:press, 0x04, 0], [:release], [:press, 0x05, 0], [:release], [:release]],
      HidKeyboard.reports
  end

  # 同一文字の連続は release を挟まないとホストが2打鍵目を落とす
  def test_repeats_release_between_identical_characters
    run_macro("ll")
    assert_equal [[:press, 0x0F, 0], [:release], [:press, 0x0F, 0], [:release], [:release]],
      HidKeyboard.reports
  end

  def test_applies_shift_modifier_and_strips_the_flag_from_the_keycode
    run_macro("A!")
    assert_equal [[:press, 0x04, LSHIFT], [:release], [:press, 0x1E, LSHIFT], [:release], [:release]],
      HidKeyboard.reports
  end

  def test_skips_carriage_return
    run_macro("a\r\n")
    assert_equal [[:press, 0x04, 0], [:release], [:press, 0x28, 0], [:release], [:release]],
      HidKeyboard.reports
  end

  def test_empty_macro_sends_only_the_trailing_release
    run_macro("")
    # 押下中の修飾キー状態をホストへ送り直す1回だけ
    assert_equal [[:release]], HidKeyboard.reports
  end

  # マクロは @modifier_state を載せないので、押下中の修飾キーを送り直して終わる
  def test_restores_modifier_state_after_sending
    @runner.instance_variable_set(:@modifier_state, LSHIFT)
    run_macro("a")
    assert_equal [[:press, 0x04, 0], [:release], [:press, 0, LSHIFT]],
      HidKeyboard.reports
  end

  def test_aborts_and_flags_release_when_a_report_never_goes_out
    HidKeyboard.reset(3)
    run_macro("abc")
    assert_equal [[:press, 0x04, 0], [:release], [:press, 0x05, 0]],
      HidKeyboard.reports
    assert @runner.instance_variable_get(:@release_pending)
  end

  def test_does_not_flag_release_when_everything_goes_out
    run_macro("abc")
    assert_false @runner.instance_variable_get(:@release_pending)
  end

  # 一時的に送れないだけならリトライして完走する
  def test_retries_until_the_endpoint_accepts_the_report
    HidKeyboard.reset(nil, 2)
    run_macro("a")
    assert_equal [[:press, 0x04, 0], [:release], [:release]], HidKeyboard.reports
  end

  def test_reports_the_triggering_note_and_count_when_finished
    run_macro("ab")
    assert_equal "{\"type\":\"macro_sent\",\"note\":60,\"name\":\"C4\",\"sent\":2}\r\n",
      $printed[-1]
  end

  # 打鍵はホストに届いているので、release で落ちた文字も sent に数える
  def test_counts_a_character_whose_press_went_out_before_aborting
    HidKeyboard.reset(3)
    run_macro("abc")
    assert_equal "{\"type\":\"macro_aborted\",\"note\":60,\"name\":\"C4\",\"sent\":2}\r\n",
      $printed[-1]
  end
end
