require 'gpio'

led = GPIO.new(25, GPIO::OUT)

loop do
  #led.write 1
  sleep 1
  #led.write 0
  sleep 1
end
