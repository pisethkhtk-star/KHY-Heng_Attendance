import 'dart:math' as math;
import 'dart:async';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:intl/intl.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import 'web_camera/web_camera.dart';
import '../core/constants/app_colors.dart';
import '../controllers/language_controller.dart';
import '../controllers/attendance_controller.dart';
import '../controllers/auth_controller.dart';
import '../repositories/auth_repository.dart';
import '../repositories/attendance_repository.dart';
import '../models/attendance_model.dart';

class ScannerModalSheet extends StatefulWidget {
  final int initialTab; // 0: QR, 1: My Badge
  final bool isLoginMode;
  final Function(String qrToken)? onLoginQrScanned;

  const ScannerModalSheet({
    super.key,
    this.initialTab = 0,
    this.isLoginMode = false,
    this.onLoginQrScanned,
  });

  @override
  State<ScannerModalSheet> createState() => _ScannerModalSheetState();
}

class _ScannerModalSheetState extends State<ScannerModalSheet> with WidgetsBindingObserver {
  final IAuthRepository _authRepository = Get.find<IAuthRepository>();
  final IAttendanceRepository _attendanceRepository = Get.find<IAttendanceRepository>();

  final TextEditingController _customQrController = TextEditingController();
  final TextEditingController _reasonController = TextEditingController();
  final TextEditingController _behalfStaffIdController = TextEditingController();

  // Mobile Scanner Controller persistent state
  MobileScannerController? _cameraController;

  // Frontend Kiosk State Alignment
  bool _isUnlocked = false; // Camera lock state, default locked until location/login mode is verified!
  Timer? _cameraTimer; // 30-second countdown timer for QR scanner
  int _remainingSeconds = 30;
  final bool _scanOnBehalf = false; // Scan on behalf checkbox
  bool _isLoadingLocation = false; // Location loading indicator state
  bool _isVerifying = false;
  bool _isProcessing = false;
  String? _statusMessage;
  bool _isSuccess = false;
  bool _isTorchOn = false;
  final bool _isFrontCamera = false;

  // Next action determined from attendance history
  String _nextAction = 'checkin_1'; // checkin_1, checkout_1, checkin_2, checkout_2
  String _reasonType = 'late'; // 'late' or 'early'
  String _earlyCheckoutReason = '';

  // Geofence & Location verification state
  bool _isLocationVerified = false;
  String? _matchedBranchName;
  String? _matchedBranchToken;

  List<Map<String, dynamic>> _allKioskSettings = [];
  List<Map<String, dynamic>> _employeeAssignedSettings = [];

  // Simulated Client GPS coordinates
  double _clientLat = 11.5564;
  double _clientLng = 104.9282;
  bool _isUserCustomLocation = false;
  StreamSubscription<Position>? _positionSubscription;
  bool _hasFetchedInitially = false;

  // Throttle state for QR scanning
  String? _lastScanToken;
  DateTime? _lastScanTime;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initCameraController();

