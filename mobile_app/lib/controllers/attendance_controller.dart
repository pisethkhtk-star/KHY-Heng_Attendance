import 'dart:math' as math;
import 'package:get/get.dart';
import 'package:intl/intl.dart';
import '../models/attendance_model.dart';
import '../repositories/attendance_repository.dart';
import '../core/services/analytics_service.dart';
import '../core/services/local_notification_service.dart';
import 'auth_controller.dart';
import 'notification_controller.dart';

class AutoActionDecision {
  final String? action; // 'checkin_1', 'checkout_1', 'checkin_2', 'checkout_2'
  final String? alertMessage; // Khmer alert message if action cannot be performed
  final bool isSuccess;

  const AutoActionDecision({
    this.action,
    this.alertMessage,
    required this.isSuccess,
  });

  factory AutoActionDecision.performAction(String action) => AutoActionDecision(
        action: action,
        isSuccess: true,
      );

  factory AutoActionDecision.alert(String message) => AutoActionDecision(
        alertMessage: message,
        isSuccess: false,
      );
}

class AttendanceController extends GetxController {
  final IAttendanceRepository _attendanceRepository = Get.find<IAttendanceRepository>();

  final RxInt _currentStep = 0.obs; // 0: Check-In 1, 1: Check-Out 1, 2: Check-In 2, 3: Check-Out 2, 4: Done
  final RxnString _checkIn1 = RxnString();
  final RxnString _checkOut1 = RxnString();
  final RxnString _checkIn2 = RxnString();
  final RxnString _checkOut2 = RxnString();
  final RxBool _isProcessing = false.obs;

  final RxInt _presentCount = 0.obs;
  final RxInt _lateCount = 0.obs;
  final RxInt _leaveCount = 0.obs;
  final RxInt _absentCount = 0.obs;

  final RxList<AttendanceRecord> _historyRecords = <AttendanceRecord>[].obs;

  int get currentStep => _currentStep.value;
  bool get isCheckedIn => _currentStep.value > 0;
  String? get checkIn1 => _checkIn1.value;
  String? get checkOut1 => _checkOut1.value;
  String? get checkIn2 => _checkIn2.value;
  String? get checkOut2 => _checkOut2.value;
  bool get isProcessing => _isProcessing.value;

  int get presentCount => _presentCount.value;
  int get lateCount => _lateCount.value;
  int get leaveCount => _leaveCount.value;
  int get absentCount => _absentCount.value;

  List<AttendanceRecord> get historyRecords => _historyRecords;

  final RxBool canCheckinOnBehalf = false.obs;
  final RxList<Map<String, dynamic>> eligibleEmployees = <Map<String, dynamic>>[].obs;

  final RxString companyShift1Start = '08:00'.obs;
  final RxString companyShift1End = '12:00'.obs;
  final RxString companyShift2Start = '13:00'.obs;
  final RxString companyShift2End = '17:00'.obs;
  final RxInt lateGraceMinutes = 0.obs;

  String get workingShiftDisplay {
    if (Get.isRegistered<AuthController>()) {
      final u = Get.find<AuthController>().user;
      if (u != null && u.shift1Start != null && u.shift1Start!.trim().isNotEmpty) {
        return u.formattedWorkingShift;
      }
    }
    final s1 = AttendanceRecord.formatTime12Hour(companyShift1Start.value);
    final s2 = (companyShift2End.value.isNotEmpty && companyShift2End.value != '--:--' && companyShift2End.value != '-')
        ? AttendanceRecord.formatTime12Hour(companyShift2End.value)
        : AttendanceRecord.formatTime12Hour(companyShift1End.value);
    return '$s1 - $s2';
  }

  String get shift1ScheduleDisplay {
    if (Get.isRegistered<AuthController>()) {
      final u = Get.find<AuthController>().user;
      if (u != null && u.formattedShift1Hours.isNotEmpty) {
        return u.formattedShift1Hours;
      }
    }
    final s1 = AttendanceRecord.formatTime12Hour(companyShift1Start.value);
    final s1E = AttendanceRecord.formatTime12Hour(companyShift1End.value);
    return s1E.isNotEmpty ? '$s1 - $s1E' : s1;
  }

