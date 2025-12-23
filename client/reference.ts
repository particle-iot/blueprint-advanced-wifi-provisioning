// Standalone WebBLE WiFi Scanner
// This replicates the functionality from the React Native BLE library using Web Bluetooth API

import { BleControlRequestChannel, Stream, Env, Aes128Cipher } from '@particle/ecjpake';
import { particle } from '@particle/device-os-protobuf/src/pbjs-generated/definitions.js';
import { Reader, Writer } from 'protobufjs';
import * as aesjs from 'aes-js';
import { Buffer } from 'buffer';
import { EventEmitter } from 'events';

const { ScanNetworksRequest, ScanNetworksReply } = particle.ctrl.wifi;

const MAX_PACKET_SIZE = 244;
const PROTOCOL_VERSION = 2;
const SCAN_NETWORKS_REQUEST_TYPE = 506;

// WebBLE-compatible AES cipher implementation
class WebAes128Cipher implements Aes128Cipher {
  private _ciph: aesjs.ModeOfOperation.ModeOfOperationECB;

  constructor(key: Uint8Array) {
    if (key.length !== 16) {
      throw new Error('Invalid key length');
    }
    this._ciph = new aesjs.ModeOfOperation.ecb(key);
  }

  async encryptBlock(block: Uint8Array): Promise<Uint8Array> {
    if (block.length !== 16) {
      throw new Error('Invalid block length');
    }
    return this._ciph.encrypt(block);
  }
}

// WebBLE-compatible environment for ECPAKE
class WebEnv implements Env {
  createAes128Cipher(key: Uint8Array) {
    return new WebAes128Cipher(key);
  }

  async getRandomBytes(size: number): Promise<Uint8Array> {
    // Web Crypto API for random bytes
    const array = new Uint8Array(size);
    crypto.getRandomValues(array);
    return array;
  }
}

// Stream implementation for bidirectional communication
class WebBLEStream extends EventEmitter implements Stream {
  private writeCallback: (data: Uint8Array) => Promise<void>;
  private receiveBuffer: Uint8Array[] = [];

  constructor(writeCallback: (data: Uint8Array) => Promise<void>) {
    super();
    this.writeCallback = writeCallback;
  }

  write(data: Uint8Array): void {
    // Split into packets and send
    this.sendData(data);
  }

  private async sendData(buffer: Uint8Array): Promise<void> {
    while (buffer.length > MAX_PACKET_SIZE) {
      const slice = buffer.slice(0, MAX_PACKET_SIZE);
      await this.writeCallback(slice);
      buffer = buffer.slice(MAX_PACKET_SIZE);
    }
    if (buffer.length > 0) {
      await this.writeCallback(buffer);
    }
  }

  // Called when data is received from BLE
  receiveData(data: Uint8Array): void {
    this.emit('data', data);
  }
}

// Main WebBLE WiFi Scanner class
export class WebBLEWiFiScanner {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private service: BluetoothRemoteGATTService | null = null;
  private versionCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private txCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private rxCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private requestChannel: BleControlRequestChannel | null = null;
  private stream: WebBLEStream | null = null;
  private env: WebEnv;

  constructor(
    private serviceUUID: string,
    private versionCharacteristicUUID: string,
    private rxCharacteristicUUID: string,
    private txCharacteristicUUID: string,
    private mobileSecret: string
  ) {
    this.env = new WebEnv();
  }

  /**
   * Connect to a BLE device and set up the communication channel
   */
  async connect(deviceNameFilter?: string): Promise<void> {
    try {
      // Request device (you can filter by name or service UUID)
      const options: RequestDeviceOptions = {
        filters: this.serviceUUID ? [{ services: [this.serviceUUID] }] : undefined,
        optionalServices: this.serviceUUID ? undefined : [this.serviceUUID],
      };

      // If filtering by name, use acceptAllDevices and check name manually
      if (deviceNameFilter) {
        options.acceptAllDevices = true;
        options.optionalServices = [this.serviceUUID];
      }

      this.device = await navigator.bluetooth.requestDevice(options);

      // Filter by name if provided
      if (deviceNameFilter && this.device.name !== deviceNameFilter) {
        throw new Error(
          `Device name mismatch: expected ${deviceNameFilter}, got ${this.device.name}`
        );
      }

      // Connect to GATT server
      this.server = await this.device.gatt!.connect();

      // Get the primary service
      this.service = await this.server.getPrimaryService(this.serviceUUID);

      // Discover characteristics
      await this.findCharacteristics();

      // Check protocol version
      await this.checkProtocolVersion();

      // Open encrypted control channel
      await this.openControlRequestChannel();
    } catch (error) {
      console.error('Connection error:', error);
      throw error;
    }
  }

  /**
   * Find and cache the required characteristics
   */
  private async findCharacteristics(): Promise<void> {
    if (!this.service) {
      throw new Error('Service not connected');
    }

    const characteristics = await this.service.getCharacteristics();

    // Find each characteristic by UUID
    this.versionCharacteristic =
      characteristics.find((c) => c.uuid === this.versionCharacteristicUUID) || null;
    this.rxCharacteristic =
      characteristics.find((c) => c.uuid === this.rxCharacteristicUUID) || null;
    this.txCharacteristic =
      characteristics.find((c) => c.uuid === this.txCharacteristicUUID) || null;

    if (!this.versionCharacteristic || !this.rxCharacteristic || !this.txCharacteristic) {
      throw new Error('Missing required characteristics');
    }

    // Check properties
    if (!this.versionCharacteristic.properties.read) {
      throw new Error('Version characteristic is not readable');
    }
    if (!this.rxCharacteristic.properties.notify) {
      throw new Error('RX characteristic does not support notifications');
    }
    if (!this.txCharacteristic.properties.writeWithoutResponse) {
      throw new Error('TX characteristic does not support write without response');
    }
  }