    WidgetsBinding.instance.addPostFrameCallback((_) {
      _verifyBranchGeofence();
      _preEvaluateAction();
    });
  }

  Future<void> _preEvaluateAction() async {
    final user = Get.find<AuthController>().user;
    final staffId = user?.employeeId;
    if (staffId == null || staffId.isEmpty) return;

    try {
      final historyRecords = await _attendanceRepository.fetchHistoryRecords(staffId: staffId);
      final now = DateTime.now();
      final todayStr = DateFormat('yyyy-MM-dd').format(now);

      AttendanceRecord? todayRecord;
      for (final item in historyRecords) {
        final dateVal = item.rawDate.isNotEmpty ? item.rawDate : item.date;
        if (dateVal.contains(todayStr)) {
          todayRecord = item;
          break;
        }
      }

      final currentMinutes = now.hour * 60 + now.minute;
      final s1EndMinutes = 12 * 60;
      final s2StartMinutes = 13 * 60;

      final checkin1 = todayRecord?.checkIn1;
      final checkout1 = todayRecord?.checkOut1;
      final checkin2 = todayRecord?.checkIn2;
      final checkout2 = todayRecord?.checkOut2;

      final bool hasCheckIn1 = checkin1 != null && checkin1.trim().isNotEmpty && checkin1 != '--:--' && checkin1 != '-';
      final bool hasCheckOut1 = checkout1 != null && checkout1.trim().isNotEmpty && checkout1 != '--:--' && checkout1 != '-';
      final bool hasCheckIn2 = checkin2 != null && checkin2.trim().isNotEmpty && checkin2 != '--:--' && checkin2 != '-';
      final bool hasCheckOut2 = checkout2 != null && checkout2.trim().isNotEmpty && checkout2 != '--:--' && checkout2 != '-';

      String determinedAction = 'checkin_1';

      if (hasCheckOut2 || (hasCheckIn1 && hasCheckOut1 && hasCheckIn2 && hasCheckOut2)) {
        determinedAction = 'completed';
      } else if (currentMinutes >= s1EndMinutes) {
        if (!hasCheckIn1) {
          if (!hasCheckIn2) {
            determinedAction = 'checkin_2';
          } else if (!hasCheckOut2) {
            determinedAction = 'checkout_2';
          } else {
            determinedAction = 'completed';
          }
        } else {
          if (!hasCheckOut1 && currentMinutes <= s2StartMinutes) {
            determinedAction = 'checkout_1';
          } else if (!hasCheckIn2) {
            determinedAction = 'checkin_2';
          } else if (!hasCheckOut2) {
            determinedAction = 'checkout_2';
          } else {
            determinedAction = 'completed';
          }
        }
      } else {
        if (!hasCheckIn1) {
          determinedAction = 'checkin_1';
        } else if (!hasCheckOut1) {
          determinedAction = 'checkout_1';
        } else if (!hasCheckIn2) {
          determinedAction = 'checkin_2';
        } else if (!hasCheckOut2) {
          determinedAction = 'checkout_2';
        } else {
          determinedAction = 'completed';
        }
      }

      if (mounted) {
        setState(() {
          _nextAction = determinedAction;
        });
      }
    } catch (_) {}
  }

  void _initCameraController() {
    if (!kIsWeb) {
      _cameraController = MobileScannerController(
        facing: CameraFacing.back,
        torchEnabled: false,
        formats: const [BarcodeFormat.qrCode],
        detectionSpeed: DetectionSpeed.normal,
        detectionTimeoutMs: 1500,
        autoStart: true,
      );
    }
  }

  Future<void> _startCamera() async {
    if (kIsWeb || _cameraController == null) return;
    try {
      if (!_cameraController!.value.isRunning) {
        await _cameraController!.start();
      }
    } catch (e) {
      debugPrint('Error starting camera: $e');
    }
  }

  Future<void> _stopCamera() async {
    if (kIsWeb || _cameraController == null) return;
    try {
      if (_cameraController!.value.isRunning) {
        await _cameraController!.stop();
      }
    } catch (e) {
      debugPrint('Error stopping camera: $e');
    }
  }

  void _startCameraTimer([int seconds = 30]) {
    _cancelCameraTimer();
    setState(() {
      _remainingSeconds = seconds;
      _statusMessage = null;
    });
    _setUnlocked(true);
    _cameraTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      if (_remainingSeconds <= 1) {
        timer.cancel();
        _cameraTimer = null;
        _setUnlocked(false);
        setState(() {
          _remainingSeconds = 0;
          _statusMessage = '⌛ ផុតកំណត់ពេលស្កេន (30 វិនាទី)! សូមចុចប៊ូតុង "${_getActionLabel(_nextAction)}" ម្តងទៀតដើម្បីបើក Camera';
        });
      } else {
        setState(() {
          _remainingSeconds--;
        });
      }
    });
  }

  void _cancelCameraTimer() {
    _cameraTimer?.cancel();
    _cameraTimer = null;
  }

  void _setUnlocked(bool unlocked) {
    if (!unlocked) {
      _cancelCameraTimer();
    }
    if (_isUnlocked == unlocked) return;
    setState(() {
      _isUnlocked = unlocked;
    });
    if (unlocked) {
      _startCamera();
    } else {
      _stopCamera();
    }
  }

  void _toggleTorch() async {
    if (_cameraController != null) {
      try {
        await _cameraController!.toggleTorch();
        setState(() {
          _isTorchOn = !_isTorchOn;
        });
      } catch (_) {}
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused) {
      _stopCamera();
    } else if (state == AppLifecycleState.resumed && _isUnlocked) {
      _startCamera();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _cancelCameraTimer();
    _positionSubscription?.cancel();
    _customQrController.dispose();
    _reasonController.dispose();
    _behalfStaffIdController.dispose();
    _cameraController?.dispose();
    super.dispose();
  }

  // Haversine distance formula in meters
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

  Future<void> _verifyBranchGeofence() async {
    if (!mounted) return;

    // 1. Request Camera Permission (Always needed)
    final cameraStatus = await Permission.camera.request();
    if (!cameraStatus.isGranted) {
      if (mounted) {
        _setUnlocked(false);
        setState(() {
          _isLoadingLocation = false;
          _isLocationVerified = false;
          _statusMessage = '❌ សូមអនុញ្ញាតឲ្យប្រើប្រាស់ Camera ដើម្បីស្កេន!';
        });
      }
      return;
    }

    if (widget.isLoginMode) {
      _setUnlocked(true);
      setState(() {
        _isLoadingLocation = false;
        _isLocationVerified = true;
        _statusMessage = '📷 សូមស្កេន QR Code បុគ្គលិកដើម្បី Login';
      });
      return;
    }

    // 2. Request Location Permission (Only needed for attendance geofence)
    final locationStatus = await Permission.locationWhenInUse.request();
    if (!locationStatus.isGranted) {
      if (mounted) {
        setState(() {
          _isLoadingLocation = false;
          _isUnlocked = false;
          _isLocationVerified = false;
          _statusMessage = '❌ សូមអនុញ្ញាតឲ្យប្រើប្រាស់ Location ដើម្បីផ្ទៀងផ្ទាត់ទីតាំង!';
        });
      }
      return;
    }

    // Start listening to real-time location changes if not already listening
    if (_positionSubscription == null) {
      _startLocationListening();
    }

    setState(() {
      _isLoadingLocation = true;
    });

    // 3. Fetch Real-Time GPS Coordinates (Unless manually simulated by developer buttons)
    if (!_isUserCustomLocation) {
      try {
        final position = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.high,
            timeLimit: Duration(seconds: 5),
          ),
        );
        _clientLat = position.latitude;
        _clientLng = position.longitude;
      } catch (e) {
        if (mounted) {
          setState(() {
            _isLoadingLocation = false;
            _isUnlocked = false;
            _isLocationVerified = false;
            _statusMessage = '❌ មិនអាចទាញយកទីតាំង GPS បានឡើយ! សូមប្រាកដថាបើក GPS លើទូរស័ព្ទ';
          });
        }
        return;
      }
    }

    try {
      final meResult = await _authRepository.getMe();
      if (meResult.success && meResult.user != null && mounted) {
        final authController = Get.find<AuthController>();
        authController.checkSavedSession();
      }
    } catch (_) {}

    if (!mounted) return;
    final authController = Get.find<AuthController>();
    final user = authController.user;
    final assignedBranchRaw = user?.branch ?? '';

    // Fetch branch location settings fresh from Database on launch and store in RAM, replacing old cached data
    if (!_hasFetchedInitially || _allKioskSettings.isEmpty) {
      if (authController.branchSettings.isNotEmpty && _allKioskSettings.isEmpty) {
        _allKioskSettings = List<Map<String, dynamic>>.from(authController.branchSettings);
      }
      try {
        final settingsRaw = await _authRepository.fetchKioskSettings();
        _allKioskSettings = settingsRaw.map((s) => Map<String, dynamic>.from(s)).toList();
        _hasFetchedInitially = true;
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

    // Real GPS coordinates are fetched at the start of _verifyBranchGeofence()

    Map<String, dynamic>? insideBranch;
    double? minDistance;
    Map<String, dynamic>? closestBranch;

    for (final setting in _employeeAssignedSettings) {
      final bLat = (setting['latitude'] as num).toDouble();
      final bLng = (setting['longitude'] as num).toDouble();
      final radius = (setting['radius'] as num).toDouble();
      final dist = _calculateDistance(_clientLat, _clientLng, bLat, bLng);

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

    if (insideBranch != null) {
      final branchId = (insideBranch['id'] ?? '').toString();
      final branchName = (insideBranch['name'] ?? '').toString();
      final branchToken = 'branch_qr:$branchId';

      if (mounted) {
        setState(() {
          _isLoadingLocation = false;
          _isLocationVerified = true;
          _matchedBranchName = branchName;
          _matchedBranchToken = branchToken;
          if (_statusMessage != null && _statusMessage!.startsWith('🔒 មិនគ្រប់លក្ខខណ្ឌ')) {
            _statusMessage = null;
          }
          if (_customQrController.text.isEmpty || _customQrController.text.startsWith('branch_qr:')) {
            _customQrController.text = branchToken;
          }
        });
      }
    } else {
      final closestName = closestBranch != null ? (closestBranch['name'] ?? '').toString() : (userBranchNames.isNotEmpty ? userBranchNames.first : 'Branch');
      final closestRadius = closestBranch != null ? (closestBranch['radius'] as num).toDouble() : 100.0;

      if (mounted) {
        _setUnlocked(false); // Force lock the camera preview feed!
        setState(() {
          _isLoadingLocation = false;
          _isLocationVerified = false;
          _matchedBranchName = closestName;
          _matchedBranchToken = closestBranch != null ? 'branch_qr:${closestBranch['id']}' : null;
          
          if (_employeeAssignedSettings.length > 1) {
            final comparisonList = _employeeAssignedSettings.map((setting) {
              final sName = (setting['name'] ?? '').toString();
              final bLat = (setting['latitude'] as num).toDouble();
              final bLng = (setting['longitude'] as num).toDouble();
              final radius = (setting['radius'] as num).toDouble();
              final dist = _calculateDistance(_clientLat, _clientLng, bLat, bLng);
              return '• $sName (${dist.toStringAsFixed(1)}m > ${radius.toStringAsFixed(0)}m)';
            }).toList();
            _statusMessage = '🔒 មិនគ្រប់លក្ខខណ្ឌទីតាំង! លោកអ្នកស្ថិតនៅក្រៅទីតាំងសាខា៖\n${comparisonList.join("\n")}';
          } else {
            _statusMessage = '🔒 មិនគ្រប់លក្ខខណ្ឌទីតាំង! លោកអ្នកស្ថិតនៅក្រៅទីតាំងសាខា $closestName (${minDistance?.toStringAsFixed(1)}m > ${closestRadius.toStringAsFixed(0)}m)';
          }
        });
      }
    }
  }

  void _startLocationListening() {
    _positionSubscription = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 3, // Receive updates when moving at least 3 meters
      ),
    ).listen((Position position) {
      if (!_isUserCustomLocation && mounted) {
        setState(() {
          _clientLat = position.latitude;
          _clientLng = position.longitude;
        });
        _verifyBranchGeofence();
      }
    }, onError: (e) {
      debugPrint('Error listening to location stream: $e');
    });
  }

  // --- Frontend Alignment: Verify Employee & Attendance History to Determine Action ---
  Future<void> _verifyEmployeeDirectly(String staffId) async {
    setState(() {
      _isVerifying = true;
    });

    try {
      final historyRecords = await _attendanceRepository.fetchHistoryRecords(staffId: staffId);

      // Find today's date string YYYY-MM-DD
      final now = DateTime.now();
      final todayStr = DateFormat('yyyy-MM-dd').format(now);

      AttendanceRecord? todayRecord;
      for (final item in historyRecords) {
        final dateVal = item.rawDate.isNotEmpty ? item.rawDate : item.date;
        if (dateVal.contains(todayStr)) {
          todayRecord = item;
          break;
        }
      }

      // Time in minutes from midnight for current actual Scan_Time
      final currentMinutes = now.hour * 60 + now.minute;

      // ⚙️ Shift definitions (in minutes) & Late Grace Period
      int s1StartMinutes = 8 * 60;       // Shift_In_1 (08:00 default)
      int s1EndMinutes = 12 * 60;       // Shift_Out_1 (12:00 default)
      int s2StartMinutes = 13 * 60;     // Shift_In_2 (13:00 default)
      int s2EndMinutes = 17 * 60;       // Shift_Out_2 (17:00 default)
      int lateGraceMinutes = 0;

      try {
        final cwh = await _attendanceRepository.fetchCompanyWorkHours();
        if (cwh != null) {
          if (cwh['shift1Start'] != null && (cwh['shift1Start'] as String).contains(':')) {
            final parts = (cwh['shift1Start'] as String).split(':');
            s1StartMinutes = int.parse(parts[0]) * 60 + int.parse(parts[1]);
          }
          if (cwh['shift1End'] != null && (cwh['shift1End'] as String).contains(':')) {
            final parts = (cwh['shift1End'] as String).split(':');
            s1EndMinutes = int.parse(parts[0]) * 60 + int.parse(parts[1]);
          }
          if (cwh['shift2Start'] != null && (cwh['shift2Start'] as String).contains(':')) {
            final parts = (cwh['shift2Start'] as String).split(':');
            s2StartMinutes = int.parse(parts[0]) * 60 + int.parse(parts[1]);
          }
          if (cwh['shift2End'] != null && (cwh['shift2End'] as String).contains(':')) {
            final parts = (cwh['shift2End'] as String).split(':');
            s2EndMinutes = int.parse(parts[0]) * 60 + int.parse(parts[1]);
          }
          if (cwh['lateGraceMinutes'] != null) {
            lateGraceMinutes = (cwh['lateGraceMinutes'] is num)
                ? (cwh['lateGraceMinutes'] as num).toInt()
                : (int.tryParse(cwh['lateGraceMinutes'].toString()) ?? 0);
          }
        }
      } catch (_) {}

      final checkin1 = todayRecord?.checkIn1;
      final checkout1 = todayRecord?.checkOut1;
      final checkin2 = todayRecord?.checkIn2;
      final checkout2 = todayRecord?.checkOut2;

      final bool hasCheckIn1 = checkin1 != null && checkin1.trim().isNotEmpty && checkin1 != '--:--' && checkin1 != '-';
      final bool hasCheckOut1 = checkout1 != null && checkout1.trim().isNotEmpty && checkout1 != '--:--' && checkout1 != '-';
      final bool hasCheckIn2 = checkin2 != null && checkin2.trim().isNotEmpty && checkin2 != '--:--' && checkin2 != '-';
      final bool hasCheckOut2 = checkout2 != null && checkout2.trim().isNotEmpty && checkout2 != '--:--' && checkout2 != '-';

      // 🔄 ដំណាក់កាលទី១៖ ការកំណត់មុខងារ Scan (Scan Type Detection)
      String determinedAction = 'checkin_1';

      if (hasCheckOut2 || (hasCheckIn1 && hasCheckOut1 && hasCheckIn2 && hasCheckOut2)) {
        determinedAction = 'completed';
      } else if (currentMinutes >= s1EndMinutes) {
        // ករណី Scan_Time >= Shift_Out_1 (ក្រោយចប់ Shift 1 / ម៉ោងថ្ងៃត្រង់ & រសៀល)
        if (!hasCheckIn1) {
          // IF Scan_Time > Shift 1 End ហើយ Check 1 (In/Out) = null ➔ ដំណើរការ Check In 2
          if (!hasCheckIn2) {
            determinedAction = 'checkin_2';
          } else if (!hasCheckOut2) {
            determinedAction = 'checkout_2';
          } else {
            determinedAction = 'completed';
          }
        } else {
          // Check 1 In មានទិន្នន័យ
          if (!hasCheckOut1 && currentMinutes <= s2StartMinutes) {
            // ចន្លោះម៉ោងសម្រាកថ្ងៃត្រង់ គាត់ស្កេនចេញទៅញ៉ាំបាយ
            determinedAction = 'checkout_1';
          } else if (!hasCheckIn2) {
            // ស្កេនចូលធ្វើការវេនរសៀល
            determinedAction = 'checkin_2';
          } else if (!hasCheckOut2) {
            // ស្កេនចេញទៅផ្ទះ
            determinedAction = 'checkout_2';
          } else {
            determinedAction = 'completed';
          }
        }
      } else {
        // ករណី Scan_Time < Shift_Out_1 (ពេលព្រឹក មុនចប់វេនទី១)
        if (!hasCheckIn1) {
          determinedAction = 'checkin_1';
        } else if (!hasCheckOut1) {
          determinedAction = 'checkout_1';
        } else if (!hasCheckIn2) {
          determinedAction = 'checkin_2';
        } else if (!hasCheckOut2) {
          determinedAction = 'checkout_2';
        } else {
          determinedAction = 'completed';
        }
      }

      if (determinedAction == 'completed') {
        _cancelCameraTimer();
        _setUnlocked(false); // Lock camera immediately!
        setState(() {
          _isVerifying = false;
          _nextAction = 'completed';
          _statusMessage = '⚠️ អ្នកបាន check គ្រប់ចំនួនរួចរាល់ហើយ សម្រាប់ថ្ងៃនេះ!';
        });
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('⚠️ អ្នកបាន check គ្រប់ចំនួនរួចរាល់ហើយ សម្រាប់ថ្ងៃនេះ!'),
              backgroundColor: AppColors.warning,
              duration: Duration(seconds: 3),
            ),
          );
        }
        return;
      }

      // 📝 ដំណាក់កាលទី២៖ លំហូរលក្ខខណ្ឌលម្អិត (Flow Condition Detail)
      bool requiresReason = false;
      String reasonType = 'late'; // 'late' or 'early'

      if (determinedAction == 'checkin_1') {
        // ១. សម្រាប់ Check In 1 (ចូលធ្វើការវេនព្រឹក)
        // IF Scan_Time > Shift_In_1 + lateGraceMinutes (មកយឺត)
        if (currentMinutes > (s1StartMinutes + lateGraceMinutes)) {
          requiresReason = true;
          reasonType = 'late';
        }
      } else if (determinedAction == 'checkout_1') {
        // ២. សម្រាប់ Check Out 1 (ចេញសម្រាកវេនព្រឹក)
        // IF Scan_Time < Shift_Out_1 (ចេញមុនម៉ោង / Early Leave)
        if (currentMinutes < s1EndMinutes) {
          requiresReason = true;
          reasonType = 'early';
        }
      } else if (determinedAction == 'checkin_2') {
        // ៣. សម្រាប់ Check In 2 (ចូលធ្វើការវេនរសៀល)
        // IF Scan_Time > Shift_In_2 + lateGraceMinutes (មកយឺត)
        if (currentMinutes > (s2StartMinutes + lateGraceMinutes)) {
          requiresReason = true;
          reasonType = 'late';
        }
      } else if (determinedAction == 'checkout_2') {
        // ៤. សម្រាប់ Check Out 2 (ចេញទៅផ្ទះវេនរសៀល)
        // IF Scan_Time < Shift_Out_2 (ចេញមុនម៉ោង)
        if (currentMinutes < s2EndMinutes) {
          requiresReason = true;
          reasonType = 'early';
        }
      }

      setState(() {
        _isVerifying = false;
        _nextAction = determinedAction;
        _reasonType = reasonType;
      });

      if (requiresReason) {
        _earlyCheckoutReason = '';
        _reasonController.clear();
        _setUnlocked(false); // Lock camera while filling form!
        _showReasonModalDialog();
      } else {
        _earlyCheckoutReason = '';
        if (_isLocationVerified || widget.isLoginMode) {
          _startCameraTimer(30); // Open Camera for 30 seconds countdown!
          setState(() {
            _statusMessage = null;
          });
        } else {
          _setUnlocked(false);
          setState(() {
            _statusMessage = '🔒 មិនអាចបើកកាមេរ៉ាស្កេនទេ! លោកអ្នកស្ថិតនៅក្រៅទីតាំងសាខា';
          });
        }
      }
    } catch (e) {
      setState(() {
        _isVerifying = false;
        _statusMessage = '❌ បរាជ័យក្នុងការផ្ទៀងផ្ទាត់ទិន្នន័យវត្តមាន';
      });
    }
  }

  String _getActionLabel(String actionKey) {
    switch (actionKey) {
      case 'checkin_1':
        return 'Check In 1';
      case 'checkout_1':
        return 'Check Out 1';
      case 'checkin_2':
        return 'Check In 2';
      case 'checkout_2':
        return 'Check Out 2';
      case 'completed':
        return 'អ្នកបាន check គ្រប់ចំនួន';
      default:
        return 'Check In/Out';
    }
  }

  Future<void> _handleCheckPress() async {
    // If next action is already completed and not scanning on behalf, block and keep locked!
    if (!_scanOnBehalf && _nextAction == 'completed') {
      _cancelCameraTimer();
      _setUnlocked(false); // Ensure camera is locked!
      setState(() {
        _statusMessage = '⚠️ អ្នកបាន check គ្រប់ចំនួនរួចរាល់ហើយ សម្រាប់ថ្ងៃនេះ!';
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('⚠️ អ្នកបាន check គ្រប់ចំនួនរួចរាល់ហើយ សម្រាប់ថ្ងៃនេះ!'),
            backgroundColor: AppColors.warning,
            duration: Duration(seconds: 3),
          ),
        );
      }
      return;
    }

    // 1. Verify location first if not already verified
    if (!_isLocationVerified && !widget.isLoginMode) {
      await _verifyBranchGeofence();
      if (!_isLocationVerified) {
        _setUnlocked(false);
        return;
      }
    }

    final user = Get.find<AuthController>().user;
    if (_scanOnBehalf) {
      _behalfStaffIdController.clear();
      _showBehalfModalDialog();
    } else {
      if (user != null && user.employeeId.isNotEmpty) {
        _verifyEmployeeDirectly(user.employeeId);
      } else {
        setState(() {
          _statusMessage = '❌ រកមិនឃើញព័ត៌មានគណនីរបស់អ្នកឡើយ!';
        });
      }
    }
  }

  void _showReasonModalDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        final isDark = Theme.of(ctx).brightness == Brightness.dark;
        final isLate = _reasonType == 'late';
        final title = isLate
            ? '⚠️ មកយឺតជាងម៉ោងកំណត់ (Late Reason)'
            : '📝 ចេញមុនម៉ោងកំណត់ (Early Leave Reason)';

        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          backgroundColor: isDark ? AppColors.cardDark : AppColors.cardLight,
          title: Row(
            children: [
              Icon(
                isLate ? LucideIcons.alertTriangle : LucideIcons.clock,
                color: AppColors.danger,
                size: 20,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppColors.danger),
                ),
              ),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                isLate
                    ? 'ម៉ោងចូលរបស់អ្នកគឺយឺតជាងម៉ោងកំណត់។ សូមបំពេញមូលហេតុនៃការមកយឺត (Note reason for being late) ដើម្បីបើក Camera ស្កេន៖'
                    : 'មិនទាន់ដល់ម៉ោងកំណត់ចេញនៅឡើយទេ។ សូមបំពេញមូលហេតុនៃការចេញមុនម៉ោង (Early Leave reason) ដើម្បីបើក Camera ស្កេន៖',
                style: const TextStyle(fontSize: 12, color: Colors.grey),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _reasonController,
                maxLines: 3,
                decoration: InputDecoration(
                  hintText: isLate ? 'បញ្ចូលមូលហេតុនៃការមកយឺត...' : 'បញ្ចូលមូលហេតុនៃការចេញមុនម៉ោង...',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  contentPadding: const EdgeInsets.all(12),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.pop(ctx);
                _setUnlocked(false); // Remains locked if cancelled
                setState(() {
                  _statusMessage = '🔒 កាមេរ៉ាត្រូវចាក់សោរ! សូមបំពេញមូលហេតុ និងចុច Submit ដើម្បីបើក Camera ស្កេន';
                });
              },
              child: const Text('បោះបង់', style: TextStyle(color: Colors.grey)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: () {
                final noteText = _reasonController.text.trim();
                if (noteText.isEmpty) {
                  ScaffoldMessenger.of(ctx).showSnackBar(
                    const SnackBar(
                      content: Text('សូមបញ្ចូលមូលហេតុជាមុនសិន!'),
                      backgroundColor: AppColors.danger,
                    ),
                  );
                  return;
                }
                _earlyCheckoutReason = noteText;
                Navigator.pop(ctx);
                if (_isLocationVerified || widget.isLoginMode) {
                  _startCameraTimer(30); // Open Camera ONLY after Submit clicked, for 30 seconds!
                  setState(() {
                    _statusMessage = null;
                  });
                } else {
                  _setUnlocked(false);
                  setState(() {
                    _statusMessage = '🔒 មិនអាចបើកកាមេរ៉ាស្កេនទេ! លោកអ្នកស្ថិតនៅក្រៅទីតាំងសាខា';
                  });
                }
              },
              child: const Text('យល់ព្រម & បើក Camera (Submit)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
            ),
          ],
        );
      },
    );
  }

  void _showBehalfModalDialog() {
    showDialog(
      context: context,
      builder: (ctx) {
        final isDark = Theme.of(ctx).brightness == Brightness.dark;
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          backgroundColor: isDark ? AppColors.cardDark : AppColors.cardLight,
          title: const Text('📋 ចុះវត្តមានជំនួសអ្នកដទៃ (Scan on Behalf)', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppColors.primary)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('សូមបញ្ចូលអត្តលេខបុគ្គលិក (Staff ID) ដែលអ្នកចង់ចុះវត្តមានជំនួស៖', style: TextStyle(fontSize: 12, color: Colors.grey)),
              const SizedBox(height: 12),
              TextField(
                controller: _behalfStaffIdController,
                decoration: InputDecoration(
                  hintText: 'ឧទាហរណ៍៖ EMP-1002',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  prefixIcon: const Icon(LucideIcons.userCheck, size: 18),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('បោះបង់', style: TextStyle(color: Colors.grey)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: () {
                final staffId = _behalfStaffIdController.text.trim();
                if (staffId.isEmpty) return;
                Navigator.pop(ctx);
                _verifyEmployeeDirectly(staffId);
              },
              child: const Text('ផ្ទៀងផ្ទាត់'),
            ),
          ],
        );
      },
    );
  }

  void _resetScanThrottle() {
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) {
        setState(() {
          _lastScanToken = null;
        });
      }
    });
  }

  void _handleScanAnyQRCode([String? customToken]) async {
    if (_isProcessing || _isSuccess) return;

    if (widget.isLoginMode) {
      final tokenToScan = (customToken != null && customToken.trim().isNotEmpty)
          ? customToken.trim()
          : _customQrController.text.trim();
      if (tokenToScan.isEmpty) return;

      setState(() {
        _isProcessing = true;
      });

      if (widget.onLoginQrScanned != null) {
        widget.onLoginQrScanned!(tokenToScan);
      }
      return;
    }

    if (!_isUnlocked) {
      setState(() {
        _statusMessage = '🔒 កាមេរ៉ាត្រូវចាក់សោរ! សូមចុចប៊ូតុង "${_getActionLabel(_nextAction)}" ដើម្បីបើក Camera ជាមុនសិន';
      });
      return;
    }

    final now = DateTime.now();
    if (customToken != null && _lastScanToken == customToken && _lastScanTime != null && now.difference(_lastScanTime!).inMilliseconds < 2500) {
      return;
    }
    _lastScanToken = customToken;
    _lastScanTime = now;

    if (!_isLocationVerified) {
      HapticFeedback.heavyImpact();
      setState(() {
        _isProcessing = false;
        _isSuccess = false;
        _statusMessage = '🔒 មិនអាចស្កែនបានទេ! លោកអ្នកស្ថិតនៅក្រៅទីតាំងសាខារបស់លោកអ្នក (${_matchedBranchName ?? "Branch"})';
      });
      _resetScanThrottle();
      _startCamera(); // Restart camera since verification failed!
      return;
    }

    final user = Get.find<AuthController>().user;
    String tokenToScan = (customToken != null && customToken.trim().isNotEmpty)
        ? customToken.trim()
        : (_customQrController.text.trim().isNotEmpty
            ? _customQrController.text.trim()
            : (_matchedBranchToken ?? 'branch_qr:default'));

    if (_allKioskSettings.isEmpty) {
      final settingsRaw = await _authRepository.fetchKioskSettings();
      _allKioskSettings = settingsRaw.map((s) => Map<String, dynamic>.from(s)).toList();
    }

    // If scanned token is raw UUID or setting ID without prefix, auto-prefix branch_qr:
    if (!tokenToScan.startsWith('branch_qr:') && !tokenToScan.startsWith('QR_TOKEN_')) {
      bool isBranchMatch = false;
      for (final setting in _allKioskSettings) {
        final sId = (setting['id'] ?? '').toString();
        final sName = (setting['name'] ?? '').toString();
        if (sId.toLowerCase() == tokenToScan.toLowerCase() ||
            sName.toLowerCase() == tokenToScan.toLowerCase() ||
            (sId.isNotEmpty && tokenToScan.toLowerCase().contains(sId.toLowerCase()))) {
          tokenToScan = 'branch_qr:$tokenToScan';
          isBranchMatch = true;
          break;
        }
      }
      if (!isBranchMatch && (tokenToScan.length >= 30 || tokenToScan.contains('-'))) {
        tokenToScan = 'branch_qr:$tokenToScan';
      }
    }

    final assignedBranchRaw = user?.branch ?? '';
    final userBranchNames = assignedBranchRaw
        .split(',')
        .map((b) => b.trim())
        .where((b) => b.isNotEmpty)
        .toList();

    if (tokenToScan.startsWith('branch_qr:')) {
      final scannedBranchId = tokenToScan.replaceFirst('branch_qr:', '').trim();

      Map<String, dynamic>? scannedSetting;
      for (final setting in _allKioskSettings) {
        final sId = (setting['id'] ?? '').toString();
        final sName = (setting['name'] ?? '').toString();
        if (sId.toLowerCase() == scannedBranchId.toLowerCase() ||
            sName.toLowerCase() == scannedBranchId.toLowerCase() ||
            (sId.isNotEmpty && scannedBranchId.toLowerCase().contains(sId.toLowerCase()))) {
          scannedSetting = setting;
          break;
        }
      }

      final scannedBranchName = scannedSetting != null
          ? (scannedSetting['name'] ?? '').toString()
          : (scannedBranchId == 'takeo_branch_id' ? 'Takeo Branch' : (scannedBranchId == 'pp_hq_id' ? 'Phnom Penh HQ' : scannedBranchId));

      final bool isAuthorizedBranch = userBranchNames.isEmpty || userBranchNames.any((ub) => _isBranchMatch(ub, scannedBranchName));

      if (!isAuthorizedBranch) {
        HapticFeedback.heavyImpact();
        setState(() {
          _isProcessing = false;
          _isSuccess = false;
          _statusMessage = '❌ QR Code នេះជា QR Code របស់សាខា "$scannedBranchName" ដែលមិនមែនជាសាខារបស់លោកអ្នកទេ (${userBranchNames.join(", ")})! មិនអាច Check-In/Out បានឡើយ';
        });
        _resetScanThrottle();
        _startCamera(); // Restart camera!
        return;
      }
    }

    setState(() {
      _isProcessing = true;
      _isSuccess = false;
    });

    final effectiveStaffId = (_scanOnBehalf && _behalfStaffIdController.text.trim().isNotEmpty)
        ? _behalfStaffIdController.text.trim()
        : user?.employeeId;

    final result = await _attendanceRepository.scanQRCode(
      tokenToScan,
      lat: _clientLat,
      lng: _clientLng,
      note: _earlyCheckoutReason.isNotEmpty ? _earlyCheckoutReason : null,
      staffId: effectiveStaffId,
      action: _nextAction,
    );

    if (mounted) {
      final attendanceController = Get.find<AttendanceController>();
      if (result['success'] == true) {
        await attendanceController.recordScanSuccess(action: result['action'] ?? _nextAction, staffId: effectiveStaffId);

        HapticFeedback.vibrate(); // Direct tactile validation response
        SystemSound.play(SystemSoundType.click); // Confirmation audio clip

        // Show Frontend Celebratory Success Dialog popup!
        final empData = result['employee'] ?? {};
        final name = empData['nameEn'] ?? empData['nameKh'] ?? user?.name ?? 'Employee User';
        final staffId = empData['staffId'] ?? effectiveStaffId ?? 'EMP-2026';
        final department = empData['department'] ?? user?.department ?? 'Engineering';
        final action = _getActionLabel(result['action'] ?? _nextAction);
        final timeString = DateFormat('hh:mm:ss a').format(DateTime.now());

        _showSuccessDialog({
          'name': name,
          'staffId': staffId,
          'department': department,
        }, action, timeString);

        _cancelCameraTimer();
        _setUnlocked(false); // Re-lock camera immediately after database insertion success!
        setState(() {
          _isProcessing = false;
          _isSuccess = true;

          // Clear cached geofence and branch details from RAM automatically!
          _allKioskSettings = [];
          _employeeAssignedSettings = [];
          _matchedBranchName = null;
          _matchedBranchToken = null;
          _isLocationVerified = false; // Reset verification state!
          _hasFetchedInitially = false; // Reset fetch flag for next scan session!
          _statusMessage = '🎉 ស្កេនបានជោគជ័យ! ($action)';
        });

        Future.delayed(const Duration(milliseconds: 3500), () {
          if (mounted) {
            setState(() {
              _isSuccess = false;
            });
            // Camera stays locked! Update next action for the user's next action click:
            _preEvaluateAction();
          }
        });
      } else {
        HapticFeedback.heavyImpact();
        setState(() {
          _isProcessing = false;
          _isSuccess = false;
          _statusMessage = '❌ ${result['message'] ?? 'QR Verification Failed'}';
        });
        _resetScanThrottle();
        _startCamera(); // Restart camera since verification failed!
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final langController = Get.find<LanguageController>();
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final now = DateTime.now();

    return Container(
      height: MediaQuery.of(context).size.height * 0.90,
      decoration: BoxDecoration(
        color: isDark ? AppColors.bgDark : AppColors.bgLight,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Stack(
        children: [
          Column(
            children: [
              const SizedBox(height: 12),
              Center(
                child: Container(
                  width: 44,
                  height: 5,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade400,
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
              ),
              const SizedBox(height: 12),

              // Digital Clock Header
              Column(
                children: [
                  Text(
                    DateFormat('hh:mm:ss a').format(now),
                    style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800, letterSpacing: 1.5),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    DateFormat('EEEE, MMMM d, yyyy').format(now),
                    style: const TextStyle(fontSize: 12, color: Colors.grey),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Direct Scanner Tab
              Expanded(
                child: _buildQrScannerTab(langController, isDark),
              ),
            ],
          ),

          // Success Overlay Modal (Replaced with Dialog popup)
        ],
      ),
    );
  }

  // --- 1. Main Scanner View Frame ---
  Widget _buildQrScannerTab(LanguageController langController, bool isDark) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: SingleChildScrollView(
        child: Column(
          children: [
            // Camera Controls (Torch & Status)
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                IconButton(
                  onPressed: _toggleTorch,
                  icon: Icon(
                    _isTorchOn ? LucideIcons.flashlight : LucideIcons.flashlightOff,
                    color: _isTorchOn ? AppColors.warning : Colors.grey,
                  ),
                  tooltip: 'Flashlight',
                ),
                const SizedBox(width: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  decoration: BoxDecoration(
                    color: (_isUnlocked
                            ? (_remainingSeconds <= 5 ? AppColors.danger : AppColors.success)
                            : Colors.grey)
                        .withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: _isUnlocked
                          ? (_remainingSeconds <= 5 ? AppColors.danger : AppColors.success)
                          : Colors.transparent,
                      width: 1,
                    ),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: _isUnlocked
                              ? (_remainingSeconds <= 5 ? AppColors.danger : AppColors.success)
                              : Colors.grey,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        _isUnlocked ? 'Camera Active (${_remainingSeconds}s)' : 'Camera Locked',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: _isUnlocked
                              ? (_remainingSeconds <= 5 ? AppColors.danger : AppColors.success)
                              : Colors.grey,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),

            // Camera Viewfinder Window Frame
            Stack(
              alignment: Alignment.center,
              children: [
                Container(
                  width: 240,
                  height: 240,
                  decoration: BoxDecoration(
                    color: Colors.black,
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(
                      color: _isSuccess ? AppColors.success : (_isUnlocked ? AppColors.primary : Colors.grey),
                      width: 2.5,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: (_isSuccess ? AppColors.success : (_isUnlocked ? AppColors.primary : Colors.grey)).withValues(alpha: 0.25),
                        blurRadius: 20,
                        spreadRadius: 2,
                      ),
                    ],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(22),
                    child: Stack(
                      children: [
                        // Web or Mobile Camera Preview
                        if (kIsWeb)
                          WebCameraPreview(
                            isFrontCamera: _isFrontCamera,
                            onQRDetected: (decodedText) {
                              if (_isUnlocked && !_isProcessing && !_isSuccess) {
                                _customQrController.text = decodedText;
                                _handleScanAnyQRCode(decodedText);
                              }
                            },
                          )
                        else
                          MobileScanner(
                            controller: _cameraController,
                            fit: BoxFit.cover,
                            errorBuilder: (context, error, child) {
                              return Container(
                                color: Colors.black,
                                child: Center(
                                  child: Padding(
                                    padding: const EdgeInsets.all(12),
                                    child: Column(
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      children: [
                                        const Icon(LucideIcons.cameraOff, color: Colors.white70, size: 32),
                                        const SizedBox(height: 8),
                                        Text(
                                          'Camera: ${error.errorCode.name}',
                                          textAlign: TextAlign.center,
                                          style: const TextStyle(color: Colors.white70, fontSize: 11),
                                        ),
                                        const SizedBox(height: 8),
                                        ElevatedButton(
                                          style: ElevatedButton.styleFrom(
                                            backgroundColor: AppColors.primary,
                                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                                          ),
                                          onPressed: () {
                                            _cameraController?.start();
                                          },
                                          child: const Text('Restart Camera', style: TextStyle(color: Colors.white, fontSize: 11)),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              );
                            },
                            onDetect: (capture) {
                              if (!_isUnlocked || _isProcessing || _isSuccess) return;
                              final List<Barcode> barcodes = capture.barcodes;
                              for (final barcode in barcodes) {
                                final String? rawValue = barcode.rawValue;
                                if (rawValue != null && rawValue.isNotEmpty) {
                                  HapticFeedback.lightImpact();
                                  _stopCamera();
                                  _customQrController.text = rawValue;
                                  _handleScanAnyQRCode(rawValue);
                                  break;
                                }
                              }
                            },
                          ),

                        // Locked Screen Overlay (Only on top when locked)
                        if (!_isUnlocked)
                          Container(
                            color: isDark ? const Color(0xFF0F172A) : Colors.grey.shade900,
                            child: Center(
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(16),
                                    decoration: BoxDecoration(
                                      color: Colors.white.withValues(alpha: 0.08),
                                      shape: BoxShape.circle,
                                    ),
                                    child: const Icon(LucideIcons.lock, color: Colors.white60, size: 40),
                                  ),
                                  const SizedBox(height: 12),
                                  const Text(
                                    'Camera Locked',
                                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                                  ),
                                  const SizedBox(height: 6),
                                  const Padding(
                                    padding: EdgeInsets.symmetric(horizontal: 20),
                                    child: Text(
                                      'Please Click Button "Check" to Open Camera',
                                      textAlign: TextAlign.center,
                                      style: TextStyle(color: Colors.grey, fontSize: 11),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),

                        // Corner Viewfinder Brackets Overlay
                        CustomPaint(
                          size: const Size(240, 240),
                          painter: ViewfinderCornerPainter(
                            color: _isSuccess ? AppColors.success : (_isUnlocked ? AppColors.primary : Colors.grey),
                          ),
                        ),

                        // Processing API Loading Overlay
                        if (_isProcessing)
                          Container(
                            color: Colors.black.withValues(alpha: 0.65),
                            child: Center(
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  const CircularProgressIndicator(
                                    valueColor: AlwaysStoppedAnimation<Color>(AppColors.primary),
                                    strokeWidth: 3,
                                  ),
                                  const SizedBox(height: 16),
                                  const Text(
                                    'កំពុងផ្ទៀងផ្ទាត់...',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 14,
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

                // Animated Laser Scanning Line (Only when unlocked!)
                if (_isUnlocked && !_isSuccess)
                  Container(
                    width: 200,
                    height: 3,
                    decoration: BoxDecoration(
                      color: AppColors.primaryLight,
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.primaryLight.withValues(alpha: 0.9),
                          blurRadius: 10,
                          spreadRadius: 3,
                        ),
                      ],
                    ),
                  ).animate(onPlay: (c) => c.repeat(reverse: true)).slideY(begin: -36, end: 36, duration: 1600.ms),
              ],
            ),
            const SizedBox(height: 14),

            if (_isLoadingLocation)
              const Padding(
                padding: EdgeInsets.only(bottom: 12),
                child: Center(
                  child: SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: AppColors.primary,
                    ),
                  ),
                ),
              )
            else if (_statusMessage != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(
                  _statusMessage!,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: _isSuccess ? AppColors.success : AppColors.danger,
                    fontWeight: FontWeight.bold,
                    fontSize: 12,
                  ),
                ),
              ),

            // Primary "Check" Action Button (Matching Frontend Kiosk Purple Gradient)
            if (!_isUnlocked) ...[
              SizedBox(
                width: double.infinity,
                child: Container(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: (_nextAction == 'completed' && !_scanOnBehalf)
                          ? [const Color(0xFF059669), const Color(0xFF10B981)]
                          : [const Color(0xFF4F46E5), const Color(0xFF7C3AED)],
                    ),
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: ((_nextAction == 'completed' && !_scanOnBehalf)
                                ? const Color(0xFF059669)
                                : const Color(0xFF4F46E5))
                            .withValues(alpha: 0.35),
                        blurRadius: 16,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.transparent,
                      shadowColor: Colors.transparent,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                    onPressed: _isVerifying
                        ? null
                        : () {
                            _handleCheckPress();
                          },
                    child: _isVerifying
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                          )
                        : Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                (_nextAction == 'completed' && !_scanOnBehalf)
                                    ? LucideIcons.checkCircle2
                                    : LucideIcons.camera,
                                size: 20,
                                color: Colors.white,
                              ),
                              const SizedBox(width: 8),
                              Text(
                                _getActionLabel(_nextAction),
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                              ),
                            ],
                          ),
                  ),
                ),
              ),
            ] else ...[
              // Active Action Label, Timer Countdown & Re-lock Button
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: (_remainingSeconds <= 5 ? AppColors.danger : AppColors.primary).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: (_remainingSeconds <= 5 ? AppColors.danger : AppColors.primary).withValues(alpha: 0.3),
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      LucideIcons.timer,
                      size: 16,
                      color: _remainingSeconds <= 5 ? AppColors.danger : AppColors.primary,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'ស្កេនក្នុងរយះពេល៖ ${_remainingSeconds}s (${_getActionLabel(_nextAction)})',
                      style: TextStyle(
                        color: _remainingSeconds <= 5 ? AppColors.danger : AppColors.primary,
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              TextButton.icon(
                onPressed: () => _setUnlocked(false),
                icon: const Icon(LucideIcons.lock, size: 14, color: Colors.grey),
                label: const Text('ចាក់សោឡើងវិញ (Lock Camera)', style: TextStyle(color: Colors.grey, fontSize: 11)),
              ),
            ],
            const SizedBox(height: 10),

            // GPS Simulator Switch
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: isDark ? Colors.black26 : Colors.grey.shade100,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(LucideIcons.mapPin, size: 12, color: AppColors.primary),
                  const SizedBox(width: 4),
                  const Text('GPS Sim: ', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600)),
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
                    child: Text(
                      'In Branch',
                      style: TextStyle(
                        fontSize: 10,
                        color: _isLocationVerified ? AppColors.success : Colors.grey,
                        fontWeight: _isLocationVerified ? FontWeight.bold : FontWeight.normal,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: () {
                      _isUserCustomLocation = true;
                      _clientLat = 0.0;
                      _clientLng = 0.0;
                      _verifyBranchGeofence();
                    },
                    child: Text(
                      'Out of Branch',
                      style: TextStyle(
                        fontSize: 10,
                        color: !_isLocationVerified ? AppColors.danger : Colors.grey,
                        fontWeight: !_isLocationVerified ? FontWeight.bold : FontWeight.normal,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // --- 3. Frontend Success Dialog popup 🎉 ---
  void _showSuccessDialog(Map<String, dynamic> empData, String actionLabel, String timeStr) {
    if (!mounted) return;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        final isDark = Theme.of(ctx).brightness == Brightness.dark;
        
        // Auto-dismiss the dialog after 3.5 seconds
        Future.delayed(const Duration(milliseconds: 3500), () {
          if (ctx.mounted) {
            Navigator.of(ctx).pop();
          }
        });

        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          backgroundColor: isDark ? AppColors.cardDark : AppColors.cardLight,
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('🎉', style: TextStyle(fontSize: 54)).animate().scale(duration: 500.ms),
              const SizedBox(height: 12),
              const Text(
                'ស្កេនបានជោគជ័យ!',
                style: TextStyle(color: AppColors.success, fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const Text(
                'Scan Success',
                style: TextStyle(color: Colors.grey, fontSize: 12, fontWeight: FontWeight.w500),
              ),
              const SizedBox(height: 20),

              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: isDark ? Colors.black.withValues(alpha: 0.2) : Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
                ),
                child: Column(
                  children: [
                    const Text('ឈ្មោះបុគ្គលិក (Employee):', style: TextStyle(fontSize: 10, color: Colors.grey)),
                    const SizedBox(height: 4),
                    Text(
                      empData['name'] ?? 'Employee User',
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                      textAlign: TextAlign.center,
                    ),
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 8),
                      child: Divider(height: 1),
                    ),
                    _buildInfoRow('អត្តលេខ (ID):', empData['staffId'] ?? 'EMP-2026'),
                    const SizedBox(height: 6),
                    _buildInfoRow('ផ្នែក (Dept):', empData['department'] ?? 'Engineering'),
                    const SizedBox(height: 6),
                    _buildInfoRow('សកម្មភាព (Action):', actionLabel, color: AppColors.success),
                    const SizedBox(height: 6),
                    _buildInfoRow('ម៉ោងស្កេន (Time):', timeStr),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: () {
                    Navigator.of(ctx).pop();
                  },
                  child: const Text('យល់ព្រម (OK)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                ),
              ),
            ],
          ),
        );
      },
    );
  }



  Widget _buildInfoRow(String label, String value, {Color? color}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(fontSize: 12, color: Colors.grey)),
        Text(value, style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: color)),
      ],
    );
  }
}



// Custom Painter for 4 Corner Brackets on Camera Viewfinder
class ViewfinderCornerPainter extends CustomPainter {
  final Color color;
  final double cornerLength;
  final double strokeWidth;

  ViewfinderCornerPainter({
    required this.color,
    this.cornerLength = 28.0,
    this.strokeWidth = 4.0,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final w = size.width;
    final h = size.height;
    final l = cornerLength;
    const offset = 12.0;

    // Top Left Corner
    canvas.drawLine(const Offset(offset, offset), Offset(offset + l, offset), paint);
    canvas.drawLine(const Offset(offset, offset), Offset(offset, offset + l), paint);

    // Top Right Corner
    canvas.drawLine(Offset(w - offset, offset), Offset(w - offset - l, offset), paint);
    canvas.drawLine(Offset(w - offset, offset), Offset(w - offset, offset + l), paint);

    // Bottom Left Corner
    canvas.drawLine(Offset(offset, h - offset), Offset(offset + l, h - offset), paint);
    canvas.drawLine(Offset(offset, h - offset), Offset(offset, h - offset - l), paint);

    // Bottom Right Corner
    canvas.drawLine(Offset(w - offset, h - offset), Offset(w - offset - l, h - offset), paint);
    canvas.drawLine(Offset(w - offset, h - offset), Offset(w - offset, h - offset - l), paint);
  }

  @override
  bool shouldRepaint(covariant ViewfinderCornerPainter oldDelegate) {
    return oldDelegate.color != color;
  }
}

