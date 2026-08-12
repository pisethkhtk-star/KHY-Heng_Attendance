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

  UserModel? get user => _user.value;
  bool get isAuthenticated => _isAuthenticated.value;
  bool get isLoading => _isLoading.value;
  String? get errorMessage => _errorMessage.value;

  @override
  void onInit() {
    super.onInit();
    checkSavedSession();
  }

  Future<void> checkSavedSession() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('auth_token');
    final userDataString = prefs.getString('user_data');

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
      return true;
    } else {
      _isAuthenticated.value = false;
      _user.value = null;
      _errorMessage.value = result['message'] ?? 'Invalid email or password';
      return false;
    }
  }

  Future<void> logout() async {
    _isAuthenticated.value = false;
    _user.value = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('auth_token');
    await prefs.remove('user_data');
  }
}
