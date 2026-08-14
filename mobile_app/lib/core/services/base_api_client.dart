import 'package:http/http.dart' as http;

abstract class BaseApiClient {
  String get baseUrl;
  Future<void> init();
  Future<http.Response?> get(String path, {Map<String, String>? headers});
  Future<http.Response?> post(String path, {dynamic body, Map<String, String>? headers});
  Future<http.Response?> delete(String path, {Map<String, String>? headers});
}
