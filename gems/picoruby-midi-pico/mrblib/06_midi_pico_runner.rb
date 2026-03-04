class MidiPico
  class Runner
    CHORD_TIMEOUT_MS = 50

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
      @active_chord_action = nil
      @active_chord_notes = []
      @tick = 0
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
          flush_pending
          @pending.clear
        end

        @tick += 1
        Machine.delay_ms 1
      end
    end

    private

    def handle_note_on(note, velocity)
      print "NOTE_ON  #{Note.name_for(note)} velocity=#{velocity}\r\n"

      if @chord_note_set[note]
        @pending << [note, velocity]
        @pending_start = @tick if @pending.size == 1

        sorted = pending_sorted_notes
        chord_action = find_chord(sorted)
        if chord_action
          if chord_action.is_a?(Action::LayerChange)
            apply_layer_change(chord_action, sorted)
          else
            @active_chord_action = chord_action
            @active_chord_notes = sorted
            press_action(chord_action)
          end
          @pending.clear
        elsif !prefix_of_any_chord?(sorted)
          flush_pending
          @pending.clear
        end
      else
        if @pending.size > 0
          flush_pending
          @pending.clear
        end
        action = find_action(@singles[note], velocity)
        if action.is_a?(Action::LayerChange)
          apply_layer_change(action, [note])
        elsif action
          @pressed[note] = action
          press_action(action)
        end
      end
    end

    def handle_note_off(note)
      print "NOTE_OFF #{Note.name_for(note)}\r\n"

      # pending にあるノートが離された場合は除去するだけ
      # (和音判定中の超短タップ — 実用上はほぼ起きない)
      if remove_from_pending(note)
        # removed from pending, nothing else to do
      elsif @hold_returns[note]
        switch_layer(@hold_returns.delete(note))
      elsif @active_chord_notes.include?(note)
        release_action(@active_chord_action)
        @active_chord_action = nil
        @active_chord_notes = []
      else
        action = @pressed.delete(note)
        release_action(action)
      end
    end

    def switch_layer(layer_name)
      @active_layer_name = layer_name
      layer = @layers[@active_layer_name]
      @singles, @chords, @chord_note_set = layer
    end

    def press_action(action)
      if action.is_a?(Action::Modifier)
        @modifier_state = @modifier_state | action.modifier
        HidKeyboard.press(0, @modifier_state)
      elsif action.is_a?(Action::Keycode)
        HidKeyboard.press(action.keycode, @modifier_state)
      end
    end

    def release_action(action)
      if action.is_a?(Action::Modifier)
        @modifier_state = @modifier_state & ~action.modifier
      end
      if @modifier_state > 0
        HidKeyboard.press(0, @modifier_state)
      else
        HidKeyboard.release_all
      end
    end

    def apply_layer_change(action, notes)
      if action.mode == :hold
        notes.each do |n|
          @hold_returns[n] = @active_layer_name
        end
      end
      switch_layer(action.layer_name)
    end

    # pending 内の全ノートを単体ノートとして発火する
    def flush_pending
      @pending.each do |p|
        action = find_action(@singles[p[0]], p[1])
        if action.is_a?(Action::LayerChange)
          apply_layer_change(action, [p[0]])
        elsif action
          @pressed[p[0]] = action
          press_action(action)
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
      singles = {}
      chords = []
      mapping.each do |key, value|
        if key.is_a?(Array)
          pairs = []
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
      chord_note_set = {}
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
      notes = []
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

    # @pending から指定ノートを除去。除去できたら true を返す
    def remove_from_pending(note)
      i = 0
      while i < @pending.size
        if @pending[i][0] == note
          @pending.delete_at(i)
          return true
        end
        i += 1
      end
      false
    end

    # 挿入ソート (mruby/c に Array#sort がないため)
    # ブロックでソートキーを抽出する。Ruby の sort_by と同様の使い方:
    #   insertion_sort(pairs) { |x| x[0] }
    #   insertion_sort(notes) { |x| x }
    # ソートキーを事前計算して yield 呼び出しを O(n) に抑える。
    def insertion_sort(arr)
      keys = []
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
