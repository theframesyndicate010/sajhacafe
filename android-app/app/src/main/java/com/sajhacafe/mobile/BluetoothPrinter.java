package com.sajhacafe.mobile;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.UUID;

final class BluetoothPrinter {
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private static final String PREFS = "native_printer";
    private static final String ADDRESS_KEY = "address";
    private static final String ID_KEY = "opaque_id";
    private final Context context;
    private final SharedPreferences prefs;
    private BluetoothSocket socket;

    BluetoothPrinter(Context context) {
        this.context = context.getApplicationContext();
        this.prefs = this.context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private BluetoothAdapter adapter() throws Exception {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && context.checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
            throw new Exception("Allow Nearby devices permission for Sajha Cafe in Android settings, then retry.");
        }
        BluetoothManager manager = (BluetoothManager) context.getSystemService(Context.BLUETOOTH_SERVICE);
        BluetoothAdapter adapter = manager == null ? null : manager.getAdapter();
        if (adapter == null) throw new Exception("Bluetooth unavailable on this Android device.");
        if (!adapter.isEnabled()) throw new Exception("Bluetooth is turned off. Enable it, then retry.");
        return adapter;
    }

    JSONArray pairedPrinters() throws Exception {
        BluetoothAdapter adapter = adapter();
        Set<BluetoothDevice> bonded = adapter.getBondedDevices();
        List<BluetoothDevice> devices = new ArrayList<>(bonded);
        Collections.sort(devices, (a,b) -> safeName(a).compareToIgnoreCase(safeName(b)));
        JSONArray result = new JSONArray();
        for (BluetoothDevice device : devices) {
            JSONObject item = new JSONObject();
            item.put("id", opaqueId(device.getAddress()));
            item.put("name", safeName(device));
            result.put(item);
        }
        return result;
    }

    JSONObject select(String id) throws Exception {
        for (int i = 0; i < pairedPrinters().length(); i++) {
            JSONObject item = pairedPrinters().getJSONObject(i);
            if (id.equals(item.getString("id"))) {
                String address = findAddress(id);
                if (!address.equals(prefs.getString(ADDRESS_KEY, ""))) closeSocket();
                prefs.edit().putString(ADDRESS_KEY, address).putString(ID_KEY, id).apply();
                return new JSONObject().put("selected", true).put("id", id).put("name", item.getString("name"));
            }
        }
        throw new Exception("That printer is no longer paired. Pair it in Android Bluetooth settings and try again.");
    }

    JSONObject status() throws Exception {
        String id = prefs.getString(ID_KEY, "");
        String address = prefs.getString(ADDRESS_KEY, "");
        if (id.isEmpty() || address.isEmpty()) return new JSONObject().put("status", "running").put("transport", "unconfigured");
        BluetoothDevice device = adapter().getRemoteDevice(address);
        boolean connected = socket != null && socket.isConnected();
        return new JSONObject().put("status", connected ? "connected" : "not-connected").put("transport", "android-bluetooth").put("connected", connected).put("printerId", id).put("printerName", safeName(device));
    }

    JSONObject connect(String requestedId) throws Exception {
        BluetoothDevice device = selectedDevice(requestedId);
        open(device);
        return new JSONObject().put("status", "connected").put("printerId", requestedId).put("printerName", safeName(device));
    }

    JSONObject print(String requestedId, byte[] bytes, int copies) throws Exception {
        BluetoothDevice device = selectedDevice(requestedId);
        BluetoothSocket connectedSocket = open(device);
        try {
            OutputStream output = connectedSocket.getOutputStream();
            int safeCopies = Math.max(1, Math.min(copies, 5));
            for (int i = 0; i < safeCopies; i++) output.write(bytes);
            output.flush();
        } catch (Exception error) {
            closeSocket();
            throw new Exception("Printer write failed. Check printer power and Bluetooth pairing, then reconnect.", error);
        }
        return new JSONObject().put("status", "printed").put("printerName", safeName(device));
    }

    JSONObject disconnect() {
        closeSocket();
        prefs.edit().remove(ADDRESS_KEY).remove(ID_KEY).apply();
        return new JSONObject().put("status", "disconnected");
    }

    private BluetoothDevice selectedDevice(String requestedId) throws Exception {
        String id = prefs.getString(ID_KEY, "");
        String address = prefs.getString(ADDRESS_KEY, "");
        if (id.isEmpty() || address.isEmpty()) throw new Exception("Printer not configured. Open Settings → Printer and select a paired Bluetooth printer.");
        if (!id.equals(requestedId)) throw new Exception("Selected printer changed. Reconnect the printer in Settings → Printer.");
        return adapter().getRemoteDevice(address);
    }

    private synchronized BluetoothSocket open(BluetoothDevice device) throws Exception {
        if (socket != null && socket.isConnected()) return socket;
        closeSocket();
        BluetoothSocket pending = device.createRfcommSocketToServiceRecord(SPP_UUID);
        try {
            adapter().cancelDiscovery();
            pending.connect();
            socket = pending;
            return socket;
        } catch (Exception error) {
            try { pending.close(); } catch (Exception ignored) { }
            throw new Exception("Bluetooth unavailable: could not connect to " + safeName(device) + " over SPP/RFCOMM. Confirm it is on, paired, and not connected to another device.", error);
        }
    }

    private synchronized void closeSocket() {
        if (socket == null) return;
        try { socket.close(); } catch (Exception ignored) { }
        socket = null;
    }

    private String findAddress(String id) throws Exception {
        for (BluetoothDevice device : adapter().getBondedDevices()) if (opaqueId(device.getAddress()).equals(id)) return device.getAddress();
        throw new Exception("Printer not found in paired Android devices.");
    }

    private static String safeName(BluetoothDevice device) {
        try { String name = device.getName(); return name == null || name.trim().isEmpty() ? "Bluetooth printer" : name; }
        catch (SecurityException ignored) { return "Bluetooth printer"; }
    }

    private static String opaqueId(String address) throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(address.toUpperCase().getBytes(StandardCharsets.UTF_8));
        StringBuilder value = new StringBuilder();
        for (int i = 0; i < 8; i++) value.append(String.format("%02x", digest[i]));
        return value.toString();
    }
}
