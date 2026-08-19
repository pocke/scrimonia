MRuby::Build.new do |conf|

  conf.toolchain

  conf.cc.defines << "PICORB_PLATFORM_POSIX"
  conf.cc.defines << "MRBC_TICK_UNIT=4"
  conf.cc.defines << "MRBC_TIMESLICE_TICK_COUNT=3"
  # 実機 (scrimonia-cortex-m0plus) と Integer 幅・Float 有無を揃える。
  conf.cc.defines << "MRBC_USE_FLOAT=2"
  conf.cc.defines << "MRBC_USE_MATH=1"

  conf.femtoruby(alloc_libc: true)

  conf.gembox "minimum"
  conf.gem core: 'picoruby-machine'
  conf.gem core: 'picoruby-picotest'
end
