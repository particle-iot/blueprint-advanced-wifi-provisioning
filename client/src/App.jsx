/* global ParticleUsb */
import { useState } from "react";
import { Buffer } from "buffer";
import toast from "react-hot-toast";
import { deviceProtectionRequest } from "./api";

function App() {
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [ssids, setSsids] = useState([]);
  const [selectedSsid, setSelectedSsid] = useState(null);
  const [password, setPassword] = useState("");

  const handleGetDevices = async () => {
    try {
      setIsLoading(true);
      const filters = [
        { vendorId: 0x2b04, productId: 0xc00c }, // 0x0C = 12 = Argon
        { vendorId: 0x2b04, productId: 0xc020 }, // 0x20 = 32 = P2 and Photon 2
        { vendorId: 0x2b04, productId: 0xc023 }, // 0x23 = 35 = M-SoM
      ];
      const nativeUsbDevice = await navigator.usb.requestDevice({ filters });
      const usbDevice = await ParticleUsb.openNativeUsbDevice(
        nativeUsbDevice,
        {}
      );
      setSelectedDevice(usbDevice);
    } catch (err) {
      console.error("Error selecting device:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const unprotectDevice = async () => {
    if (!selectedDevice) return;

    const serverPrepResponse = await deviceProtectionRequest({
      action: "prepare",
    }, selectedDevice._id);
    const serverNonce = Buffer.from(serverPrepResponse.server_nonce, "base64");
    const deviceResponse = await selectedDevice.unprotectDevice({
      action: "prepare",
      serverNonce,
    });
    const deviceNonce = deviceResponse.deviceNonce;
    const deviceSignature = deviceResponse.deviceSignature;
    const devicePublicKeyFingerprint =
      deviceResponse.devicePublicKeyFingerprint;

    const serverConfirmResponse = await deviceProtectionRequest({
      action: "confirm",
      serverNonce: serverNonce.toString("base64"),
      deviceNonce: deviceNonce.toString("base64"),
      deviceSignature: deviceSignature.toString("base64"),
      devicePublicKeyFingerprint: devicePublicKeyFingerprint.toString("base64"),
    }, selectedDevice._id);

    const serverSignature = Buffer.from(
      serverConfirmResponse.server_signature,
      "base64"
    );
    const serverPublicKeyFingerprint = Buffer.from(
      serverConfirmResponse.server_public_key_fingerprint,
      "base64"
    );

    await selectedDevice.unprotectDevice({
      action: "confirm",
      serverSignature,
      serverPublicKeyFingerprint,
    });
  };

  const handleStartScan = async () => {
    if (!selectedDevice) return;

    try {
      setIsScanning(true);
      await unprotectDevice();
      setSsids([]);
      const networks = await selectedDevice.scanWifiNetworks();
      setSsids(networks);
    } catch (err) {
      console.error("Error scanning for Wi-Fi networks:", err);
      toast.error("Failed to scan for Wi-Fi networks");
    } finally {
      setIsScanning(false);
    }
  };

  const handleSelectSsid = async (ssid) => {
    setSelectedSsid(ssid);
  };

  const handleConnect = async () => {
    if (!selectedDevice || !selectedSsid) return;

    try {
      setIsConnecting(true);
      await selectedDevice.joinNewWifiNetwork({
        ssid: selectedSsid.ssid,
        password,
      });
      await selectedDevice.unprotectDevice({ action: "reset" });
      setSelectedDevice(null);
      setSelectedSsid(null);
      setSsids([]);
      setPassword("");
      toast.success("Successfully toasted!");
    } catch (err) {
      console.error("Error connecting to Wi-Fi network:", err);
    } finally {
      setIsConnecting(false);
    }
  };

  const filteredSsids = ssids.filter(
    (ssid) => ssid.ssid && ssid.ssid.length > 0
  );

  return (
    <>
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
        <div className="max-w-xl w-full items-center justify-center flex">
          {!selectedDevice && (
            <button
              onClick={handleGetDevices}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Select Device
            </button>
          )}
          {selectedDevice && !selectedSsid && (
            <div className="flex flex-col items-end space-y-4">
              <button
                onClick={handleStartScan}
                disabled={isScanning}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 hover:cursor-pointer"
              >
                {isScanning ? "Scanning..." : "Scan for Wi-Fi Networks"}
              </button>
              <div className="h-56 w-xl overflow-y-auto bg-white border border-gray-300 rounded shadow">
                {filteredSsids.map((ssid, index) => (
                  <div
                    key={index}
                    className="hover:bg-gray-100 hover:cursor-pointer w-full p-4"
                    onClick={() => handleSelectSsid(ssid)}
                  >
                    {ssid.ssid} (Signal: {ssid.rssi} dBm, Security:{" "}
                    {ssid.security})
                  </div>
                ))}
              </div>
            </div>
          )}
          {selectedDevice && selectedSsid && (
            <div className="flex w-full">
              <input
                type="password"
                placeholder={`Enter password for ${selectedSsid.ssid}`}
                className="px-4 py-2 border w-full border-gray-300 bg-white rounded mr-2"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 hover:cursor-pointer"
              >
                {isConnecting ? "Connecting..." : "Connect"}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default App;
