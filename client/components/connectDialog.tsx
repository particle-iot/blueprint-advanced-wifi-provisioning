import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { View } from 'react-native';
import { SSIDInfo } from '@/lib/particleUtils';
import { useState } from 'react';

const ConnectDialog = ({
  children,
  handleConnect,
  network,
}: {
  children: React.ReactNode;
  handleConnect: (network: SSIDInfo, password: string) => Promise<void>;
  network: SSIDInfo;
}) => {
  const [password, setPassword] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const handleConnectToNetwork = async () => {
    setConnecting(true);
    await handleConnect(network, password);
    setConnecting(false);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {children}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect to {network.ssid}</DialogTitle>
        </DialogHeader>

        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">
              <Text>Cancel</Text>
            </Button>
          </DialogClose>
          <Button onPress={handleConnectToNetwork} disabled={connecting}>
            <Text>{connecting ? 'Connecting...' : 'Connect'}</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConnectDialog;
