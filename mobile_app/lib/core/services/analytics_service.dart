import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:flutter/foundation.dart';

class AnalyticsService {
  static final AnalyticsService _instance = AnalyticsService._internal();
  factory AnalyticsService() => _instance;
  AnalyticsService._internal();

  final FirebaseAnalytics _analytics = FirebaseAnalytics.instance;

  /// Getter សម្រាប់ប្រើជាមួយ Navigator Observers (GetMaterialApp navigatorObservers)
  FirebaseAnalyticsObserver get observer =>
      FirebaseAnalyticsObserver(analytics: _analytics);

  FirebaseAnalytics get analytics => _analytics;

  /// កំណត់ User ID នៅពេល Login
  Future<void> setUserId(String? userId) async {
    try {
      await _analytics.setUserId(id: userId);
      debugPrint('[Analytics] User ID set to: $userId');
    } catch (e) {
      debugPrint('[Analytics Error] setUserId: $e');
    }
  }

  /// កំណត់ User Properties ដូចជា Role, Branch, Department
  Future<void> setUserProperty({
    required String name,
    required String? value,
  }) async {
    try {
      await _analytics.setUserProperty(name: name, value: value);
      debugPrint('[Analytics] UserProperty $name = $value');
    } catch (e) {
      debugPrint('[Analytics Error] setUserProperty: $e');
    }
  }

  /// កំណត់ព័ត៌មាន User សំខាន់ៗទាំងអស់ក្នុងពេលតែមួយ
  Future<void> setUserProfile({
    required String staffId,
    String? role,
    String? branch,
    String? department,
  }) async {
    await setUserId(staffId);
    if (role != null) await setUserProperty(name: 'user_role', value: role);
    if (branch != null) await setUserProperty(name: 'branch_name', value: branch);
    if (department != null) await setUserProperty(name: 'department', value: department);
  }

  /// Clear User Session ពេល Logout
  Future<void> logLogout() async {
    try {
      await _analytics.logEvent(name: 'app_logout');
      await _analytics.setUserId(id: null);
      debugPrint('[Analytics] User logged out, user ID reset');
    } catch (e) {
      debugPrint('[Analytics Error] logLogout: $e');
    }
  }

  /// Track Login Event
  Future<void> logLogin({required String method}) async {
    try {
      await _analytics.logLogin(loginMethod: method);
      debugPrint('[Analytics] Login logged with method: $method');
    } catch (e) {
      debugPrint('[Analytics Error] logLogin: $e');
    }
  }

  /// Track Check-in Event
  Future<void> logCheckIn({
    required String method, // e.g. 'kiosk_qr', 'face_recognition', 'geo_location'
    required String branchName,
    required bool success,
    String? errorMessage,
  }) async {
    try {
      await _analytics.logEvent(
        name: 'attendance_check_in',
        parameters: {
          'method': method,
          'branch': branchName,
          'status': success ? 'success' : 'failed',
          'error': ?errorMessage,
        },
      );
      debugPrint('[Analytics] Check-in logged: method=$method, success=$success');
    } catch (e) {
      debugPrint('[Analytics Error] logCheckIn: $e');
    }
  }

  /// Track Check-out Event
  Future<void> logCheckOut({
    required String method,
    required String branchName,
    required bool success,
    String? errorMessage,
  }) async {
    try {
      await _analytics.logEvent(
        name: 'attendance_check_out',
        parameters: {
          'method': method,
          'branch': branchName,
          'status': success ? 'success' : 'failed',
          'error': ?errorMessage,
        },
      );
      debugPrint('[Analytics] Check-out logged: method=$method, success=$success');
    } catch (e) {
      debugPrint('[Analytics Error] logCheckOut: $e');
    }
  }

  /// Track Leave Request
  Future<void> logLeaveRequest({
    required String leaveType,
    required double durationDays,
  }) async {
    try {
      await _analytics.logEvent(
        name: 'submit_leave_request',
        parameters: {
          'leave_type': leaveType,
          'duration_days': durationDays,
        },
      );
      debugPrint('[Analytics] Leave request logged: $leaveType ($durationDays days)');
    } catch (e) {
      debugPrint('[Analytics Error] logLeaveRequest: $e');
    }
  }

  /// Track Overtime Request
  Future<void> logOvertimeRequest({
    required double hours,
    String? reason,
  }) async {
    try {
      await _analytics.logEvent(
        name: 'submit_overtime_request',
        parameters: {
          'hours': hours,
          'reason': ?reason,
        },
      );
      debugPrint('[Analytics] Overtime request logged: $hours hours');
    } catch (e) {
      debugPrint('[Analytics Error] logOvertimeRequest: $e');
    }
  }

  /// Manually log Screen View
  Future<void> logScreenView({
    required String screenName,
    String? screenClass,
  }) async {
    try {
      await _analytics.logScreenView(
        screenName: screenName,
        screenClass: screenClass ?? screenName,
      );
      debugPrint('[Analytics] ScreenView: $screenName');
    } catch (e) {
      debugPrint('[Analytics Error] logScreenView: $e');
    }
  }

  /// Generic Custom Event Logger
  Future<void> logEvent({
    required String name,
    Map<String, Object>? parameters,
  }) async {
    try {
      await _analytics.logEvent(
        name: name,
        parameters: parameters,
      );
      debugPrint('[Analytics] Custom Event: $name, params: $parameters');
    } catch (e) {
      debugPrint('[Analytics Error] logEvent: $e');
    }
  }
}
