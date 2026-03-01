class MidiPico
  class Note
    NOTE_NAMES = ["C", "Cs", "D", "Ds", "E", "F", "Fs", "G", "Gs", "A", "As", "B"]

    attr_reader :number, :velocity

    def initialize(number, velocity: nil)
      @number = number
      @velocity = velocity
    end

    def with(velocity:)
      Note.new(@number, velocity: velocity)
    end

    # MIDI note number to human-readable name (e.g. 60 → "C4")
    def self.name_for(number)
      octave = number / 12 - 1
      name = NOTE_NAMES[number % 12]
      "#{name}#{octave}"
    end
  end
end
