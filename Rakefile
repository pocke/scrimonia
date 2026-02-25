require "fileutils"

PICO_SDK_TAG = "2.1.0"
BUILD_CONFIG = "midipico-cortex-m0plus"
BUILD_DIR = "build"

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

task :libmruby => "lib/picoruby" do
  config = File.expand_path("build_config/#{BUILD_CONFIG}.rb")
  FileUtils.cd "lib/picoruby" do
    sh "MRUBY_CONFIG=#{config} rake"
  end
end

task :cmake do
  FileUtils.mkdir_p BUILD_DIR
  sh "PICO_SDK_PATH=#{pico_sdk_path} PICO_EXTRAS_PATH=#{pico_extras_path} cmake -DPICO_PLATFORM=rp2040 -DPICO_BOARD=pico -DCMAKE_BUILD_TYPE=Release -B #{BUILD_DIR}"
end

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

task :deep_clean do
  FileUtils.cd "lib/picoruby" do
    config = File.expand_path("../../build_config/#{BUILD_CONFIG}.rb")
    sh "MRUBY_CONFIG=#{config} rake deep_clean"
  end
  FileUtils.rm_rf BUILD_DIR
end
