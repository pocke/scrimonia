require 'steep/picoruby'

target :lib do
  picoruby_library

  check 'mrblib'
  check 'gems'
  signature 'sig'
end

target :example do
  picoruby_library
  check 'examples'

  signature 'sig'
  signature 'examples/sig'
end
