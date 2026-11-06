/**
 * Build-time feature switches (php-baremetal fork).
 *
 * VITE_ENABLE_COMPILE=false builds a "firmware only" frontend for a public
 * instance whose backend runs with VELXIO_ENABLE_COMPILE=0: the Compile and
 * Compile All buttons are hidden, and Run boots the firmware a board already
 * holds (a prebuilt example, or "Upload firmware") instead of rebuilding it.
 * Unset keeps upstream behaviour.
 */
export const COMPILE_ENABLED: boolean = import.meta.env.VITE_ENABLE_COMPILE !== 'false';
