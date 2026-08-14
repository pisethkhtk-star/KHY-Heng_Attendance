import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/services/base_api_client.dart';
import '../models/leave_model.dart';

abstract class ILeaveRepository {
  Future<List<LeaveItem>> fetchLeaveRequests({String? staffId, bool forceRefresh = false});
  Future<List<dynamic>> fetchLeaveBalances({String? staffId, bool forceRefresh = false});
  Future<List<dynamic>> fetchLeaveTypes({bool forceRefresh = false});
  Future<Map<String, dynamic>> submitLeaveRequest({
    required String leaveType,
    required String startDate,
    required String endDate,
    required String reason,
    String durationType = 'Full Day',
    String? staffId,
  });
  Future<Map<String, dynamic>> cancelLeaveRequest(String id);
}

class LeaveRepository implements ILeaveRepository {
  final BaseApiClient _apiClient;

  LeaveRepository(this._apiClient);

  Future<void> _invalidateCache() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('cached_leave_requests');
      await prefs.remove('cached_leave_balances');
    } catch (_) {}
  }

  @override
  Future<List<LeaveItem>> fetchLeaveRequests({String? staffId, bool forceRefresh = false}) async {
    final prefs = await SharedPreferences.getInstance();
    
    // 1. Try reading from persistent local database cache first
    if (!forceRefresh) {
      final cachedStr = prefs.getString('cached_leave_requests');
      if (cachedStr != null && cachedStr.isNotEmpty) {
        try {
          final decoded = jsonDecode(cachedStr);
          if (decoded is List) {
            final list = decoded.map((json) => LeaveItem.fromJson(json)).toList();
            
            // Trigger asynchronous background update to sync cache
            _syncLeaveRequestsBackground(staffId);
            
            return list;
          }
        } catch (_) {}
      }
    }

    // 2. Cache empty or forceRefresh, request from Backend directly
    return await _syncLeaveRequestsBackground(staffId);
  }

  Future<List<LeaveItem>> _syncLeaveRequestsBackground(String? staffId) async {
    final path = (staffId != null && staffId.isNotEmpty) ? '/leaves/employee/$staffId' : '/leaves';
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

        // Save fresh JSON to local persistent storage
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('cached_leave_requests', jsonEncode(list));

        return list.map((json) => LeaveItem.fromJson(json)).toList();
      }
    } catch (_) {}

    // Return current cache if fetch failed
    final prefs = await SharedPreferences.getInstance();
    final cachedStr = prefs.getString('cached_leave_requests');
    if (cachedStr != null && cachedStr.isNotEmpty) {
      try {
        final decoded = jsonDecode(cachedStr) as List;
        return decoded.map((json) => LeaveItem.fromJson(json)).toList();
      } catch (_) {}
    }
    return [];
  }

  @override
  Future<List<dynamic>> fetchLeaveBalances({String? staffId, bool forceRefresh = false}) async {
    final prefs = await SharedPreferences.getInstance();

    if (!forceRefresh) {
      final cachedStr = prefs.getString('cached_leave_balances');
      if (cachedStr != null && cachedStr.isNotEmpty) {
        try {
          final decoded = jsonDecode(cachedStr);
          
          // Trigger asynchronous background sync
          _syncLeaveBalancesBackground(staffId);
          
          return decoded;
        } catch (_) {}
      }
    }

    return await _syncLeaveBalancesBackground(staffId);
  }

  Future<List<dynamic>> _syncLeaveBalancesBackground(String? staffId) async {
    final query = (staffId != null && staffId.isNotEmpty) ? '?staffId=$staffId' : '';
    try {
      final response = await _apiClient.get('/employee-leave-limits$query');
      if (response != null && response.statusCode == 200) {
        final data = jsonDecode(response.body);
        List<dynamic> list = [];
        if (data is List) {
          list = data;
        } else if (data['data'] != null && data['data'] is List) {
          list = data['data'];
        }

        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('cached_leave_balances', jsonEncode(list));
        return list;
      }
    } catch (_) {}

    final prefs = await SharedPreferences.getInstance();
    final cachedStr = prefs.getString('cached_leave_balances');
    if (cachedStr != null && cachedStr.isNotEmpty) {
      try {
        return jsonDecode(cachedStr);
      } catch (_) {}
    }
    return [];
  }

  @override
  Future<List<dynamic>> fetchLeaveTypes({bool forceRefresh = false}) async {
    final prefs = await SharedPreferences.getInstance();

    if (!forceRefresh) {
      final cachedStr = prefs.getString('cached_leave_types');
      if (cachedStr != null && cachedStr.isNotEmpty) {
        try {
          final decoded = jsonDecode(cachedStr);
          _syncLeaveTypesBackground();
          return decoded;
        } catch (_) {}
      }
    }

    return await _syncLeaveTypesBackground();
  }

  Future<List<dynamic>> _syncLeaveTypesBackground() async {
    try {
      final response = await _apiClient.get('/leave-types');
      if (response != null && response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data is List) {
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString('cached_leave_types', jsonEncode(data));
          return data;
        }
      }
    } catch (_) {}

    final prefs = await SharedPreferences.getInstance();
    final cachedStr = prefs.getString('cached_leave_types');
    if (cachedStr != null && cachedStr.isNotEmpty) {
      try {
        return jsonDecode(cachedStr);
      } catch (_) {}
    }
    return [];
  }

  @override
  Future<Map<String, dynamic>> submitLeaveRequest({
    required String leaveType,
    required String startDate,
    required String endDate,
    required String reason,
    String durationType = 'Full Day',
    String? staffId,
  }) async {
    final body = {
      if (staffId != null && staffId.isNotEmpty) 'staffId': staffId,
      'leaveType': leaveType,
      'startDate': startDate,
      'endDate': endDate,
      'reason': reason,
      'durationType': durationType,
    };

    final response = await _apiClient.post('/leaves', body: body);
    if (response != null) {
      final data = jsonDecode(response.body);
      if (response.statusCode == 200 || response.statusCode == 201) {
        await _invalidateCache(); // Invalidate local DB cache on mutation success
        return {'success': true, 'message': 'Leave request submitted successfully', 'data': data};
      }
      return {'success': false, 'message': data['message'] ?? 'Submission failed'};
    }
    return {'success': false, 'message': 'Unable to submit leave request to database'};
  }

  @override
  Future<Map<String, dynamic>> cancelLeaveRequest(String id) async {
    final response = await _apiClient.delete('/leaves/$id');
    if (response != null) {
      final data = jsonDecode(response.body);
      if (response.statusCode == 200) {
        await _invalidateCache(); // Invalidate local DB cache on mutation success
        return {'success': true, 'message': data['message'] ?? 'Leave request cancelled'};
      }
      return {'success': false, 'message': data['message'] ?? 'Failed to cancel leave request'};
    }
    return {'success': false, 'message': 'Network error during leave cancellation'};
  }
}
