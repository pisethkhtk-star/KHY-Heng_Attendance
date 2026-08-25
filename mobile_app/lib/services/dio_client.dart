import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:mobile_app/core/constants/api_config.dart';

class DioClient {
  late final Dio _dio;

  // Base URL for Spring Boot backend
  // Android physical device / local network uses 192.168.88.139
  // Android Emulator uses 10.0.2.2
  static String get baseUrl => ApiConfig.baseUrl;
 
  DioClient() {
    _dio = Dio(
      BaseOptions(
        baseUrl: baseUrl,
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 10),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    // Add interceptors for logging and auth token injection
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          if (kDebugMode) {
            print('🚀 [Dio Request] ${options.method} -> ${options.uri}');
          }
          return handler.next(options);
        },
        onResponse: (response, handler) {
          if (kDebugMode) {
            print('✅ [Dio Response] ${response.statusCode} <- ${response.requestOptions.uri}');
          }
          return handler.next(response);
        },
        onError: (DioException e, handler) {
          if (kDebugMode) {
            print('❌ [Dio Error] ${e.message} from ${e.requestOptions.uri}');
          }
          return handler.next(e);
        },
      ),
    );
  }

  Dio get client => _dio;

  // Convenience GET request
  Future<Response> get(String path, {Map<String, dynamic>? queryParameters}) async {
    return await _dio.get(path, queryParameters: queryParameters);
  }

  // Convenience POST request
  Future<Response> post(String path, {dynamic data}) async {
    return await _dio.post(path, data: data);
  }

  // Convenience PUT request
  Future<Response> put(String path, {dynamic data}) async {
    return await _dio.put(path, data: data);
  }

  // Convenience DELETE request
  Future<Response> delete(String path) async {
    return await _dio.delete(path);
  }

  // Health check endpoint for Spring Boot backend
  Future<bool> checkBackendHealth() async {
    try {
      final response = await get('/health');
      return response.statusCode == 200 && response.data['status'] == 'UP';
    } catch (e) {
      if (kDebugMode) {
        print('Backend Health Check failed: $e');
      }
      return false;
    }
  }
}
