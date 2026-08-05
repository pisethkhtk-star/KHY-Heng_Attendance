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
    _initData();
    fetchRemoteLeaves();
  }

  void _initData() {
    _balances = [
      LeaveBalance(typeName: 'Annual Leave', totalDays: 18, usedDays: 4, remainingDays: 14),
      LeaveBalance(typeName: 'Sick Leave', totalDays: 7, usedDays: 1, remainingDays: 6),
      LeaveBalance(typeName: 'Unpaid Leave', totalDays: 5, usedDays: 0, remainingDays: 5),
      LeaveBalance(typeName: 'Special Leave', totalDays: 3, usedDays: 0, remainingDays: 3),
    ];
  }

  Future<void> fetchRemoteLeaves() async {
    final remoteItems = await ApiService.fetchLeaveRequests();
    if (remoteItems.isNotEmpty) {
      final parsed = remoteItems.map((json) => LeaveItem.fromJson(json)).toList();
      _leaveRequests = parsed;
      notifyListeners();
    }
  }

  Future<bool> submitLeave({
    required String type,
    required String startDate,
    required String endDate,
    required int days,
    required String reason,
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
    );

    if (result['success'] == true) {
      await fetchRemoteLeaves();
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

