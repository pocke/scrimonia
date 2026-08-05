MRuby::Build.new do |conf|

  conf.toolchain

  conf.cc.defines << "PICORB_PLATFORM_POSIX"
  conf.cc.defines << "PICORB_INT64"
  conf.cc.defines << "MRBC_TICK_UNIT=4"
  conf.cc.defines << "MRBC_TIMESLICE_TICK_COUNT=3"

  conf.femtoruby(alloc_libc: true)

  conf.gembox "minimum"
  conf.gem core: 'picoruby-machine'
  conf.gem core: 'picoruby-picotest'
end
