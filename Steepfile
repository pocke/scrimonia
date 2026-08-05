require 'steep/picoruby'

target :lib do
  picoruby_library

  check 'mrblib'
  check 'gems'
  signature 'sig'
end

target :test do
  picoruby_library
  check 'test'

  signature 'sig'
  signature 'gems/picoruby-scrimonia/sig'
  signature 'test/sig'
end

target :example do
  picoruby_library
  check 'examples'

  signature 'sig'
  signature 'examples/sig'
end
