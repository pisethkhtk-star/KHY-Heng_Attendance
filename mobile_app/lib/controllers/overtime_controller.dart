import 'package:get/get.dart';
import '../models/overtime_model.dart';
import '../repositories/overtime_repository.dart';

class OvertimeController extends GetxController {
  final IOvertimeRepository _overtimeRepository = Get.find<IOvertimeRepository>();

  final RxList<OvertimeItem> _overtimeRequests = <OvertimeItem>[].obs;
  final RxBool _isSubmitting = false.obs;

  List<OvertimeItem> get overtimeRequests => _overtimeRequests;
  bool get isSubmitting => _isSubmitting.value;

  // Counters
  int get totalRequests => _overtimeRequests.length;
  int get pendingCount => _overtimeRequests.where((o) => o.status.toLowerCase() == 'pending').length;
  int get approvedCount => _overtimeRequests.where((o) => o.status.toLowerCase() == 'approved').length;
  int get rejectedCount => _overtimeRequests.where((o) => o.status.toLowerCase() == 'rejected').length;

  double get totalApprovedDays => _overtimeRequests
      .where((o) => o.status.toLowerCase() == 'approved')
      .fold(0.0, (sum, o) => sum + o.amountDay);

  @override
  void onInit() {
    super.onInit();
    fetchRemoteOvertimes();
  }

  Future<void> fetchRemoteOvertimes({String? staffId}) async {
    try {
      final remoteItems = await _overtimeRepository.fetchOvertimeRequests(staffId: staffId);
      _overtimeRequests.value = remoteItems;
    } catch (_) {}
  }

  Future<bool> submitOvertime({
    required String fromDate,
    required String toDate,
    required String startTime,
    required String endTime,
    required double amountDay,
    required String reason,
    String? branch,
    String? staffId,
  }) async {
    _isSubmitting.value = true;

    final result = await _overtimeRepository.submitOvertimeRequest(
      fromDate: fromDate,
      toDate: toDate,
      startTime: startTime,
      endTime: endTime,
      amountDay: amountDay,
      reason: reason,
      branch: branch,
      staffId: staffId,
    );

    if (result['success'] == true) {
      await fetchRemoteOvertimes(staffId: staffId);
    } else {
      // Local fallback item if network failed
      final newRequest = OvertimeItem(
        id: 'ot-${DateTime.now().millisecondsSinceEpoch}',
        staffId: staffId ?? '',
        fromDate: fromDate,
        toDate: toDate,
        startTime: startTime,
        endTime: endTime,
        amountDay: amountDay,
        reason: reason,
        status: 'Pending',
        branch: branch,
        requestedAt: DateTime.now().toString().split(' ')[0],
      );
      _overtimeRequests.insert(0, newRequest);
    }

    _isSubmitting.value = false;
    return result['success'] == true;
  }

  Future<Map<String, dynamic>> cancelOvertime(String id, {String? staffId}) async {
    _isSubmitting.value = true;
    final result = await _overtimeRepository.cancelOvertimeRequest(id);
    if (result['success'] == true) {
      await fetchRemoteOvertimes(staffId: staffId);
    }
    _isSubmitting.value = false;
    return result;
  }
}
