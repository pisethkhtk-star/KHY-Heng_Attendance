import 'dart:convert';
import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  // Candidate API base URLs for dynamic environment resolution
  static List<String> get _candidateBaseUrls {
    if (kIsWeb) {
      return ['http://localhost:5050/api', 'http://127.0.0.1:5050/api'];
    }
    try {
      if (Platform.isAndroid) {
        return [
          'http://10.0.2.2:5050/api',   // Android Emulator host loopback
          'http://127.0.0.1:5050/api',
          'http://localhost:5050/api',
        ];
      }
    } catch (_) {}
    return [
      'http://localhost:5050/api',
      'http://127.0.0.1:5050/api',
      'http://10.0.2.2:5050/api',
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
        final res = await reqFn(candidate, headers).timeout(const Duration(seconds: 6));
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

  // --- Attendance APIs ---
  static Future<Map<String, dynamic>> logCheckInOut(String action, {double? lat, double? lng, String? note}) async {
    final body = jsonEncode({
      'action': action,
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

  static Future<List<dynamic>> fetchHistoryRecords() async {
    final response = await _requestWithFallback(
      (url, headers) => http.get(
        Uri.parse('$url/attendances/history'),
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
  static Future<Map<String, dynamic>> scanQRCode(String qrCodeData) async {
    final body = jsonEncode({
      'qrCode': qrCodeData,
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
      if (response.statusCode == 200) {
        return {'success': true, 'message': data['message'] ?? 'QR Code verified'};
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
  static Future<List<dynamic>> fetchLeaveRequests() async {
    final response = await _requestWithFallback(
      (url, headers) => http.get(
        Uri.parse('$url/leaves'),
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
  }) async {
    final body = jsonEncode({
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
}