  String get shift2ScheduleDisplay {
    if (Get.isRegistered<AuthController>()) {
      final u = Get.find<AuthController>().user;
      if (u != null && u.formattedShift2Hours.isNotEmpty) {
        return u.formattedShift2Hours;
      }
    }
    final s2 = AttendanceRecord.formatTime12Hour(companyShift2Start.value);
    final s2E = AttendanceRecord.formatTime12Hour(companyShift2End.value);
    return s2E.isNotEmpty ? '$s2 - $s2E' : s2;
  }

  bool get hasShift2 {
    if (Get.isRegistered<AuthController>()) {
      final u = Get.find<AuthController>().user;
      if (u != null && u.shift2End != null && u.shift2End!.isNotEmpty) {
        return u.hasShift2;
      }
    }
    return companyShift2End.value.isNotEmpty && companyShift2End.value != '--:--' && companyShift2End.value != '-';
  }

  @override
  void onInit() {
    super.onInit();
    fetchWorkHours();
    fetchRemoteHistory();
    checkOnBehalfEligibility();
  }

  Future<void> fetchWorkHours() async {
    try {
      final res = await _attendanceRepository.fetchCompanyWorkHours();
      if (res != null) {
        if (res['shift1Start'] != null && res['shift1Start'].toString().trim().isNotEmpty) {
          companyShift1Start.value = res['shift1Start'].toString().trim();
        }
        if (res['shift1End'] != null && res['shift1End'].toString().trim().isNotEmpty) {
          companyShift1End.value = res['shift1End'].toString().trim();
        }
        if (res['shift2Start'] != null && res['shift2Start'].toString().trim().isNotEmpty) {
          companyShift2Start.value = res['shift2Start'].toString().trim();
        }
        if (res['shift2End'] != null && res['shift2End'].toString().trim().isNotEmpty) {
          companyShift2End.value = res['shift2End'].toString().trim();
        }
        if (res['lateGraceMinutes'] != null) {
          lateGraceMinutes.value = int.tryParse(res['lateGraceMinutes'].toString()) ?? 0;
        }
      }
    } catch (_) {}
  }

  Future<void> checkOnBehalfEligibility() async {
    try {
      final res = await _attendanceRepository.fetchCheckinOnBehalfEligibility();
      final list = res['eligibleEmployees'];
      if (list is List) {
        eligibleEmployees.value = list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      } else {
        eligibleEmployees.clear();
      }
      canCheckinOnBehalf.value = res['canCheckinOnBehalf'] == true && eligibleEmployees.isNotEmpty;
    } catch (_) {
      canCheckinOnBehalf.value = false;
      eligibleEmployees.clear();
    }
  }

  Future<Map<String, dynamic>?> fetchEmployeeFaceData(String staffId) async {
    return await _attendanceRepository.fetchEmployeeFaceData(staffId);
  }

  Future<List<Map<String, dynamic>>> fetchAllEmployees() async {
    return await _attendanceRepository.fetchAllEmployees();
  }

  Future<Map<String, dynamic>> enrollEmployeeFace({
    required String staffId,
    required dynamic faceDescriptor,
    required String photoUrl,
  }) async {
    final res = await _attendanceRepository.enrollEmployeeFace(
      staffId: staffId,
      faceDescriptor: faceDescriptor,
      photoUrl: photoUrl,
    );
    if (res['success'] == true) {
      await checkOnBehalfEligibility();
    }
    return res;
  }

  static int timeToMinutes(String? timeStr) {
    if (timeStr == null || !timeStr.contains(':')) return 0;
    try {
      final parts = timeStr.trim().split(':');
      int h = int.parse(parts[0]);
      int m = int.parse(parts[1].split(' ')[0]);
      final lower = timeStr.toLowerCase();
      if (lower.contains('pm') && h < 12) h += 12;
      if (lower.contains('am') && h == 12) h = 0;
      return h * 60 + m;
    } catch (_) {
      return 0;
    }
  }

  static bool isTimeRecorded(String? val) {
    return val != null &&
        val.trim().isNotEmpty &&
        val.trim() != '--:--' &&
        val.trim() != '-';
  }

  /// Calculate Euclidean distance between two 128D biometric feature vectors
  static double calculateEuclideanDistance(List<double>? a, List<double>? b) {
    if (a == null || b == null || a.isEmpty || b.isEmpty || a.length != b.length) {
      return 1.0;
    }
    double sum = 0.0;
    for (int i = 0; i < a.length; i++) {
      final diff = a[i] - b[i];
      sum += diff * diff;
    }
    return math.sqrt(sum);
  }

