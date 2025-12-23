import { Aes128Cipher, BleControlRequestChannel, Env, Stream } from '@particle/ecjpake';
import EventEmitter from 'events';
import { particle } from '@particle/device-os-protobuf/src/pbjs-generated/definitions.js';
const {
  ScanNetworksRequest,
  ScanNetworksReply,
  JoinNewNetworkRequest,
  JoinNewNetworkReply,
  Credentials,
  CredentialsType,
} = particle.ctrl.wifi;
import { Buffer } from 'buffer';

// @ts-ignore - aes-js doesn't have types
import * as aesjs from 'aes-js';
import { Reader } from 'protobufjs';
import { InvalidProtocolVersionError, resultToError } from './particleErrors';

export const MAX_PACKET_SIZE = 244;
export const SCAN_NETWORKS_REQUEST_TYPE = 506;
export const JOIN_NETWORK_REQUEST_TYPE = 500;

export const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

export const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

export class WebBLEStream extends EventEmitter implements Stream {
  private writeCallback: (data: Uint8Array) => Promise<void>;

  constructor(writeCallback: (data: Uint8Array) => Promise<void>) {
    super();
    this.writeCallback = writeCallback;
  }

  write(data: Uint8Array): void {
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

  receiveData(data: Uint8Array): void {
    this.emit('data', data);
  }
}

export class WebEnv implements Env {
  createAes128Cipher(key: Uint8Array) {
    return new WebAes128Cipher(key);
  }

  async getRandomBytes(size: number): Promise<Uint8Array> {
    const array = new Uint8Array(size);
    crypto.getRandomValues(array);
    return array;
  }
}

// WebBLE-compatible AES cipher implementation
export class WebAes128Cipher implements Aes128Cipher {
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

export const getDeviceInfo = async (
  server: BluetoothRemoteGATTServer,
  serviceUUID: string,
  versionCharacteristicUUID: string,
  rxCharacteristicUUID: string,
  txCharacteristicUUID: string
): Promise<{
  rxCharacteristic: BluetoothRemoteGATTCharacteristic;
  txCharacteristic: BluetoothRemoteGATTCharacteristic;
}> => {
  const service = await server.getPrimaryService(serviceUUID);
  if (!service) {
    throw new Error('Service not found');
  }
  const characteristics = await service.getCharacteristics();
  if (!characteristics) {
    throw new Error('Characteristics not found');
  }
  const versionCharacteristic = characteristics.find((c) => c.uuid === versionCharacteristicUUID);
  const rxCharacteristic = characteristics.find((c) => c.uuid === rxCharacteristicUUID);
  const txCharacteristic = characteristics.find((c) => c.uuid === txCharacteristicUUID);
  if (!versionCharacteristic || !rxCharacteristic || !txCharacteristic) {
    throw new Error('Characteristic not found');
  }
  const version = await versionCharacteristic.readValue();
  const versionNumber = version.getUint8(0);
  if (versionNumber !== 2) {
    throw new InvalidProtocolVersionError();
  }
  return { rxCharacteristic, txCharacteristic };
};

export const openControlRequestChannel = async (
  txCharacteristic: BluetoothRemoteGATTCharacteristic,
  rxCharacteristic: BluetoothRemoteGATTCharacteristic,
  mobileSecret: string,
  env: WebEnv
): Promise<{ stream: WebBLEStream; requestChannel: BleControlRequestChannel }> => {
  // Create stream with write callback
  const stream = new WebBLEStream(async (buffer: Uint8Array) => {
    const base64 = Buffer.from(buffer).toString('base64');
    await rxCharacteristic.writeValueWithoutResponse(base64ToArrayBuffer(base64));
  });

  // Set up TX characteristic monitoring
  await txCharacteristic.startNotifications();
  txCharacteristic.addEventListener('characteristicvaluechanged', (event: Event) => {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    if (target.value && stream) {
      const buffer =
        target.value.buffer instanceof ArrayBuffer ? target.value.buffer : new ArrayBuffer(0);
      const base64 = arrayBufferToBase64(buffer);
      const data = Buffer.from(base64, 'base64');
      stream.receiveData(new Uint8Array(data));
    }
  });

  // Create encrypted request channel
  const requestChannel = new BleControlRequestChannel({
    stream: stream,
    secret: mobileSecret,
    env: env,
  });

  requestChannel.on('error', (error: Error) => {
    console.warn('Request channel error:', error);
  });

  await requestChannel.open();
  return { stream, requestChannel };
};

export const scanNetworks = async (requestChannel: BleControlRequestChannel) => {
  // Create empty scan request
  const requestData = ScanNetworksRequest.encode({}).finish();

  // Send request through encrypted channel
  const { result, data } = await requestChannel.sendRequest(
    SCAN_NETWORKS_REQUEST_TYPE,
    requestData
  );
  resultToError(result);

  // Decode protobuf reply
  const reply = ScanNetworksReply.decode(Buffer.from(data) as unknown as Reader);
  if (!reply.networks) {
    return [];
  }

  // Filter and format networks
  const scannedNetworks = reply.networks
    .filter((network) => network.ssid)
    .map((network) => ({
      ssid: network.ssid || '',
      rssi: network.rssi ?? undefined,
      security: network.security ?? undefined,
    }));

  return scannedNetworks;
};

export const connectToNetwork = async (
  requestChannel: BleControlRequestChannel,
  network: SSIDInfo,
  password: string
) => {
  const requestData = new JoinNewNetworkRequest({
    ssid: network.ssid,
    credentials: new Credentials({
      type: CredentialsType.PASSWORD,
      password: password,
    }),
  });

  const requestDataBuffer = JoinNewNetworkRequest.encode(requestData).finish();

  // Send request through encrypted channel
  const { result, data } = await requestChannel.sendRequest(
    JOIN_NETWORK_REQUEST_TYPE,
    requestDataBuffer
  );
  resultToError(result);

  // Decode protobuf reply
  const reply = JoinNewNetworkReply.decode(Buffer.from(data) as unknown as Reader);
  console.log('Connect to network reply:', reply);
  return reply;
};

export interface SSIDInfo {
  ssid: string;
  rssi?: number;
  security?: number;
}
