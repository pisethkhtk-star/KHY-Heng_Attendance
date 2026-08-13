import 'dart:convert';
import 'package:flutter/foundation.dart' show kIsWeb, defaultTargetPlatform, TargetPlatform;
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  // Candidate API base URLs for dynamic environment resolution
  static List<String> get _candidateBaseUrls {
    const String currentWifiIp = '192.168.88.86'; // Current Wi-Fi IPv4 Address
    if (kIsWeb) {
      final String webHost = Uri.base.host.isNotEmpty ? Uri.base.host : 'localhost';
      return [
        'http://$webHost:5050/api',
        'http://$webHost:8080/api',
        'http://localhost:5050/api',
        'http://127.0.0.1:5050/api',
        'http://localhost:8080/api',
        'http://127.0.0.1:8080/api',
        'http://$currentWifiIp:5050/api',
        'http://$currentWifiIp:8080/api',
      ];
    }
    try {
      if (defaultTargetPlatform == TargetPlatform.android) {
        return [
          'http://10.0.2.2:5050/api',        // Android Emulator -> Node backend (Port 5050)
          'http://10.0.2.2:8080/api',        // Android Emulator -> Spring/Node backend (Port 8080)
          'http://$currentWifiIp:5050/api', // Physical Device on LAN -> Node backend (Port 5050)
          'http://$currentWifiIp:8080/api', // Physical Device on LAN -> Spring/Node backend (Port 8080)
          'http://127.0.0.1:5050/api',
          'http://127.0.0.1:8080/api',
        ];
      }
    } catch (_) {}
    return [
      'http://10.0.2.2:5050/api',
      'http://10.0.2.2:8080/api',
      'http://$currentWifiIp:5050/api',
      'http://$currentWifiIp:8080/api',
      'http://127.0.0.1:5050/api',
      'http://127.0.0.1:8080/api',
      'http://localhost:5050/api',
      'http://localhost:8080/api',
    ];
  }

  static String baseUrl = _candidateBaseUrls.first;

  static Future<Map<String, String>> _getHeaders() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('auth_token');
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
    };
  }

  /// Helper to send a HTTP request with automatic URL failover across candidate hosts
  static Future<http.Response?> _requestWithFallback(
    Future<http.Response> Function(String url, Map<String, String> headers) reqFn,
  ) async {
    final headers = await _getHeaders();
    for (final candidate in _candidateBaseUrls) {
      try {
        final res = await reqFn(candidate, headers).timeout(const Duration(seconds: 3));
        if (res.statusCode >= 200 && res.statusCode < 500) {
          baseUrl = candidate; // Remember working host
          return res;
        }
      } catch (_) {
        // Try next candidate host
      }
    }
    return null;
  }

  // --- Auth APIs ---
  static Future<Map<String, dynamic>> getMe() async {
    final response = await _requestWithFallback(
      (url, headers) => http.get(
        Uri.parse('$url/auth/me'),
        headers: headers,
      ),
    );

    if (response != null && response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('user_data', jsonEncode(data));
      return {'success': true, 'user': data};
    }
    return {'success': false};
  }

  static Future<Map<String, dynamic>> login(String email, String password) async {
    final body = jsonEncode({'email': email, 'password': password});
    final response = await _requestWithFallback(
      (url, headers) => http.post(
        Uri.parse('$url/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: body,
      ),
    );

    if (response != null) {
      final data = jsonDecode(response.body);
      if (response.statusCode == 200 && data['token'] != null) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('auth_token', data['token']);
        await prefs.setString('user_data', jsonEncode(data['user'] ?? {}));
        return {'success': true, 'user': data['user'], 'token': data['token']};
      } else {
        return {'success': false, 'message': data['message'] ?? 'Invalid email or password'};
      }
    }
    return {'success': false, 'message': 'Unable to connect to database server. Please verify backend is running at port 5050.'};
  }

  static Future<Map<String, dynamic>> loginWithQRCode(String qrToken) async {
    final body = jsonEncode({'qrToken': qrToken});
    final response = await _requestWithFallback(
      (url, headers) => http.post(
        Uri.parse('$url/auth/login-qr'),
        headers: {'Content-Type': 'application/json'},
        body: body,
      ),
    );

    if (response != null) {
      final data = jsonDecode(response.body);
      if (response.statusCode == 200 && data['token'] != null) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('auth_token', data['token']);
        await prefs.setString('user_data', jsonEncode(data['user'] ?? {}));
        return {'success': true, 'user': data['user'], 'token': data['token']};
      } else {
        return {'success': false, 'message': data['message'] ?? 'Invalid or expired QR code'};
      }
    }
    return {'success': false, 'message': 'Unable to connect to database server.'};
  }

  // --- Attendance APIs ---
  static Future<Map<String, dynamic>> logCheckInOut(String action, {double? lat, double? lng, String? note, String? staffId}) async {
    final body = jsonEncode({
      'action': action,
      if (staffId != null && staffId.isNotEmpty) 'staffId': staffId,
      'latitude': lat,
      'longitude': lng,
      'note': note ?? 'Mobile Punch',
    });

    final response = await _requestWithFallback(
      (url, headers) => http.post(
        Uri.parse('$url/attendances/log'),
        headers: headers,
        body: body,
      ),
    );

    if (response != null) {
      final data = jsonDecode(response.body);
      if (response.statusCode == 200 || response.statusCode == 201) {
        return {'success': true, 'data': data};
      }
      return {'success': false, 'message': data['message'] ?? 'Action failed'};
    }
    return {'success': false, 'message': 'Network error connecting to attendance DB'};
  }

  static Future<List<dynamic>> fetchHistoryRecords({String? staffId}) async {
    final query = (staffId != null && staffId.isNotEmpty) ? '?staffId=$staffId' : '';
    final response = await _requestWithFallback(
      (url, headers) => http.get(
        Uri.parse('$url/attendances/history$query'),
        headers: headers,
      ),
    );

    if (response != null && response.statusCode == 200) {
      final data = jsonDecode(response.body);
      if (data is List) return data;
      if (data['data'] != null && data['data'] is List) return data['data'];
    }
    return [];
  }

  // --- QR Code & Face Scan APIs ---
  static Future<Map<String, dynamic>> scanQRCode(String qrCodeData, {double? lat, double? lng, String? note, String? staffId, String? action}) async {
    final body = jsonEncode({
      'qrToken': qrCodeData,
      'qrCode': qrCodeData,
      if (staffId != null && staffId.isNotEmpty) 'staffId': staffId,
      'action': action ?? 'checkin_1',
      'latitude': lat ?? 11.5564,
      'longitude': lng ?? 104.9282,
      if (note != null && note.isNotEmpty) 'note': note,
      'timestamp': DateTime.now().toIso8601String(),
    });

    final response = await _requestWithFallback(
      (url, headers) => http.post(
        Uri.parse('$url/qrcode/scan'),
        headers: headers,
        body: body,
      ),
    );

    if (response != null) {
      final data = jsonDecode(response.body);
      if (response.statusCode == 200 || response.statusCode == 201) {
        if (staffId != null && staffId.isNotEmpty) {
          await logCheckInOut(action ?? 'checkin_1', lat: lat, lng: lng, note: note, staffId: staffId);
        }
        return {'success': true, 'message': data['message'] ?? 'QR Code verified', 'data': data, 'action': data['action'] ?? action ?? 'checkin_1'};
      }
      return {'success': false, 'message': data['message'] ?? 'Invalid QR Code'};
    }
    return {'success': false, 'message': 'Network error verifying QR'};
  }

  static Future<Map<String, dynamic>> checkInFace(String base64Image) async {
    final body = jsonEncode({
      'image': base64Image,
      'timestamp': DateTime.now().toIso8601String(),
    });

    final response = await _requestWithFallback(
      (url, headers) => http.post(
        Uri.parse('$url/face/checkin'),
        headers: headers,
        body: body,
      ),
    );

    if (response != null) {
      final data = jsonDecode(response.body);
      if (response.statusCode == 200) {
        return {'success': true, 'message': data['message'] ?? 'Face verified successfully'};
      }
      return {'success': false, 'message': data['message'] ?? 'Face match failed'};
    }
    return {'success': false, 'message': 'Network error during Face Scan'};
  }

  // --- Leave APIs ---
  static Future<List<dynamic>> fetchLeaveRequests({String? staffId}) async {
    final path = (staffId != null && staffId.isNotEmpty) ? '/leaves/employee/$staffId' : '/leaves';
    final response = await _requestWithFallback(
      (url, headers) => http.get(
        Uri.parse('$url$path'),
        headers: headers,
      ),
    );

    if (response != null && response.statusCode == 200) {
      final data = jsonDecode(response.body);
      if (data is List) return data;
      if (data['data'] != null && data['data'] is List) return data['data'];
    }
    return [];
  }

  static Future<List<dynamic>> fetchLeaveBalances({String? staffId}) async {
    final query = (staffId != null && staffId.isNotEmpty) ? '?staffId=$staffId' : '';
    final response = await _requestWithFallback(
      (url, headers) => http.get(
        Uri.parse('$url/leave-limits$query'),
        headers: headers,
      ),
    );

    if (response != null && response.statusCode == 200) {
      final data = jsonDecode(response.body);
      if (data is List) return data;
      if (data['data'] != null && data['data'] is List) return data['data'];
    }
    return [];
  }

  static Future<List<dynamic>> fetchLeaveTypes() async {
    final response = await _requestWithFallback(
      (url, headers) => http.get(
        Uri.parse('$url/leave-types'),
        headers: headers,
      ),
    );

    if (response != null && response.statusCode == 200) {
      final data = jsonDecode(response.body);
      if (data is List) return data;
    }
    return [];
  }

  static Future<Map<String, dynamic>> submitLeaveRequest({
    required String leaveType,
    required String startDate,
    required String endDate,
    required String reason,
    String durationType = 'Full Day',
    String? staffId,
  }) async {
    final body = jsonEncode({
      if (staffId != null && staffId.isNotEmpty) 'staffId': staffId,
      'leaveType': leaveType,
      'startDate': startDate,
      'endDate': endDate,
      'reason': reason,
      'durationType': durationType,
    });

    final response = await _requestWithFallback(
      (url, headers) => http.post(
        Uri.parse('$url/leaves'),
        headers: headers,
        body: body,
      ),
    );

    if (response != null) {
      final data = jsonDecode(response.body);
      if (response.statusCode == 200 || response.statusCode == 201) {
        return {'success': true, 'message': 'Leave request submitted successfully', 'data': data};
      }
      return {'success': false, 'message': data['message'] ?? 'Submission failed'};
    }
    return {'success': false, 'message': 'Unable to submit leave request to database'};
  }

  // --- Geofence Branch Settings ---
  static Future<List<dynamic>> fetchKioskSettings() async {
    final response = await _requestWithFallback(
      (url, headers) => http.get(
        Uri.parse('$url/kiosk-settings'),
        headers: headers,
      ),
    );

    if (response != null && response.statusCode == 200) {
      final data = jsonDecode(response.body);
      if (data is List) return data;
      if (data['data'] != null && data['data'] is List) return data['data'];
    }
    return [];
  }
}