  /// Generate a realistic, deterministic 128-dimensional biometric descriptor vector
  static List<double> generateDeterministicDescriptor(String staffId) {
    final random = math.Random(staffId.hashCode);
    final List<double> descriptor = [];
    double sumSq = 0.0;
    for (int i = 0; i < 128; i++) {
      final val = (random.nextDouble() * 2.0) - 1.0;
      descriptor.add(val);
      sumSq += val * val;
    }
    final norm = math.sqrt(sumSq);
    if (norm > 0) {
      for (int i = 0; i < 128; i++) {
        descriptor[i] /= norm;
      }
    }
    return descriptor;
  }

  static AutoActionDecision evaluateAutoShiftAction({
    required AttendanceRecord? todayRecord,
    String? shift1Start,
    String? shift1End,
    String? shift2Start,
    String? shift2End,
    DateTime? currentTime,
  }) {
    final now = currentTime ?? DateTime.now();
    final currentMinutes = now.hour * 60 + now.minute;

    final s1EndMin = timeToMinutes(shift1End ?? '12:00');

    final bool hasShift2 = shift2End != null &&
        shift2End.trim().isNotEmpty &&
        shift2End.trim() != '--:--' &&
        shift2End.trim() != '-';

    final s2StartMin = hasShift2
        ? timeToMinutes(shift2Start != null && shift2Start.trim().isNotEmpty ? shift2Start : '13:00')
        : 0;
    final s2EndMin = hasShift2
        ? timeToMinutes(shift2End)
        : 0;

    final bool hasCheckIn1 = isTimeRecorded(todayRecord?.checkIn1);
    final bool hasCheckOut1 = isTimeRecorded(todayRecord?.checkOut1);
    final bool hasCheckIn2 = isTimeRecorded(todayRecord?.checkIn2);
    final bool hasCheckOut2 = isTimeRecorded(todayRecord?.checkOut2);

    // ==========================================
    // CASE A: Single Shift (Shift 1 only)
    // ==========================================
    if (!hasShift2) {
      if (currentMinutes < s1EndMin) {
        if (!hasCheckIn1) {
          return AutoActionDecision.performAction('checkin_1');
        } else if (!hasCheckOut1) {
          return AutoActionDecision.alert('មិនទាន់ដល់ម៉ោង Check-out វេនទី ១ នៅឡើយទេ (ម៉ោង ${shift1End ?? "12:00"})');
        } else {
          return AutoActionDecision.alert('បាន Check ពេញលេញសម្រាប់ថ្ងៃនេះហើយ');
        }
      } else {
        if (hasCheckIn1 && !hasCheckOut1) {
          return AutoActionDecision.performAction('checkout_1');
        } else {
          return AutoActionDecision.alert('ផុតកំណត់ម៉ោងធ្វើការ / បាន Check-out រួចរាល់ហើយ');
        }
      }
    }

    // ==========================================
    // CASE B: Two Shifts (Shift 1 & Shift 2)
    // ==========================================
    // 1. IF (currentTime < s1_end):
    if (currentMinutes < s1EndMin) {
      if (!hasCheckIn1) {
        return AutoActionDecision.performAction('checkin_1');
      } else if (!hasCheckOut1) {
        return AutoActionDecision.alert('មិនទាន់ដល់ម៉ោង Check-out វេនទី ១ នៅឡើយទេ (ម៉ោង ${shift1End ?? "12:00"})');
      } else {
        return AutoActionDecision.alert('Session 1 បាន Check-in/out រួចរាល់ហើយ');
      }
    }

    // 2. ELSE IF (currentTime >= s1_end AND currentTime < s2_end):
    else if (currentMinutes >= s1EndMin && currentMinutes < s2EndMin) {
      // If employee forgot morning checkout, allow checkout 1 if Shift 2 has not started yet
      if (hasCheckIn1 && !hasCheckOut1 && (s2StartMin <= s1EndMin || currentMinutes < s2StartMin)) {
        return AutoActionDecision.performAction('checkout_1');
      }
      // If employee is in Shift 2 window and hasn't checked in for Shift 2:
      else if (!hasCheckIn2) {
        return AutoActionDecision.performAction('checkin_2');
      }
      // Already checked in Shift 2, but not yet s2_end (Cannot checkout 2 early):
      else if (!hasCheckOut2) {
        return AutoActionDecision.alert('មិនទាន់ដល់ម៉ោង Check-out វេនទី ២ នៅឡើយទេ (ម៉ោង $shift2End)');
      }
      // Completed all shifts
      else {
        return AutoActionDecision.alert('បាន Check ពេញលេញសម្រាប់ថ្ងៃនេះហើយ');
      }
    }

    // 3. ELSE IF (currentTime >= s2_end):
    else {
      if (hasCheckIn2 && !hasCheckOut2) {
        return AutoActionDecision.performAction('checkout_2');
      } else if (hasCheckIn1 && !hasCheckOut1 && !hasCheckIn2) {
        return AutoActionDecision.performAction('checkout_1');
      } else {
        return AutoActionDecision.alert('ផុតកំណត់ម៉ោងធ្វើការ / បាន Check-out រួចរាល់ហើយ');
      }
    }
  }

