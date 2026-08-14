import 'dart:convert';
import '../core/services/base_api_client.dart';
import '../models/user_model.dart';
import 'package:shared_preferences/shared_preferences.dart';

class AuthResponse {
  final bool success;
  final UserModel? user;
  final String? token;
  final String? message;

  AuthResponse({
    required this.success,
    this.user,
    this.token,
    this.message,
  });
}

abstract class IAuthRepository {
  Future<AuthResponse> getMe();
  Future<AuthResponse> login(String email, String password);
  Future<AuthResponse> loginWithQRCode(String qrToken);
  Future<List<dynamic>> fetchKioskSettings();
}

class AuthRepository implements IAuthRepository {
  final BaseApiClient _apiClient;

  AuthRepository(this._apiClient);

  @override
  Future<AuthResponse> getMe() async {
    final response = await _apiClient.get('/auth/me');
    if (response != null && response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('user_data', jsonEncode(data));
      return AuthResponse(
        success: true,
        user: UserModel.fromJson(data),
      );
    }
    return AuthResponse(success: false);
  }

  @override
  Future<AuthResponse> login(String email, String password) async {
    final body = {'email': email, 'password': password};
    final response = await _apiClient.post(
      '/auth/login',
      body: body,
      headers: {'Content-Type': 'application/json'},
    );

    if (response != null) {
      final data = jsonDecode(response.body);
      if (response.statusCode == 200 && data['token'] != null) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('auth_token', data['token']);
        await prefs.setString('user_data', jsonEncode(data['user'] ?? {}));
        return AuthResponse(
          success: true,
          user: UserModel.fromJson(data['user'] ?? {}),
          token: data['token'],
        );
      } else {
        return AuthResponse(
          success: false,
          message: data['message'] ?? 'Invalid email or password',
        );
      }
    }
    return AuthResponse(
      success: false,
      message: 'Unable to connect to database server. Please verify backend is running at port 5050.',
    );
  }

  @override
  Future<AuthResponse> loginWithQRCode(String qrToken) async {
    final body = {'qrToken': qrToken};
    final response = await _apiClient.post(
      '/auth/login-qr',
      body: body,
      headers: {'Content-Type': 'application/json'},
    );

    if (response != null) {
      final data = jsonDecode(response.body);
      if (response.statusCode == 200 && data['token'] != null) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('auth_token', data['token']);
        await prefs.setString('user_data', jsonEncode(data['user'] ?? {}));
        return AuthResponse(
          success: true,
          user: UserModel.fromJson(data['user'] ?? {}),
          token: data['token'],
        );
      } else {
        return AuthResponse(
          success: false,
          message: data['message'] ?? 'Invalid or expired QR code',
        );
      }
    }
    return AuthResponse(
      success: false,
      message: 'Unable to connect to database server.',
    );
  }

  @override
  Future<List<dynamic>> fetchKioskSettings() async {
    final response = await _apiClient.get('/kiosk-settings');
    if (response != null && response.statusCode == 200) {
      final data = jsonDecode(response.body);
      if (data is List) return data;
      if (data['data'] != null && data['data'] is List) return data['data'];
    }
    return [];
  }
}