  /**
   * Read and verify protocol version
   */
  private async checkProtocolVersion(): Promise<void> {
    if (!this.versionCharacteristic) {
      throw new Error('Version characteristic not found');
    }

    const dataView = await this.versionCharacteristic.readValue();
    const version = dataView.getUint8(0);

    if (version !== PROTOCOL_VERSION) {
      throw new Error(`Unsupported protocol version: ${version}, expected ${PROTOCOL_VERSION}`);
    }

    console.log(`Protocol version verified: ${version}`);
  }

  /**
   * Set up the encrypted bidirectional communication channel
   */
  private async openControlRequestChannel(): Promise<void> {
    if (!this.txCharacteristic || !this.rxCharacteristic) {
      throw new Error('Characteristics not found');
    }

    // Create stream with write callback
    this.stream = new WebBLEStream(async (buffer: Uint8Array) => {
      // Convert to base64 and write to TX characteristic
      const base64 = Buffer.from(buffer).toString('base64');
      await this.txCharacteristic!.writeValueWithoutResponse(this.base64ToArrayBuffer(base64));
    });

    // Set up RX characteristic monitoring
    await this.rxCharacteristic.startNotifications();
    this.rxCharacteristic.addEventListener('characteristicvaluechanged', (event: Event) => {
      const target = event.target as BluetoothRemoteGATTCharacteristic;
      if (target.value) {
        // Convert from base64 to Uint8Array
        const base64 = this.arrayBufferToBase64(target.value.buffer);
        const data = Buffer.from(base64, 'base64');
        this.stream!.receiveData(new Uint8Array(data));
      }
    });

    // Create encrypted request channel
    this.requestChannel = new BleControlRequestChannel({
      stream: this.stream,
      secret: this.mobileSecret,
      env: this.env,
    });

    this.requestChannel.on('error', (error: Error) => {
      console.warn('Request channel error:', error);
    });

    await this.requestChannel.open();
    console.log('Control request channel opened');
  }

  /**
   * Scan for WiFi networks
   */
  async scanNetworks(): Promise<Array<{ ssid: string; rssi?: number; security?: number }>> {
    if (!this.requestChannel) {
      throw new Error('Not connected. Call connect() first.');
    }

    try {
      // Create empty scan request
      const requestData = ScanNetworksRequest.encode({}).finish();

      // Send request through encrypted channel
      const { result, data } = await this.requestChannel.sendRequest(
        SCAN_NETWORKS_REQUEST_TYPE,
        requestData
      );

      // Check result (you may want to implement resultToError similar to the library)
      if (result !== 0) {
        throw new Error(`Request failed with result code: ${result}`);
      }

      // Decode protobuf reply
      const reply = ScanNetworksReply.decode(Buffer.from(data) as unknown as Reader);

      if (!reply.networks) {
        return [];
      }

      // Filter and format networks
      return reply.networks
        .filter((network) => network.ssid)
        .map((network) => ({
          ssid: network.ssid || '',
          rssi: network.rssi,
          security: network.security,
        }));
    } catch (error) {
      console.error('Scan networks error:', error);
      throw error;
    }
  }

  /**
   * Disconnect from the device
   */
  async disconnect(): Promise<void> {
    if (this.rxCharacteristic) {
      try {
        await this.rxCharacteristic.stopNotifications();
      } catch (e) {
        console.warn('Error stopping notifications:', e);
      }
    }

    if (this.requestChannel) {
      this.requestChannel.close();
      this.requestChannel = null;
    }

    this.stream = null;
    this.versionCharacteristic = null;
    this.rxCharacteristic = null;
    this.txCharacteristic = null;
    this.service = null;

    if (this.server) {
      if (this.server.connected) {
        this.server.disconnect();
      }
      this.server = null;
    }

    this.device = null;
  }

  // Helper methods for base64 conversion
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}

// Usage example:
async function scanWiFiNetworks() {
  // You need to provide these UUIDs - they should match your device
  const serviceUUID = 'your-service-uuid-here';
  const versionCharacteristicUUID = 'your-version-characteristic-uuid';
  const rxCharacteristicUUID = 'your-rx-characteristic-uuid';
  const txCharacteristicUUID = 'your-tx-characteristic-uuid';
  const mobileSecret = 'your-mobile-secret-here'; // Same secret used in React Native version

  const scanner = new WebBLEWiFiScanner(
    serviceUUID,
    versionCharacteristicUUID,
    rxCharacteristicUUID,
    txCharacteristicUUID,
    mobileSecret
  );

  try {
    // Connect to device (optionally filter by name)
    await scanner.connect(/* 'DeviceName-XXXX' */);

    // Scan for networks
    const networks = await scanner.scanNetworks();

    console.log('Found WiFi networks:');
    networks.forEach((network) => {
      console.log(`  - ${network.ssid} (RSSI: ${network.rssi}, Security: ${network.security})`);
    });

    // Disconnect when done
    await scanner.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

// Export for use
export { scanWiFiNetworks };
