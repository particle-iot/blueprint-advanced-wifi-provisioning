/*
 * Project myProject
 * Author: Your Name
 * Date:
 * For comprehensive documentation and examples, please visit:
 * https://docs.particle.io/firmware/best-practices/firmware-template/
 */

// Include Particle Device OS APIs
#include "Particle.h"

// Let Device OS manage the connection to the Particle Cloud
SYSTEM_MODE(AUTOMATIC);

// Run the application and system concurrently in separate threads
#ifndef SYSTEM_VERSION_v620
SYSTEM_THREAD(ENABLED); // System thread defaults to on in 6.2.0 and later and this line is not required
#endif

// Show system, cloud connectivity, and application logs over USB
// View logs with CLI using 'particle serial monitor --follow'
SerialLogHandler logHandler(LOG_LEVEL_INFO);

STARTUP(System.enableFeature(FEATURE_DISABLE_LISTENING_MODE));

// setup() runs once, when the device is first turned on
void setup()
{
  // Put initialization like pinMode and begin functions here
  BLE.setProvisioningSvcUuid("6E400021-B5A3-F393-E0A9-E50E24DCCA9E");
  BLE.setProvisioningTxUuid("6E400022-B5A3-F393-E0A9-E50E24DCCA9E");
  BLE.setProvisioningRxUuid("6E400023-B5A3-F393-E0A9-E50E24DCCA9E");
  BLE.setProvisioningVerUuid("6E400024-B5A3-F393-E0A9-E50E24DCCA9E");
  BLE.setProvisioningCompanyId(0x1234);
  BLE.setDeviceName("Acme Sensor");

  char arr[HAL_DEVICE_SECRET_SIZE] = {};
  memcpy(arr, "0123456789abcde", HAL_DEVICE_SECRET_SIZE);
  hal_set_device_secret(arr, sizeof(arr), nullptr);

  BLE.provisioningMode(true);
}

// loop() runs over and over again, as quickly as it can execute.
void loop()
{
  // The core of your code will likely live here.

  // Example: Publish event to cloud every 10 seconds. Uncomment the next 3 lines to try it!
  // Log.info("Sending Hello World to the cloud!");
  // Particle.publish("Hello world!");
  // delay( 10 * 1000 ); // milliseconds and blocking - see docs for more info!
}
