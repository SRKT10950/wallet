import 'dart:io';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

class DeviceIdentity {
  // Android Keystore backed secure storage
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(
      encryptedSharedPreferences: true,
    ),
  );

  static const String _keyApiKey = 'mw_api_key';
  static const String _keyDeviceSecurityKey = 'mw_device_security_key';
  static const String _keyDeviceId = 'mw_device_id';
  static const String _keyLocationId = 'mw_location_id';
  static const String _keyAuthToken = 'mw_auth_token';

  static String deviceName = 'MYWALLET-ANDROID';
  static String deviceType = 'Mobile';
  static String appName = 'My Wallet';
  static String appVersion = '1.0.0';
  static String osVersion = 'Android';

  /// Initializes device hardware info via official Android APIs
  static Future<void> initialize() async {
    final deviceInfo = DeviceInfoPlugin();
    if (Platform.isAndroid) {
      final androidInfo = await deviceInfo.androidInfo;
      final model = androidInfo.model;
      final release = androidInfo.version.release;
      final sdkInt = androidInfo.version.sdkInt;

      osVersion = 'Android $release (API $sdkInt)';
      // Generate formatted device name: MYWALLET-ANDROID-XXXX
      final prefs = await SharedPreferences.getInstance();
      String? suffix = prefs.getString('device_suffix');
      if (suffix == null) {
        suffix = model.toUpperCase().replaceAll(' ', '-').substring(0, model.length.clamp(0, 10));
        await prefs.setString('device_suffix', suffix);
      }
      deviceName = 'MYWALLET-ANDROID-$suffix';
    }
  }

  // --- Secure Storage via Android Keystore ---

  static Future<void> saveCredentials({
    required String apiKey,
    required String deviceSecurityKey,
    required String deviceId,
    required String locationId,
  }) async {
    await _storage.write(key: _keyApiKey, value: apiKey);
    await _storage.write(key: _keyDeviceSecurityKey, value: deviceSecurityKey);
    await _storage.write(key: _keyDeviceId, value: deviceId);
    await _storage.write(key: _keyLocationId, value: locationId);
  }

  static Future<String?> getApiKey() async => await _storage.read(key: _keyApiKey);
  static Future<String?> getDeviceSecurityKey() async => await _storage.read(key: _keyDeviceSecurityKey);
  static Future<String?> getDeviceId() async => await _storage.read(key: _keyDeviceId);
  static Future<String?> getLocationId() async => await _storage.read(key: _keyLocationId);

  static Future<void> saveAuthToken(String token) async {
    await _storage.write(key: _keyAuthToken, value: token);
  }

  static Future<String?> getAuthToken() async => await _storage.read(key: _keyAuthToken);

  static Future<void> clearAuthToken() async {
    await _storage.delete(key: _keyAuthToken);
  }

  static Future<bool> isEnrolled() async {
    final key = await getDeviceSecurityKey();
    return key != null && key.isNotEmpty;
  }
}
