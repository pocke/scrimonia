MRuby::CrossBuild.new("midipico-cortex-m0plus") do |conf|

  conf.toolchain

  conf.cc.command = "arm-none-eabi-gcc"
  conf.linker.command = "arm-none-eabi-ld"
  conf.linker.flags << "-static"
  conf.archiver.command = "arm-none-eabi-ar"

  conf.cc.host_command = "gcc"

  conf.cc.flags.flatten!
  conf.cc.flags << "-mcpu=cortex-m0plus"
  conf.cc.flags << "-mthumb"
  conf.cc.flags << "-fshort-enums"
  conf.cc.flags << "-Wall"
  conf.cc.flags << "-Wno-format"
  conf.cc.flags << "-Wno-unused-function"
  conf.cc.flags << "-ffunction-sections"
  conf.cc.flags << "-fdata-sections"

  conf.cc.defines << "PICORUBY_INT64"
  conf.cc.defines << "MRBC_REQUIRE_32BIT_ALIGNMENT=1"
  conf.cc.defines << "MRBC_CONVERT_CRLF=1"
  conf.cc.defines << "MRBC_USE_FLOAT=2"
  conf.cc.defines << "MRBC_USE_MATH=1"
  conf.cc.defines << "MRBC_TICK_UNIT=1"
  conf.cc.defines << "MRBC_TIMESLICE_TICK_COUNT=10"
  conf.cc.defines << "NO_CLOCK_GETTIME=1"
  conf.cc.defines << "MAX_SYMBOLS_COUNT=1000"

  # picoruby() must be called before gembox so that vm_mrubyc? returns true
  conf.mrubyc_hal_arm
  conf.picoruby(alloc_libc: false)

  conf.gembox "minimum"
  conf.gem core: 'picoruby-require'
  conf.gem core: 'picoruby-machine'
  conf.gem core: 'picoruby-gpio'
  conf.gem gemdir: '../gems/picoruby-pio-usb-midi'
  conf.gem gemdir: '../gems/picoruby-hid-keyboard'

end
