cmake_minimum_required(VERSION 3.24)

include(pico_sdk_import.cmake)
include(pico_extras_import.cmake)

set(BUILD_CONFIG midipico-cortex-m0plus)

add_definitions(
  -DPICORB_VM_MRUBYC
  -DDISABLE_MRUBY
  -DMRBC_NO_STDIO
  -DMRBC_REQUIRE_32BIT_ALIGNMENT
  -DMAX_REGS_SIZE=256
  -DMAX_VM_COUNT=255
  -DMAX_SYMBOLS_COUNT=1000
  -DMRBC_CONVERT_CRLF
  -DMRBC_USE_MATH
  -DMRBC_USE_FLOAT=2
  -DNO_CLOCK_GETTIME=1
  -DPICORUBY_NO_MSC
)

project(midipico C CXX ASM)

pico_sdk_init()

add_compile_options(-Wall
  -Wno-format
  -Wno-unused-function
  -Wno-maybe-uninitialized
  -fshort-enums
)

file(GLOB SRCS src/*.c)
add_executable(${PROJECT_NAME}
  ${SRCS}
  ${CMAKE_SOURCE_DIR}/lib/picoruby/mrbgems/picoruby-gpio/ports/rp2040/gpio.c
  ${CMAKE_SOURCE_DIR}/lib/picoruby/mrbgems/picoruby-machine/ports/rp2040/machine.c
  ${CMAKE_SOURCE_DIR}/lib/picoruby/mrbgems/picoruby-machine/ports/common/machine.c
  ${CMAKE_SOURCE_DIR}/lib/picoruby/mrbgems/picoruby-io-console/ports/rp2040/io-console.c
  ${CMAKE_SOURCE_DIR}/lib/picoruby/mrbgems/picoruby-env/ports/rp2040/env.c
  ${CMAKE_SOURCE_DIR}/lib/picoruby/mrbgems/picoruby-filesystem-fat/ports/rp2040/flash_disk.c
)

set(PICORBC ${CMAKE_SOURCE_DIR}/lib/picoruby/bin/picorbc)

add_custom_target(mrbdir ALL
  COMMAND ${CMAKE_COMMAND} -E make_directory ${CMAKE_SOURCE_DIR}/build/mrb
)

set(RUBY_TASK_FILES
  main_task
)
foreach(rb ${RUBY_TASK_FILES})
  add_custom_target(${rb}
    COMMAND ${PICORBC} -B${rb}
      -o${CMAKE_SOURCE_DIR}/build/mrb/${rb}.c
      ${CMAKE_SOURCE_DIR}/mrblib/${rb}.rb
  )
endforeach(rb)

add_dependencies(${PROJECT_NAME}
  mrbdir
  ${RUBY_TASK_FILES}
)

target_include_directories(${PROJECT_NAME} PRIVATE
  ${CMAKE_SOURCE_DIR}/tinyusb
  ${CMAKE_SOURCE_DIR}/lib/picoruby/mrbgems/picoruby-machine/include
  ${CMAKE_SOURCE_DIR}/lib/picoruby/mrbgems/picoruby-mrubyc/lib/mrubyc/src
  ${CMAKE_SOURCE_DIR}/lib/picoruby/mrbgems/picoruby-filesystem-fat/lib/ff14b/source
  ${CMAKE_SOURCE_DIR}/lib/picoruby/mrbgems
  ${CMAKE_SOURCE_DIR}/lib/picoruby/build/${BUILD_CONFIG}/mrbgems
  ${CMAKE_SOURCE_DIR}/lib/picoruby/build/repos/${BUILD_CONFIG}/mruby-compiler2/include
  ${CMAKE_SOURCE_DIR}/build/mrb
)

target_link_directories(${PROJECT_NAME} PRIVATE
  ${CMAKE_SOURCE_DIR}/lib/picoruby/build/${BUILD_CONFIG}/lib
)

target_link_libraries(${PROJECT_NAME} PRIVATE
  pico_stdlib
  pico_unique_id
  hardware_gpio
  hardware_rosc
  hardware_rtc
  hardware_vreg
  hardware_sync
  hardware_irq
  hardware_clocks
  hardware_flash
  hardware_adc
  hardware_uart
  hardware_dma
  hardware_i2c
  hardware_spi
  hardware_pwm
  hardware_sleep
  pico_aon_timer
  tinyusb_device
  tinyusb_board
  mruby
)

pico_add_extra_outputs(${PROJECT_NAME})
