class ApiConfig {
  /// The server IP or Domain address (e.g., '98.90.129.131' or 'api.example.com')
  static const String serverHost = '98.90.129.131';

  /// Set port (e.g. '8080' for direct Spring Boot, '' or '80' / '443' for standard web ports)
  static const String serverPort = '8080';

  /// Set to true if your server is configured with SSL/HTTPS
  static const bool useHttps = false;

  // Backward compatibility alias
  static const String serverIp = serverHost;

  static String get baseUrl {
    final scheme = useHttps ? 'https' : 'http';
    if (serverPort.isEmpty || (useHttps && serverPort == '443') || (!useHttps && serverPort == '80')) {
      return '$scheme://$serverHost/api';
    }
    return '$scheme://$serverHost:$serverPort/api';
  }
}
