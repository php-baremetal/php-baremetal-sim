<?php
// Event-driven runtime: there is no loop(). A press of the button on GPIO4 raises a debounced
// interrupt, the reactor delivers it as a typed event, and the listener toggles the LED on GPIO2.
// Between presses the CPU sleeps.
//   LED + 330 ohm resistor between GPIO2 and GND, push button between GPIO4 and GND.

use Baremetal\Event;
use Baremetal\Events;

const LED    = 2;
const BUTTON = 4;

final class Pressed extends Event {}

gpio_mode(LED, GPIO_OUTPUT);
$on = false;

Events::listen(Pressed::class, function (Pressed $e) use (&$on): void {
    $on = !$on;
    gpio_write(LED, $on ? 1 : 0);
    printf("button pressed -> LED %s\n", $on ? 'on' : 'off');
});

watch_gpio(BUTTON, Pressed::class);   // falling edge, debounced by the source

echo "button-events: press the button to toggle the LED\n";
