require "fileutils"

PICO_SDK_TAG = "2.1.0"
BUILD_CONFIG = "scrimonia-cortex-m0plus"
HOST_BUILD_CONFIG = "scrimonia-host"
BUILD_DIR = "build"

PICORUBY_BIN = "lib/picoruby/build/host/bin/femtoruby"
PICOTEST_PATH = "lib/picoruby/mrbgems/picoruby-picotest/mrblib/picotest.rb"

# 04 の KC_* が 02 の Action::Keycode を、06 が 01 の Note を参照するため、依存順に並べる。
# mocks は Runner を再オープンするので最後に置く。
TEST_LOAD_FILES = %w[
  gems/picoruby-scrimonia/mrblib/01_scrimonia_note.rb
  gems/picoruby-scrimonia/mrblib/02_scrimonia_action.rb
  gems/picoruby-scrimonia/mrblib/04_scrimonia_keycodes.rb
  gems/picoruby-scrimonia/mrblib/06_scrimonia_runner.rb
  test/mocks.rb
]

# pico-sdk と pico-extras は PicoRuby の R2P2 gem に git submodule として含まれている。
# 環境変数で外部のパスを指定することも可能。
def pico_sdk_path
  ENV["PICO_SDK_PATH"] || File.expand_path("lib/picoruby/mrbgems/picoruby-r2p2/lib/pico-sdk")
end

def pico_extras_path
  ENV["PICO_EXTRAS_PATH"] || File.expand_path("lib/picoruby/mrbgems/picoruby-r2p2/lib/pico-extras")
end

task :default do
  puts "Usage:"
  puts "  rake setup   # initialize submodules and install dependencies"
  puts "  rake all     # build everything"
  puts "  rake test    # run tests on the host PicoRuby VM"
  puts "  rake clean   # clean build artifacts"
end

# ファームウェアのフルビルド。3段階を順に実行する:
#   1. libmruby: mruby/c VM と gem を ARM 向けにクロスコンパイルして libmruby.a を生成
#   2. cmake:    pico-sdk 等の依存関係を解決し、CMake のビルドシステムを生成
#   3. build:    C ソースと libmruby.a をリンクして .uf2 ファームウェアを生成
task :all => [:libmruby, :cmake, :build]

task :setup do
  sh "git submodule update --init --recursive"
  FileUtils.cd "lib/picoruby" do
    sh "bundle install"
  end
end

file "lib/picoruby" do
  sh "git submodule update --init --recursive"
end

# Stage 1: PicoRuby (mruby/c VM + gem) のクロスコンパイル
# build_config/scrimonia-cortex-m0plus.rb の設定に従い、
# arm-none-eabi-gcc で Cortex-M0+ 向けの libmruby.a を生成する。
# このライブラリには VM 本体、組み込み gem のCコード、picogem_init.c が含まれる。
task :libmruby => "lib/picoruby" do
  config = File.expand_path("build_config/#{BUILD_CONFIG}.rb")
  FileUtils.cd "lib/picoruby" do
    sh "MRUBY_CONFIG=#{config} rake"
  end
end

# Stage 2: CMake のビルドシステム生成
# pico-sdk / pico-extras のパスを渡し、RP2040 (Pico) 向けの
# Makefile を build/ ディレクトリに生成する。
task :cmake do
  FileUtils.mkdir_p BUILD_DIR
  sh "PICO_SDK_PATH=#{pico_sdk_path} PICO_EXTRAS_PATH=#{pico_extras_path} cmake -DPICO_PLATFORM=rp2040 -DPICO_BOARD=pico -DCMAKE_BUILD_TYPE=Release -B #{BUILD_DIR}"
end

# Stage 3: ファームウェアのビルド
# CMake が生成した Makefile を実行し、C ソース・ポートファイル・libmruby.a を
# リンクして scrimonia.uf2 を生成する。
task :build do
  sh "cmake --build #{BUILD_DIR}"
end

# picotest はテスト本体をこの VM のサブプロセスとして実行する。CRuby ではなく
# mruby/c 上で走るため、String がバイト単位であるなどの差異を踏んだまま検証できる。
task :host_vm => "lib/picoruby" do
  config = File.expand_path("build_config/#{HOST_BUILD_CONFIG}.rb")
  FileUtils.cd "lib/picoruby" do
    sh "MRUBY_CONFIG=#{config} rake"
  end
end

desc "run tests"
task :test => :host_vm do
  require_relative PICOTEST_PATH

  ENV['RUBY'] = File.expand_path(PICORUBY_BIN)

  runner = Picotest::Runner.new(
    File.expand_path("test"),
    load_files: TEST_LOAD_FILES.map { |f| File.expand_path(f) },
  )
  exit 1 if runner.run > 0
end

task :clean do
  FileUtils.cd "lib/picoruby" do
    config = File.expand_path("../../build_config/#{BUILD_CONFIG}.rb")
    sh "MRUBY_CONFIG=#{config} rake clean"
  end
  if Dir.exist?(BUILD_DIR)
    begin
      sh "cmake --build #{BUILD_DIR} --target clean"
    rescue => e
      puts "Ignoring: #{e.message}"
    end
  end
end

# libmruby の中間ファイルも含めた完全クリーン
task :deep_clean do
  FileUtils.cd "lib/picoruby" do
    [BUILD_CONFIG, HOST_BUILD_CONFIG].each do |name|
      config = File.expand_path("../../build_config/#{name}.rb")
      sh "MRUBY_CONFIG=#{config} rake deep_clean"
    end
  end
  FileUtils.rm_rf BUILD_DIR
end
