import 'package:firebase_remote_config/firebase_remote_config.dart';
import 'package:flutter/foundation.dart';
import 'package:get/get.dart';
import '../../views/maintenance_screen.dart';

class RemoteConfigService {
  static final RemoteConfigService _instance = RemoteConfigService._internal();
  factory RemoteConfigService() => _instance;
  RemoteConfigService._internal();

  final FirebaseRemoteConfig _remoteConfig = FirebaseRemoteConfig.instance;

  Future<void> init() async {
    try {
      // កំណត់ Setting សម្រាប់ Fetch
      await _remoteConfig.setConfigSettings(RemoteConfigSettings(
        fetchTimeout: const Duration(seconds: 10),
        // ពេល Test ដាក់ Duration.zero ដើម្បី Fetch បានភ្លាមៗ (ពេល Production គួរដាក់ ១ ម៉ោងឡើង)
        minimumFetchInterval: kDebugMode ? Duration.zero : const Duration(hours: 1),
      ));

      // កំណត់ Default Values បម្រុងទុក (ករណីគ្មាន Internet ឬ Fetch មិនទាន់រួច)
      await _remoteConfig.setDefaults(const {
        'is_maintenance_mode': false,
        'maintenance_message': 'ប្រព័ន្ធកំពុងដំណើរការកែលម្អ សូមព្យាយាមម្តងទៀតនៅពេលក្រោយ។',
        'min_app_version': '1.0.0',
        'enable_face_recognition': true,
      });

      // ទាញយកទិន្នន័យពី Firebase Server
      await _remoteConfig.fetchAndActivate();

      // Realtime listener (ចាប់ការកែប្រែភ្លាមៗពី Firebase Console)
      _remoteConfig.onConfigUpdated.listen((event) async {
        await _remoteConfig.activate();
        debugPrint('Remote Config updated in real-time! isMaintenanceMode: $isMaintenanceMode');
        if (isMaintenanceMode) {
          Get.offAll(() => const MaintenanceScreen());
        }
      });
    } catch (e) {
      debugPrint('Error initializing Remote Config: $e');
    }
  }

  // --- Getters សម្រាប់យកតម្លៃតាមប្រភេទ ---
  bool get isMaintenanceMode => _remoteConfig.getBool('is_maintenance_mode');
  String get maintenanceMessage => _remoteConfig.getString('maintenance_message');
  String get minAppVersion => _remoteConfig.getString('min_app_version');
  bool get enableFaceRecognition => _remoteConfig.getBool('enable_face_recognition');

  // Generic getter សម្រាប់ key ផ្សេងៗ
  String getString(String key) => _remoteConfig.getString(key);
  bool getBool(String key) => _remoteConfig.getBool(key);
  int getInt(String key) => _remoteConfig.getInt(key);
  double getDouble(String key) => _remoteConfig.getDouble(key);
}
