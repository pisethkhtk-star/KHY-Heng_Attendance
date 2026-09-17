import 'dart:convert';
import 'package:get/get.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user_model.dart';
import '../repositories/auth_repository.dart';
import '../core/services/analytics_service.dart';
import 'attendance_controller.dart';

class AuthController extends GetxController {
  final IAuthRepository _authRepository = Get.find<IAuthRepository>();

  final Rxn<UserModel> _user = Rxn<UserModel>();
  final RxBool _isAuthenticated = false.obs;
  final RxBool _isLoading = false.obs;
  final RxnString _errorMessage = RxnString();
  final RxList<Map<String, dynamic>> _branchSettings = <Map<String, dynamic>>[].obs;
  final RxBool _isAvatarUploading = false.obs;

  UserModel? get user => _user.value;
  bool get isAuthenticated => _isAuthenticated.value;
  bool get isLoading => _isLoading.value;
  bool get isAvatarUploading => _isAvatarUploading.value;
  String? get errorMessage => _errorMessage.value;
  List<Map<String, dynamic>> get branchSettings => _branchSettings;

  @override
  void onInit() {
    super.onInit();
    checkSavedSession();
  }

  void _syncUserAttendance() {
    if (Get.isRegistered<AttendanceController>()) {
      final attendanceCtrl = Get.find<AttendanceController>();
      attendanceCtrl.fetchWorkHours();
      attendanceCtrl.fetchRemoteHistory(staffId: _user.value?.employeeId);
      attendanceCtrl.checkOnBehalfEligibility();
    }
  }

  /// Immediately fetch branch location settings from Database upon login/session load
  Future<void> fetchBranchLocationsFromDb() async {
    try {
      final settingsRaw = await _authRepository.fetchKioskSettings();
      _branchSettings.value = settingsRaw.map((s) => Map<String, dynamic>.from(s)).toList();
      
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('branch_settings', jsonEncode(_branchSettings.toList()));
    } catch (_) {}
  }

  Future<void> checkSavedSession() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('auth_token');
    final userDataString = prefs.getString('user_data');
    final branchSettingsString = prefs.getString('branch_settings');

    if (branchSettingsString != null) {
      try {
        final decoded = jsonDecode(branchSettingsString);
        if (decoded is List) {
          _branchSettings.value = decoded.map((s) => Map<String, dynamic>.from(s)).toList();
        }
      } catch (_) {}
    }

    if (token != null && userDataString != null) {
      try {
        final userData = jsonDecode(userDataString);
        _user.value = UserModel.fromJson(userData);
        _isAuthenticated.value = true;

        // Fetch live updated profile & branch from database
        await refreshUserProfile();
        if (_user.value != null) {
          AnalyticsService().setUserProfile(
            staffId: _user.value!.employeeId.isNotEmpty ? _user.value!.employeeId : _user.value!.id,
            role: _user.value!.role,
            branch: _user.value!.branch,
            department: _user.value!.department,
          );
        }
      } catch (_) {
        _isAuthenticated.value = false;
        _user.value = null;
      }
    } else {
      _isAuthenticated.value = false;
      _user.value = null;
    }
  }

  Future<void> refreshUserProfile() async {
    try {
      final meResult = await _authRepository.getMe();
      if (meResult.success && meResult.user != null) {
        _user.value = meResult.user;
        AnalyticsService().setUserProfile(
          staffId: meResult.user!.employeeId.isNotEmpty ? meResult.user!.employeeId : meResult.user!.id,
          role: meResult.user!.role,
          branch: meResult.user!.branch,
          department: meResult.user!.department,
        );
      }
      await fetchBranchLocationsFromDb();
      _syncUserAttendance();
    } catch (_) {}
  }

  Future<bool> login(String email, String password) async {
    _isLoading.value = true;
    _errorMessage.value = null;

    final result = await _authRepository.login(email, password);

    _isLoading.value = false;
    if (result.success) {
      _user.value = result.user;
      _isAuthenticated.value = true;
      _errorMessage.value = null;

      // Track Firebase Analytics Login & User Profile
      AnalyticsService().logLogin(method: 'password');
      if (result.user != null) {
        AnalyticsService().setUserProfile(
          staffId: result.user!.employeeId.isNotEmpty ? result.user!.employeeId : result.user!.id,
          role: result.user!.role,
          branch: result.user!.branch,
          department: result.user!.department,
        );
      }

      // Immediately fetch branch locations from database upon successful login!
      await fetchBranchLocationsFromDb();
      _syncUserAttendance();
      return true;
    } else {
      _isAuthenticated.value = false;
      _user.value = null;
      _errorMessage.value = result.message ?? 'Invalid email or password';
      return false;
    }
  }

  Future<bool> loginWithQRCode(String qrToken) async {
    _isLoading.value = true;
    _errorMessage.value = null;

    final result = await _authRepository.loginWithQRCode(qrToken);

    _isLoading.value = false;
    if (result.success) {
      _user.value = result.user;
      _isAuthenticated.value = true;
      _errorMessage.value = null;

      // Track Firebase Analytics Login & User Profile
      AnalyticsService().logLogin(method: 'qr_code');
      if (result.user != null) {
        AnalyticsService().setUserProfile(
          staffId: result.user!.employeeId.isNotEmpty ? result.user!.employeeId : result.user!.id,
          role: result.user!.role,
          branch: result.user!.branch,
          department: result.user!.department,
        );
      }

      await fetchBranchLocationsFromDb();
      _syncUserAttendance();
      return true;
    } else {
      _isAuthenticated.value = false;
      _user.value = null;
      _errorMessage.value = result.message ?? 'Invalid or expired QR code';
      return false;
    }
  }

  Future<void> logout() async {
    // Track Firebase Analytics Logout
    AnalyticsService().logLogout();

    _isAuthenticated.value = false;
    _user.value = null;
    _branchSettings.clear();
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('auth_token');
    await prefs.remove('user_data');
    await prefs.remove('branch_settings');
    if (Get.isRegistered<AttendanceController>()) {
      final attendanceCtrl = Get.find<AttendanceController>();
      attendanceCtrl.canCheckinOnBehalf.value = false;
      attendanceCtrl.eligibleEmployees.clear();
    }
    _syncUserAttendance();
  }

  Future<bool> updateProfileAvatar(String? avatarBase64) async {
    _isAvatarUploading.value = true;
    _errorMessage.value = null;
    try {
      final result = await _authRepository.updateAvatar(avatarBase64);
      if (result.success && result.user != null) {
        _user.value = result.user;
        return true;
      } else {
        _errorMessage.value = result.message ?? 'Failed to update avatar';
        return false;
      }
    } catch (e) {
      _errorMessage.value = e.toString();
      return false;
    } finally {
      _isAvatarUploading.value = false;
    }
  }
}