  Future<Map<String, dynamic>> logCheckinOnBehalf({
    required String staffId,
    required String action,
    String? note,
  }) async {
    _isProcessing.value = true;
    try {
      String normalized = action.toLowerCase().trim();
      if (normalized == 'check_in_1') normalized = 'checkin_1';
      if (normalized == 'check_out_1') normalized = 'checkout_1';
      if (normalized == 'check_in_2') normalized = 'checkin_2';
      if (normalized == 'check_out_2') normalized = 'checkout_2';

      final result = await _attendanceRepository.logCheckInOut(
        normalized,
        staffId: staffId,
        note: note ?? 'Check-in on behalf',
      );
      if (result['success'] == true) {
        AnalyticsService().logEvent(
          name: 'on_behalf_attendance',
          parameters: {
            'target_staff_id': staffId,
            'action': normalized,
          },
        );
        final isCheckIn = normalized.contains('checkin');
        final actionKhmer = isCheckIn ? 'Check-in ជំនួស' : 'Check-out ជំនួស';
        LocalNotificationService().showAttendanceNotification(
          title: 'វត្តមាន៖ $actionKhmer ជោគជ័យ',
          body: 'បុគ្គលិក $staffId បានកត់ត្រាវត្តមានរួចរាល់!',
          isCheckIn: isCheckIn,
        );
        await fetchRemoteHistory();
      }
      return result;
    } finally {
      _isProcessing.value = false;
    }
  }

  Future<void> fetchRemoteHistory({String? staffId}) async {
    final effectiveStaffId = (staffId != null && staffId.isNotEmpty)
        ? staffId
        : (Get.isRegistered<AuthController>() ? Get.find<AuthController>().user?.employeeId : null);

    checkOnBehalfEligibility();

    final parsed = await _attendanceRepository.fetchHistoryRecords(staffId: effectiveStaffId, forceRefresh: true);
    _historyRecords.value = parsed;

    // Calculate statistics strictly for THIS MONTH (Current Month & Year)
    final now = DateTime.now();
    final currentYear = now.year;
    final currentMonth = now.month;

    final thisMonthRecords = _historyRecords.where((r) {
      if (r.rawDate.isNotEmpty) {
        try {
          final dt = DateTime.parse(r.rawDate);
          return dt.year == currentYear && dt.month == currentMonth;
        } catch (_) {}
      }
      return false;
    }).toList();

    _presentCount.value = thisMonthRecords.where((r) => r.status == 'Present' || r.status == 'Early Leave').length;
    _lateCount.value = thisMonthRecords.where((r) => r.status == 'Late').length;
    _leaveCount.value = thisMonthRecords.where((r) => r.status == 'On Leave').length;
    _absentCount.value = thisMonthRecords.where((r) => r.status == 'Absent').length;

    // Sync today's check-in/out steps and session time slots from database for this specific employee
    final todayStr = DateFormat('yyyy-MM-dd').format(DateTime.now());
    AttendanceRecord? todayRecord;
    for (final record in _historyRecords) {
      final matchesDate = record.rawDate.contains(todayStr) || record.date.contains(todayStr);
      final matchesStaff = effectiveStaffId == null || effectiveStaffId.isEmpty || record.staffId == effectiveStaffId;
      if (matchesDate && matchesStaff) {
        todayRecord = record;
        break;
      }
    }

    if (todayRecord != null) {
      _checkIn1.value = (todayRecord.checkIn1 != null && todayRecord.checkIn1 != '--:--' && todayRecord.checkIn1 != '-') ? todayRecord.checkIn1 : null;
      _checkOut1.value = (todayRecord.checkOut1 != null && todayRecord.checkOut1 != '--:--' && todayRecord.checkOut1 != '-') ? todayRecord.checkOut1 : null;
      _checkIn2.value = (todayRecord.checkIn2 != null && todayRecord.checkIn2 != '--:--' && todayRecord.checkIn2 != '-') ? todayRecord.checkIn2 : null;
      _checkOut2.value = (todayRecord.checkOut2 != null && todayRecord.checkOut2 != '--:--' && todayRecord.checkOut2 != '-') ? todayRecord.checkOut2 : null;

      if (_checkOut2.value != null) {
        _currentStep.value = 4;
      } else if (_checkIn2.value != null) {
        _currentStep.value = 3;
      } else if (_checkOut1.value != null) {
        _currentStep.value = 2;
      } else if (_checkIn1.value != null) {
        _currentStep.value = 1;
      } else {
        final now = DateTime.now();
        if (now.hour >= 12) {
          _currentStep.value = 2; // Check In 2
        } else {
          _currentStep.value = 0; // Check In 1
        }
      }
    } else {
      _checkIn1.value = null;
      _checkOut1.value = null;
      _checkIn2.value = null;
      _checkOut2.value = null;
      final now = DateTime.now();
      if (now.hour >= 12) {
        _currentStep.value = 2; // Check In 2
      } else {
        _currentStep.value = 0; // Check In 1
      }
    }
  }

