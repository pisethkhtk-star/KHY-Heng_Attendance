import 'dart:async';
import 'dart:math' as math;
import 'package:get/get.dart';
import 'package:intl/intl.dart';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';
import '../models/attendance_model.dart';
import '../repositories/attendance_repository.dart';
import '../repositories/auth_repository.dart';
import '../core/services/analytics_service.dart';
import '../core/services/local_notification_service.dart';
import '../core/services/mock_location_service.dart';
import 'auth_controller.dart';
import 'notification_controller.dart';

class AutoActionDecision {
  final String? action; // 'checkin_1', 'checkout_1', 'checkin_2', 'checkout_2'
  final String? alertMessage; // Khmer alert message if action cannot be performed
  final bool isSuccess;
  final bool isExistingData;
  final String? existingTime;

  const AutoActionDecision({
    this.action,
    this.alertMessage,
    required this.isSuccess,
    this.isExistingData = false,
    this.existingTime,
  });

  factory AutoActionDecision.performAction(String action) => AutoActionDecision(
        action: action,
        isSuccess: true,
        isExistingData: false,
      );

  factory AutoActionDecision.existingRecord(String action, String? time) => AutoActionDecision(
        action: action,
        isSuccess: true,
        isExistingData: true,
        existingTime: time,
      );

