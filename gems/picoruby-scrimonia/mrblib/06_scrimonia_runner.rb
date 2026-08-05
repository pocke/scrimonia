class Scrimonia
  class Runner
    CHORD_TIMEOUT_MS = 50

    # マクロ送出時、1レポートあたり tud_hid_ready を待つ上限
    MACRO_REPORT_TIMEOUT_MS = 200
    # HID 修飾キーのビットマスク (左 Shift)
    MACRO_SHIFT_MODIFIER = 0x02

    def initialize(layer_definitions)
      @layers = {}
      layer_definitions.each do |name, mapping|
        @layers[name] = build_layer(mapping)
      end

      @active_layer_name = :default
      raise "No :default layer defined" unless @layers[@active_layer_name]
      switch_layer(@active_layer_name)

      # NOTE_OFF 時にベロシティ条件なしで正しいアクションを逆引きするため、
      # 押下中のノートとそのアクションを記録する
      @pressed = {}
      @modifier_state = 0

      # :hold モードの LayerChange で押下中のノートと戻り先レイヤーを記録
      @hold_returns = {}

      # 和音判定用: ノート入力を一時バッファして和音マッチを試みる
      @pending = []
      @pending_start = 0
      # @pending が完全マッチしたが、より長い和音にもなり得る場合の暫定マッチ。
      # [action, sorted_notes] を保持し、タイムアウト or 続行不能になったら確定発火する。
      @pending_match = nil
      @active_chord_action = nil
      @active_chord_notes = []
      @tick = 0

      # HID release が失敗した場合のリトライフラグ
      @release_pending = false

      # MidiNote アクションのベロシティパススルー用。最初の NOTE_ON が
      # 来るまではこの初期値が使われる (MIDI の最大ベロシティ)。
      @last_velocity = 127

    end

    def run
      loop do
        ev = PioUsbMidi.receive
        if ev
          status, note, velocity = ev
          if status == PioUsbMidi::NOTE_ON && velocity > 0
            handle_note_on(note, velocity)
          elsif status == PioUsbMidi::NOTE_OFF || (status == PioUsbMidi::NOTE_ON && velocity == 0)
            handle_note_off(note)
          end
        end

        if @pending.size > 0 && (@tick - @pending_start) >= CHORD_TIMEOUT_MS
          finalize_pending
        end

        # HID release が前回失敗していたらリトライ
        if @release_pending
          retry_release
        end

        @tick += 1
        # sleep はスケジューラに制御を返す。Machine.delay_ms はCPUブロッキングのため
        # 他タスク (MSC 等) を飢餓させるので使わない。
        sleep 0.001
      end
    end

    private

    def handle_note_on(note, velocity)
      print "{\"type\":\"note_on\",\"note\":#{note},\"name\":\"#{Note.name_for(note)}\",\"velocity\":#{velocity}}\r\n"

      # MidiNote アクションがベロシティをパススルーするために記録
      @last_velocity = velocity

      if @chord_note_set[note]
        @pending << [note, velocity]
        @pending_start = @tick if @pending.size == 1

        unless evaluate_pending
          # 追加したばかりの note を含めると、もはやどの和音の部分集合にもならない。
          # 旧 pending (= note 追加前) を確定処理し、note を新規 pending の起点として
          # 再評価する。こうしないと例えば [E3,G3] 暫定マッチ中に F3 が押された場合、
          # KC_Z (E3+G3) を確定発火する一方で F3 が pending クリアと共に lost する。
          @pending.pop
          finalize_pending
          @pending << [note, velocity]
          @pending_start = @tick
          evaluate_pending
        end
      else
        finalize_pending if @pending.size > 0
        action = find_action(@singles[note], velocity)
        if action.is_a?(Action::LayerChange)
          apply_layer_change(action, [note])
        elsif action
          @pressed[note] = action
          press_action(action, note)
        end
      end
    end

    def handle_note_off(note)
      print "{\"type\":\"note_off\",\"note\":#{note},\"name\":\"#{Note.name_for(note)}\"}\r\n"

      pending_entry = remove_from_pending(note)
      if pending_entry
        match = @pending_match
        if match
          # 暫定マッチがある状態で和音タップが終わりかけている。50ms 未満で
          # 弾き切られた subset 関係の和音 (例: [E3,G3] と [E3,G3,B3] が両方
          # 定義されている時の [E3,G3] のタップ) を取りこぼさないよう、
          # 暫定マッチを press+release で確定発火する。
          chord_action = match[0]
          chord_notes = match[1]
          if chord_action.is_a?(Action::LayerChange)
            apply_layer_change(chord_action, chord_notes)
          else
            press_action(chord_action, chord_notes[0])
            release_action(chord_action)
          end
          @pending.clear
          @pending_match = nil
        else
          # 和音判定中に NOTE_OFF が来た場合、単体ノートとして即発火＋即リリース。
          # MIDI キーボードは短いタップで 50ms 未満の NOTE_ON→OFF を送るため、
          # 待たずに処理しないとキー入力がロストする。
          action = find_action(@singles[note], pending_entry[1])
          if action.is_a?(Action::LayerChange)
            apply_layer_change(action, [note])
          elsif action
            press_action(action, note)
            release_action(action)
          end
        end
      elsif (return_layer = @hold_returns.delete(note))
        switch_layer(return_layer)
      elsif @active_chord_notes.include?(note)
        release_action(@active_chord_action)
        @active_chord_action = nil
        @active_chord_notes = []
      else
        action = @pressed.delete(note)
        release_action(action) if action
      end
    end

    def switch_layer(layer_name)
      @active_layer_name = layer_name
      layer = @layers[@active_layer_name]
      @singles, @chords, @chord_note_set = layer
      print "{\"type\":\"layer_change\",\"layer\":\"#{layer_name}\"}\r\n"
    end

    def press_action(action, note)
      if action.is_a?(Action::MidiNote)
        MidiOutput.note_on(action.note, @last_velocity)
      elsif action.is_a?(Action::Modifier)
        @modifier_state = @modifier_state | action.modifier
        HidKeyboard.press(0, @modifier_state)
      elsif action.is_a?(Action::Keycode)
        HidKeyboard.press(action.keycode, @modifier_state)
      elsif action.is_a?(Action::Macro)
        run_macro(action, note)
      end
    end

    # 同一文字の連続 (例: "ll") をホストが取りこぼさないよう、press と release は
    # 必ず1文字ごとに対で送る。
    def run_macro(macro, note)
      text = macro.text
      sent = 0
      i = 0
      while i < text.bytesize
        byte = text.getbyte(i)
        i += 1
        code = byte && Action::Macro.hid_code_for(byte)
        next unless code

        modifier = (code & Action::Macro::SHIFT) > 0 ? MACRO_SHIFT_MODIFIER : 0
        unless send_hid_with_retry { HidKeyboard.press(code & Action::Macro::KEYCODE_MASK, modifier) }
          abort_macro(note, sent)
          return
        end
        sent += 1
        unless send_hid_with_retry { HidKeyboard.release_all }
          abort_macro(note, sent)
          return
        end
      end

      # マクロは @modifier_state を載せずに送るため、押下中の修飾キーの状態を
      # ホストへ送り直す。
      send_hid_release
      print "{\"type\":\"macro_sent\",\"note\":#{note},\"name\":\"#{Note.name_for(note)}\",\"sent\":#{sent}}\r\n"
    end

    # 送信できないうちは MACRO_REPORT_TIMEOUT_MS までリトライする。ホスト未接続や
    # サスペンド中に無限待ちしないよう、超過したら false を返す。
    def send_hid_with_retry
      deadline = Machine.board_millis + MACRO_REPORT_TIMEOUT_MS
      return true if yield
      while Machine.board_millis <= deadline
        sleep 0.001
        return true if yield
      end
      false
    end

    def abort_macro(note, sent)
      # press 済みのキーを打ち切ると押しっぱなしになるため、メインループの
      # リトライで確実に release させる。
      @release_pending = true
      print "{\"type\":\"macro_aborted\",\"note\":#{note},\"name\":\"#{Note.name_for(note)}\",\"sent\":#{sent}}\r\n"
    end

    def release_action(action)
      if action.is_a?(Action::MidiNote)
        MidiOutput.note_off(action.note)
      elsif action.is_a?(Action::Modifier)
        @modifier_state = @modifier_state & ~action.modifier
      end

      unless action.is_a?(Action::MidiNote)
        send_hid_release
      end
    end

    def send_hid_release
      result = if @modifier_state > 0
        HidKeyboard.press(0, @modifier_state)
      else
        HidKeyboard.release_all
      end
      @release_pending = !result
    end

    def retry_release
      send_hid_release
    end

    def apply_layer_change(action, notes)
      if action.mode == :hold
        notes.each do |n|
          @hold_returns[n] = @active_layer_name
        end
      end
      switch_layer(action.layer_name)
    end

    # @pending の現在の内容に対して和音判定を行う。確定発火・暫定マッチ・
    # 待機のいずれかに進められたら true を返す。完全マッチも prefix も無い
    # (= 入力がどの和音定義からも外れた) 場合は false を返し、呼び出し側が
    # 旧 pending の整理を行う余地を残す。
    def evaluate_pending
      sorted = pending_sorted_notes
      chord_action = find_chord(sorted)

      if chord_action && !prefix_of_longer_chord?(sorted)
        commit_chord_action(chord_action, sorted)
        @pending.clear
        @pending_match = nil
        true
      elsif chord_action
        # 完全マッチだが、より長い和音 ([E3,G3] に対する [E3,G3,B3] のように) の
        # prefix にもなり得る。暫定マッチを保持してノート追加を待つ。
        @pending_match = [chord_action, sorted]
        true
      elsif prefix_of_any_chord?(sorted)
        # まだ確定しないが続行は可能
        true
      else
        false
      end
    end

    # 和音アクションを press する共通処理。LayerChange ならレイヤー切替、それ
    # 以外なら active_chord に記録した上で press する。
    def commit_chord_action(action, notes)
      if action.is_a?(Action::LayerChange)
        apply_layer_change(action, notes)
      else
        @active_chord_action = action
        @active_chord_notes = notes
        press_action(action, notes[0])
      end
    end

    # @pending を確定処理する。暫定マッチがあればそれを発火、なければ単音
    # flush。どちらでも最後に @pending と @pending_match をクリアする。
    def finalize_pending
      match = @pending_match
      if match
        commit_chord_action(match[0], match[1])
      else
        flush_pending
      end
      @pending.clear
      @pending_match = nil
    end

    # pending 内の全ノートを単体ノートとして発火する
    def flush_pending
      @pending.each do |p|
        action = find_action(@singles[p[0]], p[1])
        if action.is_a?(Action::LayerChange)
          apply_layer_change(action, [p[0]])
        elsif action
          @pressed[p[0]] = action
          press_action(action, p[0])
        end
      end
    end

    # マッピング定義をノート番号ベースの内部構造に変換する。
    #
    # 単体ノート: Note#number (Integer) をキーに、
    #   [[velocity_range_or_nil, action], ...] の配列で管理。
    # 和音: ソート済みノート番号配列と action のペアで管理。
    #   mruby/c Hash はオブジェクトキーをポインタ比較するため、
    #   Array をキーにできない。線形探索用の配列として保持する。
    def build_layer(mapping)
      singles = {} #: singles_table
      chords = [] #: Array[chord_entry]
      mapping.each do |key, value|
        if key.is_a?(Array)
          pairs = [] #: Array[chord_pair]
          key.each do |k|
            if k.is_a?(Note)
              pairs << [k.number, k.velocity]
            else
              pairs << [k, nil]
            end
          end
          chords << [insertion_sort(pairs) { |x| x[0] }, value]
        else
          if key.is_a?(Note)
            note_number = key.number
            vel = key.velocity
          else
            note_number = key
            vel = nil
          end
          singles[note_number] ||= []
          singles[note_number] << [vel, value]
        end
      end

      # 和音に含まれるノートを高速判定するための集合
      chord_note_set = {} #: Hash[Integer, true]
      chords.each do |entry|
        entry[0].each do |pair|
          chord_note_set[pair[0]] = true
        end
      end

      [singles, chords, chord_note_set]
    end

    # ベロシティ条件付きエントリを優先し、マッチしなければ条件なしにフォールバック
    def find_action(entries, velocity)
      return nil unless entries
      default_action = nil
      entries.each do |entry|
        if entry[0]
          return entry[1] if entry[0] === velocity
        else
          default_action = entry[1]
        end
      end
      default_action
    end

    # @pending のノート番号をソート済み配列として返す
    def pending_sorted_notes
      notes = [] #: Array[Integer]
      @pending.each do |p|
        notes << p[0]
      end
      insertion_sort(notes) { |x| x }
    end

    # 和音定義リストからノート番号+ベロシティ条件の完全マッチを線形探索
    def find_chord(sorted_notes)
      @chords.each do |entry|
        chord_pairs = entry[0]
        next if sorted_notes.size != chord_pairs.size
        note_match = true
        i = 0
        while i < sorted_notes.size
          unless sorted_notes[i] == chord_pairs[i][0]
            note_match = false
            break
          end
          i += 1
        end
        next unless note_match
        vel_match = true
        chord_pairs.each do |pair|
          vel_cond = pair[1]
          if vel_cond
            vel = nil
            @pending.each do |p|
              if p[0] == pair[0]
                vel = p[1]
                break
              end
            end
            unless vel_cond === vel
              vel_match = false
              break
            end
          end
        end
        return entry[1] if vel_match
      end
      nil
    end

    # sorted_notes がいずれかの和音定義の部分集合かを判定
    # (ノート番号のみで判定、ベロシティは完全マッチ時に検査する)
    def prefix_of_any_chord?(sorted_notes)
      @chords.each do |entry|
        chord_pairs = entry[0]
        if sorted_notes.size <= chord_pairs.size
          all_found = true
          sorted_notes.each do |n|
            found = false
            chord_pairs.each do |pair|
              if pair[0] == n
                found = true
                break
              end
            end
            unless found
              all_found = false
              break
            end
          end
          return true if all_found
        end
      end
      false
    end

    # sorted_notes より厳密に長い和音の部分集合かを判定。完全マッチ済みの
    # 和音が、さらに長い和音 ([E3,G3] に対する [E3,G3,B3] のような)
    # の途中状態でもあるかを区別するために使う。
    def prefix_of_longer_chord?(sorted_notes)
      @chords.each do |entry|
        chord_pairs = entry[0]
        next unless sorted_notes.size < chord_pairs.size
        all_found = true
        sorted_notes.each do |n|
          found = false
          chord_pairs.each do |pair|
            if pair[0] == n
              found = true
              break
            end
          end
          unless found
            all_found = false
            break
          end
        end
        return true if all_found
      end
      false
    end

    # @pending から指定ノートを除去。除去できたら [note, velocity] を返す
    def remove_from_pending(note)
      i = 0
      while i < @pending.size
        if @pending[i][0] == note
          return @pending.delete_at(i)
        end
        i += 1
      end
      nil
    end

    # 挿入ソート (mruby/c に Array#sort がないため)
    # ブロックでソートキーを抽出する。Ruby の sort_by と同様の使い方:
    #   insertion_sort(pairs) { |x| x[0] }
    #   insertion_sort(notes) { |x| x }
    # ソートキーを事前計算して yield 呼び出しを O(n) に抑える。
    def insertion_sort(arr)
      keys = [] #: Array[Integer | String]
      i = 0
      while i < arr.size
        keys << yield(arr[i])
        i += 1
      end

      i = 1
      while i < arr.size
        val = arr[i]
        val_key = keys[i]
        j = i - 1
        while j >= 0 && keys[j] > val_key
          arr[j + 1] = arr[j]
          keys[j + 1] = keys[j]
          j -= 1
        end
        arr[j + 1] = val
        keys[j + 1] = val_key
        i += 1
      end
      arr
    end
  end
end
