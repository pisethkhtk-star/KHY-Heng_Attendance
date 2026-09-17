import 'dart:convert';
import 'package:flutter/foundation.dart' show kIsWeb, defaultTargetPlatform, TargetPlatform, debugPrint;
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mobile_app/core/constants/api_config.dart';
import 'base_api_client.dart';
import 'remote_config_service.dart';

class HttpApiClient implements BaseApiClient {
  String _baseUrl = '';

  @override
  String get baseUrl => _baseUrl;

  String get _currentConfiguredHost {
    final remoteHost = RemoteConfigService().serverHost;
    if (remoteHost.isNotEmpty) return remoteHost;
    return ApiConfig.defaultServerHost;
  }

  void updateServerHost(String newHost) {
    if (newHost.trim().isEmpty) return;
    final newUrl = ApiConfig.getBaseUrl(newHost);
    _baseUrl = newUrl;
    SharedPreferences.getInstance().then((prefs) {
      prefs.setString('working_base_url', newUrl);
    });
    debugPrint('[HttpApiClient] Dynamic server host updated to: $newUrl');
  }

  // Candidate API base URLs for dynamic environment resolution
  List<String> get _candidateBaseUrls {
    final String currentHost = _currentConfiguredHost;
    final String primaryUrl = ApiConfig.getBaseUrl(currentHost);
    final String fallbackUrl = ApiConfig.baseUrl;

    if (kIsWeb) {
      final String webHost = Uri.base.host.isNotEmpty ? Uri.base.host : 'localhost';
      return [
        primaryUrl,
        if (primaryUrl != fallbackUrl) fallbackUrl,
        'http://$currentHost:8080/api',
        'http://$currentHost/api',
        'http://$webHost:8080/api',
        'http://localhost:8080/api',
      ];
    }
    try {
      if (defaultTargetPlatform == TargetPlatform.android) {
        return [
          primaryUrl,                       // Configured Server from Firebase (e.g. http://192.168.88.120:8080/api)
          if (primaryUrl != fallbackUrl) fallbackUrl,
          'http://$currentHost:8080/api', // Direct backend (Port 8080)
          'http://$currentHost/api',      // Hosted Backend (Port 80)
          'http://10.0.2.2:8080/api',        // Android Emulator -> backend
          'http://127.0.0.1:8080/api',
        ];
      }
    } catch (_) {}
    return [
      primaryUrl,
      if (primaryUrl != fallbackUrl) fallbackUrl,
      'http://$currentHost:8080/api',
      'http://$currentHost/api',
      'http://10.0.2.2:8080/api',
      'http://localhost:8080/api',
    ];
  }

  @override
  Future<void> init() async {
    final String currentHost = _currentConfiguredHost;
    final String primaryUrl = ApiConfig.getBaseUrl(currentHost);
    _baseUrl = primaryUrl;

    try {
      final prefs = await SharedPreferences.getInstance();
      final savedUrl = prefs.getString('working_base_url');
      if (savedUrl != null && savedUrl.isNotEmpty) {
        // If savedUrl matches current server host from Firebase, use it
        if (savedUrl.contains(currentHost)) {
          _baseUrl = savedUrl;
        } else {
          // Outdated cached IP -> reset to newest Firebase server host
          _baseUrl = primaryUrl;
        }
      }
      await prefs.setString('working_base_url', _baseUrl);
    } catch (_) {}
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

  /// Helper to send a HTTP request with automatic URL failover across candidate hosts
  Future<http.Response?> _requestWithFallback(
    Future<http.Response> Function(String url, Map<String, String> headers) reqFn, {
    Map<String, String>? customHeaders,
  }) async {
    final headers = await _getHeaders(customHeaders);

    // 1. Try last known working URL first
    if (_baseUrl.isNotEmpty) {
      try {
        final res = await reqFn(_baseUrl, headers).timeout(const Duration(seconds: 4));
        if (res.statusCode >= 200 && res.statusCode < 500) {
          return res;
        }
      } catch (_) {
        // Last known working failed, fallback to candidate list
      }
    }

    // 2. Loop through all candidates to find a working one
    for (final candidate in _candidateBaseUrls) {
      if (candidate == _baseUrl) continue; // Already tried
      try {
        final res = await reqFn(candidate, headers).timeout(const Duration(seconds: 4));
        if (res.statusCode >= 200 && res.statusCode < 500) {
          _baseUrl = candidate; // Remember working host
          try {
            final prefs = await SharedPreferences.getInstance();
            await prefs.setString('working_base_url', candidate);
          } catch (_) {}
          return res;
        }
      } catch (_) {
        // Try next candidate host
      }
    }
    return null;
  }

  @override
  Future<http.Response?> get(String path, {Map<String, String>? headers}) async {
    return await _requestWithFallback(
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
    return await _requestWithFallback(
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
    return await _requestWithFallback(
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
    return await _requestWithFallback(
      (url, requestHeaders) => http.delete(
        _buildUri(url, path),
        headers: requestHeaders,
      ),
      customHeaders: headers,
    );
  }
}
