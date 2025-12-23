import { View } from 'react-native';
import React from 'react';
import { Text } from './ui/text';
import { Button } from './ui/button';
import { SSIDInfo } from '@/lib/particleUtils';
import { DialogTrigger } from './ui/dialog';
import ConnectDialog from './connectDialog';

const ScanResults = ({
  networks,
  handleConnectToNetwork,
}: {
  networks: SSIDInfo[];
  handleConnectToNetwork: (network: SSIDInfo, password: string) => Promise<void>;
}) => {
  return (
    <View className="mt-4 max-h-96 w-full overflow-y-auto border border-border p-4">
      <Text className="font-semibold">Found {networks?.length} networks:</Text>
      {networks?.map((network, index) => (
        <View key={index} className="mt-2 rounded border border-border p-4">
          <Text className="font-semibold">{network.ssid || '(Hidden)'}</Text>
          {network.rssi !== undefined && <Text>RSSI: {network.rssi} dBm</Text>}
          {network.security !== undefined && (
            <Text>Security: {network.security === 0 ? 'Open' : `WPA${network.security}`}</Text>
          )}
          <ConnectDialog handleConnect={handleConnectToNetwork} network={network}>
            <DialogTrigger asChild>
              <Button className="mt-2" variant="secondary">
                <Text>Connect</Text>
              </Button>
            </DialogTrigger>
          </ConnectDialog>
        </View>
      ))}
    </View>
  );
};

export default ScanResults;
