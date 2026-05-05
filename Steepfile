require 'steep/picoruby'

target :lib do
  # build_config から依存 gem を解析し、PicoRuby gem 同梱の RBS を読み込む。
  # picoruby_root は lib/picoruby (デフォルト)、build_config は
  # build_config/*.rb (デフォルト) を使うため引数省略。
  picoruby_library

  check 'mrblib'
  signature 'sig'
end
