class ApiConfig {
  /// Default fallback server IP or Domain address
  static const String defaultServerHost = '10.10.1.186';

  /// The server IP or Domain address (fallback)
  static const String serverHost = defaultServerHost;

  /// Set port (e.g. '8080' for direct Spring Boot, '' or '80' / '443' for standard web ports)
  static const String serverPort = '8080';

  /// Set to true if your server is configured with SSL/HTTPS
  static const bool useHttps = false;

  // Backward compatibility alias
  static const String serverIp = serverHost;

  /// Generate baseUrl dynamically for any given host
  static String getBaseUrl(String host) {
    final cleanHost = host.trim();
    final scheme = useHttps ? 'https' : 'http';
    if (serverPort.isEmpty || (useHttps && serverPort == '443') || (!useHttps && serverPort == '80')) {
      return '$scheme://$cleanHost/api';
    }
    return '$scheme://$cleanHost:$serverPort/api';
  }

  static String get baseUrl => getBaseUrl(serverHost);
}
