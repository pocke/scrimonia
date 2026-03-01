class MidiPico
  module Action
    class Keycode
      attr_reader :keycode

      def initialize(keycode)
        @keycode = keycode
      end
    end
  end
end
