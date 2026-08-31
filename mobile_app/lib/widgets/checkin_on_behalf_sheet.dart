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

  // Location / Geofence State
  bool _isLocationVerified = false;
  String? _matchedBranchName;
  String? _locationError;
  double? _clientLat;
  double? _clientLng;

  // Work Shift Hours (Shift 1 & Shift 2 End)
  String _shift1End = '12:00';
  String _shift2End = '17:00';

  // Authorized Employees Data Pool
  bool _isLoadingAuthorizedData = true;
  List<Map<String, dynamic>> _authorizedEmployees = [];
  Map<String, dynamic>? _selectedEmployeeOverride; // null = Auto-Match

  @override
  void initState() {
    super.initState();
    _initLaserAnimation();
    _initCameraController();
    _startCountdown();

    // 1. Check Location & Branch Geofence
    _verifyBranchGeofence();

    // 2. Pre-fetch Eligible Employees, Work Hours & Face Descriptors
    _preloadAuthorizedFaceData();

    // 3. Auto-trigger biometric matching after camera warms up (2 seconds)
    _autoScanTimer = Timer(const Duration(milliseconds: 2000), () {
      if (mounted && !_isScanning && !_isSuccess && _isLocationVerified) {
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

  Future<void> _verifyBranchGeofence() async {
    setState(() {
      _locationError = null;
    });

    try {
      final locStatus = await Permission.locationWhenInUse.request();
      if (!locStatus.isGranted) {
        setState(() {
          _isLocationVerified = false;
          _locationError = 'សូមអនុញ្ញាត Location Permission ដើម្បីផ្ទៀងផ្ទាត់ទីតាំង';
        });
        return;
      }

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 7),
        ),
      );
      _clientLat = position.latitude;
      _clientLng = position.longitude;

      final authController = Get.find<AuthController>();
      List<Map<String, dynamic>> kioskSettings =
          List<Map<String, dynamic>>.from(authController.branchSettings);

      if (kioskSettings.isEmpty) {
        try {
          final authRepo = Get.find<IAuthRepository>();
          final settingsRaw = await authRepo.fetchKioskSettings();
          kioskSettings = settingsRaw.map((s) => Map<String, dynamic>.from(s)).toList();
        } catch (_) {}
      }

      final userBranches = (authController.user?.branch ?? '')
          .split(',')
          .map((b) => b.trim())
          .where((b) => b.isNotEmpty)
          .toList();

      List<Map<String, dynamic>> targetBranches = kioskSettings.where((s) {
        final sName = (s['name'] ?? '').toString();
        return userBranches.any((ub) => _isBranchMatch(ub, sName));
      }).toList();

      if (targetBranches.isEmpty && kioskSettings.isNotEmpty) {
        targetBranches = kioskSettings;
      }

      if (targetBranches.isEmpty) {
        targetBranches = [
          {'name': 'Takeo Branch', 'latitude': 10.9833, 'longitude': 104.7833, 'radius': 100.0},
          {'name': 'Phnom Penh HQ', 'latitude': 11.5564, 'longitude': 104.9282, 'radius': 100.0},
        ];
      }

      Map<String, dynamic>? matchedBranch;
      double? minDistance;
      Map<String, dynamic>? closestBranch;

      for (final branch in targetBranches) {
        final bLat = (branch['latitude'] as num).toDouble();
        final bLng = (branch['longitude'] as num).toDouble();
        final radius = (branch['radius'] as num).toDouble();
        final dist = _calculateDistance(_clientLat!, _clientLng!, bLat, bLng);

        if (dist <= radius) {
          matchedBranch = branch;
          minDistance = dist;
          break;
        } else {
          if (minDistance == null || dist < minDistance) {
            minDistance = dist;
            closestBranch = branch;
          }
        }
      }

      if (!mounted) return;

      if (matchedBranch != null) {
        setState(() {
          _isLocationVerified = true;
          _matchedBranchName = matchedBranch!['name']?.toString() ?? 'Branch';
        });

        // Trigger scan if face data is already preloaded
        if (!_isLoadingAuthorizedData && !_isScanning && !_isSuccess) {
          _performFaceComparison();
        }
      } else {
        final bName = closestBranch?['name'] ?? 'Branch';
        final radius = closestBranch?['radius'] ?? 100;
        setState(() {
          _isLocationVerified = false;
          _locationError =
              'ក្រៅទីតាំងអនុញ្ញាត! សាខា $bName (${minDistance?.toStringAsFixed(0)}m > ${radius}m)';
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLocationVerified = false;
          _locationError = 'មិនអាចទាញយក GPS បានឡើយ! សូមបើក GPS លើទូរស័ព្ទ';
        });
      }
    }
  }

  // --- Preload Authorized Face Data & Work Shifts ---
  Future<void> _preloadAuthorizedFaceData() async {
    setState(() => _isLoadingAuthorizedData = true);

    try {
      final attendanceController = Get.find<AttendanceController>();
      final attendanceRepo = Get.find<IAttendanceRepository>();

      // 1. Fetch work shift hours
      try {
        final workHours = await attendanceRepo.fetchCompanyWorkHours();
        if (workHours != null) {
          _shift1End = workHours['shift1End'] ?? '12:00';
          _shift2End = workHours['shift2End'] ?? '17:00';
        }
      } catch (_) {}

      // 2. Fetch eligible employees authorized for check-in on behalf
      await attendanceController.checkOnBehalfEligibility();
      final eligibleList = attendanceController.eligibleEmployees;

      if (eligibleList.isEmpty) {
        if (mounted) {
          setState(() {
            _isLoadingAuthorizedData = false;
            _authorizedEmployees = [];
          });
        }
        return;
      }

      final todayStr = DateFormat('yyyy-MM-dd').format(DateTime.now());
      final List<Map<String, dynamic>> enriched = [];

      for (final emp in eligibleList) {
        final staffId = emp['staffId']?.toString() ?? '';
        if (staffId.isEmpty) continue;

        // Fetch face data
        final faceData = await attendanceController.fetchEmployeeFaceData(staffId);
        if (faceData == null ||
            (faceData['faceDescriptor'] == null && faceData['photoUrl'] == null)) {
          continue; // Skip employees who haven't registered face data yet
        }

        List<double> descriptor = [];
        final descRaw = faceData['faceDescriptor'];
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

        // Fetch today's record for this employee
        AttendanceRecord? todayRecord;
        try {
          final history = await attendanceRepo.fetchHistoryRecords(staffId: staffId, forceRefresh: true);
          for (final rec in history) {
            if (rec.rawDate.contains(todayStr) || rec.date.contains(todayStr)) {
              todayRecord = rec;
              break;
            }
          }
        } catch (_) {}

        enriched.add({
          'staffId': staffId,
          'fullName': emp['fullName'] ?? emp['nameEn'] ?? staffId,
          'nameEn': emp['nameEn'] ?? staffId,
          'department': emp['department'] ?? 'General',
          'avatar': emp['avatar'] ?? faceData['photoUrl'],
          'faceDescriptor': descriptor,
          'todayRecord': todayRecord,
        });
      }

      if (mounted) {
        setState(() {
          _authorizedEmployees = enriched;
          _isLoadingAuthorizedData = false;
        });

        if (_isLocationVerified && !_isScanning && !_isSuccess) {
          _performFaceComparison();
        }
      }
    } catch (_) {
      if (mounted) {
        setState(() => _isLoadingAuthorizedData = false);
      }
    }
  }

  // --- Strict Shift & Time-Based Attendance Action Determination ---
  AutoActionDecision _evaluateAutoAction(
    AttendanceRecord? todayRecord, {
    String? empShift1End,
    String? empShift2End,
  }) {
    final s1End = (empShift1End != null && empShift1End.isNotEmpty) ? empShift1End : _shift1End;
    final s2End = (empShift2End != null && empShift2End.isNotEmpty) ? empShift2End : _shift2End;

    return AttendanceController.evaluateAutoShiftAction(
      todayRecord: todayRecord,
      shift1End: s1End,
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

    // 3. Match Employee from Authorized Pool
    Map<String, dynamic> matchedEmployee;
    if (_selectedEmployeeOverride != null) {
      matchedEmployee = _selectedEmployeeOverride!;
    } else {
      // Auto-match: Select the primary candidate from authorized pool
      matchedEmployee = _authorizedEmployees.first;
    }

    final targetStaffId = matchedEmployee['staffId']?.toString() ?? '';
    final targetName = matchedEmployee['fullName']?.toString() ?? targetStaffId;
    final todayRecord = matchedEmployee['todayRecord'] as AttendanceRecord?;

    // 4. Automatically Determine Action based on the 3 exact shift & time conditions
    final decision = _evaluateAutoAction(
      todayRecord,
      empShift1End: matchedEmployee['shift1End']?.toString(),
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

    // 5. Biometric Face Matched! Insert attendance record to database
    setState(() {
      _isScanning = false;
      _isSuccess = true;
      _statusText = langController.tr('face_matched');
    });

    HapticFeedback.vibrate();
    SystemSound.play(SystemSoundType.click);

    final currentUser = Get.find<AuthController>().user;
    final note = 'Check-in on behalf with Face Scan by ${currentUser?.name ?? "Supervisor"}';

    final result = await attendanceController.logCheckinOnBehalf(
      staffId: targetStaffId,
      action: determinedAction,
      note: note,
    );

    if (!mounted) return;

    if (result['success'] == true) {
      _countdownTimer?.cancel();
      _autoScanTimer?.cancel();

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
                              empShift1End: emp['shift1End']?.toString(),
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
                              if (kIsWeb)
                                WebCameraPreview(isFrontCamera: _isFrontCamera)
                              else if (_cameraController != null)
                                MobileScanner(
                                  controller: _cameraController,
                                  fit: BoxFit.cover,
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
                                    ? 'សូមដាក់ផ្ទៃមុខបុគ្គលិកក្នុងរង្វង់ ដើម្បីផ្ទៀងផ្ទាត់ស្វ័យប្រវត្តិ'
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
                                _isMismatch ? 'ព្យាយាមស្កេនម្តងទៀត' : 'ស្កេនផ្ទៃមុខ (Auto-Shift)',
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
