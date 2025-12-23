import { View } from 'react-native';
import React from 'react';
import { Button } from './ui/button';
import { Text } from './ui/text';
import { useBluetooth } from '@/hooks/useBluetooth';
const BleButtons = ({
  serviceUUID,
  readyToScan,
  isScanning,
  handleScanNetworks,
}: {
  serviceUUID: string;
  readyToScan: boolean;
  isScanning: boolean;
  handleScanNetworks: () => void;
}) => {
  const { connectionState, connectToDevice, disconnectDevice } = useBluetooth();
  return (
    <View className="flex w-full flex-row items-center justify-between">
      {(connectionState === 'DISCONNECTED' || connectionState === 'CONNECTING') && (
        <Button
          className="w-1/5"
          onPress={() => connectToDevice(serviceUUID)}
          disabled={connectionState == 'CONNECTING'}>
          <Text>{connectionState === 'DISCONNECTED' ? 'Connect' : 'Connecting...'}</Text>
        </Button>
      )}
      {connectionState === 'CONNECTED' && (
        <Button
          className="w-1/5"
          variant="destructive"
          onPress={disconnectDevice}
          disabled={connectionState !== 'CONNECTED'}>
          <Text>Disconnect</Text>
        </Button>
      )}
      <Text className="w-3/5 text-center">{connectionState}</Text>
      <Button
        variant="default"
        className="w-1/5"
        onPress={handleScanNetworks}
        disabled={!readyToScan || isScanning || connectionState !== 'CONNECTED'}>
        <Text>
          {!readyToScan && connectionState === 'CONNECTED'
            ? 'Loading...'
            : isScanning
              ? 'Scanning...'
              : 'Scan Networks'}
        </Text>
      </Button>
    </View>
  );
};

export default BleButtons;
