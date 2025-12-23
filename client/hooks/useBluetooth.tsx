import React, { useState, useContext, createContext, useEffect, useMemo, ReactNode } from 'react';

interface BluetoothContextType {
  device: BluetoothDevice | null;
  gattServer: BluetoothRemoteGATTServer | null;
  error: Error | null;
  connectionState: string;
  setError: (error: Error | null) => void;
  logs: string[];
  setLogs: (logs: string[]) => void;
  scanFilter: string;
  setScanFilter: (filter: string) => void;
  disconnectDevice: () => void;
  connectToDevice: (serviceUUID: string) => Promise<void>;
  addLog: (message: string) => void;
}

const BluetoothContext = createContext<BluetoothContextType | undefined>(undefined);

export const useBluetooth = (): BluetoothContextType => {
  const context = useContext(BluetoothContext);
  if (!context) {
    throw new Error('useBluetooth must be used within a BluetoothProvider');
  }
  return context;
};

interface BluetoothProviderProps {
  children: ReactNode;
}

export const BluetoothProvider = ({ children }: BluetoothProviderProps) => {
  const [connectionState, setConnectionState] = useState<string>('DISCONNECTED');
  const [device, setDevice] = useState<BluetoothDevice | null>(null);
  const [gattServer, setGattServer] = useState<BluetoothRemoteGATTServer | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [scanFilter, setScanFilter] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);

  // Helper to add log entry
  const addLog = (message: string) => {
    setLogs((prev) => [...prev, message]);
  };

  // Helper to handle errors consistently
  const handleError = (err: unknown, message?: string) => {
    const error = err instanceof Error ? err : new Error(String(err));
    setError(error);
    if (message) {
      addLog(message);
    }
    console.error(message || 'Bluetooth error:', error);
  };

  const disconnectDevice = () => {
    if (device?.gatt?.connected) {
      device.gatt.disconnect();
    }
    setDevice(null);
    setGattServer(null);
    setConnectionState('DISCONNECTED');
    addLog(`Disconnected from device: ${device?.name}`);
  };

  const connectToDevice = async (serviceUUID: string) => {
    addLog('Connecting to device...');
    setConnectionState('CONNECTING');

    try {
      if (!navigator.bluetooth) {
        throw new Error('Web Bluetooth API is not available in this browser');
      }

      const connectionParams: RequestDeviceOptions = {
        ...(scanFilter ? { filters: [{ namePrefix: scanFilter }] } : { acceptAllDevices: true }),
        optionalServices: [serviceUUID],
      };

      const bluetoothDevice = await navigator.bluetooth.requestDevice(connectionParams);
      bluetoothDevice.addEventListener('gattserverdisconnected', disconnectDevice);

      if (!bluetoothDevice.gatt) {
        throw new Error('GATT server not available');
      }

      const server = await bluetoothDevice.gatt.connect();
      setGattServer(server);
      setDevice(bluetoothDevice);
      setConnectionState('CONNECTED');
      addLog(`Connected to device: ${bluetoothDevice.name}`);
    } catch (err) {
      handleError(err, `Failed to connect to Bluetooth device: ${err}`);
      setConnectionState('DISCONNECTED');
    }
  };

  return (
    <BluetoothContext.Provider
      value={{
        device,
        gattServer,
        error,
        connectionState,
        setError,
        logs,
        setLogs,
        scanFilter,
        setScanFilter,
        disconnectDevice,
        connectToDevice,
        addLog,
      }}>
      {children}
    </BluetoothContext.Provider>
  );
};
