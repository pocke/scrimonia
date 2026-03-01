class MidiPico
  class Note
    attr_reader :number, :velocity

    def initialize(number, velocity: nil)
      @number = number
      @velocity = velocity
    end

    def with(velocity:)
      Note.new(@number, velocity: velocity)
    end
  end
end
