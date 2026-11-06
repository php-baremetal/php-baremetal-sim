<?php
// I2C: list the devices on the bus, then read the time from a DS3231 real-time clock every second.
//   DS3231: SDA -> GPIO11, SCL -> GPIO10, VCC -> 3V3, GND -> GND (address 0x68)

use Baremetal\I2c\Bus;

const SDA    = 11;
const SCL    = 10;
const DS3231 = 0x68;

$rtc = null;

/** The DS3231 keeps each field in BCD: 0x59 means 59. */
function bcd(int $v): int
{
    return ($v >> 4) * 10 + ($v & 0x0F);
}

function setup(): void
{
    global $rtc;
    $bus = new Bus(sda: SDA, scl: SCL);
    foreach ($bus->scan() as $address => $info) {
        printf("found 0x%02X %s\n", $address, $info['driver'] ?? '(raw device)');
    }
    $rtc = $bus->device(DS3231);
}

function loop(int $tick): void
{
    global $rtc;
    $r = $rtc->readReg(0x00, 3);   // seconds, minutes, hours
    printf("%02d:%02d:%02d\n", bcd(ord($r[2]) & 0x3F), bcd(ord($r[1])), bcd(ord($r[0]) & 0x7F));
    delay(1000);
}
