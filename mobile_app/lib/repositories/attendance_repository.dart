import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/services/base_api_client.dart';
import '../models/attendance_model.dart';

abstract class IAttendanceRepository {
  Future<Map<String, dynamic>> logCheckInOut(
    String action, {
    double? lat,
    double? lng,
    String? note,
    String? staffId,
  });

  Future<List<AttendanceRecord>> fetchHistoryRecords({String? staffId, bool forceRefresh = false});

  Future<Map<String, dynamic>?> fetchCompanyWorkHours();

  Future<Map<String, dynamic>> scanQRCode(
    String qrCodeData, {
    double? lat,
    double? lng,
    String? note,
    String? staffId,
    String? action,
  });

  Future<Map<String, dynamic>> checkInFace(String base64Image);

  Future<Map<String, dynamic>> fetchCheckinOnBehalfEligibility();

  Future<Map<String, dynamic>?> fetchEmployeeFaceData(String staffId);

  Future<List<Map<String, dynamic>>> fetchAllEmployees();

  Future<Map<String, dynamic>> enrollEmployeeFace({
    required String staffId,
    required dynamic faceDescriptor,
    required String photoUrl,
  });
}

class AttendanceRepository implements IAttendanceRepository {
  final BaseApiClient _apiClient;

  AttendanceRepository(this._apiClient);

