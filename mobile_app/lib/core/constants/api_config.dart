class ApiConfig {
  /// Default server host (used only as fallback if Firebase Remote Config is not yet loaded)
  static const String defaultServerHost = '';

  /// Default port if host does not specify one
  static const String serverPort = '8080';

  /// Set to true if server uses HTTPS
  static const bool useHttps = false;

  /// Generate baseUrl dynamically from Firebase Remote Config host
  static String getBaseUrl(String host) {
    var clean = host.trim();
    if (clean.isEmpty) {
      return '';
    }

    // Remove any trailing slashes
    clean = clean.replaceAll(RegExp(r'/+$'), '');

    // 1. If host already starts with http:// or https://
    if (clean.startsWith('http://') || clean.startsWith('https://')) {
      if (clean.endsWith('/api')) {
        return clean;
      }
      return '$clean/api';
    }

    // 2. Host does not specify scheme
    final scheme = useHttps ? 'https' : 'http';

    
    if (clean.contains(':')) {
      return '$scheme://$clean/api';
    }

  
    if (serverPort.isNotEmpty && serverPort != '80' && serverPort != '443') {
      return '$scheme://$clean:$serverPort/api';
    }

    return '$scheme://$clean/api';
  }

  static String get baseUrl => getBaseUrl(defaultServerHost);
}
