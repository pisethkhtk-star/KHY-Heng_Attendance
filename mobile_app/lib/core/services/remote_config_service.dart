import 'package:firebase_remote_config/firebase_remote_config.dart';
import 'package:flutter/foundation.dart';
import 'package:get/get.dart';
import '../constants/api_config.dart';
import 'base_api_client.dart';
import 'http_api_client.dart';
import '../../views/maintenance_screen.dart';

class RemoteConfigService {
  static final RemoteConfigService _instance = RemoteConfigService._internal();
  factory RemoteConfigService() => _instance;
  RemoteConfigService._internal();

  FirebaseRemoteConfig? _remoteConfig;

  FirebaseRemoteConfig? get instance {
    try {
      _remoteConfig ??= FirebaseRemoteConfig.instance;
      return _remoteConfig;
    } catch (e) {
      debugPrint('[RemoteConfig Warning] FirebaseRemoteConfig.instance: $e');
      return null;
    }
  }

  Future<void> init() async {
    final rc = instance;
    if (rc == null) return;

    try {
      // កំណត់ Setting សម្រាប់ Fetch ភ្លាមៗ
      await rc.setConfigSettings(RemoteConfigSettings(
        fetchTimeout: const Duration(seconds: 5),
        minimumFetchInterval: Duration.zero,
      ));

      // កំណត់ Default Values បម្រុងទុក (ករណីគ្មាន Internet ឬ Fetch មិនទាន់រួច)
      await rc.setDefaults({
        'server_host': ApiConfig.defaultServerHost,
        'is_maintenance_mode': false,
        'maintenance_message': 'ប្រព័ន្ធកំពុងដំណើរការកែលម្អ សូមព្យាយាមម្តងទៀតនៅពេលក្រោយ។',
        'min_app_version': '1.0.0',
        'enable_face_recognition': true,
      });

      // ទាញយកទិន្នន័យពី Firebase Server
      await rc.fetchAndActivate();
      debugPrint('[RemoteConfig] Fetched successfully! server_host: $serverHost');

      // Realtime listener (ចាប់ការកែប្រែភ្លាមៗពី Firebase Console)
      rc.onConfigUpdated.listen((event) async {
        try {
          await rc.activate();
          debugPrint('[RemoteConfig Realtime] Updated! server_host: $serverHost, isMaintenanceMode: $isMaintenanceMode');

          // Update HttpApiClient base URL dynamically if registered
          if (Get.isRegistered<BaseApiClient>()) {
            final client = Get.find<BaseApiClient>();
            if (client is HttpApiClient) {
              client.updateServerHost(serverHost);
            }
          }

          if (isMaintenanceMode) {
            Get.offAll(() => const MaintenanceScreen());
          }
        } catch (_) {}
      });
    } catch (e) {
      debugPrint('Error initializing Remote Config: $e');
    }
  }

  // --- Getters សម្រាប់យកតម្លៃតាមប្រភេទ ---
  /// IP Address ឬ Domain របស់ Server ដែល Push ពី Firebase Remote Config
  String get serverHost {
    try {
      final host = instance?.getString('server_host').trim() ?? '';
      return host.isNotEmpty ? host : ApiConfig.defaultServerHost;
    } catch (_) {
      return ApiConfig.defaultServerHost;
    }
  }

  bool get isMaintenanceMode {
    try {
      return instance?.getBool('is_maintenance_mode') ?? false;
    } catch (_) {
      return false;
    }
  }

  String get maintenanceMessage {
    try {
      return instance?.getString('maintenance_message') ?? 'ប្រព័ន្ធកំពុងដំណើរការកែលម្អ សូមព្យាយាមម្តងទៀតនៅពេលក្រោយ។';
    } catch (_) {
      return 'ប្រព័ន្ធកំពុងដំណើរការកែលម្អ សូមព្យាយាមម្តងទៀតនៅពេលក្រោយ។';
    }
  }

  String get minAppVersion {
    try {
      return instance?.getString('min_app_version') ?? '1.0.0';
    } catch (_) {
      return '1.0.0';
    }
  }

  bool get enableFaceRecognition {
    try {
      return instance?.getBool('enable_face_recognition') ?? true;
    } catch (_) {
      return true;
    }
  }

  // Generic getter សម្រាប់ key ផ្សេងៗ
  String getString(String key) {
    try {
      return instance?.getString(key) ?? '';
    } catch (_) {
      return '';
    }
  }

  bool getBool(String key) {
    try {
      return instance?.getBool(key) ?? false;
    } catch (_) {
      return false;
    }
  }

  int getInt(String key) {
    try {
      return instance?.getInt(key) ?? 0;
    } catch (_) {
      return 0;
    }
  }

  double getDouble(String key) {
    try {
      return instance?.getDouble(key) ?? 0.0;
    } catch (_) {
      return 0.0;
    }
  }
}
