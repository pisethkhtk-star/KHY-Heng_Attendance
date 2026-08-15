import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/services/base_api_client.dart';
import '../models/overtime_model.dart';

abstract class IOvertimeRepository {
  Future<List<OvertimeItem>> fetchOvertimeRequests({String? staffId, bool forceRefresh = false});
  Future<Map<String, dynamic>> submitOvertimeRequest({
    required String fromDate,
    required String toDate,
    required String startTime,
    required String endTime,
    required double amountDay,
    required String reason,
    String? branch,
    String? staffId,
  });
  Future<Map<String, dynamic>> cancelOvertimeRequest(String id);
}

class OvertimeRepository implements IOvertimeRepository {
  final BaseApiClient _apiClient;

  OvertimeRepository(this._apiClient);

  Future<void> _invalidateCache() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('cached_overtime_requests');
    } catch (_) {}
  }

  @override
  Future<List<OvertimeItem>> fetchOvertimeRequests({String? staffId, bool forceRefresh = false}) async {
    final prefs = await SharedPreferences.getInstance();

    // 1. Try reading from persistent local database cache first
    if (!forceRefresh) {
      final cachedStr = prefs.getString('cached_overtime_requests');
      if (cachedStr != null && cachedStr.isNotEmpty) {
        try {
          final decoded = jsonDecode(cachedStr);
          if (decoded is List) {
            final list = decoded.map((json) => OvertimeItem.fromJson(json)).toList();
            _syncOvertimeRequestsBackground(staffId);
            return list;
          }
        } catch (_) {}
      }
    }

    // 2. Cache empty or forceRefresh, request from Backend directly
    return await _syncOvertimeRequestsBackground(staffId);
  }

  Future<List<OvertimeItem>> _syncOvertimeRequestsBackground(String? staffId) async {
    final path = (staffId != null && staffId.isNotEmpty) ? '/overtimes/employee/$staffId' : '/overtimes';
    try {
      final response = await _apiClient.get(path);
      if (response != null && response.statusCode == 200) {
        final data = jsonDecode(response.body);
        List<dynamic> list = [];
        if (data is List) {
          list = data;
        } else if (data['data'] != null && data['data'] is List) {
          list = data['data'];
        }

        final parsedList = list.map((json) => OvertimeItem.fromJson(json)).toList();

        // Save to cache
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('cached_overtime_requests', jsonEncode(list));

        return parsedList;
      }
    } catch (_) {}
    return [];
  }

  @override
  Future<Map<String, dynamic>> submitOvertimeRequest({
    required String fromDate,
    required String toDate,
    required String startTime,
    required String endTime,
    required double amountDay,
    required String reason,
    String? branch,
    String? staffId,
  }) async {
    final body = {
      'fromDate': fromDate,
      'toDate': toDate,
      'startTime': startTime,
      'endTime': endTime,
      'amountDay': amountDay,
      'reason': reason,
      if (branch != null && branch.isNotEmpty) 'branch': branch,
      if (staffId != null && staffId.isNotEmpty) 'staffId': staffId,
    };

    try {
      final response = await _apiClient.post('/overtimes', body: body);
      if (response != null && (response.statusCode == 200 || response.statusCode == 201)) {
        await _invalidateCache();
        final data = jsonDecode(response.body);
        return {
          'success': true,
          'message': 'Overtime request submitted successfully',
          'data': data,
        };
      } else {
        String msg = 'Failed to submit overtime request';
        if (response != null) {
          try {
            final err = jsonDecode(response.body);
            if (err['message'] != null) msg = err['message'];
          } catch (_) {}
        }
        return {'success': false, 'message': msg};
      }
    } catch (e) {
      return {'success': false, 'message': 'Network error: $e'};
    }
  }

  @override
  Future<Map<String, dynamic>> cancelOvertimeRequest(String id) async {
    try {
      final response = await _apiClient.delete('/overtimes/$id');
      if (response != null && response.statusCode == 200) {
        await _invalidateCache();
        return {'success': true, 'message': 'Overtime request cancelled successfully'};
      } else {
        String msg = 'Failed to cancel overtime request';
        if (response != null) {
          try {
            final err = jsonDecode(response.body);
            if (err['message'] != null) msg = err['message'];
          } catch (_) {}
        }
        return {'success': false, 'message': msg};
      }
    } catch (e) {
      return {'success': false, 'message': 'Network error: $e'};
    }
  }
}
