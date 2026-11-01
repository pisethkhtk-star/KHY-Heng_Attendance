import 'dart:convert';
import 'dart:math' as math;
import 'package:flutter/foundation.dart';
import 'package:get/get.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../repositories/attendance_repository.dart';

/// Local face model stored in the Android persistent database (SharedPreferences)
class LocalFaceRecord {
  final String staffId;
  final String nameEn;
  final String nameKh;
  final String photoUrl;
  final List<double> descriptor;
  final String updatedAt;

  LocalFaceRecord({
    required this.staffId,
    required this.nameEn,
    required this.nameKh,
    required this.photoUrl,
    required this.descriptor,
    required this.updatedAt,
  });

  factory LocalFaceRecord.fromJson(Map<String, dynamic> json) {
    List<double> parsedDescriptor = [];
    final rawDesc = json['descriptor'] ?? json['faceDescriptor'];
    if (rawDesc is List) {
      parsedDescriptor = rawDesc.map((e) => (e as num).toDouble()).toList();
    } else if (rawDesc is String) {
      try {
        final decoded = jsonDecode(rawDesc);
        if (decoded is List) {
          parsedDescriptor = decoded.map((e) => (e as num).toDouble()).toList();
        }
      } catch (_) {}
    }

    return LocalFaceRecord(
      staffId: (json['staffId'] ?? '').toString().trim(),
      nameEn: (json['nameEn'] ?? '').toString(),
      nameKh: (json['nameKh'] ?? '').toString(),
      photoUrl: (json['photoUrl'] ?? '').toString(),
      descriptor: parsedDescriptor,
      updatedAt: (json['updatedAt'] ?? '').toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'staffId': staffId,
      'nameEn': nameEn,
      'nameKh': nameKh,
      'photoUrl': photoUrl,
      'descriptor': descriptor,
      'updatedAt': updatedAt,
    };
  }
}

/// Service that manages the Android local face database.
/// Face data is downloaded from the backend server, stored in Android persistent storage,
/// and automatically synced/replaced whenever the backend database changes.
class FaceDatabaseService extends GetxService {
  static FaceDatabaseService get to => Get.find<FaceDatabaseService>();

  static const String _keyVersion = 'android_local_face_db_version';
  static const String _keyRecords = 'android_local_face_db_records';

  final RxMap<String, LocalFaceRecord> _faces = <String, LocalFaceRecord>{}.obs;
  final RxString currentVersion = ''.obs;
  final RxBool isSyncing = false.obs;
  final Rx<DateTime?> lastSyncTime = Rx<DateTime?>(null);

  int get totalFaces => _faces.length;
  List<LocalFaceRecord> get allFaces => _faces.values.toList();

  /// Retrieve an employee face record by staffId from the Android local DB
  LocalFaceRecord? getFace(String staffId) {
    final cleanId = staffId.trim().toUpperCase();
    return _faces[cleanId] ?? _faces[staffId.trim()];
  }

  /// Check if employee has registered face data in the Android local DB
  bool hasFace(String staffId) {
    final cleanId = staffId.trim().toUpperCase();
    return _faces.containsKey(cleanId) || _faces.containsKey(staffId.trim());
  }

  /// Initialize service and load cached face records from Android local storage
  Future<FaceDatabaseService> init() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedVersion = prefs.getString(_keyVersion) ?? '';
      final savedRecordsRaw = prefs.getString(_keyRecords);

      currentVersion.value = savedVersion;

