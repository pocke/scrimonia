class MidiPico
  module Action
    class Keycode
      attr_reader :keycode

      def initialize(keycode)
        @keycode = keycode
      end
    end

    class Modifier
      attr_reader :modifier

      def initialize(modifier)
        @modifier = modifier
      end
    end
  end
end
