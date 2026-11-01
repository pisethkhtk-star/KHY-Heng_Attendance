import 'dart:convert';
import 'package:flutter/foundation.dart' show debugPrint;
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mobile_app/core/constants/api_config.dart';
import 'base_api_client.dart';
import 'remote_config_service.dart';

class HttpApiClient implements BaseApiClient {
  String _baseUrl = '';

  @override
  String get baseUrl {
    if (_baseUrl.isNotEmpty) return _baseUrl;
    final remoteHost = RemoteConfigService().serverHost;
    if (remoteHost.isNotEmpty) {
      return ApiConfig.getBaseUrl(remoteHost);
    }
    return ApiConfig.baseUrl;
  }

  /// Update server host dynamically from Firebase Remote Config
  void updateServerHost(String newHost) {
    if (newHost.trim().isEmpty) return;
    final newUrl = ApiConfig.getBaseUrl(newHost);
    if (newUrl.isEmpty) return;
    
    _baseUrl = newUrl;
    SharedPreferences.getInstance().then((prefs) {
      prefs.setString('working_base_url', newUrl);
    });
    debugPrint('[HttpApiClient] Server URL updated from Firebase Remote Config: $newUrl');
  }

  @override
  Future<void> init() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      
      // 1. Prioritize Firebase Remote Config serverHost
      final remoteHost = RemoteConfigService().serverHost;
      if (remoteHost.isNotEmpty) {
        _baseUrl = ApiConfig.getBaseUrl(remoteHost);
      } else {
        // 2. Fallback to cached URL from previous session
        final savedUrl = prefs.getString('working_base_url');
        if (savedUrl != null && savedUrl.isNotEmpty) {
          _baseUrl = savedUrl;
        } else {
          // 3. Fallback to default
          _baseUrl = ApiConfig.baseUrl;
        }
      }

      if (_baseUrl.isNotEmpty) {
        await prefs.setString('working_base_url', _baseUrl);
      }
    } catch (e) {
      debugPrint('[HttpApiClient Init Warning]: $e');
    }
    debugPrint('[HttpApiClient] Initialized with baseUrl: $_baseUrl');
  }

  Uri _buildUri(String baseUrl, String path) {
    final cleanBase = baseUrl.endsWith('/') ? baseUrl.substring(0, baseUrl.length - 1) : baseUrl;
    final cleanPath = path.startsWith('/') ? path : '/$path';
    return Uri.parse('$cleanBase$cleanPath');
  }

  Future<Map<String, String>> _getHeaders(Map<String, String>? customHeaders) async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('auth_token');
    final Map<String, String> headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
    };
    if (customHeaders != null) {
      headers.addAll(customHeaders);
    }
    return headers;
  }

  /// Send direct HTTP request to the active base URL from Firebase Remote Config
  Future<http.Response?> _sendRequest(
    Future<http.Response> Function(String url, Map<String, String> headers) reqFn, {
    Map<String, String>? customHeaders,
  }) async {
    final activeBaseUrl = baseUrl;
    if (activeBaseUrl.isEmpty) {
      debugPrint('[HttpApiClient Error] No server host configured from Firebase Remote Config.');
      return null;
    }

    final headers = await _getHeaders(customHeaders);
    try {
      final res = await reqFn(activeBaseUrl, headers).timeout(const Duration(seconds: 12));
      return res;
    } catch (e) {
      debugPrint('[HttpApiClient Error] Request to $activeBaseUrl failed: $e');
      return null;
    }
  }

  @override
  Future<http.Response?> get(String path, {Map<String, String>? headers}) async {
    return await _sendRequest(
      (url, requestHeaders) => http.get(
        _buildUri(url, path),
        headers: requestHeaders,
      ),
      customHeaders: headers,
    );
  }

  @override
  Future<http.Response?> post(String path, {dynamic body, Map<String, String>? headers}) async {
    final encodedBody = body is String ? body : jsonEncode(body);
    return await _sendRequest(
      (url, requestHeaders) => http.post(
        _buildUri(url, path),
        headers: requestHeaders,
        body: encodedBody,
      ),
      customHeaders: headers,
    );
  }

  @override
  Future<http.Response?> put(String path, {dynamic body, Map<String, String>? headers}) async {
    final encodedBody = body is String ? body : jsonEncode(body);
    return await _sendRequest(
      (url, requestHeaders) => http.put(
        _buildUri(url, path),
        headers: requestHeaders,
        body: encodedBody,
      ),
      customHeaders: headers,
    );
  }

  @override
  Future<http.Response?> delete(String path, {Map<String, String>? headers}) async {
    return await _sendRequest(
      (url, requestHeaders) => http.delete(
        _buildUri(url, path),
        headers: requestHeaders,
      ),
      customHeaders: headers,
    );
  }
}
