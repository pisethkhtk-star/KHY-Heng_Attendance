import 'package:get/get.dart';
import 'package:intl/intl.dart';
import '../models/attendance_model.dart';
import '../core/services/api_service.dart';

class AttendanceController extends GetxController {
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

  @override
  void onInit() {
    super.onInit();
    fetchRemoteHistory();
  }

  Future<void> fetchRemoteHistory({String? staffId}) async {
    final remoteData = await ApiService.fetchHistoryRecords(staffId: staffId);
    if (remoteData.isNotEmpty) {
      final parsed = remoteData.map((json) => AttendanceRecord.fromJson(json)).toList();
      _historyRecords.value = parsed;
    } else {
      _historyRecords.value = [];
    }

    _presentCount.value = _historyRecords.where((r) => r.status == 'Present').length;
    _lateCount.value = _historyRecords.where((r) => r.status == 'Late').length;
    _leaveCount.value = _historyRecords.where((r) => r.status == 'On Leave').length;
    _absentCount.value = _historyRecords.where((r) => r.status == 'Absent').length;

    // Sync today's check-in/out steps and session time slots from database
    final todayStr = DateFormat('yyyy-MM-dd').format(DateTime.now());
    AttendanceRecord? todayRecord;
    for (final record in _historyRecords) {
      if (record.rawDate.contains(todayStr) || record.date.contains(todayStr)) {
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
        _currentStep.value = 0;
      }
    }
  }

  Future<void> recordScanSuccess({String? action, String? staffId}) async {
    final nowStr = DateFormat('hh:mm a').format(DateTime.now());
    final todayStr = DateFormat('yyyy-MM-dd').format(DateTime.now());

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

    _upsertTodayRecord(todayStr, staffId);
    await fetchRemoteHistory(staffId: staffId);
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

    await ApiService.logCheckInOut(actionStr, staffId: staffId);
    _upsertTodayRecord(todayStr, staffId);

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
