# Prebuilt php-baremetal firmware (not in git)

The gallery's php-baremetal examples load `<example>.bin` from here
(`ExampleBoard.prebuiltFirmwareUrl`). The images are merged flash images
(`phpbm build --merged`, ESP32-S3 `generic-esp32s3-quad`), about 4 MB each,
so they are not committed:

- local build: `tools/build-firmware.sh` in the php-baremetal simulation workspace
  copies them here;
- Docker/CI: `Dockerfile.standalone` downloads them from `PHP_BAREMETAL_FW_URL`
  (a release with `blink-sos.bin`, `button-led.bin`, …) when the files are missing.
