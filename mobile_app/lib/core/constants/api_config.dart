class ApiConfig {
  /// The server IP address used by both the Dio client and Http API client
  static const String serverIp = '98.90.129.131';
  static const String serverPort = '8080'; // Set to '8080' (Spring Boot backend1) or empty '' for port 80

  static String get baseUrl {
    if (serverPort.isEmpty || serverPort == '80') {
      return 'http://$serverIp/api';
    }
    return 'http://$serverIp:$serverPort/api';
  }
}
