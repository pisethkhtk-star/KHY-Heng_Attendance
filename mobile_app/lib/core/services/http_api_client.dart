import 'dart:convert';
import 'package:flutter/foundation.dart' show kIsWeb, defaultTargetPlatform, TargetPlatform;
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'base_api_client.dart';

class HttpApiClient implements BaseApiClient {
  String _baseUrl = '';

  @override
  String get baseUrl => _baseUrl;

  // Candidate API base URLs for dynamic environment resolution
  List<String> get _candidateBaseUrls {
    const String currentWifiIp = '192.168.88.225'; // Current Wi-Fi IPv4 Address
    if (kIsWeb) {
      final String webHost = Uri.base.host.isNotEmpty ? Uri.base.host : 'localhost';
      return [
        'http://$webHost:5050/api',
        'http://$webHost:8080/api',
        'http://localhost:5050/api',
        'http://127.0.0.1:5050/api',
        'http://localhost:8080/api',
        'http://127.0.0.1:8080/api',
        'http://$currentWifiIp:5050/api',
        'http://$currentWifiIp:8080/api',
      ];
    }
    try {
      if (defaultTargetPlatform == TargetPlatform.android) {
        return [
          'http://10.0.2.2:5050/api',        // Android Emulator -> Node backend (Port 5050)
          'http://10.0.2.2:8080/api',        // Android Emulator -> Spring/Node backend (Port 8080)
          'http://$currentWifiIp:5050/api', // Physical Device on LAN -> Node backend (Port 5050)
          'http://$currentWifiIp:8080/api', // Physical Device on LAN -> Spring/Node backend (Port 8080)
          'http://127.0.0.1:5050/api',
          'http://127.0.0.1:8080/api',
        ];
      }
    } catch (_) {}
    return [
      'http://10.0.2.2:5050/api',
      'http://10.0.2.2:8080/api',
      'http://$currentWifiIp:5050/api',
      'http://$currentWifiIp:8080/api',
      'http://127.0.0.1:5050/api',
      'http://127.0.0.1:8080/api',
      'http://localhost:5050/api',
      'http://localhost:8080/api',
    ];
  }

  @override
  Future<void> init() async {
    _baseUrl = _candidateBaseUrls.first;
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedUrl = prefs.getString('working_base_url');
      if (savedUrl != null && savedUrl.isNotEmpty) {
        _baseUrl = savedUrl;
      }
    } catch (_) {}
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
        final res = await reqFn(_baseUrl, headers).timeout(const Duration(seconds: 3));
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
        final res = await reqFn(candidate, headers).timeout(const Duration(seconds: 3));
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
        Uri.parse('$url$path'),
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
        Uri.parse('$url$path'),
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
        Uri.parse('$url$path'),
        headers: requestHeaders,
      ),
      customHeaders: headers,
    );
  }
}
