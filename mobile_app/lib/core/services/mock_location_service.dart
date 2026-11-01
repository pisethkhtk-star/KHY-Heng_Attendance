import 'dart:async';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:get/get.dart';
import '../../views/mock_gps_blocked_screen.dart';

class MockLocationService extends GetxService with WidgetsBindingObserver {
  static MockLocationService get to => Get.find<MockLocationService>();

  final RxBool isMockLocationDetected = false.obs;
  final RxBool isChecking = false.obs;

  Timer? _periodicTimer;
  bool _isBlockedScreenOpen = false;

  @override
  void onInit() {
    super.onInit();
    WidgetsBinding.instance.addObserver(this);
    startContinuousMonitoring();
  }

  @override
  void onClose() {
    WidgetsBinding.instance.removeObserver(this);
    _periodicTimer?.cancel();
    super.onClose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      // Whenever user switches back into app from Fake GPS app or settings, immediately re-check!
      checkMockGps(promptBlockScreen: true);
    }
  }

  /// Starts a lightweight background periodic timer to continuously detect Fake GPS
  void startContinuousMonitoring() {
    _periodicTimer?.cancel();
    _periodicTimer = Timer.periodic(const Duration(seconds: 7), (_) async {
      try {
        final permission = await Geolocator.checkPermission();
        if (permission == LocationPermission.always || permission == LocationPermission.whileInUse) {
          final serviceEnabled = await Geolocator.isLocationServiceEnabled();
          if (serviceEnabled) {
            await checkMockGps(promptBlockScreen: true);
          }
        }
      } catch (e) {
        debugPrint('[MockLocationService] Periodic check skipped: $e');
      }
    });
  }

  /// Core detector method to verify if current GPS position is mocked
  Future<bool> checkMockGps({bool promptBlockScreen = true}) async {
    if (isChecking.value) return isMockLocationDetected.value;
    isChecking.value = true;

    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        isChecking.value = false;
        return false;
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
        isChecking.value = false;
        return false;
      }

      // Fast-path: Check last known cached position first
      try {
        final lastKnown = await Geolocator.getLastKnownPosition();
        if (lastKnown != null && lastKnown.isMocked) {
          isMockLocationDetected.value = true;
          if (promptBlockScreen) {
            triggerMockDetected();
          }
          isChecking.value = false;
          return true;
        }
      } catch (_) {}

      // Accurate check: Get fresh position with timeout
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
          timeLimit: Duration(seconds: 4),
        ),
      );

      if (position.isMocked) {
        isMockLocationDetected.value = true;
        if (promptBlockScreen) {
          triggerMockDetected();
        }
        isChecking.value = false;
        return true;
      } else {
        isMockLocationDetected.value = false;
        if (_isBlockedScreenOpen && !promptBlockScreen) {
          _isBlockedScreenOpen = false;
        }
        isChecking.value = false;
        return false;
      }
    } catch (e) {
      debugPrint('[MockLocationService] checkMockGps error: $e');
    } finally {
      isChecking.value = false;
    }
    return false;
  }

  /// Navigates to the blocking screen if not already shown
  void triggerMockDetected() {
    isMockLocationDetected.value = true;
    if (!_isBlockedScreenOpen) {
      _isBlockedScreenOpen = true;
      Get.to(
        () => const MockGpsBlockedScreen(),
        preventDuplicates: true,
        transition: Transition.fade,
      )?.then((_) {
        _isBlockedScreenOpen = false;
      });
    }
  }

  void markScreenClosed() {
    _isBlockedScreenOpen = false;
  }
}