  factory AutoActionDecision.alert(String message) => AutoActionDecision(
        alertMessage: message,
        isSuccess: false,
        isExistingData: false,
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

  // Background Location & Branch Geofence Tracking
  final RxBool isLocationVerified = false.obs;
  final RxnString matchedBranchName = RxnString();
  final RxnString locationError = RxnString();
  final RxDouble currentLat = 0.0.obs;
  final RxDouble currentLng = 0.0.obs;
  final RxDouble distanceToBranch = 0.0.obs;
  final RxList<Map<String, dynamic>> branchSettings = <Map<String, dynamic>>[].obs;
  StreamSubscription<Position>? _backgroundPositionSub;

  @override
  void onInit() {
    super.onInit();
    fetchWorkHours();
    fetchRemoteHistory();
    checkOnBehalfEligibility();
    startBackgroundLocationTracking();
  }

  @override
  void onClose() {
    _backgroundPositionSub?.cancel();
    super.onClose();
  }

  // --- Geofence Math & Branch Matching Helpers ---
  static double calculateDistance(double lat1, double lon1, double lat2, double lon2) {
    const double p = 0.017453292519943295; // PI / 180
    final double a = 0.5 -
        math.cos((lat2 - lat1) * p) / 2 +
        math.cos(lat1 * p) * math.cos(lat2 * p) * (1 - math.cos((lon2 - lon1) * p)) / 2;
    return 12742000 * math.asin(math.sqrt(a)); // meters
  }

  static bool isBranchMatch(String userBranch, String settingName) {
    final ub = userBranch.trim().toLowerCase();
    final sn = settingName.trim().toLowerCase();
    if (ub.isEmpty || sn.isEmpty) return false;
    if (ub == sn || sn.contains(ub) || ub.contains(sn)) return true;

    final ubPP = ub.contains('pp') || ub.contains('phnom penh') || ub.contains('hq');
    final snPP = sn.contains('pp') || sn.contains('phnom penh') || sn.contains('hq');
    if (ubPP && snPP) return true;

    final ubTakeo = ub.contains('takeo') || ub.contains('តាកែវ');
    final snTakeo = sn.contains('takeo') || sn.contains('តាកែវ');
    if (ubTakeo && snTakeo) return true;

    return false;
  }

  Future<void> fetchBranchKioskSettings() async {
    try {
      if (Get.isRegistered<IAuthRepository>()) {
        final settingsRaw = await Get.find<IAuthRepository>().fetchKioskSettings();
        if (settingsRaw.isNotEmpty) {
          branchSettings.value = settingsRaw.map((s) => Map<String, dynamic>.from(s)).toList();
          return;
        }
      }
    } catch (_) {}

    // Fallback default branches if offline
    if (branchSettings.isEmpty) {
      branchSettings.value = [
        {'id': 'pp_hq_id', 'name': 'Phnom Penh HQ', 'latitude': 11.5564, 'longitude': 104.9282, 'radius': 100.0},
        {'id': 'takeo_branch_id', 'name': 'Takeo Branch', 'latitude': 10.9833, 'longitude': 104.7833, 'radius': 100.0},
      ];
    }
  }

  Future<void> startBackgroundLocationTracking() async {
    try {
      final status = await Permission.locationWhenInUse.status;
      if (!status.isGranted) {
        await Permission.locationWhenInUse.request();
      }

      await fetchBranchKioskSettings();

      // Immediate GPS reading on startup
      try {
        final pos = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.high,
            timeLimit: Duration(seconds: 5),
          ),
        );
        _updateBackgroundPosition(pos);
      } catch (e) {
        verifyBranchGeofenceNow();
      }

      // Continuous background location stream
      _backgroundPositionSub?.cancel();
      _backgroundPositionSub = Geolocator.getPositionStream(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          distanceFilter: 3,
        ),
      ).listen(
        (Position position) {
          _updateBackgroundPosition(position);
        },
        onError: (_) {},
      );
    } catch (_) {}
  }

  void _updateBackgroundPosition(Position position) {
    if (position.isMocked) {
      isLocationVerified.value = false;
      locationError.value = '❌ រកឃើញ Fake GPS! សូមបិទ Fake GPS ជាមុនសិន';
      try {
        Get.find<MockLocationService>().triggerMockDetected();
      } catch (_) {}
      return;
    }

    currentLat.value = position.latitude;
    currentLng.value = position.longitude;

    verifyBranchGeofenceNow(lat: position.latitude, lng: position.longitude);
  }

  void verifyBranchGeofenceNow({double? lat, double? lng}) {
    final checkLat = lat ?? (currentLat.value != 0.0 ? currentLat.value : 11.5564);
    final checkLng = lng ?? (currentLng.value != 0.0 ? currentLng.value : 104.9282);

    final authController = Get.isRegistered<AuthController>() ? Get.find<AuthController>() : null;
    final assignedBranchRaw = authController?.user?.branch ?? '';
    final userBranchNames = assignedBranchRaw
        .split(',')
        .map((b) => b.trim())
        .where((b) => b.isNotEmpty)
        .toList();

    List<Map<String, dynamic>> targetBranches = branchSettings.where((setting) {
      final settingName = (setting['name'] ?? '').toString();
      return userBranchNames.any((ub) => isBranchMatch(ub, settingName));
    }).toList();

    if (targetBranches.isEmpty) {
      targetBranches = branchSettings.isNotEmpty
          ? branchSettings
          : [
              {'name': 'Phnom Penh HQ', 'latitude': 11.5564, 'longitude': 104.9282, 'radius': 100.0},
              {'name': 'Takeo Branch', 'latitude': 10.9833, 'longitude': 104.7833, 'radius': 100.0},
            ];
    }

    Map<String, dynamic>? insideBranch;
    double? minDistance;
    Map<String, dynamic>? closestBranch;

    for (final branch in targetBranches) {
      final bLat = (branch['latitude'] as num?)?.toDouble() ?? 11.5564;
      final bLng = (branch['longitude'] as num?)?.toDouble() ?? 104.9282;
      final radius = (branch['radius'] as num?)?.toDouble() ?? 100.0;
      final dist = calculateDistance(checkLat, checkLng, bLat, bLng);

      if (dist <= radius) {
        insideBranch = branch;
        minDistance = dist;
        break;
      } else {
        if (minDistance == null || dist < minDistance) {
          minDistance = dist;
          closestBranch = branch;
        }
      }
    }

    if (insideBranch != null) {
      final name = (insideBranch['name'] ?? 'Branch').toString();
      isLocationVerified.value = true;
      matchedBranchName.value = name;
      locationError.value = null;
      distanceToBranch.value = minDistance ?? 0.0;
    } else {
      final closestName = (closestBranch?['name'] ?? 'Branch').toString();
      final closestRadius = (closestBranch?['radius'] as num?)?.toDouble() ?? 100.0;
      isLocationVerified.value = false;
      matchedBranchName.value = closestName;
      distanceToBranch.value = minDistance ?? 0.0;
      locationError.value =
          '🔒 មិនគ្រប់លក្ខខណ្ឌទីតាំង! លោកអ្នកស្ថិតនៅក្រៅទីតាំងសាខា៖ $closestName (${(minDistance ?? 0).toStringAsFixed(1)}m > ${closestRadius.toStringAsFixed(0)}m)';
    }
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

  Future<Map<String, dynamic>> syncFaceData(String? clientVersion) async {
    return await _attendanceRepository.syncFaceData(clientVersion);
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
    String? selectedAction,
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

    // If an action was explicitly requested (e.g. from manual selection)
    if (selectedAction != null && selectedAction.trim().isNotEmpty) {
      String norm = selectedAction.trim().toLowerCase();
      if (norm == 'check_in_1') norm = 'checkin_1';
      if (norm == 'check_out_1') norm = 'checkout_1';
      if (norm == 'check_in_2') norm = 'checkin_2';
      if (norm == 'check_out_2') norm = 'checkout_2';

      if (norm == 'checkin_1') {
        if (hasCheckIn1) {
          return AutoActionDecision.existingRecord('checkin_1', todayRecord?.checkIn1);
        }
        return AutoActionDecision.performAction('checkin_1');
      } else if (norm == 'checkout_1') {
        if (hasCheckOut1) {
          return AutoActionDecision.existingRecord('checkout_1', todayRecord?.checkOut1);
        }
        return AutoActionDecision.performAction('checkout_1');
      } else if (norm == 'checkin_2') {
        if (hasCheckIn2) {
          return AutoActionDecision.existingRecord('checkin_2', todayRecord?.checkIn2);
        }
        return AutoActionDecision.performAction('checkin_2');
      } else if (norm == 'checkout_2') {
        if (hasCheckOut2) {
          return AutoActionDecision.existingRecord('checkout_2', todayRecord?.checkOut2);
        }
        return AutoActionDecision.performAction('checkout_2');
      }
    }

    // ==========================================
    // CASE A: Single Shift (Shift 1 only)
    // ==========================================
    if (!hasShift2) {
      if (currentMinutes < s1EndMin) {
        if (!hasCheckIn1) {
          return AutoActionDecision.performAction('checkin_1');
        } else {
          return AutoActionDecision.existingRecord('checkin_1', todayRecord?.checkIn1);
        }
      } else {
        if (hasCheckOut1) {
          return AutoActionDecision.existingRecord('checkout_1', todayRecord?.checkOut1);
        } else if (hasCheckIn1) {
          return AutoActionDecision.performAction('checkout_1');
        } else {
          return AutoActionDecision.performAction('checkout_1');
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
      } else if (hasCheckOut1) {
        return AutoActionDecision.existingRecord('checkout_1', todayRecord?.checkOut1);
      } else {
        return AutoActionDecision.existingRecord('checkin_1', todayRecord?.checkIn1);
      }
    }

    // 2. ELSE IF (currentTime >= s1_end AND currentTime < s2_end):
    else if (currentMinutes >= s1EndMin && currentMinutes < s2EndMin) {
      // If in Shift 1 checkout window before Shift 2 starts:
      if (s2StartMin > s1EndMin && currentMinutes < s2StartMin) {
        if (hasCheckOut1) {
          return AutoActionDecision.existingRecord('checkout_1', todayRecord?.checkOut1);
        } else {
          return AutoActionDecision.performAction('checkout_1');
        }
      }
      // If in Shift 2 window:
      else {
        if (!hasCheckIn2) {
          if (hasCheckIn1 && !hasCheckOut1 && currentMinutes < s2StartMin) {
            return AutoActionDecision.performAction('checkout_1');
          }
          return AutoActionDecision.performAction('checkin_2');
        } else if (hasCheckOut2) {
          return AutoActionDecision.existingRecord('checkout_2', todayRecord?.checkOut2);
        } else {
          return AutoActionDecision.existingRecord('checkin_2', todayRecord?.checkIn2);
        }
      }
    }

    // 3. ELSE IF (currentTime >= s2_end):
    else {
      if (hasCheckOut2) {
        return AutoActionDecision.existingRecord('checkout_2', todayRecord?.checkOut2);
      } else if (hasCheckIn2) {
        return AutoActionDecision.performAction('checkout_2');
      } else if (hasCheckIn1 && !hasCheckOut1 && !hasCheckIn2) {
        return AutoActionDecision.performAction('checkout_1');
      } else {
        return AutoActionDecision.performAction('checkout_2');
      }
    }
  }

  Future<Map<String, dynamic>> logCheckinOnBehalf({
    required String staffId,
    required String action,
    String? note,
    double? lat,
    double? lng,
  }) async {
    _isProcessing.value = true;
    try {
      String normalized = action.toLowerCase().trim();
      if (normalized == 'check_in_1') normalized = 'checkin_1';
      if (normalized == 'check_out_1') normalized = 'checkout_1';
      if (normalized == 'check_in_2') normalized = 'checkin_2';
      if (normalized == 'check_out_2') normalized = 'checkout_2';

      final effectiveLat = lat ?? (currentLat.value != 0.0 ? currentLat.value : 11.5564);
      final effectiveLng = lng ?? (currentLng.value != 0.0 ? currentLng.value : 104.9282);

      final result = await _attendanceRepository.logCheckInOut(
        normalized,
        staffId: staffId,
        lat: effectiveLat,
        lng: effectiveLng,
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