  Future<void> recordScanSuccess({String? action, String? staffId}) async {
    final nowStr = DateFormat('hh:mm a').format(DateTime.now());
    final todayStr = DateFormat('yyyy-MM-dd').format(DateTime.now());

    if (action == 'checkin_1') {
      _checkIn1.value = nowStr;
      _currentStep.value = 1;
    } else if (action == 'checkout_1') {
      _checkOut1.value = nowStr;
      _currentStep.value = 2;
    } else if (action == 'checkin_2') {
      _checkIn2.value = nowStr;
      _currentStep.value = 3;
    } else if (action == 'checkout_2') {
      _checkOut2.value = nowStr;
      _currentStep.value = 4;
    } else {
      switch (_currentStep.value) {
        case 0:
          _checkIn1.value = nowStr;
          _currentStep.value = 1;
          break;
        case 1:
          _checkOut1.value = nowStr;
          _currentStep.value = 2;
          break;
        case 2:
          _checkIn2.value = nowStr;
          _currentStep.value = 3;
          break;
        case 3:
          _checkOut2.value = nowStr;
          _currentStep.value = 4;
          break;
      }
    }

    _upsertTodayRecord(todayStr, staffId);
    await fetchRemoteHistory(staffId: staffId);

    // Track Firebase Analytics Event
    final branchName = Get.isRegistered<AuthController>()
        ? (Get.find<AuthController>().user?.branch ?? 'HQ')
        : 'HQ';
    final effectiveAction = action ?? 'checkin_1';
    final isCheckIn = effectiveAction.contains('checkin');
    if (isCheckIn) {
      AnalyticsService().logCheckIn(
        method: 'qr_or_face_scan',
        branchName: branchName,
        success: true,
      );
    } else {
      AnalyticsService().logCheckOut(
        method: 'qr_or_face_scan',
        branchName: branchName,
        success: true,
      );
    }

    // Trigger System Notification Bar on top of phone
    final actionKhmer = isCheckIn ? 'Check-in (ចូលធ្វើការ)' : 'Check-out (ចេញពីធ្វើការ)';
    final notifTitle = 'វត្តមាន៖ $actionKhmer ជោគជ័យ';
    final notifBody = 'បានកត់ត្រាវត្តមាននៅម៉ោង $nowStr ជោគជ័យ!';
    LocalNotificationService().showAttendanceNotification(
      title: notifTitle,
      body: notifBody,
      isCheckIn: isCheckIn,
    );
    if (Get.isRegistered<NotificationController>()) {
      Get.find<NotificationController>().addNotification(
        title: notifTitle,
        message: notifBody,
        type: isCheckIn ? 'approved' : 'checkout',
      );
    }
  }

