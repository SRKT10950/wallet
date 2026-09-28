import 'dart:convert';
import 'package:http/http.dart' as http;
import 'device_identity.dart';

class ApiClient {
  // Configurable API Base URL pointing to deployed Coolify domain
  static String baseUrl = 'https://wallet.mhservice.co.in/api/v1';

  static Future<Map<String, String>> _getSecurityHeaders() async {
    final apiKey = await DeviceIdentity.getApiKey() ?? 'mw_live_android_app_key_secure_2026';
    final deviceKey = await DeviceIdentity.getDeviceSecurityKey() ?? '';
    final locationId = await DeviceIdentity.getLocationId() ?? '';
    final token = await DeviceIdentity.getAuthToken();

    final headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-API-Key': apiKey,
      'X-Device-Security-Key': deviceKey,
      'X-Device-Name': DeviceIdentity.deviceName,
      'X-Device-Type': DeviceIdentity.deviceType,
      'X-App-Name': 'My Wallet Android',
    };

    if (locationId.isNotEmpty) {
      headers['X-Location'] = locationId;
    }

    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }

    return headers;
  }

  static Future<dynamic> get(String endpoint) async {
    final headers = await _getSecurityHeaders();
    final response = await http.get(Uri.parse('$baseUrl$endpoint'), headers: headers);
    return _handleResponse(response);
  }

  static Future<dynamic> post(String endpoint, Map<String, dynamic> body) async {
    final headers = await _getSecurityHeaders();
    final response = await http.post(
      Uri.parse('$baseUrl$endpoint'),
      headers: headers,
      body: jsonEncode(body),
    );
    return _handleResponse(response);
  }

  static dynamic _handleResponse(http.Response response) {
    try {
      final json = jsonDecode(response.body);
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return json['data'];
      } else {
        final error = json['error']?['message'] ?? 'Request failed (${response.statusCode})';
        throw Exception(error);
      }
    } catch (e) {
      if (e is FormatException) {
        throw Exception('Server returned invalid response');
      }
      rethrow;
    }
  }

  /// Self-enrolls Android device with backend
  static Future<bool> enrollDevice({
    required String apiKey,
    String? locationId,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/devices/register'),
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'X-App-Name': 'My Wallet Android',
      },
      body: jsonEncode({
        'deviceName': DeviceIdentity.deviceName,
        'deviceType': DeviceIdentity.deviceType,
        'locationId': locationId,
        'osVersion': DeviceIdentity.osVersion,
        'appVersion': DeviceIdentity.appVersion,
      }),
    );

    final json = jsonDecode(response.body);
    if (json['success'] == true && json['data']?['deviceSecurityKey'] != null) {
      final data = json['data'];
      await DeviceIdentity.saveCredentials(
        apiKey: apiKey,
        deviceSecurityKey: data['deviceSecurityKey'],
        deviceId: data['deviceId'] ?? '',
        locationId: data['locationId'] ?? '',
      );
      return true;
    }
    return false;
  }
}
