/**
 * The files a board gets when it is switched to PHP (php-baremetal fork):
 * a php-baremetal project as `phpbm init` lays it out — composer.json (the
 * firmware's packages and settings) + index.php (the code, runtime
 * init-loop: setup() once, loop() forever).
 */
export const PHP_DEFAULT_INDEX = `<?php
// PHP on an ESP32-S3 (php-baremetal). setup() runs once, loop() forever.
// The LED on the canvas is wired GPIO2 -> 330 ohm -> LED -> GND: press Run.
// Add packages (extensions, drivers, PHP extensions) with the Libraries button:
// they go into composer.json, and the next Run builds the firmware with them.

define('LED', 2);

function setup(): void {
    gpio_mode(LED, GPIO_OUTPUT);
    echo "Hello from PHP " . PHP_VERSION . "\\n";
}

function loop(int $tick): void {
    gpio_write(LED, $tick % 2);
    delay(500);
}
`;

export const PHP_DEFAULT_COMPOSER = `{
    "name": "local/my-project",
    "type": "project",
    "repositories": [
        {
            "type": "composer",
            "url": "https://repository.php-baremetal.com",
            "canonical": true
        }
    ],
    "require": {
        "php-baremetal/conductor": "^1.0",
        "php-baremetal/ext-gpio": "^1.0",
        "php-baremetal/ext-sys": "^1.0"
    },
    "config": {
        "allow-plugins": {
            "php-baremetal/conductor": true
        },
        "platform": {
            "php": "8.5.11"
        }
    },
    "extra": {
        "baremetal": {
            "sdk": "esp32@^2.0",
            "board": "generic-esp32s3-quad",
            "runtime": "init-loop",
            "storage": "embedded"
        }
    }
}
`;

export const PHP_DEFAULT_FILES = [
  { name: 'index.php', content: PHP_DEFAULT_INDEX },
  { name: 'composer.json', content: PHP_DEFAULT_COMPOSER },
];
