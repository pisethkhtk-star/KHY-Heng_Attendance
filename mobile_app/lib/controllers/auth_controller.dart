import 'dart:convert';
import 'package:get/get.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user_model.dart';
import '../core/services/api_service.dart';

class AuthController extends GetxController {
  final Rxn<UserModel> _user = Rxn<UserModel>();
  final RxBool _isAuthenticated = false.obs;
  final RxBool _isLoading = false.obs;
  final RxnString _errorMessage = RxnString();
  final RxList<Map<String, dynamic>> _branchSettings = <Map<String, dynamic>>[].obs;

  UserModel? get user => _user.value;
  bool get isAuthenticated => _isAuthenticated.value;
  bool get isLoading => _isLoading.value;
  String? get errorMessage => _errorMessage.value;
  List<Map<String, dynamic>> get branchSettings => _branchSettings;

  @override
  void onInit() {
    super.onInit();
    checkSavedSession();
  }

  /// Immediately fetch branch location settings from Database upon login/session load
  Future<void> fetchBranchLocationsFromDb() async {
    try {
      final settingsRaw = await ApiService.fetchKioskSettings();
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
        final meResult = await ApiService.getMe();
        if (meResult['success'] == true && meResult['user'] != null) {
          _user.value = UserModel.fromJson(meResult['user']);
        }
        await fetchBranchLocationsFromDb();
      } catch (_) {
        _isAuthenticated.value = false;
        _user.value = null;
      }
    } else {
      _isAuthenticated.value = false;
      _user.value = null;
    }
  }

  Future<bool> login(String email, String password) async {
    _isLoading.value = true;
    _errorMessage.value = null;

    final result = await ApiService.login(email, password);

    _isLoading.value = false;
    if (result['success'] == true) {
      _user.value = UserModel.fromJson(result['user'] ?? {});
      _isAuthenticated.value = true;
      _errorMessage.value = null;

      // Immediately fetch branch locations from database upon successful login!
      await fetchBranchLocationsFromDb();
      return true;
    } else {
      _isAuthenticated.value = false;
      _user.value = null;
      _errorMessage.value = result['message'] ?? 'Invalid email or password';
      return false;
    }
  }

  Future<bool> loginWithQRCode(String qrToken) async {
    _isLoading.value = true;
    _errorMessage.value = null;

    final result = await ApiService.loginWithQRCode(qrToken);

    _isLoading.value = false;
    if (result['success'] == true) {
      _user.value = UserModel.fromJson(result['user'] ?? {});
      _isAuthenticated.value = true;
      _errorMessage.value = null;

      await fetchBranchLocationsFromDb();
      return true;
    } else {
      _isAuthenticated.value = false;
      _user.value = null;
      _errorMessage.value = result['message'] ?? 'Invalid or expired QR code';
      return false;
    }
  }

  Future<void> logout() async {
    _isAuthenticated.value = false;
    _user.value = null;
    _branchSettings.clear();
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('auth_token');
    await prefs.remove('user_data');
    await prefs.remove('branch_settings');
  }
}
