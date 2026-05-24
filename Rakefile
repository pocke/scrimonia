require "fileutils"

PICO_SDK_TAG = "2.1.0"
BUILD_CONFIG = "scrimonia-cortex-m0plus"
BUILD_DIR = "build"

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
    config = File.expand_path("../../build_config/#{BUILD_CONFIG}.rb")
    sh "MRUBY_CONFIG=#{config} rake deep_clean"
  end
  FileUtils.rm_rf BUILD_DIR
end
