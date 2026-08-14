import 'package:get/get.dart';
import '../models/leave_model.dart';
import '../core/services/api_service.dart';

class LeaveController extends GetxController {
  final RxList<LeaveBalance> _balances = <LeaveBalance>[].obs;
  final RxList<LeaveItem> _leaveRequests = <LeaveItem>[].obs;
  final RxBool _isSubmitting = false.obs;

  List<LeaveBalance> get balances => _balances;
  List<LeaveItem> get leaveRequests => _leaveRequests;
  bool get isSubmitting => _isSubmitting.value;

  @override
  void onInit() {
    super.onInit();
    fetchRemoteLeaves();
  }

  Future<void> fetchRemoteLeaves({String? staffId}) async {
    try {
      final remoteItems = await ApiService.fetchLeaveRequests(staffId: staffId);
      final limitData = await ApiService.fetchLeaveBalances(staffId: staffId);
      final leaveTypesRaw = await ApiService.fetchLeaveTypes();

      if (remoteItems.isNotEmpty) {
        try {
          final parsed = remoteItems.map((json) => LeaveItem.fromJson(json)).toList();
          _leaveRequests.value = parsed;
        } catch (e) {
          print('Error parsing leave requests: $e');
          _leaveRequests.value = [];
        }
      } else {
        _leaveRequests.value = [];
      }

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
              final maxDays = (allowance['maxDays'] as num?)?.toInt() ?? 18;
              final usedDays = (allowance['usedDays'] as num?)?.toInt() ?? 0;
              final remaining = maxDays - usedDays;

              return LeaveBalance(
                typeName: typeName,
                totalDays: maxDays,
                usedDays: usedDays,
                remainingDays: remaining < 0 ? 0 : remaining,
              );
            }).toList();
            return; // Successful fetch, stop here!
          }
        } catch (e) {
          print('Error mapping leave limits: $e');
        }
      }

      // 2. Client-side fallback calculation if geofence API fails
      if (leaveTypesRaw.isNotEmpty) {
        _balances.value = leaveTypesRaw.map((typeJson) {
          final code = typeJson['code']?.toString() ?? '';
          final nameEn = typeJson['nameEn']?.toString() ?? typeJson['nameKh']?.toString() ?? 'Leave';
          final typeName = code.isNotEmpty ? '$nameEn ($code)' : nameEn;
          final maxDays = (typeJson['maxDays'] as num?)?.toInt() ?? 18;

          final usedCount = _leaveRequests
              .where((req) =>
                  (req.status == 'Approved' || req.status == 'Pending') &&
                  (req.leaveType.toLowerCase() == code.toLowerCase() ||
                      req.leaveType.toLowerCase() == nameEn.toLowerCase() ||
                      req.leaveType.toLowerCase().contains(nameEn.toLowerCase()) ||
                      req.leaveType.toLowerCase().contains(code.toLowerCase())))
              .fold<int>(0, (sum, item) => sum + item.totalDays);

          final remaining = maxDays - usedCount;

          return LeaveBalance(
            typeName: typeName,
            totalDays: maxDays,
            usedDays: usedCount < 0 ? 0 : usedCount,
            remainingDays: remaining < 0 ? 0 : remaining,
          );
        }).toList();
      } else if (_balances.isEmpty) {
        _balances.value = [
          LeaveBalance(typeName: 'Annual Leave (AL)', totalDays: 18, usedDays: 0, remainingDays: 18),
          LeaveBalance(typeName: 'Personal Leave (PL)', totalDays: 7, usedDays: 0, remainingDays: 7),
          LeaveBalance(typeName: 'Sick Leave (SL)', totalDays: 12, usedDays: 0, remainingDays: 12),
        ];
      }
    } catch (e) {
      print('General error in fetchRemoteLeaves: $e');
      if (_balances.isEmpty) {
        _balances.value = [
          LeaveBalance(typeName: 'Annual Leave (AL)', totalDays: 18, usedDays: 0, remainingDays: 18),
          LeaveBalance(typeName: 'Personal Leave (PL)', totalDays: 7, usedDays: 0, remainingDays: 7),
          LeaveBalance(typeName: 'Sick Leave (SL)', totalDays: 12, usedDays: 0, remainingDays: 12),
        ];
      }
    }
  }

  Future<bool> submitLeave({
    required String type,
    required String startDate,
    required String endDate,
    required int days,
    required String reason,
    String? staffId,
  }) async {
    _isSubmitting.value = true;

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
    return true;
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
          .fold<int>(0, (sum, item) => sum + item.totalDays);

      final remaining = balance.totalDays - usedCount;

      return LeaveBalance(
        typeName: balance.typeName,
        totalDays: balance.totalDays,
        usedDays: usedCount < 0 ? 0 : usedCount,
        remainingDays: remaining < 0 ? 0 : remaining,
      );
    }).toList();
  }
}
