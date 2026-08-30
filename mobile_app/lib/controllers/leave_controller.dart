import 'dart:async';
import 'dart:convert';
import 'package:get/get.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/leave_model.dart';
import '../repositories/leave_repository.dart';
import 'attendance_controller.dart';
import 'auth_controller.dart';
import 'language_controller.dart';
import 'notification_controller.dart';

class LeaveController extends GetxController {
  final ILeaveRepository _leaveRepository = Get.find<ILeaveRepository>();

  final RxList<LeaveBalance> _balances = <LeaveBalance>[].obs;
  final RxList<LeaveItem> _leaveRequests = <LeaveItem>[].obs;
  final RxBool _isSubmitting = false.obs;
  Timer? _pollingTimer;

  List<LeaveBalance> get balances => _balances;
  List<LeaveItem> get leaveRequests => _leaveRequests;
  bool get isSubmitting => _isSubmitting.value;

  @override
  void onInit() {
    super.onInit();
    fetchRemoteLeaves();
    // Background polling every 15 seconds to catch live approvals/rejections
    _pollingTimer = Timer.periodic(const Duration(seconds: 15), (_) {
      _pollLeavesSilently();
    });
  }

  @override
  void onClose() {
    _pollingTimer?.cancel();
    super.onClose();
  }

  void _pollLeavesSilently() {
    if (!Get.isRegistered<AuthController>()) return;
    final user = Get.find<AuthController>().user;
    if (user?.employeeId != null) {
      fetchRemoteLeaves(staffId: user?.employeeId);
    }
  }

  Future<void> fetchRemoteLeaves({String? staffId}) async {
    try {
      final remoteItems = await _leaveRepository.fetchLeaveRequests(staffId: staffId);
      final limitData = await _leaveRepository.fetchLeaveBalances(staffId: staffId);
      final leaveTypesRaw = await _leaveRepository.fetchLeaveTypes();

      _leaveRequests.value = remoteItems;
      _checkLeaveStatusTransitions(remoteItems);

      // 1. Try to load leave balances directly from database allowances
      if (limitData.isNotEmpty) {
        try {
          final empRecord = limitData.firstWhere(
            (emp) => emp['staffId'] == staffId,
            orElse: () => limitData.first,
          );

          final allowances = empRecord['allowances'] as List<dynamic>?;
          if (allowances != null && allowances.isNotEmpty) {
            _balances.value = allowances.map((allowance) {
              final code = allowance['code']?.toString() ?? '';
              final nameEn = allowance['nameEn']?.toString() ?? allowance['nameKh']?.toString() ?? code;
              final typeName = code.isNotEmpty ? '$nameEn ($code)' : nameEn;
              final maxDays = (allowance['maxDays'] as num?)?.toDouble() ?? 18.0;
              final usedDays = (allowance['usedDays'] as num?)?.toDouble() ?? 0.0;
              final remaining = maxDays - usedDays;

              return LeaveBalance(
                typeName: typeName,
                totalDays: maxDays,
                usedDays: usedDays,
                remainingDays: remaining < 0 ? 0.0 : remaining,
              );
            }).toList();
            return; // Successful fetch, stop here!
          }
        } catch (_) {}
      }

      // 2. Client-side fallback calculation if geofence API fails
      if (leaveTypesRaw.isNotEmpty) {
        _balances.value = leaveTypesRaw.map((typeJson) {
          final code = typeJson['code']?.toString() ?? '';
          final nameEn = typeJson['nameEn']?.toString() ?? typeJson['nameKh']?.toString() ?? 'Leave';
          final typeName = code.isNotEmpty ? '$nameEn ($code)' : nameEn;
          final maxDays = (typeJson['maxDays'] as num?)?.toDouble() ?? 18.0;

          final usedCount = _leaveRequests
              .where((req) =>
                  (req.status == 'Approved' || req.status == 'Pending') &&
                  (req.leaveType.toLowerCase() == code.toLowerCase() ||
                      req.leaveType.toLowerCase() == nameEn.toLowerCase() ||
                      req.leaveType.toLowerCase().contains(nameEn.toLowerCase()) ||
                      req.leaveType.toLowerCase().contains(code.toLowerCase())))
              .fold<double>(0.0, (sum, item) => sum + item.totalDays);

          final remaining = maxDays - usedCount;

          return LeaveBalance(
            typeName: typeName,
            totalDays: maxDays,
            usedDays: usedCount < 0 ? 0.0 : usedCount,
            remainingDays: remaining < 0 ? 0.0 : remaining,
          );
        }).toList();
      } else if (_balances.isEmpty) {
        _balances.value = [
          LeaveBalance(typeName: 'Annual Leave (AL)', totalDays: 18.0, usedDays: 0.0, remainingDays: 18.0),
          LeaveBalance(typeName: 'Personal Leave (PL)', totalDays: 7.0, usedDays: 0.0, remainingDays: 7.0),
          LeaveBalance(typeName: 'Sick Leave (SL)', totalDays: 12.0, usedDays: 0.0, remainingDays: 12.0),
        ];
      }
    } catch (e) {
      if (_balances.isEmpty) {
        _balances.value = [
          LeaveBalance(typeName: 'Annual Leave (AL)', totalDays: 18.0, usedDays: 0.0, remainingDays: 18.0),
          LeaveBalance(typeName: 'Personal Leave (PL)', totalDays: 7.0, usedDays: 0.0, remainingDays: 7.0),
          LeaveBalance(typeName: 'Sick Leave (SL)', totalDays: 12.0, usedDays: 0.0, remainingDays: 12.0),
        ];
      }
    }
  }