  Future<void> _invalidateCache() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('cached_attendance_history');
    } catch (_) {}
  }

  @override
  Future<Map<String, dynamic>> logCheckInOut(
    String action, {
    double? lat,
    double? lng,
    String? note,
    String? staffId,
  }) async {
    final body = {
      'action': action,
      if (staffId != null && staffId.isNotEmpty) 'staffId': staffId,
      'latitude': lat,
      'longitude': lng,
      'note': note ?? 'Mobile Punch',
    };

    final response = await _apiClient.post('/attendances/log', body: body);
    if (response != null) {
      final data = jsonDecode(response.body);
      if (response.statusCode == 200 || response.statusCode == 201) {
        await _invalidateCache(); // Invalidate local DB cache on successful check-in/out
        return {'success': true, 'data': data};
      }
      return {'success': false, 'message': data['message'] ?? 'Action failed'};
    }
    return {'success': false, 'message': 'Network error connecting to attendance DB'};
  }

  @override
  Future<List<AttendanceRecord>> fetchHistoryRecords({String? staffId, bool forceRefresh = false}) async {
    final prefs = await SharedPreferences.getInstance();

    // 1. Try reading from persistent local database cache first
    if (!forceRefresh) {
      final cachedStr = prefs.getString('cached_attendance_history');
      if (cachedStr != null && cachedStr.isNotEmpty) {
        try {
          final decoded = jsonDecode(cachedStr);
          if (decoded is List) {
            final list = decoded.map((json) => AttendanceRecord.fromJson(json)).toList();
            
            // Trigger asynchronous background sync
            _syncHistoryBackground(staffId);
            
            return list;
          }
        } catch (_) {}
      }
    }

    // 2. Cache empty or forceRefresh, request from Backend directly
    return await _syncHistoryBackground(staffId);
  }

  Future<List<AttendanceRecord>> _syncHistoryBackground(String? staffId) async {
    final query = (staffId != null && staffId.isNotEmpty) ? '?staffId=$staffId' : '';
    try {
      final response = await _apiClient.get('/attendances/history$query');
      if (response != null && response.statusCode == 200) {
        final data = jsonDecode(response.body);
        List<dynamic> list = [];
        if (data is List) {
          list = data;
        } else if (data['data'] != null && data['data'] is List) {
          list = data['data'];
        }

        // Save fresh JSON to local persistent storage
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('cached_attendance_history', jsonEncode(list));

        return list.map((json) => AttendanceRecord.fromJson(json)).toList();
      }
    } catch (_) {}

    // Return current cache if fetch failed
    final prefs = await SharedPreferences.getInstance();
    final cachedStr = prefs.getString('cached_attendance_history');
    if (cachedStr != null && cachedStr.isNotEmpty) {
      try {
        final decoded = jsonDecode(cachedStr) as List;
        return decoded.map((json) => AttendanceRecord.fromJson(json)).toList();
      } catch (_) {}
    }
    return [];
  }

  @override
  Future<Map<String, dynamic>?> fetchCompanyWorkHours() async {
    try {
      final response = await _apiClient.get('/company-work-hours');
      if (response != null && response.statusCode == 200) {
        return jsonDecode(response.body) as Map<String, dynamic>;
      }
    } catch (_) {}
    return null;
  }

  @override
  Future<Map<String, dynamic>> scanQRCode(
    String qrCodeData, {
    double? lat,
    double? lng,
    String? note,
    String? staffId,
    String? action,
  }) async {
    final body = {
      'qrToken': qrCodeData,
      'qrCode': qrCodeData,
      if (staffId != null && staffId.isNotEmpty) 'staffId': staffId,
      'action': action ?? 'checkin_1',
      'latitude': lat ?? 11.5564,
      'longitude': lng ?? 104.9282,
      if (note != null && note.isNotEmpty) 'note': note,
      'timestamp': DateTime.now().toIso8601String(),
    };

    final response = await _apiClient.post('/qrcode/scan', body: body);
    if (response != null) {
      final data = jsonDecode(response.body);
      if (response.statusCode == 200 || response.statusCode == 201) {
        await _invalidateCache(); // Invalidate local DB cache
        return {
          'success': true,
          'message': data['message'] ?? 'QR Code verified',
          'data': data,
          'action': data['action'] ?? action ?? 'checkin_1',
          'employee': data['employee'],
        };
      }
      return {'success': false, 'message': data['message'] ?? 'Invalid QR Code'};
    }
    return {'success': false, 'message': 'Network error verifying QR'};
  }

  @override
  Future<Map<String, dynamic>> checkInFace(String base64Image) async {
    final body = {
      'image': base64Image,
      'timestamp': DateTime.now().toIso8601String(),
    };

    final response = await _apiClient.post('/face/checkin', body: body);
    if (response != null) {
      final data = jsonDecode(response.body);
      if (response.statusCode == 200) {
        await _invalidateCache(); // Invalidate local DB cache on success
        return {'success': true, 'message': data['message'] ?? 'Face verified successfully'};
      }
      return {'success': false, 'message': data['message'] ?? 'Face match failed'};
    }
    return {'success': false, 'message': 'Network error during Face Scan'};
  }

  @override
  Future<Map<String, dynamic>> fetchCheckinOnBehalfEligibility() async {
    try {
      final response = await _apiClient.get('/attendances/checkin-on-behalf/eligible-employees');
      if (response != null) {
        final data = jsonDecode(response.body);
        if (response.statusCode == 200 && data is Map<String, dynamic>) {
          return data;
        }
      }
    } catch (_) {}
    return {'canCheckinOnBehalf': false, 'eligibleEmployees': []};
  }

  @override
  Future<Map<String, dynamic>?> fetchEmployeeFaceData(String staffId) async {
    try {
      final response = await _apiClient.get('/face/$staffId');
      if (response != null && response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data is Map<String, dynamic>) {
          return data;
        }
      }
    } catch (_) {}
    return null;
  }

  @override
  Future<List<Map<String, dynamic>>> fetchAllEmployees() async {
    try {
      final response = await _apiClient.get('/employees');
      if (response != null && response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data is List) {
          return data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
        }
      }
    } catch (_) {}
    return [];
  }

  @override
  Future<Map<String, dynamic>> enrollEmployeeFace({
    required String staffId,
    required dynamic faceDescriptor,
    required String photoUrl,
  }) async {
    try {
      final response = await _apiClient.post(
        '/face/enroll',
        body: {
          'staffId': staffId,
          'faceDescriptor': faceDescriptor,
          'photoUrl': photoUrl,
        },
      );
      if (response != null) {
        final data = jsonDecode(response.body);
        if (response.statusCode >= 200 && response.statusCode < 300) {
          return {'success': true, 'data': data};
        } else {
          return {'success': false, 'message': data['message'] ?? 'Enrollment failed'};
        }
      }
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
    return {'success': false, 'message': 'Network connection failed'};
  }
}

