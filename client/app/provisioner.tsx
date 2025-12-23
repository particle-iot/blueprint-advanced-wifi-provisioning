import { View } from 'react-native';
import React, { useEffect, useState, useRef } from 'react';
import { useBluetooth } from '@/hooks/useBluetooth';
import { BleControlRequestChannel } from '@particle/ecjpake';
import {
  WebBLEStream,
  WebEnv,
  getDeviceInfo,
  openControlRequestChannel,
  SSIDInfo,
  scanNetworks,
  connectToNetwork,
} from '@/lib/particleUtils';
import BleButtons from '@/components/bleButtons';
import ScanResults from '@/components/scanResults';

/*
  BLE.setProvisioningSvcUuid("6E400021-B5A3-F393-E0A9-E50E24DCCA9E");
  BLE.setProvisioningTxUuid("6E400022-B5A3-F393-E0A9-E50E24DCCA9E");
  BLE.setProvisioningRxUuid("6E400023-B5A3-F393-E0A9-E50E24DCCA9E");
  BLE.setProvisioningVerUuid("6E400024-B5A3-F393-E0A9-E50E24DCCA9E");
*/

const Provisioner = () => {
  const { gattServer } = useBluetooth();
  const [networks, setNetworks] = useState<SSIDInfo[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [readyToScan, setReadyToScan] = useState(false);

  const requestChannelRef = useRef<BleControlRequestChannel | null>(null);
  const streamRef = useRef<WebBLEStream | null>(null);
  const envRef = useRef<WebEnv>(new WebEnv());

  const serviceUUID = '6E400021-B5A3-F393-E0A9-E50E24DCCA9E'.toLowerCase();
  const rxCharacteristicUUID = '6E400023-B5A3-F393-E0A9-E50E24DCCA9E'.toLowerCase();
  const txCharacteristicUUID = '6E400022-B5A3-F393-E0A9-E50E24DCCA9E'.toLowerCase();
  const versionCharacteristicUUID = '6E400024-B5A3-F393-E0A9-E50E24DCCA9E'.toLowerCase();
  const mobileSecret = '0123456789abcde';

  const onConnect = async (server: BluetoothRemoteGATTServer) => {
    const { rxCharacteristic, txCharacteristic } = await getDeviceInfo(
      server,
      serviceUUID,
      versionCharacteristicUUID,
      rxCharacteristicUUID,
      txCharacteristicUUID
    );
    const { stream, requestChannel } = await openControlRequestChannel(
      txCharacteristic,
      rxCharacteristic,
      mobileSecret,
      envRef.current
    );
    streamRef.current = stream;
    requestChannelRef.current = requestChannel;
    setReadyToScan(true);
  };

  const handleScanNetworks = async () => {
    try {
      setIsScanning(true);
      const networks = await scanNetworks(requestChannelRef.current as BleControlRequestChannel);
      setNetworks(networks);
    } catch (error) {
      console.error('Scan networks error:', error);
    } finally {
      setIsScanning(false);
    }
  };

  const handleConnectToNetwork = async (network: SSIDInfo, password: string) => {
    try {
      console.log('Connecting to network:', network);
      const result = await connectToNetwork(
        requestChannelRef.current as BleControlRequestChannel,
        network,
        password
      );
      console.log('Connect to network result:', result);
    } catch (error) {
      console.error('Connect to network error:', error);
    }
  };

  useEffect(() => {
    if (gattServer) {
      onConnect(gattServer);
    }
  }, [gattServer]);

  return (
    <View className="flex w-full max-w-3xl flex-col items-center justify-center">
      <BleButtons
        serviceUUID={serviceUUID}
        readyToScan={readyToScan}
        isScanning={isScanning}
        handleScanNetworks={handleScanNetworks}
      />
      <ScanResults networks={networks} handleConnectToNetwork={handleConnectToNetwork} />
    </View>
  );
};

export default Provisioner;
