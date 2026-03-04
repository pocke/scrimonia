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

    class LayerChange
      attr_reader :layer_name, :mode

      def initialize(layer_name, mode)
        @layer_name = layer_name
        @mode = mode  # :hold or :switch
      end
    end
  end
end
