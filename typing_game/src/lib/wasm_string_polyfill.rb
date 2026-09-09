# @picoruby/wasm-wasi (0.9.6) の String に bytesize が無い。
# gems/picoruby-scrimonia/mrblib/02_scrimonia_action.rb の Macro#initialize が
# text.bytesize を呼ぶため、polyfill しないと Macro を含む keymap のパースが
# NoMethodError で落ちる。
class String
  def bytesize
    bytes.size
  end
end
