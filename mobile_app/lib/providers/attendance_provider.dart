import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/attendance_model.dart';
import '../core/services/api_service.dart';

class AttendanceProvider extends ChangeNotifier {
  int _currentStep = 0; // 0: Check-In 1, 1: Check-Out 1, 2: Check-In 2, 3: Check-Out 2, 4: Done
  String? _checkIn1;
  String? _checkOut1;
  String? _checkIn2;
  String? _checkOut2;
  bool _isProcessing = false;

  int _presentCount = 0;
  int _lateCount = 0;
  int _leaveCount = 0;
  int _absentCount = 0;

  int get currentStep => _currentStep;
  bool get isCheckedIn => _currentStep > 0;
  String? get checkIn1 => _checkIn1;
  String? get checkOut1 => _checkOut1;
  String? get checkIn2 => _checkIn2;
  String? get checkOut2 => _checkOut2;
  bool get isProcessing => _isProcessing;

  int get presentCount => _historyRecords.isEmpty ? 22 : _presentCount;
  int get lateCount => _historyRecords.isEmpty ? 2 : _lateCount;
  int get leaveCount => _historyRecords.isEmpty ? 1 : _leaveCount;
  int get absentCount => _absentCount;

  List<AttendanceRecord> _historyRecords = [];
  List<AttendanceRecord> get historyRecords => _historyRecords;

  AttendanceProvider() {
    _initMockHistory();
    fetchRemoteHistory();
  }

  void _initMockHistory() {
    final now = DateTime.now();
    _historyRecords = List.generate(15, (index) {
      final date = now.subtract(Duration(days: index));
      final dateStr = DateFormat('yyyy-MM-dd').format(date);
      final isLate = index % 5 == 2;
      final isOnLeave = index == 7;

      return AttendanceRecord(
        id: 'att-$index',
        date: dateStr,
        checkIn1: isOnLeave ? '--:--' : (isLate ? '08:35 AM' : '07:55 AM'),
        checkOut1: isOnLeave ? '--:--' : '12:02 PM',
        checkIn2: isOnLeave ? '--:--' : '01:00 PM',
        checkOut2: isOnLeave ? '--:--' : '05:05 PM',
        status: isOnLeave ? 'On Leave' : (isLate ? 'Late' : 'Present'),
        totalHours: isOnLeave ? '0.0 hrs' : '8.1 hrs',
        location: 'HQ Office Geofence',
        isVerified: true,
      );
    });
  }

  Future<void> fetchRemoteHistory() async {
    final remoteData = await ApiService.fetchHistoryRecords();
    if (remoteData.isNotEmpty) {
      final parsed = remoteData.map((json) => AttendanceRecord.fromJson(json)).toList();
      _historyRecords = parsed;

      // Recalculate stats from DB history records
      _presentCount = _historyRecords.where((r) => r.status == 'Present').length;
      _lateCount = _historyRecords.where((r) => r.status == 'Late').length;
      _leaveCount = _historyRecords.where((r) => r.status == 'On Leave').length;
      _absentCount = _historyRecords.where((r) => r.status == 'Absent').length;

      notifyListeners();
    }
  }


  String get activeActionLabel {
    switch (_currentStep) {
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

  Future<bool> toggleCheckInCheckOut() async {
    _isProcessing = true;
    notifyListeners();

    final nowStr = DateFormat('hh:mm a').format(DateTime.now());
    final todayStr = DateFormat('yyyy-MM-dd').format(DateTime.now());

    String actionStr = 'checkin_1';
    switch (_currentStep) {
      case 0:
        actionStr = 'checkin_1';
        _checkIn1 = nowStr;
        _currentStep = 1;
        break;
      case 1:
        actionStr = 'checkout_1';
        _checkOut1 = nowStr;
        _currentStep = 2;
        break;
      case 2:
        actionStr = 'checkin_2';
        _checkIn2 = nowStr;
        _currentStep = 3;
        break;
      case 3:
        actionStr = 'checkout_2';
        _checkOut2 = nowStr;
        _currentStep = 4;
        break;
    }

    await ApiService.logCheckInOut(actionStr);
    _upsertTodayRecord(todayStr);

    _isProcessing = false;
    notifyListeners();
    return true;
  }

  void _upsertTodayRecord(String dateStr) {
    if (_historyRecords.isNotEmpty && _historyRecords[0].date == dateStr) {
      _historyRecords[0] = AttendanceRecord(
        id: _historyRecords[0].id,
        date: dateStr,
        checkIn1: _checkIn1 ?? _historyRecords[0].checkIn1,
        checkOut1: _checkOut1 ?? _historyRecords[0].checkOut1,
        checkIn2: _checkIn2 ?? _historyRecords[0].checkIn2,
        checkOut2: _checkOut2 ?? _historyRecords[0].checkOut2,
        status: 'Present',
        totalHours: _currentStep >= 3 ? '8.0 hrs' : 'In Progress',
        location: 'HQ Office Geofence',
      );
    } else {
      _historyRecords.insert(
        0,
        AttendanceRecord(
          id: DateTime.now().millisecondsSinceEpoch.toString(),
          date: dateStr,
          checkIn1: _checkIn1,
          checkOut1: _checkOut1,
          checkIn2: _checkIn2,
          checkOut2: _checkOut2,
          status: 'Present',
          totalHours: 'In Progress',
          location: 'HQ Office Geofence',
        ),
      );
    }
  }
}
