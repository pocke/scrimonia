require 'machine'
require 'pio_usb_midi'
require 'hid_keyboard'

class MidiPico
  CHORD_TIMEOUT_MS = 50

  def initialize
    @layers = {}
  end

  # マッピング定義をノート番号ベースの内部構造に変換する。
  #
  # 単体ノート: Note#number (Integer) をキーに、
  #   [[velocity_range_or_nil, action], ...] の配列で管理。
  # 和音: ソート済みノート番号配列と action のペアで管理。
  #   mruby/c Hash はオブジェクトキーをポインタ比較するため、
  #   Array をキーにできない。線形探索用の配列として保持する。
  def add_layer(name, mapping)
    singles = {}
    chords = []
    mapping.each do |key, value|
      if key.is_a?(Array)
        notes = []
        key.each do |k|
          notes << (k.is_a?(Note) ? k.number : k)
        end
        chords << [sort_notes(notes), value]
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
      entry[0].each do |n|
        chord_note_set[n] = true
      end
    end

    @layers[name] = [singles, chords, chord_note_set]
  end

  def start!
    layer = @layers[:default]
    raise "No :default layer defined" unless layer

    singles, chords, chord_note_set = layer
    has_chords = chords.size > 0

    # NOTE_OFF 時にベロシティ条件なしで正しいアクションを逆引きするため、
    # 押下中のノートとそのアクションを記録する
    pressed = {}
    modifier_state = 0

    # 和音判定用: ノート入力を一時バッファして和音マッチを試みる
    pending = []
    pending_start = 0
    active_chord_action = nil
    active_chord_notes = []
    tick = 0

    loop do
      ev = PioUsbMidi.receive
      if ev
        status, note, velocity = ev
        if status == PioUsbMidi::NOTE_ON && velocity > 0
          print "NOTE_ON  #{Note.name_for(note)} velocity=#{velocity}\r\n"

          if has_chords && chord_note_set[note]
            pending << [note, velocity]
            pending_start = tick if pending.size == 1

            sorted = pending_sorted_notes(pending)
            chord_action = find_chord(sorted, chords)
            if chord_action
              active_chord_action = chord_action
              active_chord_notes = sorted
              if chord_action.is_a?(Action::Modifier)
                modifier_state = modifier_state | chord_action.modifier
                HidKeyboard.press(0, modifier_state)
              elsif chord_action.is_a?(Action::Keycode)
                HidKeyboard.press(chord_action.keycode, modifier_state)
              end
              pending.clear
            elsif !prefix_of_any_chord?(sorted, chords)
              modifier_state = flush_pending(pending, singles, pressed, modifier_state)
              pending.clear
            end
          else
            if pending.size > 0
              modifier_state = flush_pending(pending, singles, pressed, modifier_state)
              pending.clear
            end
            action = find_action(singles[note], velocity)
            pressed[note] = action
            if action.is_a?(Action::Modifier)
              modifier_state = modifier_state | action.modifier
              HidKeyboard.press(0, modifier_state)
            elsif action.is_a?(Action::Keycode)
              HidKeyboard.press(action.keycode, modifier_state)
            end
          end

        elsif status == PioUsbMidi::NOTE_OFF || (status == PioUsbMidi::NOTE_ON && velocity == 0)
          print "NOTE_OFF #{Note.name_for(note)}\r\n"

          # pending にあるノートが離された場合は除去するだけ
          # (和音判定中の超短タップ — 実用上はほぼ起きない)
          if remove_from_pending(pending, note)
            # removed from pending, nothing else to do
          elsif active_chord_notes.include?(note)
            if active_chord_action.is_a?(Action::Modifier)
              modifier_state = modifier_state & ~active_chord_action.modifier
            end
            active_chord_action = nil
            active_chord_notes = []
            if modifier_state > 0
              HidKeyboard.press(0, modifier_state)
            else
              HidKeyboard.release_all
            end
          else
            action = pressed.delete(note)
            if action.is_a?(Action::Modifier)
              modifier_state = modifier_state & ~action.modifier
            end
            if modifier_state > 0
              HidKeyboard.press(0, modifier_state)
            else
              HidKeyboard.release_all
            end
          end
        end
      end

      if pending.size > 0 && (tick - pending_start) >= CHORD_TIMEOUT_MS
        modifier_state = flush_pending(pending, singles, pressed, modifier_state)
        pending.clear
      end

      tick += 1
      Machine.delay_ms 1
    end
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

  # pending のノート番号をソート済み配列として返す
  def pending_sorted_notes(pending)
    notes = []
    pending.each do |p|
      notes << p[0]
    end
    sort_notes(notes)
  end

  # 和音定義リストから完全マッチを線形探索
  def find_chord(sorted_notes, chords)
    chords.each do |entry|
      return entry[1] if arrays_equal?(sorted_notes, entry[0])
    end
    nil
  end

  # sorted_notes がいずれかの和音定義の部分集合かを判定
  def prefix_of_any_chord?(sorted_notes, chords)
    chords.each do |entry|
      chord = entry[0]
      if sorted_notes.size <= chord.size
        all_found = true
        sorted_notes.each do |n|
          unless chord.include?(n)
            all_found = false
            break
          end
        end
        return true if all_found
      end
    end
    false
  end

  # pending 内の全ノートを単体ノートとして発火する
  def flush_pending(pending, singles, pressed, modifier_state)
    pending.each do |p|
      action = find_action(singles[p[0]], p[1])
      pressed[p[0]] = action
      if action.is_a?(Action::Modifier)
        modifier_state = modifier_state | action.modifier
        HidKeyboard.press(0, modifier_state)
      elsif action.is_a?(Action::Keycode)
        HidKeyboard.press(action.keycode, modifier_state)
      end
    end
    modifier_state
  end

  # pending から指定ノートを除去。除去できたら true を返す
  def remove_from_pending(pending, note)
    i = 0
    while i < pending.size
      if pending[i][0] == note
        pending.delete_at(i)
        return true
      end
      i += 1
    end
    false
  end

  # Integer 配列の挿入ソート (mruby/c に Array#sort がないため)
  def sort_notes(arr)
    i = 1
    while i < arr.size
      key = arr[i]
      j = i - 1
      while j >= 0 && arr[j] > key
        arr[j + 1] = arr[j]
        j -= 1
      end
      arr[j + 1] = key
      i += 1
    end
    arr
  end

  def arrays_equal?(a, b)
    return false if a.size != b.size
    i = 0
    while i < a.size
      return false if a[i] != b[i]
      i += 1
    end
    true
  end
end
