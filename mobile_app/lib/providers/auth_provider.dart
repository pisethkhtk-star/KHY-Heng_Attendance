import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user_model.dart';
import '../core/services/api_service.dart';

class AuthProvider extends ChangeNotifier {
  UserModel? _user;
  bool _isAuthenticated = false;
  bool _isLoading = false;
  String? _errorMessage;

  UserModel? get user => _user;
  bool get isAuthenticated => _isAuthenticated;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  AuthProvider() {
    checkSavedSession();
  }

  Future<void> checkSavedSession() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('auth_token');
    final userDataString = prefs.getString('user_data');

    if (token != null && userDataString != null) {
      try {
        final userData = jsonDecode(userDataString);
        _user = UserModel.fromJson(userData);
        _isAuthenticated = true;
        notifyListeners();

        // Fetch live updated profile & branch from database
        final meResult = await ApiService.getMe();
        if (meResult['success'] == true && meResult['user'] != null) {
          _user = UserModel.fromJson(meResult['user']);
          notifyListeners();
        }
      } catch (_) {
        _isAuthenticated = false;
        _user = null;
        notifyListeners();
      }
    } else {
      _isAuthenticated = false;
      _user = null;
      notifyListeners();
    }
  }

  Future<bool> login(String email, String password) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    // Authenticate strictly with Database backend API
    final result = await ApiService.login(email, password);

    _isLoading = false;
    if (result['success'] == true) {
      _user = UserModel.fromJson(result['user'] ?? {});
      _isAuthenticated = true;
      _errorMessage = null;
      notifyListeners();
      return true;
    } else {
      _isAuthenticated = false;
      _user = null;
      _errorMessage = result['message'] ?? 'Invalid email or password';
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    _isAuthenticated = false;
    _user = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('auth_token');
    await prefs.remove('user_data');
    notifyListeners();
  }
}