  Future<bool> submitLeave({
    required String type,
    required String startDate,
    required String endDate,
    required double days,
    required String reason,
    String durationType = 'Full Day',
    String? staffId,
  }) async {
    _isSubmitting.value = true;

    final result = await _leaveRepository.submitLeaveRequest(
      leaveType: type,
      startDate: startDate,
      endDate: endDate,
      reason: reason,
      durationType: durationType,
      staffId: staffId,
    );

    if (result['success'] == true) {
      await fetchRemoteLeaves(staffId: staffId);
      // Immediately refresh attendance history so overridden null slots reflect on home screen!
      try {
        if (Get.isRegistered<AttendanceController>()) {
          await Get.find<AttendanceController>().fetchRemoteHistory(staffId: staffId);
        }
      } catch (_) {}
    } else {
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
      _recalculateLocalBalances();
    }

    _isSubmitting.value = false;
    return result['success'] == true;
  }

  Future<Map<String, dynamic>> cancelLeave(String id, {String? staffId}) async {
    _isSubmitting.value = true;
    final result = await _leaveRepository.cancelLeaveRequest(id);
    if (result['success'] == true) {
      await fetchRemoteLeaves(staffId: staffId);
      try {
        if (Get.isRegistered<AttendanceController>()) {
          await Get.find<AttendanceController>().fetchRemoteHistory(staffId: staffId);
        }
      } catch (_) {}
    }
    _isSubmitting.value = false;
    return result;
  }

  void _recalculateLocalBalances() {
    _balances.value = _balances.map((balance) {
      final typeName = balance.typeName.toLowerCase();
      
      final usedCount = _leaveRequests
          .where((req) =>
              (req.status == 'Approved' || req.status == 'Pending') &&
              (req.leaveType.toLowerCase() == typeName ||
               (typeName.contains('annual') && req.leaveType.toLowerCase().contains('annual')) ||
               (typeName.contains('sick') && req.leaveType.toLowerCase().contains('sick')) ||
               (typeName.contains('unpaid') && req.leaveType.toLowerCase().contains('unpaid')) ||
               (typeName.contains('special') && req.leaveType.toLowerCase().contains('special')) ||
               (typeName.contains('personal') && req.leaveType.toLowerCase().contains('personal'))))
          .fold<double>(0.0, (sum, item) => sum + item.totalDays);

      final remaining = balance.totalDays - usedCount;

      return LeaveBalance(
        typeName: balance.typeName,
        totalDays: balance.totalDays,
        usedDays: usedCount < 0 ? 0.0 : usedCount,
        remainingDays: remaining < 0 ? 0.0 : remaining,
      );
    }).toList();
  }

  Future<void> _checkLeaveStatusTransitions(List<LeaveItem> freshItems) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final trackingStr = prefs.getString('tracked_leave_statuses');
      Map<String, dynamic> tracked = {};
      if (trackingStr != null && trackingStr.isNotEmpty) {
        try {
          tracked = jsonDecode(trackingStr) as Map<String, dynamic>;
        } catch (_) {}
      }

      final notifController = Get.isRegistered<NotificationController>() ? Get.find<NotificationController>() : null;
      final langController = Get.isRegistered<LanguageController>() ? Get.find<LanguageController>() : null;
      final isKhmer = langController?.currentLanguage == 'km';

      bool hasNewTracking = false;

      for (final item in freshItems) {
        final prevStatus = tracked[item.id]?.toString();
        final currentStatus = item.status;

        // If this leave was previously Pending and now changed to Approved or Rejected:
        if (prevStatus != null && prevStatus.toLowerCase() == 'pending') {
          if (currentStatus.toLowerCase() == 'approved') {
            notifController?.addNotification(
              title: isKhmer ? 'ពាក្យស្នើសុំច្បាប់ត្រូវបានអនុម័ត 🎉' : 'Leave Request Approved 🎉',
              message: isKhmer
                  ? 'ច្បាប់ឈប់សម្រាក (${item.leaveType}) សម្រាប់ថ្ងៃ ${item.startDate} ត្រូវបានអនុម័តរួចរាល់ហើយ!'
                  : 'Your leave request for ${item.leaveType} (${item.startDate}) has been APPROVED!',
              type: 'approved',
              targetId: item.id,
            );
          } else if (currentStatus.toLowerCase() == 'rejected') {
            notifController?.addNotification(
              title: isKhmer ? 'ពាក្យស្នើសុំច្បាប់ត្រូវបានបដិសេធ ⚠️' : 'Leave Request Rejected ⚠️',
              message: isKhmer
                  ? 'ច្បាប់ឈប់សម្រាក (${item.leaveType}) សម្រាប់ថ្ងៃ ${item.startDate} ត្រូវបានបដិសេធ។'
                  : 'Your leave request for ${item.leaveType} (${item.startDate}) was REJECTED.',
              type: 'rejected',
              targetId: item.id,
            );
          }
        }

        if (prevStatus != currentStatus) {
          tracked[item.id] = currentStatus;
          hasNewTracking = true;
        }
      }

      if (hasNewTracking || trackingStr == null) {
        await prefs.setString('tracked_leave_statuses', jsonEncode(tracked));
      }
    } catch (_) {}
  }
}