      if (savedRecordsRaw != null && savedRecordsRaw.isNotEmpty) {
        final decoded = jsonDecode(savedRecordsRaw);
        if (decoded is List) {
          final Map<String, LocalFaceRecord> loaded = {};
          for (final item in decoded) {
            if (item is Map) {
              final record = LocalFaceRecord.fromJson(Map<String, dynamic>.from(item));
              if (record.staffId.isNotEmpty && record.descriptor.isNotEmpty) {
                loaded[record.staffId.toUpperCase()] = record;
                loaded[record.staffId] = record;
              }
            }
          }
          _faces.assignAll(loaded);
          debugPrint(
              '[FaceDatabaseService] Loaded ${_faces.length} faces from Android local database (version: $savedVersion)');
        }
      }
    } catch (e) {
      debugPrint('[FaceDatabaseService] Error loading from Android local DB: $e');
    }
    return this;
  }

  /// Check server for face data updates and sync with Android local database.
  /// If database has changed (upToDate == false), downloads new face records and replaces old data.
  Future<bool> syncWithServer({bool force = false}) async {
    if (isSyncing.value) return false;
    isSyncing.value = true;

    try {
      final attendanceRepo = Get.find<IAttendanceRepository>();
      final clientVer = force ? null : currentVersion.value;
      
      final syncResult = await attendanceRepo.syncFaceData(clientVer);
      final bool upToDate = syncResult['upToDate'] == true;
      final String? serverVersion = syncResult['version']?.toString();
      final facesRaw = syncResult['faces'];

      lastSyncTime.value = DateTime.now();

      if (upToDate) {
        debugPrint(
            '[FaceDatabaseService] Face DB is already up-to-date with server (version: $currentVersion)');
        isSyncing.value = false;
        return false;
      }

      // New data available: Replace local storage with fresh records from database
      if (facesRaw is List) {
        final prefs = await SharedPreferences.getInstance();
        final Map<String, LocalFaceRecord> freshMap = {};
        final List<Map<String, dynamic>> recordsToStore = [];

        for (final item in facesRaw) {
          if (item is Map) {
            final record = LocalFaceRecord.fromJson(Map<String, dynamic>.from(item));
            if (record.staffId.isNotEmpty && record.descriptor.isNotEmpty) {
              freshMap[record.staffId.toUpperCase()] = record;
              freshMap[record.staffId] = record;
              recordsToStore.add(record.toJson());
            }
          }
        }

        // Store to Android persistent SharedPreferences
        await prefs.setString(_keyRecords, jsonEncode(recordsToStore));
        if (serverVersion != null && serverVersion.isNotEmpty) {
          await prefs.setString(_keyVersion, serverVersion);
          currentVersion.value = serverVersion;
        }

        _faces.assignAll(freshMap);
        debugPrint(
            '[FaceDatabaseService] Replaced Android local DB with ${freshMap.length} faces (version: $currentVersion)');
        isSyncing.value = false;
        return true;
      }
    } catch (e) {
      debugPrint('[FaceDatabaseService] Sync error: $e');
    } finally {
      isSyncing.value = false;
    }
    return false;
  }

  /// Calculate Euclidean Distance between two face embedding vectors
  static double calculateDistance(List<double> desc1, List<double> desc2) {
    if (desc1.length != desc2.length || desc1.isEmpty) return 1.0;
    double sum = 0.0;
    for (int i = 0; i < desc1.length; i++) {
      final diff = desc1[i] - desc2[i];
      sum += diff * diff;
    }
    return math.sqrt(sum);
  }

  /// Find the best matching employee from the Android local database.
  /// If [allowedStaffIds] is provided, only searches within authorized employees.
  LocalFaceRecord? findBestMatch(
    List<double> liveDescriptor, {
    double threshold = 0.55,
    List<String>? allowedStaffIds,
  }) {
    if (liveDescriptor.isEmpty || _faces.isEmpty) return null;

    final Set<String>? allowedSet = allowedStaffIds?.map((id) => id.trim().toUpperCase()).toSet();

    LocalFaceRecord? bestCandidate;
    double minDistance = double.infinity;

    // Use a set to avoid checking duplicates if staffId is stored in both upper and original case
    final Set<String> checked = {};

    for (final record in _faces.values) {
      final staffIdUpper = record.staffId.toUpperCase();
      if (checked.contains(staffIdUpper)) continue;
      checked.add(staffIdUpper);

      if (allowedSet != null && !allowedSet.contains(staffIdUpper)) {
        continue;
      }

      if (record.descriptor.isEmpty) continue;

      final dist = calculateDistance(liveDescriptor, record.descriptor);
      if (dist < minDistance) {
        minDistance = dist;
        bestCandidate = record;
      }
    }

    if (bestCandidate != null && minDistance <= threshold) {
      return bestCandidate;
    }

    return null;
  }

  /// Clear the local Android face database
  Future<void> clearDatabase() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keyVersion);
    await prefs.remove(_keyRecords);
    _faces.clear();
    currentVersion.value = '';
    debugPrint('[FaceDatabaseService] Cleared Android local face database');
  }
}
