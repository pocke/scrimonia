class Scrimonia
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

    class MidiNote
      attr_reader :note

      def initialize(note)
        @note = note
      end
    end

    class Macro
      # hid_code_for の戻り値の bit7。HID Usage ID は 0x73 までしか使わないので衝突しない。
      SHIFT = 0x80

      attr_reader :text

      def initialize(text)
        i = 0
        while i < text.bytesize
          byte = text.getbyte(i)
          # CR は打鍵に対応しないが、"\r\n" が Enter 2回にならないよう
          # 例外にはせず送出時に読み飛ばす。
          if byte && byte != 0x0D && Macro.hid_code_for(byte).nil?
            raise ArgumentError, "Macro cannot type byte #{byte} at index #{i}: #{text}"
          end
          i += 1
        end
        @text = text
      end

      # US 配列の ASCII 1バイトを HID Usage ID に変換する。bit7 が立っていれば
      # Shift が必要。変換できないバイトは nil を返す。
      #
      # Hash や文字列テーブルは常時ヒープに載るが、case/when はバイトコードとして
      # flash に載るだけなのでヒープを消費しない。
      def self.hid_code_for(byte)
        case byte
        when 0x61..0x7A then 0x04 + byte - 0x61           # a-z
        when 0x41..0x5A then SHIFT | (0x04 + byte - 0x41) # A-Z
        when 0x31..0x39 then 0x1E + byte - 0x31           # 1-9
        when 0x30 then 0x27                               # 0
        when 0x0A then 0x28                               # \n -> Enter
        when 0x09 then 0x2B                               # \t -> Tab
        when 0x20 then 0x2C                               # space
        when 0x2D then 0x2D                               # -
        when 0x3D then 0x2E                               # =
        when 0x5B then 0x2F                               # [
        when 0x5D then 0x30                               # ]
        when 0x5C then 0x31                               # \
        when 0x3B then 0x33                               # ;
        when 0x27 then 0x34                               # '
        when 0x60 then 0x35                               # `
        when 0x2C then 0x36                               # ,
        when 0x2E then 0x37                               # .
        when 0x2F then 0x38                               # /
        when 0x21 then SHIFT | 0x1E                       # !
        when 0x40 then SHIFT | 0x1F                       # @
        when 0x23 then SHIFT | 0x20                       # #
        when 0x24 then SHIFT | 0x21                       # $
        when 0x25 then SHIFT | 0x22                       # %
        when 0x5E then SHIFT | 0x23                       # ^
        when 0x26 then SHIFT | 0x24                       # &
        when 0x2A then SHIFT | 0x25                       # *
        when 0x28 then SHIFT | 0x26                       # (
        when 0x29 then SHIFT | 0x27                       # )
        when 0x5F then SHIFT | 0x2D                       # _
        when 0x2B then SHIFT | 0x2E                       # +
        when 0x7B then SHIFT | 0x2F                       # {
        when 0x7D then SHIFT | 0x30                       # }
        when 0x7C then SHIFT | 0x31                       # |
        when 0x3A then SHIFT | 0x33                       # :
        when 0x22 then SHIFT | 0x34                       # "
        when 0x7E then SHIFT | 0x35                       # ~
        when 0x3C then SHIFT | 0x36                       # <
        when 0x3E then SHIFT | 0x37                       # >
        when 0x3F then SHIFT | 0x38                       # ?
        end
      end
    end
  end
end