  String get activeActionLabel {
    switch (_currentStep.value) {
      case 0:
        return 'Check In (1)';
      case 1:
        return 'Check Out (1)';
      case 2:
        return 'Check In (2)';
      case 3:
        return 'Check Out (2)';
      default:
        return 'Completed';
    }
  }

  Future<bool> toggleCheckInCheckOut([String? staffId]) async {
    _isProcessing.value = true;

    final nowStr = DateFormat('hh:mm a').format(DateTime.now());
    final todayStr = DateFormat('yyyy-MM-dd').format(DateTime.now());

    String actionStr = 'checkin_1';
    switch (_currentStep.value) {
      case 0:
        actionStr = 'checkin_1';
        _checkIn1.value = nowStr;
        _currentStep.value = 1;
        break;
      case 1:
        actionStr = 'checkout_1';
        _checkOut1.value = nowStr;
        _currentStep.value = 2;
        break;
      case 2:
        actionStr = 'checkin_2';
        _checkIn2.value = nowStr;
        _currentStep.value = 3;
        break;
      case 3:
        actionStr = 'checkout_2';
        _checkOut2.value = nowStr;
        _currentStep.value = 4;
        break;
    }

    final res = await _attendanceRepository.logCheckInOut(actionStr, staffId: staffId);
    _upsertTodayRecord(todayStr, staffId);

    // Track Firebase Analytics Event
    final isSuccess = res['success'] == true;
    final branchName = Get.isRegistered<AuthController>()
        ? (Get.find<AuthController>().user?.branch ?? 'HQ')
        : 'HQ';
    if (actionStr.contains('checkin')) {
      AnalyticsService().logCheckIn(
        method: 'manual_button',
        branchName: branchName,
        success: isSuccess,
      );
    } else {
      AnalyticsService().logCheckOut(
        method: 'manual_button',
        branchName: branchName,
        success: isSuccess,
      );
    }

    if (isSuccess) {
      final isCheckIn = actionStr.contains('checkin');
      final actionKhmer = isCheckIn ? 'Check-in (ចូលធ្វើការ)' : 'Check-out (ចេញពីធ្វើការ)';
      final notifTitle = 'វត្តមាន៖ $actionKhmer ជោគជ័យ';
      final notifBody = 'បានកត់ត្រាវត្តមាននៅម៉ោង $nowStr ជោគជ័យ!';
      LocalNotificationService().showAttendanceNotification(
        title: notifTitle,
        body: notifBody,
        isCheckIn: isCheckIn,
      );
      if (Get.isRegistered<NotificationController>()) {
        Get.find<NotificationController>().addNotification(
          title: notifTitle,
          message: notifBody,
          type: isCheckIn ? 'approved' : 'checkout',
        );
      }
    }

    _isProcessing.value = false;
    return true;
  }

  void _upsertTodayRecord(String dateStr, [String? staffId]) {
    if (_historyRecords.isNotEmpty && _historyRecords[0].date == dateStr) {
      _historyRecords[0] = AttendanceRecord(
        id: _historyRecords[0].id,
        staffId: staffId ?? _historyRecords[0].staffId,
        date: dateStr,
        checkIn1: _checkIn1.value ?? _historyRecords[0].checkIn1,
        checkOut1: _checkOut1.value ?? _historyRecords[0].checkOut1,
        checkIn2: _checkIn2.value ?? _historyRecords[0].checkIn2,
        checkOut2: _checkOut2.value ?? _historyRecords[0].checkOut2,
        status: 'Present',
        totalHours: _currentStep.value >= 3 ? '8.0 hrs' : 'In Progress',
        location: 'HQ Office Geofence',
      );
    } else {
      _historyRecords.insert(
        0,
        AttendanceRecord(
          id: DateTime.now().millisecondsSinceEpoch.toString(),
          staffId: staffId ?? 'EMP-001',
          date: dateStr,
          checkIn1: _checkIn1.value,
          checkOut1: _checkOut1.value,
          checkIn2: _checkIn2.value,
          checkOut2: _checkOut2.value,
          status: 'Present',
          totalHours: 'In Progress',
          location: 'HQ Office Geofence',
        ),
      );
    }
  }
}
