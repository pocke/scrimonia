# @picoruby/wasm-wasi (0.9.6) の String に bytesize が無い。
# gems/picoruby-scrimonia/mrblib/02_scrimonia_action.rb の Macro#initialize が
# text.bytesize を呼ぶため、polyfill しないと Macro を含む keymap のパースが
# NoMethodError で落ちる。将来 @picoruby/wasm-wasi がネイティブの bytesize を
# 持つようになったら、この polyfill (bytes.size 経由で O(n) の Array を作る)
# で上書きしないよう respond_to? で確認する。
unless "".respond_to?(:bytesize)
  class String
    def bytesize
      bytes.size
    end
  end
end
