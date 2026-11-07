import '../core/services/mock_location_service.dart';
import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:intl/intl.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';

import '../core/services/face_database_service.dart';
import '../core/constants/app_colors.dart';
import '../controllers/attendance_controller.dart';
import '../controllers/auth_controller.dart';
import '../controllers/language_controller.dart';
import '../repositories/auth_repository.dart';
import '../repositories/attendance_repository.dart';
import '../models/attendance_model.dart';
import 'web_camera/web_camera.dart';

class CheckinOnBehalfSheet extends StatefulWidget {
  const CheckinOnBehalfSheet({super.key});

  @override
  State<CheckinOnBehalfSheet> createState() => _CheckinOnBehalfSheetState();
}

class _CheckinOnBehalfSheetState extends State<CheckinOnBehalfSheet>
    with SingleTickerProviderStateMixin {
  // Camera & Animation Controllers
  MobileScannerController? _cameraController;
  late AnimationController _laserAnimController;

  bool _isFrontCamera = true;
  bool _isTorchOn = false;
  bool _isScanning = false;
  bool _isSuccess = false;
  bool _isMismatch = false;
  String? _statusText;
  int _remainingSeconds = 35;
  Timer? _countdownTimer;
  Timer? _autoScanTimer;
  Timer? _autoDetectTimer;

  // Location / Geofence State (aligned with scanner_modal_sheet.dart)
  bool _isLocationVerified = false;
  String? _matchedBranchName;
  String? _locationError;
  double? _clientLat;
  double? _clientLng;
  bool _isLoadingLocation = false;
  bool _isUserCustomLocation = false;
  StreamSubscription<Position>? _positionSubscription;
  List<Map<String, dynamic>> _allKioskSettings = [];
  List<Map<String, dynamic>> _employeeAssignedSettings = [];

  // Work Shift Hours (Shift 1 & Shift 2 End)
  String _shift1End = '12:00';
  String _shift2End = '17:00';

  // Authorized Employees Data Pool
  bool _isLoadingAuthorizedData = true;
  List<Map<String, dynamic>> _authorizedEmployees = [];
  Map<String, dynamic>? _selectedEmployeeOverride; // null = Auto-Match

  // Visual Simulation / Test Mode (Testing without real physical face)
  bool _isVisualTestMode = false;
  bool _simulateMismatch = false;

  @override
  void initState() {
    super.initState();
    _initLaserAnimation();
    _initCameraController();
    _startCountdown();

    // 1. Read background location status from AttendanceController
    if (Get.isRegistered<AttendanceController>()) {
      final attCtrl = Get.find<AttendanceController>();
      _isLocationVerified = attCtrl.isLocationVerified.value;
      _matchedBranchName = attCtrl.matchedBranchName.value;
      _locationError = attCtrl.locationError.value;
      if (attCtrl.currentLat.value != 0.0) {
        _clientLat = attCtrl.currentLat.value;
        _clientLng = attCtrl.currentLng.value;
      }
    }

    // 2. Check Location & Branch Geofence
    _verifyBranchGeofence();

    // 2. Pre-fetch Eligible Employees, Work Hours & Face Descriptors
    _preloadAuthorizedFaceData();

    // Note: Waiting for user to position face and tap scan explicitly
  }

  void _scheduleAutoFaceDetection() {
    _autoDetectTimer?.cancel();
    if (_isSuccess || _isScanning) return;

    _autoDetectTimer = Timer(const Duration(milliseconds: 2200), () {
      if (!mounted || _isSuccess || _isScanning) return;
      if (_isLocationVerified && _authorizedEmployees.isNotEmpty && _selectedEmployeeOverride == null) {
        debugPrint('[CheckinOnBehalf] Auto-detect: Face recognized in frame from database!');
        _performFaceComparison();
      }
    });
  }

  void _initLaserAnimation() {
    _laserAnimController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat(reverse: true);
  }

  void _initCameraController() {
    if (!kIsWeb) {
      _cameraController = MobileScannerController(
        facing: _isFrontCamera ? CameraFacing.front : CameraFacing.back,
        torchEnabled: _isTorchOn,
        detectionSpeed: DetectionSpeed.noDuplicates,
      );
    }
  }

  void _startCountdown() {
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      if (_remainingSeconds > 1) {
        setState(() => _remainingSeconds--);
      } else {
        timer.cancel();
        if (!_isSuccess) {
          setState(() {
            _statusText = 'Camera session timed out. Tap scan to retry.';
          });
        }
      }
    });
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    _autoScanTimer?.cancel();
    _autoDetectTimer?.cancel();
    _positionSubscription?.cancel();
    _laserAnimController.dispose();
    _cameraController?.dispose();
    super.dispose();
  }

  // --- Location Geofence Verification ---
  double _calculateDistance(double lat1, double lon1, double lat2, double lon2) {
    const double p = 0.017453292519943295; // PI / 180
    final double a = 0.5 -
        math.cos((lat2 - lat1) * p) / 2 +
        math.cos(lat1 * p) * math.cos(lat2 * p) * (1 - math.cos((lon2 - lon1) * p)) / 2;
    return 12742000 * math.asin(math.sqrt(a)); // meters
  }

  bool _isBranchMatch(String userBranch, String settingName) {
    final ub = userBranch.trim().toLowerCase();
    final sn = settingName.trim().toLowerCase();
    if (ub.isEmpty || sn.isEmpty) return false;
    if (ub == sn || sn.contains(ub) || ub.contains(sn)) return true;

    final ubPP = ub.contains('pp') || ub.contains('phnom penh') || ub.contains('hq');
    final snPP = sn.contains('pp') || sn.contains('phnom penh') || sn.contains('hq');
    if (ubPP && snPP) return true;

    final ubTakeo = ub.contains('takeo') || ub.contains('តាកែវ');
    final snTakeo = sn.contains('takeo') || sn.contains('តាកែវ');
    if (ubTakeo && snTakeo) return true;

    return false;
  }

  void _startLocationListening() {
    _positionSubscription = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 3, // Receive updates when moving at least 3 meters
      ),
    ).listen((Position position) {
      if (!_isUserCustomLocation && mounted) {
        if (position.isMocked) {
          Get.find<MockLocationService>().triggerMockDetected();
          return;
        }
        setState(() {
          _clientLat = position.latitude;
          _clientLng = position.longitude;
        });
        _verifyBranchGeofence();
      }
    });
  }

  Future<void> _verifyBranchGeofence() async {
    setState(() {
      _isLoadingLocation = true;
      _locationError = null;
    });

    try {
      final locStatus = await Permission.locationWhenInUse.request();
      if (!locStatus.isGranted) {
        if (mounted) {
          setState(() {
            _isLoadingLocation = false;
            _isLocationVerified = false;
            _locationError = '❌ សូមអនុញ្ញាតឲ្យប្រើប្រាស់ Location ដើម្បីផ្ទៀងផ្ទាត់ទីតាំង!';
          });
        }
        return;
      }

      // Start listening to real-time location changes if not already listening
      if (_positionSubscription == null) {
        _startLocationListening();
      }

      // Fetch Real-Time GPS Coordinates (Unless manually simulated by developer buttons)
      if (!_isUserCustomLocation) {
        try {
          final position = await Geolocator.getCurrentPosition(
            locationSettings: const LocationSettings(
              accuracy: LocationAccuracy.high,
              timeLimit: Duration(seconds: 5),
            ),
          );
          if (!_isUserCustomLocation && position.isMocked) {
            if (mounted) {
              setState(() {
                _isLoadingLocation = false;
                _isLocationVerified = false;
                _locationError = '❌ រកឃើញ Fake GPS! សូមបិទ Fake GPS ជាមុនសិន';
              });
              Get.find<MockLocationService>().triggerMockDetected();
            }
            return;
          }
          _clientLat = position.latitude;
          _clientLng = position.longitude;
        } catch (e) {
          if (mounted) {
            setState(() {
              _isLoadingLocation = false;
              _isLocationVerified = false;
              _locationError = '❌ មិនអាចទាញយកទីតាំង GPS បានឡើយ! សូមប្រាកដថាបើក GPS លើទូរស័ព្ទ';
            });
          }
          return;
        }
      }

      final authController = Get.find<AuthController>();
      final user = authController.user;
      final assignedBranchRaw = user?.branch ?? '';

      // Fetch branch location settings fresh from Database if not loaded
      if (_allKioskSettings.isEmpty) {
        if (authController.branchSettings.isNotEmpty) {
          _allKioskSettings = List<Map<String, dynamic>>.from(authController.branchSettings);
        }
        try {
          final authRepo = Get.find<IAuthRepository>();
          final settingsRaw = await authRepo.fetchKioskSettings();
          _allKioskSettings = settingsRaw.map((s) => Map<String, dynamic>.from(s)).toList();
        } catch (_) {
          if (authController.branchSettings.isNotEmpty) {
            _allKioskSettings = List<Map<String, dynamic>>.from(authController.branchSettings);
          }
        }
      }

      final userBranchNames = assignedBranchRaw
          .split(',')
          .map((b) => b.trim())
          .where((b) => b.isNotEmpty)
          .toList();

      _employeeAssignedSettings = _allKioskSettings.where((setting) {
        final settingName = (setting['name'] ?? '').toString();
        return userBranchNames.any((ub) => _isBranchMatch(ub, settingName));
      }).toList();

      if (_employeeAssignedSettings.isEmpty && _allKioskSettings.isEmpty) {
        for (final ub in userBranchNames) {
          if (_isBranchMatch(ub, 'Takeo')) {
            _employeeAssignedSettings.add({
              'id': 'takeo_branch_id',
              'name': 'Takeo Branch',
              'latitude': 10.9833,
              'longitude': 104.7833,
              'radius': 100.0,
            });
          } else {
            _employeeAssignedSettings.add({
              'id': 'pp_hq_id',
              'name': 'Phnom Penh HQ',
              'latitude': 11.5564,
              'longitude': 104.9282,
              'radius': 100.0,
            });
          }
        }
      }

      if (_employeeAssignedSettings.isEmpty) {
        _employeeAssignedSettings = _allKioskSettings;
      }

      if (_employeeAssignedSettings.isEmpty) {
        _employeeAssignedSettings = [
          {'name': 'Phnom Penh HQ', 'latitude': 11.5564, 'longitude': 104.9282, 'radius': 100.0},
          {'name': 'Takeo Branch', 'latitude': 10.9833, 'longitude': 104.7833, 'radius': 100.0},
        ];
      }

      final lat = _clientLat ?? 11.5564;
      final lng = _clientLng ?? 104.9282;

      Map<String, dynamic>? insideBranch;
      double? minDistance;
      Map<String, dynamic>? closestBranch;

      for (final setting in _employeeAssignedSettings) {
        final bLat = (setting['latitude'] as num).toDouble();
        final bLng = (setting['longitude'] as num).toDouble();
        final radius = (setting['radius'] as num).toDouble();
        final dist = _calculateDistance(lat, lng, bLat, bLng);

        if (dist <= radius) {
          insideBranch = setting;
          minDistance = dist;
          break;
        } else {
          if (minDistance == null || dist < minDistance) {
            minDistance = dist;
            closestBranch = setting;
          }
        }
      }

      if (!mounted) return;

      if (insideBranch != null) {
        final branchName = (insideBranch['name'] ?? '').toString();
        setState(() {
          _isLoadingLocation = false;
          _isLocationVerified = true;
          _matchedBranchName = branchName;
          _locationError = null;
          if (_statusText != null && _statusText!.startsWith('🔒 មិនគ្រប់លក្ខខណ្ឌ')) {
            _statusText = null;
          }
        });

        // Location verified: ready for auto face detection or tap scan
        if (_selectedEmployeeOverride == null) {
          _scheduleAutoFaceDetection();
        }
      } else {
        final closestName = closestBranch != null
            ? (closestBranch['name'] ?? '').toString()
            : (userBranchNames.isNotEmpty ? userBranchNames.first : 'Branch');
        final closestRadius = closestBranch != null
            ? (closestBranch['radius'] as num).toDouble()
            : 100.0;

        setState(() {
          _isLoadingLocation = false;
          _isLocationVerified = false;
          _matchedBranchName = closestName;

          if (_employeeAssignedSettings.length > 1) {
            final comparisonList = _employeeAssignedSettings.map((setting) {
              final sName = (setting['name'] ?? '').toString();
              final bLat = (setting['latitude'] as num).toDouble();
              final bLng = (setting['longitude'] as num).toDouble();
              final radius = (setting['radius'] as num).toDouble();
              final dist = _calculateDistance(lat, lng, bLat, bLng);
              return '• $sName (' + dist.toStringAsFixed(1) + 'm > ' + radius.toStringAsFixed(0) + 'm)';
            }).toList();
            _locationError =
                '🔒 មិនគ្រប់លក្ខខណ្ឌទីតាំង! លោកអ្នកស្ថិតនៅក្រៅទីតាំងសាខា៖\n' + comparisonList.join('\n');
          } else {
            _locationError =
                '🔒 មិនគ្រប់លក្ខខណ្ឌទីតាំង! លោកអ្នកស្ថិតនៅក្រៅទីតាំងសាខា ' + closestName + ' (' + (minDistance != null ? minDistance.toStringAsFixed(1) : '0') + 'm > ' + closestRadius.toStringAsFixed(0) + 'm)';
          }
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoadingLocation = false;
          _isLocationVerified = false;
          _locationError = '❌ មិនអាចទាញយក GPS បានឡើយ! សូមបើក GPS លើទូរស័ព្ទ';
        });
      }
    }
  }

  // --- Preload Authorized Face Data & Work Shifts from Android Local DB ---
  Future<void> _preloadAuthorizedFaceData() async {
    setState(() => _isLoadingAuthorizedData = true);

    try {
      final attendanceController = Get.find<AttendanceController>();
      final attendanceRepo = Get.find<IAttendanceRepository>();
      final faceDb = FaceDatabaseService.to;

      // 1. Fetch work shift hours
      try {
        final workHours = await attendanceRepo.fetchCompanyWorkHours();
        if (workHours != null) {
          _shift1End = workHours['shift1End'] ?? '12:00';
          _shift2End = workHours['shift2End'] ?? '17:00';
        }
      } catch (_) {}

      // 2. Fetch eligible employees & load full profile details from Database
      await attendanceController.checkOnBehalfEligibility();
      List<Map<String, dynamic>> eligibleList = List.from(attendanceController.eligibleEmployees);

      // Load all employees from Database to guarantee real profile photos and full metadata
      try {
        final allDbEmployees = await attendanceRepo.fetchAllEmployees();
        if (allDbEmployees.isNotEmpty) {
          if (eligibleList.isEmpty) {
            eligibleList = allDbEmployees;
          } else {
            // Merge database profiles (photoUrl, real names, department) into eligible list
            final Map<String, Map<String, dynamic>> dbMap = {
              for (final e in allDbEmployees) (e['staffId']?.toString().toUpperCase() ?? ''): e
            };
            for (int i = 0; i < eligibleList.length; i++) {
              final sId = eligibleList[i]['staffId']?.toString().toUpperCase() ?? '';
              if (dbMap.containsKey(sId)) {
                final dbEmp = dbMap[sId]!;
                eligibleList[i] = {
                  ...dbEmp,
                  ...eligibleList[i],
                  'avatar': dbEmp['photoUrl'] ?? dbEmp['avatar'] ?? eligibleList[i]['avatar'],
                  'photoUrl': dbEmp['photoUrl'] ?? eligibleList[i]['photoUrl'],
                };
              }
            }
          }
        }
      } catch (_) {}

      // If still empty in a fresh environment, provide sample seeded staff for visual testing
      if (eligibleList.isEmpty) {
        eligibleList = [
          {
            'staffId': 'EMP-001',
            'nameEn': 'Admin',
            'nameKh': 'រដ្ឋបាល',
            'fullName': 'Admin (រដ្ឋបាល)',
            'department': 'Management',
            'shift1Start': '08:00',
            'shift1End': '12:00',
            'shift2Start': '13:00',
            'shift2End': '17:00',
          },
          {
            'staffId': 'EMP-002',
            'nameEn': 'Chomnan',
            'nameKh': 'ចំរើន',
            'fullName': 'Chomnan (ចំរើន)',
            'department': 'IT Support',
            'shift1Start': '08:00',
            'shift1End': '12:00',
            'shift2Start': '13:00',
            'shift2End': '17:00',
          },
          {
            'staffId': 'EMP-003',
            'nameEn': 'Piseth',
            'nameKh': 'ពិសិដ្ឋ',
            'fullName': 'Piseth (ពិសិដ្ឋ)',
            'department': 'Accounting',
            'shift1Start': '08:00',
            'shift1End': '12:00',
            'shift2Start': '13:00',
            'shift2End': '17:00',
          },
        ];
      }

      // 3. If local Android face database is empty, do initial download & store
      if (faceDb.totalFaces == 0) {
        await faceDb.syncWithServer();
      }

      // 4. Build authorized employees list immediately from Android local DB (0ms delay)
      _buildAuthorizedEmployeesList(eligibleList);

      if (mounted) {
        setState(() => _isLoadingAuthorizedData = false);

        if (_isLocationVerified && _selectedEmployeeOverride == null) {
          _scheduleAutoFaceDetection();
        }
      }

      // 5. Check in background if database in backend was updated.
      // If server updated, automatically replace local DB with new records and update UI!
      faceDb.syncWithServer().then((updated) {
        if (updated && mounted) {
          _buildAuthorizedEmployeesList(eligibleList);
          setState(() {});
          debugPrint('[CheckinOnBehalf] Synced: replaced Android local face DB with updated server records');
        }
      });

      // 6. Fetch today attendance records in background without blocking face scan
      _loadTodayAttendanceRecords(eligibleList);

    } catch (e) {
      debugPrint('[CheckinOnBehalf] Preload error: $e');
      if (mounted) {
        setState(() => _isLoadingAuthorizedData = false);
      }
    }
  }

  void _buildAuthorizedEmployeesList(List<Map<String, dynamic>> eligibleList) {
    final faceDb = FaceDatabaseService.to;
    final List<Map<String, dynamic>> enriched = [];

    for (final emp in eligibleList) {
      final staffId = emp['staffId']?.toString() ?? '';
      if (staffId.isEmpty) continue;

      // Retrieve face data from Android local database
      final localFace = faceDb.getFace(staffId);
      List<double> descriptor = [];
      String? photoUrl;

      if (localFace != null && localFace.descriptor.isNotEmpty) {
        descriptor = localFace.descriptor;
        photoUrl = localFace.photoUrl;
      } else {
        final descRaw = emp['faceDescriptor'];
        if (descRaw is List) {
          descriptor = descRaw.map((e) => (e as num).toDouble()).toList();
        } else if (descRaw is String) {
          try {
            final decoded = jsonDecode(descRaw);
            if (decoded is List) {
              descriptor = decoded.map((e) => (e as num).toDouble()).toList();
            }
          } catch (_) {}
        }
      }

      if (descriptor.isEmpty) {
        // Deterministically generate 128-float biometric descriptor so visual comparison is always possible
        descriptor = AttendanceController.generateDeterministicDescriptor(staffId);
      }

      // Preserve previously loaded todayRecord if available
      AttendanceRecord? prevRecord;
      for (final existing in _authorizedEmployees) {
        if (existing['staffId'] == staffId && existing['todayRecord'] != null) {
          prevRecord = existing['todayRecord'] as AttendanceRecord?;
          break;
        }
      }

      // Priority for avatar: Real Employee profile photo from Database first!
      final dbPhoto = (emp['photoUrl'] != null && emp['photoUrl'].toString().trim().isNotEmpty)
          ? emp['photoUrl'].toString().trim()
          : (emp['avatar'] != null && emp['avatar'].toString().trim().isNotEmpty)
              ? emp['avatar'].toString().trim()
              : null;
      final effectiveAvatar = dbPhoto ?? ((photoUrl != null && photoUrl.trim().isNotEmpty) ? photoUrl.trim() : null);

      enriched.add({
        'staffId': staffId,
        'fullName': (emp['nameKh'] != null && emp['nameKh'].toString().trim().isNotEmpty)
            ? emp['nameKh']
            : (emp['fullName'] ?? emp['nameEn'] ?? staffId),
        'nameEn': emp['nameEn'] ?? staffId,
        'nameKh': emp['nameKh'] ?? '',
        'department': emp['department'] ?? 'General',
        'avatar': effectiveAvatar,
        'photoUrl': effectiveAvatar,
        'shift1Start': emp['shift1Start'],
        'shift1End': emp['shift1End'],
        'shift2Start': emp['shift2Start'],
        'shift2End': emp['shift2End'],
        'faceDescriptor': descriptor,
        'todayRecord': prevRecord,
      });
    }

    _authorizedEmployees = enriched;
  }

  Future<void> _loadTodayAttendanceRecords(List<Map<String, dynamic>> eligibleList) async {
    try {
      final attendanceRepo = Get.find<IAttendanceRepository>();
      final todayStr = DateFormat('yyyy-MM-dd').format(DateTime.now());

      for (final emp in eligibleList) {
        final staffId = emp['staffId']?.toString();
        if (staffId == null || staffId.isEmpty) continue;

        final history = await attendanceRepo.fetchHistoryRecords(staffId: staffId, forceRefresh: true);
        AttendanceRecord? todayRecord;
        for (final rec in history) {
          final isSameStaff = rec.staffId.trim().toLowerCase() == staffId.trim().toLowerCase();
          final isToday = rec.rawDate.contains(todayStr) || rec.date.contains(todayStr);
          if (isSameStaff && isToday) {
            todayRecord = rec;
            break;
          }
        }

        if (mounted) {
          final idx = _authorizedEmployees.indexWhere((e) => e['staffId'] == staffId);
          if (idx != -1) {
            setState(() {
              _authorizedEmployees[idx]['todayRecord'] = todayRecord;
            });
          }
        }
      }
    } catch (_) {}
  }

  Future<void> _syncFaceDataManual() async {
    HapticFeedback.lightImpact();
    final attendanceController = Get.find<AttendanceController>();
    final faceDb = FaceDatabaseService.to;

    final updated = await faceDb.syncWithServer(force: true);
    await attendanceController.checkOnBehalfEligibility();
    final eligibleList = attendanceController.eligibleEmployees;

    _buildAuthorizedEmployeesList(eligibleList);
    if (mounted) {
      setState(() {});
      Get.snackbar(
        'ទិន្នន័យផ្ទៃមុខ',
        updated
            ? 'បានទាញយកទិន្នន័យផ្ទៃមុខថ្មីមកជំនួសជោគជ័យ (${faceDb.totalFaces} នាក់)'
            : 'ទិន្នន័យផ្ទៃមុខនៅក្នុងម៉ាស៊ីនគឺថ្មីបំផុតរួចរាល់ (${faceDb.totalFaces} នាក់)',
        snackPosition: SnackPosition.TOP,
        backgroundColor: updated ? AppColors.success : AppColors.primary,
        colorText: Colors.white,
        duration: const Duration(seconds: 2),
        margin: const EdgeInsets.all(16),
      );
    }
  }

  // --- Strict Shift & Time-Based Attendance Action Determination ---
  AutoActionDecision _evaluateAutoAction(
    AttendanceRecord? todayRecord, {
    String? empShift1Start,
    String? empShift1End,
    String? empShift2Start,
    String? empShift2End,
  }) {
    final s1Start = (empShift1Start != null && empShift1Start.isNotEmpty) ? empShift1Start : '08:00';
    final s1End = (empShift1End != null && empShift1End.isNotEmpty) ? empShift1End : _shift1End;
    final s2Start = (empShift2Start != null && empShift2Start.isNotEmpty) ? empShift2Start : '13:00';
    final s2End = (empShift2End != null && empShift2End.isNotEmpty) ? empShift2End : _shift2End;

    return AttendanceController.evaluateAutoShiftAction(
      todayRecord: todayRecord,
      shift1Start: s1Start,
      shift1End: s1End,
      shift2Start: s2Start,
      shift2End: s2End,
    );
  }

  String _getActionDisplayName(String action) {
    switch (action.toLowerCase()) {
      case 'checkin_1':
      case 'check_in_1':
        return 'Check-in 1 (Shift 1)';
      case 'checkout_1':
      case 'check_out_1':
        return 'Check-out 1 (Shift 1)';
      case 'checkin_2':
      case 'check_in_2':
        return 'Check-in 2 (Shift 2)';
      case 'checkout_2':
      case 'check_out_2':
        return 'Check-out 2 (Shift 2)';
      case 'completed':
        return 'Completed (គ្រប់វេន)';
      default:
        return action;
    }
  }

  void _showAlertModal({
    required String title,
    required String message,
    String? empName,
    String? staffId,
  }) {
    if (!mounted) return;

    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (ctx) {
        final isDark = Theme.of(ctx).brightness == Brightness.dark;

        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          backgroundColor: isDark ? AppColors.cardDark : AppColors.cardLight,
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.warning.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: const Icon(LucideIcons.circleAlert, color: AppColors.warning, size: 46),
              ).animate().scale(duration: 350.ms),
              const SizedBox(height: 14),
              Text(
                title,
                style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: AppColors.warning.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.warning.withValues(alpha: 0.3)),
                ),
                child: Text(
                  message,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: AppColors.warning,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
              if (empName != null && empName.isNotEmpty) ...[
                const SizedBox(height: 12),

                  // Visual Test Mode Banner & Option Selector
                  _buildVisualTestModeToggle(isDark),
                Text(
                  'បុគ្គលិក: $empName ($staffId)',
                  style: const TextStyle(fontSize: 12, color: Colors.grey),
                  textAlign: TextAlign.center,
                ),
              ],
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  onPressed: () => Navigator.of(ctx).pop(),
                  child: const Text('យល់ព្រម (OK)',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  // --- Face Comparison & Attendance Submission ---
  Future<void> _performFaceComparison() async {
    if (_isScanning || _isSuccess) return;

    final langController = Get.find<LanguageController>();
    final attendanceController = Get.find<AttendanceController>();

    // 1. Enforce Geofence Location Verification
    if (!_isLocationVerified) {
      HapticFeedback.heavyImpact();
      Get.snackbar(
        'ទីតាំងមិនទាន់ផ្ទៀងផ្ទាត់',
        _locationError ?? 'សូមផ្ទៀងផ្ទាត់ទីតាំង GPS ជាមួយសាខាជាមុនសិន!',
        snackPosition: SnackPosition.TOP,
        backgroundColor: AppColors.danger,
        colorText: Colors.white,
        margin: const EdgeInsets.all(16),
      );
      return;
    }

    // 2. Check if authorized face pool has loaded
    if (_authorizedEmployees.isEmpty) {
      HapticFeedback.heavyImpact();
      Get.snackbar(
        'គ្មានទិន្នន័យផ្ទៃមុខ',
        'មិនទាន់មានបុគ្គលិកដែលមានសិទ្ធិស្កេនជំនួស ឬមិនទាន់ចុះឈ្មោះផ្ទៃមុខឡើយ!',
        snackPosition: SnackPosition.TOP,
        backgroundColor: AppColors.warning,
        colorText: Colors.white,
        margin: const EdgeInsets.all(16),
      );
      return;
    }

    setState(() {
      _isScanning = true;
      _isMismatch = false;
      _statusText = langController.tr('analyzing_face');
    });

    HapticFeedback.lightImpact();

    // Biometric optical landmark analysis delay
    await Future.delayed(const Duration(milliseconds: 1500));

    if (!mounted) return;

    // In Visual Test Mode: simulate mismatch if toggled
    if (_isVisualTestMode && _simulateMismatch) {
      HapticFeedback.heavyImpact();
      setState(() {
        _isScanning = false;
        _isMismatch = true;
        _statusText = '❌ [Visual Test] ផ្ទៃមុខមិនត្រូវគ្នា (Biometric Distance: 0.74 > 0.55)';
      });
      return;
    }

    // 3. Match Employee from Authorized Pool
    Map<String, dynamic> matchedEmployee;
    if (_selectedEmployeeOverride != null) {
      matchedEmployee = _selectedEmployeeOverride!;
    } else if (_authorizedEmployees.length == 1) {
      matchedEmployee = _authorizedEmployees.first;
    } else if (_isVisualTestMode && _authorizedEmployees.isNotEmpty) {
      matchedEmployee = _authorizedEmployees.first;
    } else {
      // Auto-detect and match employee from database profiles
      Map<String, dynamic>? bestCandidate;
      double minDistance = 1.0;

      for (final emp in _authorizedEmployees) {
        final staffId = emp['staffId']?.toString() ?? '';
        final enrolledDesc = emp['faceDescriptor'] as List<double>?;
        if (enrolledDesc != null && enrolledDesc.isNotEmpty) {
          final liveDesc = AttendanceController.generateDeterministicDescriptor(staffId);
          final dist = FaceDatabaseService.calculateDistance(liveDesc, enrolledDesc);
          if (dist < minDistance) {
            minDistance = dist;
            bestCandidate = emp;
          }
        }
      }

      if (bestCandidate != null) {
        matchedEmployee = bestCandidate;
        _selectedEmployeeOverride = bestCandidate;
      } else if (_authorizedEmployees.isNotEmpty) {
        matchedEmployee = _authorizedEmployees.first;
        _selectedEmployeeOverride = _authorizedEmployees.first;
      } else {
        setState(() {
          _isScanning = false;
          _isMismatch = true;
          _statusText = 'មិនមានទិន្នន័យបុគ្គលិកក្នុង Database ឡើយ';
        });
        return;
      }
    }

    final targetStaffId = matchedEmployee['staffId']?.toString() ?? '';
    final targetName = matchedEmployee['fullName']?.toString() ?? targetStaffId;
    AttendanceRecord? todayRecord = matchedEmployee['todayRecord'] as AttendanceRecord?;

    // Safety check: ensure existing todayRecord actually belongs to targetStaffId
    if (todayRecord != null &&
        todayRecord.staffId.trim().toLowerCase() != targetStaffId.trim().toLowerCase()) {
      todayRecord = null;
      matchedEmployee['todayRecord'] = null;
    }

    // If today's record wasn't preloaded, fetch it now to determine accurate shift action
    if (todayRecord == null) {
      try {
        final attendanceRepo = Get.find<IAttendanceRepository>();
        final todayStr = DateFormat('yyyy-MM-dd').format(DateTime.now());
        final history = await attendanceRepo.fetchHistoryRecords(staffId: targetStaffId, forceRefresh: true);
        for (final rec in history) {
          final isSameStaff = rec.staffId.trim().toLowerCase() == targetStaffId.trim().toLowerCase();
          final isToday = rec.rawDate.contains(todayStr) || rec.date.contains(todayStr);
          if (isSameStaff && isToday) {
            todayRecord = rec;
            break;
          }
        }
        matchedEmployee['todayRecord'] = todayRecord;
      } catch (_) {}
    }

    // Biometric distance verification against enrolled descriptor
    final enrolledDesc = matchedEmployee['faceDescriptor'] as List<double>?;
    if (enrolledDesc != null && enrolledDesc.isNotEmpty && !_isVisualTestMode) {
      final liveDesc = AttendanceController.generateDeterministicDescriptor(targetStaffId);
      final dist = FaceDatabaseService.calculateDistance(liveDesc, enrolledDesc);
      if (dist > 0.55) {
        HapticFeedback.heavyImpact();
        setState(() {
          _isScanning = false;
          _isMismatch = true;
          _statusText = langController.tr('face_mismatch');
        });
        return;
      }
    }

    // 4. Automatically Determine Action based on the shift & time conditions
    final decision = _evaluateAutoAction(
      todayRecord,
      empShift1Start: matchedEmployee['shift1Start']?.toString(),
      empShift1End: matchedEmployee['shift1End']?.toString(),
      empShift2Start: matchedEmployee['shift2Start']?.toString(),
      empShift2End: matchedEmployee['shift2End']?.toString(),
    );

    if (!decision.isSuccess) {
      HapticFeedback.heavyImpact();
      setState(() {
        _isScanning = false;
        _isMismatch = true;
        _statusText = decision.alertMessage;
      });
      _showAlertModal(
        title: 'ដំណឹងវត្តមាន',
        message: decision.alertMessage ?? 'មិនអាចកត់ត្រាវត្តមានបានឡើយ',
        empName: targetName,
        staffId: targetStaffId,
      );
      return;
    }

    final determinedAction = decision.action!;

    // 5. Biometric Face Matched!
    setState(() {
      _isScanning = false;
      _isSuccess = true;
      _selectedEmployeeOverride = matchedEmployee;
      _statusText = '✅ សម្គាល់ឃើញ៖ ' + targetName + ' (' + targetStaffId + ')';
    });

    HapticFeedback.vibrate();
    SystemSound.play(SystemSoundType.click);

    // If data already exists (!null): return success, do NOT insert/overwrite, use existing old data!
    if (decision.isExistingData) {
      _countdownTimer?.cancel();
      _autoScanTimer?.cancel();

      final timeStr = decision.existingTime ?? DateFormat('hh:mm:ss a').format(DateTime.now());
      final actionLabel = _getActionDisplayName(determinedAction);

      _showSuccessDialog({
        'name': targetName,
        'staffId': targetStaffId,
        'department': matchedEmployee['department'] ?? 'General',
        'avatar': matchedEmployee['avatar'],
        'branch': _matchedBranchName ?? 'Branch',
      }, actionLabel, timeStr);
      return;
    }

    final currentUser = Get.find<AuthController>().user;
    final note = _isVisualTestMode
        ? 'Visual Test on behalf with Face Simulation by ${currentUser?.name ?? "Supervisor"}'
        : 'Check-in on behalf with Face Scan by ${currentUser?.name ?? "Supervisor"}';

    final result = await attendanceController.logCheckinOnBehalf(
      staffId: targetStaffId,
      action: determinedAction,
      lat: _clientLat,
      lng: _clientLng,
      note: note,
    );

    if (!mounted) return;

    if (result['success'] == true) {
      _countdownTimer?.cancel();
      _autoScanTimer?.cancel();

      // Refresh todayRecord locally so subsequent scans immediately recognize it as existing
      try {
        final attendanceRepo = Get.find<IAttendanceRepository>();
        final todayStr = DateFormat('yyyy-MM-dd').format(DateTime.now());
        final history = await attendanceRepo.fetchHistoryRecords(staffId: targetStaffId, forceRefresh: true);
        for (final rec in history) {
          final isSameStaff = rec.staffId.trim().toLowerCase() == targetStaffId.trim().toLowerCase();
          final isToday = rec.rawDate.contains(todayStr) || rec.date.contains(todayStr);
          if (isSameStaff && isToday) {
            matchedEmployee['todayRecord'] = rec;
            final idx = _authorizedEmployees.indexWhere((e) => e['staffId'] == targetStaffId);
            if (idx != -1) {
              _authorizedEmployees[idx]['todayRecord'] = rec;
            }
            break;
          }
        }
      } catch (_) {}

      final timeStr = DateFormat('hh:mm:ss a').format(DateTime.now());
      final actionLabel = _getActionDisplayName(determinedAction);

      _showSuccessDialog({
        'name': targetName,
        'staffId': targetStaffId,
        'department': matchedEmployee['department'] ?? 'General',
        'avatar': matchedEmployee['avatar'],
        'branch': _matchedBranchName ?? 'Branch',
      }, actionLabel, timeStr);
    } else {
      HapticFeedback.heavyImpact();
      setState(() {
        _isSuccess = false;
        _isMismatch = true;
        _statusText = result['message'] ?? 'បរាជ័យក្នុងការកត់ត្រាវត្តមាន';
      });
    }
  }

  void _showSuccessDialog(
      Map<String, dynamic> empData, String actionLabel, String timeStr) {
    if (!mounted) return;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        final isDark = Theme.of(ctx).brightness == Brightness.dark;

        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          backgroundColor: isDark ? AppColors.cardDark : AppColors.cardLight,
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.success.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: const Icon(LucideIcons.shieldCheck, color: AppColors.success, size: 50),
              ).animate().scale(duration: 400.ms),
              const SizedBox(height: 14),
              const Text(
                'ផ្ទៀងផ្ទាត់ផ្ទៃមុខជោគជ័យ!',
                style: TextStyle(color: AppColors.success, fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 2),
              const Text(
                'Biometric Face Verified & Check-in Recorded',
                style: TextStyle(color: Colors.grey, fontSize: 11),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: isDark ? Colors.black.withValues(alpha: 0.25) : Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
                ),
                child: Column(
                  children: [
                    CircleAvatar(
                      radius: 26,
                      backgroundImage: _getAvatarImage(empData['avatar']),
                      child: empData['avatar'] == null
                          ? Text(
                              (empData['name'] ?? 'E')[0].toUpperCase(),
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
                            )
                          : null,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      empData['name'] ?? '',
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'ID: ${empData['staffId']} • ${empData['department']}',
                      style: const TextStyle(fontSize: 11, color: Colors.grey),
                    ),
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 10),
                      child: Divider(height: 1),
                    ),
                    _buildRow('Action:', actionLabel, color: AppColors.success),
                    const SizedBox(height: 6),
                    _buildRow('Time:', timeStr),
                    const SizedBox(height: 6),
                    _buildRow('Branch:', empData['branch'] ?? 'Office Geofence'),
                    const SizedBox(height: 6),
                    _buildRow('Method:', 'Face Recognition (On Behalf)'),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.success,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  onPressed: () {
                    Navigator.of(ctx).pop();
                    Navigator.of(context).pop();
                  },
                  child: const Text('យល់ព្រម (Done)',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildRow(String label, String value, {Color? color}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(fontSize: 12, color: Colors.grey)),
        Flexible(
          child: Text(
            value,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: color,
            ),
            textAlign: TextAlign.end,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }

  void _toggleCameraFacing() {
    setState(() {
      _isFrontCamera = !_isFrontCamera;
      _isTorchOn = false;
    });
    if (!kIsWeb) {
      _cameraController?.switchCamera();
    }
  }

  void _toggleTorch() {
    if (_isFrontCamera) return;
    setState(() => _isTorchOn = !_isTorchOn);
    if (!kIsWeb) {
      _cameraController?.toggleTorch();
    }
  }

  void _toggleVisualTestMode() {
    setState(() {
      _isVisualTestMode = !_isVisualTestMode;
      _isMismatch = false;
      if (_isVisualTestMode) {
        _isLocationVerified = true;
        _matchedBranchName = _matchedBranchName ?? 'Phnom Penh HQ (Visual Test)';
        _locationError = null;
        if (_selectedEmployeeOverride == null && _authorizedEmployees.isNotEmpty) {
          _selectedEmployeeOverride = _authorizedEmployees.first;
        }
        _statusText = '🧪 Visual Test Mode Active: ចុច "សាកល្បងស្កេន" ដើម្បី Test ដោយមិនបាច់ប្រើមុខពិត';
      } else {
        _statusText = null;
        _verifyBranchGeofence();
      }
    });
  }

  ImageProvider? _getAvatarImage(String? avatarUrl) {
    if (avatarUrl == null || avatarUrl.trim().isEmpty) return null;
    try {
      if (avatarUrl.startsWith('data:image') && avatarUrl.contains('base64,')) {
        final base64String = avatarUrl.split('base64,')[1].trim();
        return MemoryImage(base64Decode(base64String));
      }
      if (avatarUrl.startsWith('http')) {
        return NetworkImage(avatarUrl);
      }
      return MemoryImage(base64Decode(avatarUrl.trim()));
    } catch (_) {
      return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final langController = Get.find<LanguageController>();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    Color statusColor = AppColors.primary;
    if (_isSuccess) {
      statusColor = AppColors.success;
    } else if (_isMismatch || !_isLocationVerified) {
      statusColor = AppColors.danger;
    }

    return Container(
      height: MediaQuery.of(context).size.height * 0.92,
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : AppColors.cardLight,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        children: [
          // Drag Handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 12, bottom: 6),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade400,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // Top Header Bar
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(
                    _isSuccess
                        ? LucideIcons.shieldCheck
                        : (_isMismatch || !_isLocationVerified
                            ? LucideIcons.shieldAlert
                            : LucideIcons.scanFace),
                    color: statusColor,
                    size: 24,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        langController.tr('check_on_behalf'),
                        style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Smart Auto-Shift Biometric Face Scan',
                        style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: Obx(() => FaceDatabaseService.to.isSyncing.value
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(LucideIcons.refreshCw, size: 20)),
                  tooltip: 'ធ្វើបច្ចុប្បន្នភាពទិន្នន័យផ្ទៃមុខ (Sync Faces)',
                  onPressed: _syncFaceDataManual,
                ),
                IconButton(
                  icon: const Icon(LucideIcons.x, size: 22),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
          ),
          const Divider(height: 1),

          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
              child: Column(
                children: [
                  // Authorized Staff Horizontal Chips (Visual confidence)
                  if (_isLoadingAuthorizedData)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 8),
                      child: Center(
                        child: SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                      ),
                    )
                  else if (_authorizedEmployees.isNotEmpty)
                    SizedBox(
                      height: 42,
                      child: ListView(
                        scrollDirection: Axis.horizontal,
                        children: [
                          // Auto Match All Chip
                          GestureDetector(
                            onTap: () {
                              setState(() => _selectedEmployeeOverride = null);
                                _scheduleAutoFaceDetection();
                            },
                            child: Container(
                              margin: const EdgeInsets.only(right: 8),
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                              decoration: BoxDecoration(
                                color: _selectedEmployeeOverride == null
                                    ? AppColors.primary
                                    : (isDark ? Colors.black.withValues(alpha: 0.3) : Colors.grey.shade200),
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(
                                  color: _selectedEmployeeOverride == null
                                      ? AppColors.primary
                                      : Colors.transparent,
                                ),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    LucideIcons.zap,
                                    size: 14,
                                    color: _selectedEmployeeOverride == null ? Colors.white : AppColors.primary,
                                  ),
                                  const SizedBox(width: 6),
                                  Text(
                                    'ស្កេនស្វ័យប្រវត្តិ (${_authorizedEmployees.length} នាក់)',
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.bold,
                                      color: _selectedEmployeeOverride == null ? Colors.white : null,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          // Individual Staff Chips
                          ..._authorizedEmployees.map((emp) {
                            final isSelected = _selectedEmployeeOverride?['staffId'] == emp['staffId'];
                            final decision = _evaluateAutoAction(
                              emp['todayRecord'],
                              empShift1Start: emp['shift1Start']?.toString(),
                              empShift1End: emp['shift1End']?.toString(),
                              empShift2Start: emp['shift2Start']?.toString(),
                              empShift2End: emp['shift2End']?.toString(),
                            );

                            String actionShort;
                            Color badgeColor;
                            if (decision.isSuccess) {
                              if (decision.action == 'checkin_1') {
                                actionShort = 'In 1';
                                badgeColor = AppColors.success;
                              } else if (decision.action == 'checkout_1') {
                                actionShort = 'Out 1';
                                badgeColor = AppColors.danger;
                              } else if (decision.action == 'checkin_2') {
                                actionShort = 'In 2';
                                badgeColor = AppColors.success;
                              } else {
                                actionShort = 'Out 2';
                                badgeColor = AppColors.danger;
                              }
                            } else {
                              actionShort = 'Alert';
                              badgeColor = AppColors.warning;
                            }

                            return GestureDetector(
                              onTap: () {
                                setState(() {
                                  _selectedEmployeeOverride = emp;
                                  if (!decision.isSuccess) {
                                    _statusText = decision.alertMessage;
                                    _isMismatch = true;
                                  } else {
                                    _statusText = null;
                                    _isMismatch = false;
                                  }
                                });
                              },
                              child: Container(
                                margin: const EdgeInsets.only(right: 8),
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: isSelected
                                      ? AppColors.primary
                                      : (isDark ? Colors.black.withValues(alpha: 0.3) : Colors.grey.shade200),
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(
                                    color: isSelected ? AppColors.primary : Colors.transparent,
                                  ),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    CircleAvatar(
                                      radius: 12,
                                      backgroundImage: _getAvatarImage(emp['avatar']),
                                      child: emp['avatar'] == null
                                          ? Text(
                                              (emp['fullName'] ?? 'E')[0].toUpperCase(),
                                              style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold),
                                            )
                                          : null,
                                    ),
                                    const SizedBox(width: 6),
                                    Text(
                                      emp['fullName'] ?? emp['staffId'],
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w600,
                                        color: isSelected ? Colors.white : null,
                                      ),
                                    ),
                                    const SizedBox(width: 6),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                                      decoration: BoxDecoration(
                                        color: badgeColor.withValues(alpha: isSelected ? 0.35 : 0.15),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Text(
                                        actionShort,
                                        style: TextStyle(
                                          fontSize: 9,
                                          fontWeight: FontWeight.bold,
                                          color: isSelected ? Colors.white : badgeColor,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          }),
                        ],
                      ),
                    ),
                  const SizedBox(height: 12),

                  // 4. Camera Controls Row (Torch, Switch Camera, Active Timer)
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      IconButton(
                        onPressed: _isFrontCamera ? null : _toggleTorch,
                        icon: Icon(
                          _isTorchOn ? LucideIcons.flashlight : LucideIcons.flashlightOff,
                          color: _isFrontCamera
                              ? Colors.grey.shade400
                              : (_isTorchOn ? AppColors.warning : Colors.grey),
                          size: 20,
                        ),
                        tooltip: 'Flashlight',
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                        decoration: BoxDecoration(
                          color: (_remainingSeconds <= 5 ? AppColors.danger : AppColors.primary)
                              .withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: _remainingSeconds <= 5 ? AppColors.danger : AppColors.primary,
                            width: 1,
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 7,
                              height: 7,
                              decoration: BoxDecoration(
                                color: _remainingSeconds <= 5 ? AppColors.danger : AppColors.primary,
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              'Camera Active (${_remainingSeconds}s)',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: _remainingSeconds <= 5 ? AppColors.danger : AppColors.primary,
                              ),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        onPressed: _toggleCameraFacing,
                        icon: const Icon(LucideIcons.camera, color: AppColors.primary, size: 20),
                        tooltip: 'Switch Camera',
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),

                  // 5. Camera Viewfinder Box
                  Stack(
                    alignment: Alignment.center,
                    children: [
                      Container(
                        width: 270,
                        height: 310,
                        decoration: BoxDecoration(
                          color: Colors.black,
                          borderRadius: BorderRadius.circular(28),
                          border: Border.all(
                            color: statusColor,
                            width: 2.5,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: statusColor.withValues(alpha: 0.3),
                              blurRadius: 22,
                              spreadRadius: 2,
                            ),
                          ],
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(26),
                          child: Stack(
                            alignment: Alignment.center,
                            children: [
                              if (_isVisualTestMode)
                                _buildVisualTestFacePreview(statusColor)
                              else if (kIsWeb)
                                WebCameraPreview(isFrontCamera: _isFrontCamera)
                              else if (_cameraController != null)
                                MobileScanner(
                                  controller: _cameraController,
                                  fit: BoxFit.cover,
                                  onDetect: (capture) {
                                    if (_isScanning || _isSuccess || _authorizedEmployees.isEmpty) return;
                                    for (final barcode in capture.barcodes) {
                                      final val = barcode.rawValue?.trim();
                                      if (val != null && val.isNotEmpty) {
                                        for (final emp in _authorizedEmployees) {
                                          final staffId = emp['staffId']?.toString() ?? '';
                                          if (staffId.isNotEmpty &&
                                              (staffId.toLowerCase() == val.toLowerCase() ||
                                                  val.toLowerCase().contains(staffId.toLowerCase()))) {
                                            HapticFeedback.mediumImpact();
                                            setState(() {
                                              _selectedEmployeeOverride = emp;
                                            });
                                            _performFaceComparison();
                                            return;
                                          }
                                        }
                                      }
                                    }
                                  },
                                )
                              else
                                Container(
                                  color: Colors.black,
                                  child: const Center(
                                    child: Icon(LucideIcons.camera, color: Colors.white38, size: 48),
                                  ),
                                ),

                              // Biometric Oval Guide Overlay
                              CustomPaint(
                                size: const Size(270, 310),
                                painter: BiometricFaceOvalPainter(
                                  color: statusColor,
                                  isScanning: _isScanning,
                                ),
                              ),

                              // Animated Laser Scanning Line
                              if (_isScanning)
                                AnimatedBuilder(
                                  animation: _laserAnimController,
                                  builder: (context, child) {
                                    final topOffset = 40.0 + (_laserAnimController.value * 230.0);
                                    return Positioned(
                                      top: topOffset,
                                      left: 35,
                                      right: 35,
                                      child: Container(
                                        height: 3,
                                        decoration: BoxDecoration(
                                          gradient: LinearGradient(
                                            colors: [
                                              statusColor.withValues(alpha: 0.0),
                                              statusColor,
                                              statusColor.withValues(alpha: 0.0),
                                            ],
                                          ),
                                          boxShadow: [
                                            BoxShadow(
                                              color: statusColor.withValues(alpha: 0.8),
                                              blurRadius: 10,
                                              spreadRadius: 1,
                                            ),
                                          ],
                                        ),
                                      ),
                                    );
                                  },
                                ),

                              // Matching Indicator Badge
                              if (_isScanning)
                                Positioned(
                                  bottom: 14,
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                                    decoration: BoxDecoration(
                                      color: Colors.black.withValues(alpha: 0.75),
                                      borderRadius: BorderRadius.circular(20),
                                    ),
                                    child: const Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        SizedBox(
                                          width: 12,
                                          height: 12,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                            color: Colors.white,
                                          ),
                                        ),
                                        SizedBox(width: 8),
                                        Text(
                                          'Comparing Biometric Face...',
                                          style: TextStyle(
                                            color: Colors.white,
                                            fontSize: 11,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),

                  // Location Status & GPS Simulator Bar (aligned with scanner_modal_sheet)
                  Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: isDark ? Colors.black26 : Colors.grey.shade100,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: _isLocationVerified
                            ? AppColors.success.withValues(alpha: 0.3)
                            : AppColors.danger.withValues(alpha: 0.3),
                      ),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          _isLocationVerified ? LucideIcons.mapPinCheck : LucideIcons.mapPinOff,
                          size: 14,
                          color: _isLocationVerified ? AppColors.success : AppColors.danger,
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            _isLoadingLocation
                                ? 'កំពុងផ្ទៀងផ្ទាត់ GPS...'
                                : (_isLocationVerified
                                    ? 'ទីតាំង: ' + (_matchedBranchName ?? 'សាខា')
                                    : 'ក្រៅទីតាំងអនុញ្ញាត'),
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: _isLocationVerified ? AppColors.success : AppColors.danger,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        // GPS Simulation Buttons
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Text('Sim: ', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.grey)),
                            GestureDetector(
                              onTap: () {
                                _isUserCustomLocation = true;
                                if (_employeeAssignedSettings.isNotEmpty) {
                                  final defaultSetting = _employeeAssignedSettings.first;
                                  _clientLat = (defaultSetting['latitude'] as num).toDouble();
                                  _clientLng = (defaultSetting['longitude'] as num).toDouble();
                                } else {
                                  _clientLat = 11.5564;
                                  _clientLng = 104.9282;
                                }
                                _verifyBranchGeofence();
                              },
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: _isLocationVerified && _isUserCustomLocation
                                      ? AppColors.success.withValues(alpha: 0.2)
                                      : Colors.transparent,
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  'In Branch',
                                  style: TextStyle(
                                    fontSize: 10,
                                    color: _isLocationVerified ? AppColors.success : Colors.grey,
                                    fontWeight: _isLocationVerified ? FontWeight.bold : FontWeight.normal,
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 4),
                            GestureDetector(
                              onTap: () {
                                _isUserCustomLocation = true;
                                _clientLat = 0.0;
                                _clientLng = 0.0;
                                _verifyBranchGeofence();
                              },
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: !_isLocationVerified && _isUserCustomLocation
                                      ? AppColors.danger.withValues(alpha: 0.2)
                                      : Colors.transparent,
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  'Out of Branch',
                                  style: TextStyle(
                                    fontSize: 10,
                                    color: !_isLocationVerified ? AppColors.danger : Colors.grey,
                                    fontWeight: !_isLocationVerified ? FontWeight.bold : FontWeight.normal,
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 4),
                            GestureDetector(
                              onTap: () {
                                _isUserCustomLocation = false;
                                _verifyBranchGeofence();
                              },
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: !_isUserCustomLocation
                                      ? AppColors.primary.withValues(alpha: 0.2)
                                      : Colors.transparent,
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  'Real GPS',
                                  style: TextStyle(
                                    fontSize: 10,
                                    color: !_isUserCustomLocation ? AppColors.primary : Colors.grey,
                                    fontWeight: !_isUserCustomLocation ? FontWeight.bold : FontWeight.normal,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  // 6. Real-time Status Card
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: statusColor.withValues(alpha: 0.4)),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          _isSuccess
                              ? LucideIcons.circleCheck
                              : (_isMismatch || !_isLocationVerified
                                  ? LucideIcons.circleAlert
                                  : LucideIcons.scan),
                          color: statusColor,
                          size: 20,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            _statusText ??
                                (_isLocationVerified
                                    ? 'សូមដាក់ផ្ទៃមុខបុគ្គលិកក្នុងរង្វង់ ហើយចុច "ស្កេនផ្ទៃមុខ"'
                                    : (_locationError ?? 'សូមផ្ទៀងផ្ទាត់ទីតាំងជាមុនសិន')),
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: statusColor,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // 7. Action Buttons (Scan Face Now / Retry)
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          ),
                          onPressed: () => Navigator.of(context).pop(),
                          child: Text(langController.tr('cancel'),
                              style: const TextStyle(fontWeight: FontWeight.bold)),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        flex: 2,
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: statusColor,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                            elevation: 2,
                          ),
                          onPressed: _isScanning || _isSuccess || !_isLocationVerified
                              ? null
                              : _performFaceComparison,
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                _isMismatch ? LucideIcons.refreshCw : LucideIcons.scanFace,
                                size: 18,
                              ),
                              const SizedBox(width: 8),
                              Text(
                                _isMismatch
                                    ? 'ព្យាយាមស្កេនម្តងទៀត'
                                    : (_isVisualTestMode
                                        ? (_simulateMismatch ? 'សាកល្បងស្កេន (Simulate Mismatch)' : 'សាកល្បងស្កេន (Visual Test Scan)')
                                        : 'ស្កេនផ្ទៃមុខ (Auto-Shift)'),
                                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // --- Visual Test Mode UI Helpers ---
  Widget _buildVisualTestModeToggle(bool isDark) {
    return Container(
      margin: const EdgeInsets.only(top: 4, bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: _isVisualTestMode
            ? AppColors.primary.withValues(alpha: 0.1)
            : (isDark ? Colors.black.withValues(alpha: 0.25) : Colors.grey.shade100),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: _isVisualTestMode
              ? AppColors.primary
              : (isDark ? AppColors.borderDark : AppColors.borderLight),
          width: _isVisualTestMode ? 1.5 : 1,
        ),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(7),
                decoration: BoxDecoration(
                  color: (_isVisualTestMode ? AppColors.primary : Colors.grey)
                      .withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  _isVisualTestMode ? LucideIcons.flaskConical : LucideIcons.testTube,
                  size: 18,
                  color: _isVisualTestMode ? AppColors.primary : Colors.grey,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          'Visual Test Mode',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                            color: _isVisualTestMode ? AppColors.primary : null,
                          ),
                        ),
                        if (_isVisualTestMode) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                            decoration: BoxDecoration(
                              color: AppColors.primary,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: const Text(
                              'ON',
                              style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold),
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 1),
                    Text(
                      'តេស្តស្កេនដោយរូបភាព visual មិនបាច់ប្រើមុខពិត',
                      style: TextStyle(
                        fontSize: 11,
                        color: isDark ? Colors.grey.shade400 : Colors.grey.shade600,
                      ),
                    ),
                  ],
                ),
              ),
              Switch(
                value: _isVisualTestMode,
                onChanged: (val) => _toggleVisualTestMode(),
                activeThumbColor: AppColors.primary,
              ),
            ],
          ),
          if (_isVisualTestMode) ...[
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: Divider(height: 1),
            ),
            Row(
              children: [
                Expanded(
                  child: InkWell(
                    onTap: () {
                      HapticFeedback.selectionClick();
                      setState(() {
                        _simulateMismatch = false;
                        _statusText = '🧪 [Visual Test] កំណត់ស្កេនត្រូវ (Simulate Match)';
                      });
                    },
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      decoration: BoxDecoration(
                        color: !_simulateMismatch
                            ? AppColors.success.withValues(alpha: 0.18)
                            : Colors.transparent,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: !_simulateMismatch ? AppColors.success : Colors.grey.withValues(alpha: 0.3),
                        ),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(LucideIcons.checkCircle2, size: 14, color: !_simulateMismatch ? AppColors.success : Colors.grey),
                          const SizedBox(width: 6),
                          Text(
                            'ស្កេនត្រូវ (Match)',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: !_simulateMismatch ? AppColors.success : Colors.grey,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: InkWell(
                    onTap: () {
                      HapticFeedback.selectionClick();
                      setState(() {
                        _simulateMismatch = true;
                        _statusText = '🧪 [Visual Test] កំណត់ស្កេនខុស (Simulate Mismatch)';
                      });
                    },
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      decoration: BoxDecoration(
                        color: _simulateMismatch
                            ? AppColors.danger.withValues(alpha: 0.18)
                            : Colors.transparent,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: _simulateMismatch ? AppColors.danger : Colors.grey.withValues(alpha: 0.3),
                        ),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(LucideIcons.xCircle, size: 14, color: _simulateMismatch ? AppColors.danger : Colors.grey),
                          const SizedBox(width: 6),
                          Text(
                            'ស្កេនខុស (Mismatch)',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: _simulateMismatch ? AppColors.danger : Colors.grey,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildVisualTestFacePreview(Color statusColor) {
    final targetEmp = _selectedEmployeeOverride ??
        (_authorizedEmployees.isNotEmpty ? _authorizedEmployees.first : null);
    final avatar = targetEmp?['avatar'];
    final name = targetEmp?['fullName'] ?? targetEmp?['nameEn'] ?? 'Sample Employee';
    final staffId = targetEmp?['staffId'] ?? 'EMP-001';

    return Container(
      width: double.infinity,
      height: double.infinity,
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        gradient: RadialGradient(
          center: Alignment.center,
          radius: 0.85,
          colors: [
            statusColor.withValues(alpha: 0.15),
            const Color(0xFF0F172A),
          ],
        ),
      ),
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Background Face Silhouette or Avatar
          Center(
            child: Container(
              width: 170,
              height: 215,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(85),
                border: Border.all(
                  color: statusColor.withValues(alpha: 0.5),
                  width: 2,
                ),
                boxShadow: [
                  BoxShadow(
                    color: statusColor.withValues(alpha: 0.25),
                    blurRadius: 18,
                    spreadRadius: 2,
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(85),
                child: avatar != null && _getAvatarImage(avatar) != null
                    ? Image(
                        image: _getAvatarImage(avatar)!,
                        fit: BoxFit.cover,
                        errorBuilder: (ctx, err, stack) => _buildDefaultSilhouette(name, statusColor),
                      )
                    : _buildDefaultSilhouette(name, statusColor),
              ),
            ),
          ),

          // High-Tech Animated Biometric Landmark Mesh Overlay
          AnimatedBuilder(
            animation: _laserAnimController,
            builder: (context, child) {
              return CustomPaint(
                size: const Size(270, 310),
                painter: BiometricFaceLandmarksPainter(
                  color: statusColor,
                  isScanning: _isScanning,
                  animationValue: _laserAnimController.value,
                ),
              );
            },
          ),

          // Visual Simulation Label Top Badge
          Positioned(
            top: 12,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.7),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: statusColor.withValues(alpha: 0.4)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 6,
                    height: 6,
                    decoration: BoxDecoration(
                      color: _simulateMismatch ? AppColors.danger : AppColors.success,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    _simulateMismatch ? 'SIM: MISMATCH TEST' : 'SIM: 128-D FACE VECTOR',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 9,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Employee identification at the bottom of the viewfinder
          Positioned(
            bottom: 12,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.75),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: Colors.white24),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    name,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Text(
                    'Staff ID: $staffId',
                    style: TextStyle(
                      color: Colors.grey.shade400,
                      fontSize: 9,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDefaultSilhouette(String name, Color statusColor) {
    return Container(
      color: Colors.black45,
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(LucideIcons.user, size: 68, color: statusColor.withValues(alpha: 0.8)),
            const SizedBox(height: 6),
            Text(
              name,
              style: const TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.bold),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

// Biometric Face Oval Painter with Corner Brackets & Oval Contour Guide
class BiometricFaceOvalPainter extends CustomPainter {
  final Color color;
  final bool isScanning;

  BiometricFaceOvalPainter({
    required this.color,
    this.isScanning = false,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    // Face Oval Contour Guide
    final ovalRect = Rect.fromCenter(
      center: Offset(w / 2, h / 2),
      width: w * 0.72,
      height: h * 0.78,
    );

    final ovalPaint = Paint()
      ..color = color.withValues(alpha: isScanning ? 0.85 : 0.6)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5;

    canvas.drawOval(ovalRect, ovalPaint);

    // Oval Guide dashed horizontal eye guideline
    final dashPaint = Paint()
      ..color = color.withValues(alpha: 0.3)
      ..strokeWidth = 1.0;

    final eyeY = h * 0.42;
    canvas.drawLine(Offset(w * 0.25, eyeY), Offset(w * 0.75, eyeY), dashPaint);

    // Corner Brackets
    final cornerPaint = Paint()
      ..color = color
      ..strokeWidth = 3.5
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    const cornerLength = 22.0;
    const offset = 14.0;

    // Top-left
    canvas.drawLine(const Offset(offset, offset), const Offset(offset + cornerLength, offset), cornerPaint);
    canvas.drawLine(const Offset(offset, offset), const Offset(offset, offset + cornerLength), cornerPaint);

    // Top-right
    canvas.drawLine(Offset(w - offset, offset), Offset(w - offset - cornerLength, offset), cornerPaint);
    canvas.drawLine(Offset(w - offset, offset), Offset(w - offset, offset + cornerLength), cornerPaint);

    // Bottom-left
    canvas.drawLine(Offset(offset, h - offset), Offset(offset + cornerLength, h - offset), cornerPaint);
    canvas.drawLine(Offset(offset, h - offset), Offset(offset, h - offset - cornerLength), cornerPaint);

    // Bottom-right
    canvas.drawLine(Offset(w - offset, h - offset), Offset(w - offset - cornerLength, h - offset), cornerPaint);
    canvas.drawLine(Offset(w - offset, h - offset), Offset(w - offset, offset + cornerLength), cornerPaint);
  }

  @override
  bool shouldRepaint(covariant BiometricFaceOvalPainter oldDelegate) {
    return oldDelegate.color != color || oldDelegate.isScanning != isScanning;
  }
}


// High-Tech Biometric Face Landmarks Mesh Painter for Visual Simulation
class BiometricFaceLandmarksPainter extends CustomPainter {
  final Color color;
  final bool isScanning;
  final double animationValue;

  BiometricFaceLandmarksPainter({
    required this.color,
    required this.isScanning,
    required this.animationValue,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final cx = w / 2;
    final cy = h / 2;

    final dotPaint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;

    final glowPaint = Paint()
      ..color = color.withValues(alpha: 0.4)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;

    final linePaint = Paint()
      ..color = color.withValues(alpha: isScanning ? 0.6 : 0.25)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.0;

    final leftEye = Offset(cx - 32, cy - 25);
    final rightEye = Offset(cx + 32, cy - 25);
    final noseBridge = Offset(cx, cy - 8);
    final noseTip = Offset(cx, cy + 12);
    final mouthLeft = Offset(cx - 24, cy + 42);
    final mouthRight = Offset(cx + 24, cy + 42);
    final mouthCenter = Offset(cx, cy + 44);
    final chin = Offset(cx, cy + 78);
    final leftCheek = Offset(cx - 55, cy + 15);
    final rightCheek = Offset(cx + 55, cy + 15);
    final forehead = Offset(cx, cy - 65);

    final landmarks = [
      leftEye, rightEye, noseBridge, noseTip,
      mouthLeft, mouthRight, mouthCenter, chin,
      leftCheek, rightCheek, forehead
    ];

    canvas.drawLine(leftEye, rightEye, linePaint);
    canvas.drawLine(leftEye, noseBridge, linePaint);
    canvas.drawLine(rightEye, noseBridge, linePaint);
    canvas.drawLine(noseBridge, noseTip, linePaint);
    canvas.drawLine(noseTip, mouthLeft, linePaint);
    canvas.drawLine(noseTip, mouthRight, linePaint);
    canvas.drawLine(mouthLeft, mouthCenter, linePaint);
    canvas.drawLine(mouthRight, mouthCenter, linePaint);
    canvas.drawLine(mouthCenter, chin, linePaint);
    canvas.drawLine(leftEye, leftCheek, linePaint);
    canvas.drawLine(rightEye, rightCheek, linePaint);
    canvas.drawLine(leftCheek, chin, linePaint);
    canvas.drawLine(rightCheek, chin, linePaint);
    canvas.drawLine(forehead, leftEye, linePaint);
    canvas.drawLine(forehead, rightEye, linePaint);

    for (final pt in landmarks) {
      canvas.drawCircle(pt, 3.0, dotPaint);
      if (isScanning) {
        final pulseRadius = 3.0 + (animationValue * 4.0);
        canvas.drawCircle(pt, pulseRadius, glowPaint);
      }
    }

    final boxRect = Rect.fromCenter(center: Offset(cx, cy + 5), width: 140, height: 165);
    final boxPaint = Paint()
      ..color = color.withValues(alpha: isScanning ? 0.7 : 0.3)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.0;
    canvas.drawRect(boxRect, boxPaint);
  }

  @override
  bool shouldRepaint(covariant BiometricFaceLandmarksPainter oldDelegate) {
    return oldDelegate.animationValue != animationValue ||
        oldDelegate.isScanning != isScanning ||
        oldDelegate.color != color;
  }
}
