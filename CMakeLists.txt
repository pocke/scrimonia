cmake_minimum_required(VERSION 3.24)

include(pico_sdk_import.cmake)
include(pico_extras_import.cmake)

set(BUILD_CONFIG midipico-cortex-m0plus)
set(PICORUBY_ROOT ${CMAKE_SOURCE_DIR}/lib/picoruby)

add_compile_definitions(
  PICORB_VM_MRUBYC=1
  PICORUBY_NO_MSC=1
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
file(GLOB PORT_FILES CONFIGURE_DEPENDS
  ${PICORUBY_ROOT}/mrbgems/picoruby-gpio/ports/rp2040/*.c
  ${PICORUBY_ROOT}/mrbgems/picoruby-machine/ports/rp2040/*.c
  ${PICORUBY_ROOT}/mrbgems/picoruby-machine/ports/common/*.c
  ${PICORUBY_ROOT}/mrbgems/picoruby-io-console/ports/rp2040/*.c
  ${PICORUBY_ROOT}/mrbgems/picoruby-env/ports/rp2040/*.c
  ${PICORUBY_ROOT}/mrbgems/picoruby-filesystem-fat/ports/rp2040/*.c
)
# msc_disk.c requires PICORUBY_MSC_FLASH or PICORUBY_MSC_SD; excluded via PICORUBY_NO_MSC
list(FILTER PORT_FILES EXCLUDE REGEX "msc_disk\\.c$")

add_executable(${PROJECT_NAME}
  ${SRCS}
  ${PORT_FILES}
)

set(PICORBC ${PICORUBY_ROOT}/bin/picorbc)

add_custom_target(mrbdir ALL
  COMMAND ${CMAKE_COMMAND} -E make_directory ${CMAKE_BINARY_DIR}/mrb
)

set(RUBY_TASK_FILES main_task)
foreach(rb ${RUBY_TASK_FILES})
  add_custom_target(${rb}
    COMMAND ${PICORBC} -B${rb}
      -o${CMAKE_BINARY_DIR}/mrb/${rb}.c
      ${CMAKE_SOURCE_DIR}/mrblib/${rb}.rb
  )
endforeach(rb)

add_dependencies(${PROJECT_NAME}
  mrbdir
  ${RUBY_TASK_FILES}
)

target_include_directories(${PROJECT_NAME} PRIVATE
  ${CMAKE_SOURCE_DIR}/tinyusb
  ${CMAKE_BINARY_DIR}/mrb
  ${PICORUBY_ROOT}/include
  ${PICORUBY_ROOT}/build/${BUILD_CONFIG}/include
  ${PICORUBY_ROOT}/build/${BUILD_CONFIG}/mrbgems
  ${PICORUBY_ROOT}/mrbgems/mruby-compiler2/include
  ${PICORUBY_ROOT}/mrbgems/mruby-compiler2/lib/prism/include
  ${PICORUBY_ROOT}/mrbgems/picoruby-mrubyc/lib/mrubyc/src
  ${PICORUBY_ROOT}/mrbgems/picoruby-machine/include
  ${PICORUBY_ROOT}/mrbgems/picoruby-filesystem-fat/lib/ff14b/source
)

target_link_directories(${PROJECT_NAME} PRIVATE
  ${PICORUBY_ROOT}/build/${BUILD_CONFIG}/lib
)

target_link_libraries(${PROJECT_NAME} PRIVATE
  pico_stdlib
  pico_unique_id
  pico_aon_timer
  tinyusb_device
  tinyusb_board
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
  mruby
)

pico_add_extra_outputs(${PROJECT_NAME})
