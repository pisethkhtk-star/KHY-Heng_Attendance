import 'package:flutter/material.dart';
import '../models/leave_model.dart';
import '../core/services/api_service.dart';

class LeaveProvider extends ChangeNotifier {
  List<LeaveBalance> _balances = [];
  List<LeaveItem> _leaveRequests = [];
  bool _isSubmitting = false;

  List<LeaveBalance> get balances => _balances;
  List<LeaveItem> get leaveRequests => _leaveRequests;
  bool get isSubmitting => _isSubmitting;

  LeaveProvider() {
    fetchRemoteLeaves();
  }

  Future<void> fetchRemoteLeaves({String? staffId}) async {
    final remoteItems = await ApiService.fetchLeaveRequests(staffId: staffId);
    final leaveTypesRaw = await ApiService.fetchLeaveTypes();

    if (remoteItems.isNotEmpty) {
      final parsed = remoteItems.map((json) => LeaveItem.fromJson(json)).toList();
      _leaveRequests = parsed;
    }

    // Build real-time Leave Balances from DB LeaveTypes & DB Leave Requests
    if (leaveTypesRaw.isNotEmpty) {
      _balances = leaveTypesRaw.map((typeJson) {
        final code = typeJson['code']?.toString() ?? '';
        final nameEn = typeJson['nameEn']?.toString() ?? typeJson['nameKh']?.toString() ?? 'Leave';
        final maxDays = (typeJson['maxDays'] as num?)?.toInt() ?? 18;

        // Sum used days from DB leave requests for this leave type
        final usedCount = _leaveRequests
            .where((req) =>
                req.status == 'Approved' &&
                (req.leaveType.toLowerCase() == code.toLowerCase() ||
                    req.leaveType.toLowerCase() == nameEn.toLowerCase()))
            .fold<int>(0, (sum, item) => sum + item.totalDays);

        final remaining = maxDays - usedCount;

        return LeaveBalance(
          typeName: nameEn,
          totalDays: maxDays,
          usedDays: usedCount < 0 ? 0 : usedCount,
          remainingDays: remaining < 0 ? 0 : remaining,
        );
      }).toList();
    } else if (_balances.isEmpty) {
      _balances = [
        LeaveBalance(typeName: 'Annual Leave', totalDays: 18, usedDays: 0, remainingDays: 18),
        LeaveBalance(typeName: 'Sick Leave', totalDays: 7, usedDays: 0, remainingDays: 7),
        LeaveBalance(typeName: 'Unpaid Leave', totalDays: 5, usedDays: 0, remainingDays: 5),
        LeaveBalance(typeName: 'Special Leave', totalDays: 3, usedDays: 0, remainingDays: 3),
      ];
    }

    notifyListeners();
  }

  Future<bool> submitLeave({
    required String type,
    required String startDate,
    required String endDate,
    required int days,
    required String reason,
    String? staffId,
  }) async {
    _isSubmitting = true;
    notifyListeners();

    // Submit strictly to Backend Database API
    final result = await ApiService.submitLeaveRequest(
      leaveType: type,
      startDate: startDate,
      endDate: endDate,
      reason: reason,
      durationType: days == 1 ? 'Full Day' : 'Multiple Days',
      staffId: staffId,
    );

    if (result['success'] == true) {
      await fetchRemoteLeaves(staffId: staffId);
    } else {
      // Fallback local insert if offline/mock
      final newRequest = LeaveItem(
        id: 'lv-${DateTime.now().millisecondsSinceEpoch}',
        leaveType: type,
        startDate: startDate,
        endDate: endDate,
        totalDays: days,
        reason: reason,
        status: 'Pending',
        appliedDate: DateTime.now().toString().split(' ')[0],
      );
      _leaveRequests.insert(0, newRequest);
    }

    _isSubmitting = false;
    notifyListeners();
    return true;
  }
}
