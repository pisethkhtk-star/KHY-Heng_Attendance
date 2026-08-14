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
import '../core/services/api_service.dart';

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
  final TextEditingController _customQrController = TextEditingController();
  final TextEditingController _reasonController = TextEditingController();
  final TextEditingController _behalfStaffIdController = TextEditingController();

  // Mobile Scanner Controller persistent state
  MobileScannerController? _cameraController;
  bool _isCameraRunning = false;

  // Frontend Kiosk State Alignment
  bool _isUnlocked = false; // Camera lock state, default locked until location/login mode is verified!
  bool _scanOnBehalf = false; // Scan on behalf checkbox
  bool _isVerifying = false;
  bool _isProcessing = false;
  String? _statusMessage;
  bool _isSuccess = false;
  bool _isTorchOn = false;
  bool _isFrontCamera = false;

  // Next action determined from attendance history
  String _nextAction = 'checkin_1'; // checkin_1, checkout_1, checkin_2, checkout_2
  String _reasonType = 'late'; // 'late' or 'early'
  String _earlyCheckoutReason = '';

  // Geofence & Location verification state
  bool _isLocationVerified = false;
  String? _matchedBranchName;
  String? _matchedBranchToken;
  double? _closestBranchDistance;
  double? _closestBranchRadius;

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
    });
  }

  void _initCameraController() {
    if (!kIsWeb) {
      _cameraController = MobileScannerController(
        facing: CameraFacing.back,
        torchEnabled: false,
        formats: const [BarcodeFormat.qrCode],
        detectionSpeed: DetectionSpeed.normal,
        detectionTimeoutMs: 1500, // Throttling scans of the same QR code
        cameraResolution: const Size(1280, 720), // Optimal resolution for fast detection
      );
    }
  }

  Future<void> _startCamera() async {
    if (kIsWeb || _cameraController == null || _isCameraRunning) return;
    try {
      await _cameraController!.start();
      _isCameraRunning = true;
    } catch (e) {
      debugPrint('Error starting camera: $e');
    }
  }

  Future<void> _stopCamera() async {
    if (kIsWeb || _cameraController == null || !_isCameraRunning) return;
    try {
      await _cameraController!.stop();
      _isCameraRunning = false;
    } catch (e) {
      debugPrint('Error stopping camera: $e');
    }
  }

  void _setUnlocked(bool unlocked) {
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
      await _cameraController!.toggleTorch();
      setState(() {
        _isTorchOn = !_isTorchOn;
      });
    }
  }

  void _switchCamera() async {
    if (_cameraController != null) {
      await _cameraController!.switchCamera();
      setState(() {
        _isFrontCamera = !_isFrontCamera;
      });
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
          _isLocationVerified = false;
          _statusMessage = '❌ សូមអនុញ្ញាតឲ្យប្រើប្រាស់ Camera ដើម្បីស្កេន!';
        });
      }
      return;
    }

    if (widget.isLoginMode) {
      _setUnlocked(true);
      setState(() {
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
      _statusMessage = '🔍 កំពុងទាញទិន្នន័យសាខាពី Database...';
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
            _isUnlocked = false;
            _isLocationVerified = false;
            _statusMessage = '❌ មិនអាចទាញយកទីតាំង GPS បានឡើយ! សូមប្រាកដថាបើក GPS លើទូរស័ព្ទ';
          });
        }
        return;
      }
    }

    try {
      final meResult = await ApiService.getMe();
      if (meResult['success'] == true && meResult['user'] != null && mounted) {
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
        final settingsRaw = await ApiService.fetchKioskSettings();
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
      final radius = (insideBranch['radius'] as num).toDouble();

      if (mounted) {
        _setUnlocked(true); // Unlock the camera preview feed!
        setState(() {
          _isLocationVerified = true;
          _matchedBranchName = branchName;
          _matchedBranchToken = branchToken;
          _closestBranchDistance = minDistance;
          _closestBranchRadius = radius;
          _statusMessage = null;
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
          _isLocationVerified = false;
          _matchedBranchName = closestName;
          _matchedBranchToken = closestBranch != null ? 'branch_qr:${closestBranch['id']}' : null;
          _closestBranchDistance = minDistance;
          _closestBranchRadius = closestRadius;
          
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
      _statusMessage = '🔍 កំពុងផ្ទៀងផ្ទាត់ទិន្នន័យវត្តមានសម្រាប់អត្តលេខ $staffId...';
    });

    try {
      final historyRecords = await ApiService.fetchHistoryRecords(staffId: staffId);

      // Find today's date string YYYY-MM-DD
      final now = DateTime.now();
      final todayStr = DateFormat('yyyy-MM-dd').format(now);

      Map<String, dynamic>? todayRecord;
      for (final item in historyRecords) {
        final dateVal = (item['attendanceDate'] ?? item['date'] ?? '').toString();
        if (dateVal.contains(todayStr)) {
          todayRecord = Map<String, dynamic>.from(item);
          break;
        }
      }

      // Time parsing helper
      int timeToMinutes(String? tStr) {
        if (tStr == null || tStr.isEmpty) return 0;
        try {
          final parts = tStr.split(':').map((e) => int.parse(e.replaceAll(RegExp(r'[^0-9]'), ''))).toList();
          return parts[0] * 60 + (parts.length > 1 ? parts[1] : 0);
        } catch (_) {
          return 0;
        }
      }

      final currentTimeStr = DateFormat('HH:mm').format(now);
      final currentMinutes = timeToMinutes(currentTimeStr);

      final s1StartMinutes = timeToMinutes('08:00');
      final s1EndMinutes = timeToMinutes('12:00');
      final s2StartMinutes = timeToMinutes('13:00');
      final s2EndMinutes = timeToMinutes('17:00');

      final checkin1 = todayRecord?['checkin1'] ?? todayRecord?['checkIn1'];
      final checkout1 = todayRecord?['checkout1'] ?? todayRecord?['checkOut1'];
      final checkin2 = todayRecord?['checkin2'] ?? todayRecord?['checkIn2'];
      final checkout2 = todayRecord?['checkout2'] ?? todayRecord?['checkOut2'];

      String determinedAction = 'checkin_1';

      if (checkin2 != null && checkout2 == null) {
        determinedAction = 'checkout_2';
      } else if (checkout1 != null || (currentMinutes >= s1EndMinutes && checkin1 == null)) {
        if (checkin2 == null) {
          determinedAction = 'checkin_2';
        } else {
          determinedAction = 'completed';
        }
      } else if (checkin1 != null && checkout1 == null) {
        final midpoint = s1EndMinutes + (s2StartMinutes - s1EndMinutes) / 2;
        if (currentMinutes < midpoint) {
          determinedAction = 'checkout_1';
        } else {
          if (checkin2 == null) {
            determinedAction = 'checkin_2';
          } else {
            determinedAction = 'completed';
          }
        }
      } else if (checkin1 == null && currentMinutes < s1EndMinutes) {
        determinedAction = 'checkin_1';
      } else {
        if (checkin1 == null) {
          determinedAction = 'checkin_1';
        } else if (checkout1 == null) {
          determinedAction = 'checkout_1';
        } else if (checkin2 == null) {
          determinedAction = 'checkin_2';
        } else if (checkout2 == null) {
          determinedAction = 'checkout_2';
        } else {
          determinedAction = 'completed';
        }
      }

      if (determinedAction == 'completed') {
        setState(() {
          _isVerifying = false;
          _statusMessage = '⚠️ អ្នកធ្លាប់បាន check គ្រប់ចំនួន ៤ ដងរួចរាល់ហើយ សម្រាប់ថ្ងៃនេះ!';
        });
        return;
      }

      bool isLate = false;
      bool isEarly = false;

      if (determinedAction == 'checkin_1' && currentMinutes > s1StartMinutes) {
        isLate = true;
      } else if (determinedAction == 'checkin_2' && currentMinutes > s2StartMinutes) {
        isLate = true;
      } else if (determinedAction == 'checkout_1' && currentMinutes < s1EndMinutes) {
        isEarly = true;
      } else if (determinedAction == 'checkout_2' && currentMinutes < s2EndMinutes) {
        isEarly = true;
      }

      setState(() {
        _isVerifying = false;
        _nextAction = determinedAction;
      });

      if (isLate) {
        _reasonType = 'late';
        _earlyCheckoutReason = '';
        _reasonController.clear();
        _setUnlocked(false);
        _showReasonModalDialog();
      } else if (isEarly) {
        _reasonType = 'early';
        _earlyCheckoutReason = '';
        _reasonController.clear();
        _setUnlocked(false);
        _showReasonModalDialog();
      } else {
        _earlyCheckoutReason = '';
        if (_isLocationVerified) {
          _setUnlocked(true); // Unlock camera for normal on-time checkin/checkout!
          setState(() {
            _statusMessage = '✅ ផ្ទៀងផ្ទាត់ជោគជ័យ! បើកកាមេរ៉ាស្កេន (សកម្មភាព៖ ${_getActionLabel(determinedAction)})';
          });
        } else {
          _setUnlocked(false); // Keep camera locked!
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
        return 'Check In 1 (ព្រឹក)';
      case 'checkout_1':
        return 'Check Out 1 (ថ្ងៃត្រង់)';
      case 'checkin_2':
        return 'Check In 2 (រសៀល)';
      case 'checkout_2':
        return 'Check Out 2 (ល្ងាច)';
      default:
        return 'Check In/Out';
    }
  }

  void _handleCheckPress() {
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
        final title = _reasonType == 'late'
            ? '⚠️ មកយឺតជាងម៉ោងកំណត់ (Late Check-in Note)'
            : '📝 មិនទាន់ដល់ម៉ោង Check-out (Early Check-out Note)';

        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          backgroundColor: isDark ? AppColors.cardDark : AppColors.cardLight,
          title: Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppColors.danger)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                _reasonType == 'late'
                    ? 'ម៉ោងចូលរបស់អ្នកគឺយឺតជាងម៉ោងកំណត់។ សូមបំពេញ Note / មូលហេតុនៃការមកយឺត៖'
                    : 'មិនទាន់ដល់ម៉ោងកំណត់ចេញពីធ្វើការនៅឡើយទេ។ សូមបំពេញ Note / មូលហេតុនៃការចាកចេញមុនម៉ោង និងចុច "Done" ដើម្បីអាចស្កេន Check-Out បាន៖',
                style: const TextStyle(fontSize: 12, color: Colors.grey),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _reasonController,
                maxLines: 3,
                decoration: InputDecoration(
                  hintText: 'បញ្ចូល Note / មូលហេតុទីនេះ...',
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
                  _statusMessage = '🔒 កាមេរ៉ាត្រូវចាក់សោរ! សូមបំពេញ Note និងចុច Done ដើម្បីបើក Camera ស្កេន Check-Out';
                });
              },
              child: const Text('បោះបង់', style: TextStyle(color: Colors.grey)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: () {
                final noteText = _reasonController.text.trim();
                if (noteText.isEmpty) {
                  ScaffoldMessenger.of(ctx).showSnackBar(
                    const SnackBar(
                      content: Text('សូមបញ្ចូល Note / មូលហេតុមុននឹងចុច Done!'),
                      backgroundColor: AppColors.danger,
                    ),
                  );
                  return;
                }
                _earlyCheckoutReason = noteText;
                Navigator.pop(ctx);
                if (_isLocationVerified) {
                  _setUnlocked(true); // Unlock Camera ONLY after Done clicked!
                  setState(() {
                    _statusMessage = '✅ បានរក្សាទុក Note រួចរាល់! អាចស្កេន Check-Out បានហើយ (${_getActionLabel(_nextAction)})';
                  });
                } else {
                  _setUnlocked(false); // Keep camera locked if out of branch!
                  setState(() {
                    _statusMessage = '🔒 មិនអាចបើកកាមេរ៉ាស្កេនទេ! លោកអ្នកស្ថិតនៅក្រៅទីតាំងសាខា';
                  });
                }
              },
              child: const Text('Done', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
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
        _statusMessage = '🔍 កំពុង Login តាមរយៈ QR Code...';
      });

      if (widget.onLoginQrScanned != null) {
        widget.onLoginQrScanned!(tokenToScan);
      }
      return;
    }

    if (!_isUnlocked) {
      if (_isLocationVerified) {
        _setUnlocked(true);
      } else {
        setState(() {
          _statusMessage = '🔒 កាមេរ៉ាត្រូវចាក់សោរ! សូមចុចប៊ូតុង "Check" ដើម្បីបើក Camera ជាមុនសិន';
        });
        return;
      }
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
      final settingsRaw = await ApiService.fetchKioskSettings();
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
      _statusMessage = '🔍 កំពុងផ្ទៀងផ្ទាត់កូដ QR ($tokenToScan)...';
      _isSuccess = false;
    });

    final result = await ApiService.scanQRCode(
      tokenToScan,
      lat: _clientLat,
      lng: _clientLng,
      note: _earlyCheckoutReason.isNotEmpty ? _earlyCheckoutReason : null,
      staffId: user?.employeeId,
      action: _getActionLabel(_nextAction),
    );

    if (mounted) {
      final attendanceController = Get.find<AttendanceController>();
      if (result['success'] == true) {
        await attendanceController.recordScanSuccess(action: result['action'], staffId: user?.employeeId);

        HapticFeedback.vibrate(); // Direct tactile validation response
        SystemSound.play(SystemSoundType.click); // Confirmation audio clip

        // Show Frontend Celebratory Success Dialog popup!
        final empData = result['employee'] ?? {};
        final name = empData['nameEn'] ?? empData['nameKh'] ?? user?.name ?? 'Employee User';
        final staffId = empData['staffId'] ?? user?.employeeId ?? 'EMP-2026';
        final department = empData['department'] ?? user?.department ?? 'Engineering';
        final action = result['action'] ?? _getActionLabel(_nextAction);
        final timeString = DateFormat('hh:mm:ss a').format(DateTime.now());

        _showSuccessDialog({
          'name': name,
          'staffId': staffId,
          'department': department,
        }, action, timeString);

        _setUnlocked(false); // Re-lock camera immediately after success!
        setState(() {
          _isProcessing = false;
          _isSuccess = true;

          // Clear cached geofence and branch details from RAM automatically!
          _allKioskSettings = [];
          _employeeAssignedSettings = [];
          _matchedBranchName = null;
          _matchedBranchToken = null;
          _closestBranchDistance = null;
          _closestBranchRadius = null;
          _isLocationVerified = false; // Reset verification state!
          _hasFetchedInitially = false; // Reset fetch flag for next scan session!
          _statusMessage = '🎉 ស្កេនបានជោគជ័យ! ($action)';
        });

        Future.delayed(const Duration(milliseconds: 3500), () {
          if (mounted) {
            setState(() {
              _isSuccess = false;
            });
            _setUnlocked(_isLocationVerified); // Auto re-unlock camera only if location is verified!
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

              // Kiosk Digital Clock & GPS Status Header Banner (Matching Frontend)
              Column(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(LucideIcons.clock, size: 14, color: AppColors.primary),
                        SizedBox(width: 6),
                        Text('KIOSK ACTIVE scan mode', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.primary)),
                      ],
                    ),
                  ),
                  const SizedBox(height: 6),

                  // Geolocation Status Chip
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                    decoration: BoxDecoration(
                      color: (_isLocationVerified ? AppColors.success : AppColors.danger).withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: (_isLocationVerified ? AppColors.success : AppColors.danger).withValues(alpha: 0.3)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(LucideIcons.mapPin, size: 12, color: _isLocationVerified ? AppColors.success : AppColors.danger),
                        const SizedBox(width: 4),
                        Text(
                          _isLocationVerified
                              ? '📍 GPS Active (${_clientLat.toStringAsFixed(4)}, ${_clientLng.toStringAsFixed(4)})'
                              : '⚠️ GPS Offline / Out of Branch (${_matchedBranchName ?? "Branch"}${_closestBranchDistance != null ? " ${_closestBranchDistance!.toStringAsFixed(0)}m / ${_closestBranchRadius?.toStringAsFixed(0) ?? 100}m" : ""})',
                          style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: _isLocationVerified ? AppColors.success : AppColors.danger),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 6),

                  Text(
                    DateFormat('hh:mm:ss a').format(now),
                    style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800, letterSpacing: 1.5),
                  ),
                  Text(
                    DateFormat('EEEE, MMMM d, yyyy').format(now),
                    style: const TextStyle(fontSize: 11, color: Colors.grey),
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
            // Camera Controls (Torch & Switch)
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
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: (_isUnlocked ? AppColors.success : Colors.grey).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: _isUnlocked ? AppColors.success : Colors.grey,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        _isUnlocked ? 'Camera Active' : 'Camera Locked',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: _isUnlocked ? AppColors.success : Colors.grey,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                IconButton(
                  onPressed: _switchCamera,
                  icon: Icon(
                    LucideIcons.camera,
                    color: _isFrontCamera ? AppColors.accent : Colors.grey,
                  ),
                  tooltip: 'Switch Camera',
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
                        // Locked Screen Overlay (Matching Frontend Kiosk Locked View)
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
                          )
                        else if (kIsWeb)
                          WebCameraPreview(
                            isFrontCamera: _isFrontCamera,
                            onQRDetected: (decodedText) {
                              if (!_isProcessing && !_isSuccess) {
                                _customQrController.text = decodedText;
                                _handleScanAnyQRCode(decodedText);
                              }
                            },
                          )
                        else
                          MobileScanner(
                            controller: _cameraController,
                            onDetect: (capture) {
                              final List<Barcode> barcodes = capture.barcodes;
                              for (final barcode in barcodes) {
                                final String? rawValue = barcode.rawValue;
                                if (rawValue != null && rawValue.isNotEmpty && !_isProcessing && !_isSuccess) {
                                  HapticFeedback.lightImpact(); // Instant tactile response on scan
                                  _stopCamera(); // Stop camera instantly to prevent duplicate scans
                                  _customQrController.text = rawValue;
                                  _handleScanAnyQRCode(rawValue);
                                  break;
                                }
                              }
                            },
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

            if (_statusMessage != null)
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
                    gradient: const LinearGradient(
                      colors: [Color(0xFF4F46E5), Color(0xFF7C3AED)],
                    ),
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF4F46E5).withValues(alpha: 0.35),
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
                            _handleScanAnyQRCode();
                          },
                    child: _isVerifying
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                          )
                        : Text(
                            'សកម្មភាព៖ ${_getActionLabel(_nextAction)}',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, letterSpacing: 1),
                          ),
                  ),
                ),
              ),
              const SizedBox(height: 10),

              // Checkbox: Scan on Behalf (Matching Frontend Kiosk)
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Checkbox(
                    value: _scanOnBehalf,
                    activeColor: AppColors.primary,
                    onChanged: (val) => setState(() => _scanOnBehalf = val ?? false),
                  ),
                  const Text(
                    'ចុះវត្តមានជំនួសអ្នកដទៃ (Scan on Behalf)',
                    style: TextStyle(fontSize: 12, color: AppColors.primary, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            ] else ...[
              // Active Action Label & Re-lock Button
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
                ),
                child: Text(
                  'សកម្មភាព៖ ${_getActionLabel(_nextAction)}',
                  style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 12),
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

