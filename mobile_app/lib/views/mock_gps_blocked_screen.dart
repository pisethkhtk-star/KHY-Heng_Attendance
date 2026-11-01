import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:geolocator/geolocator.dart';
import 'package:get/get.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../core/constants/app_colors.dart';
import '../core/services/mock_location_service.dart';
import 'splash_screen.dart';

class MockGpsBlockedScreen extends StatefulWidget {
  const MockGpsBlockedScreen({super.key});

  @override
  State<MockGpsBlockedScreen> createState() => _MockGpsBlockedScreenState();
}

class _MockGpsBlockedScreenState extends State<MockGpsBlockedScreen> {
  bool _isRechecking = false;

  Future<void> _handleRecheck() async {
    setState(() => _isRechecking = true);

    try {
      final mockService = Get.find<MockLocationService>();
      final isStillMocked = await mockService.checkMockGps(promptBlockScreen: false);

      if (!mounted) return;
      setState(() => _isRechecking = false);

      if (!isStillMocked) {
        Get.snackbar(
          'ជោគជ័យ',
          'ទីតាំងពិតត្រូវបានផ្ទៀងផ្ទាត់ជោគជ័យ!',
          snackPosition: SnackPosition.TOP,
          backgroundColor: AppColors.success,
          colorText: Colors.white,
          margin: const EdgeInsets.all(16),
          borderRadius: 12,
          icon: const Icon(LucideIcons.checkCircle2, color: Colors.white),
          duration: const Duration(seconds: 2),
        );

        // Resume to Splash flow to re-route safely
        Get.offAll(() => const SplashScreen());
      } else {
        Get.snackbar(
          'នៅតែរកឃើញ Fake GPS',
          'សូមបិទកម្មវិធី Fake GPS ឬបិទ Mock Location ក្នុង Developer Options ជាមុនសិន។',
          snackPosition: SnackPosition.BOTTOM,
          backgroundColor: AppColors.danger.withValues(alpha: 0.95),
          colorText: Colors.white,
          margin: const EdgeInsets.all(16),
          borderRadius: 12,
          icon: const Icon(LucideIcons.alertOctagon, color: Colors.white),
          duration: const Duration(seconds: 3),
        );
      }
    } catch (e) {
      if (mounted) setState(() => _isRechecking = false);
      debugPrint('[MockGpsBlockedScreen] Recheck error: $e');
    }
  }

  Future<void> _openLocationSettings() async {
    try {
      await Geolocator.openLocationSettings();
    } catch (e) {
      debugPrint('Error opening location settings: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardBg = isDark ? AppColors.cardDark : AppColors.cardLight;
    final textPrimary = isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight;

    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: isDark ? AppColors.bgDark : const Color(0xFFFFF1F2), // subtle red-tinted background
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // 1. Red Alert Shield Badge with subtle pulse animation
                  Container(
                    width: 120,
                    height: 120,
                    decoration: BoxDecoration(
                      color: AppColors.dangerBg,
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: AppColors.danger.withValues(alpha: 0.35),
                        width: 3,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.danger.withValues(alpha: 0.2),
                          blurRadius: 30,
                          spreadRadius: 4,
                        ),
                      ],
                    ),
                    child: const Center(
                      child: Icon(
                        LucideIcons.shieldAlert,
                        size: 58,
                        color: AppColors.danger,
                      ),
                    ),
                  )
                      .animate(onPlay: (c) => c.repeat(reverse: true))
                      .scale(
                        begin: const Offset(0.97, 0.97),
                        end: const Offset(1.03, 1.03),
                        duration: 1200.ms,
                        curve: Curves.easeInOut,
                      ),
                  const SizedBox(height: 28),

                  // 2. Main Title
                  Text(
                    'រកឃើញទីតាំងក្លែងក្លាយ',
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      color: textPrimary,
                      letterSpacing: 0.5,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Fake / Mock GPS Detected',
                    style: TextStyle(
                      fontSize: 13,
                      color: Colors.grey,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 0.3,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 22),

                  // 3. Highlighted Blocking Message Box (Exactly as requested by user)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 20),
                    decoration: BoxDecoration(
                      color: cardBg,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: AppColors.danger.withValues(alpha: 0.4),
                        width: 1.5,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.05),
                          blurRadius: 15,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Column(
                      children: [
                        const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(LucideIcons.ban, color: AppColors.danger, size: 20),
                            SizedBox(width: 8),
                            Text(
                              'ការព្រមានសុវត្ថិភាពប្រព័ន្ធ',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                                color: AppColors.danger,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        const Text(
                          'អ្នកមិនអាចចូលទៅកាន់ app បានទេ សូមធ្វើការ បិទ Fake GPS ជាមុនសិន',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            height: 1.5,
                            color: AppColors.danger,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'ប្រព័ន្ធបានពិនិត្យឃើញថាមុខងារ Mock Location ឬកម្មវិធីក្លែងបន្លំទីតាំង (Fake GPS) កំពុងដំណើរការលើឧបករណ៍របស់អ្នក។ ដើម្បីការពារសុចរិតភាព និងភាពត្រឹមត្រូវនៃទិន្នន័យវត្តមាន សូមបិទ Fake GPS ជាមុនសិន។',
                          style: TextStyle(
                            fontSize: 12.5,
                            color: isDark ? Colors.grey[300] : Colors.grey[700],
                            height: 1.45,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 32),

                  // 4. Action Button: ពិនិត្យឡើងវិញ (Recheck)
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: ElevatedButton.icon(
                      onPressed: _isRechecking ? null : _handleRecheck,
                      icon: _isRechecking
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Icon(LucideIcons.refreshCw, size: 18),
                      label: Text(
                        _isRechecking ? 'កំពុងពិនិត្យឡើងវិញ...' : 'ពិនិត្យទីតាំងឡើងវិញ (Re-check)',
                        style: const TextStyle(
                          fontSize: 14.5,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        elevation: 2,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),

                  // 5. Action Button: បើកការកំណត់ទីតាំង (Settings)
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: OutlinedButton.icon(
                      onPressed: _openLocationSettings,
                      icon: const Icon(LucideIcons.settings, size: 18),
                      label: const Text(
                        'បើកការកំណត់ទីតាំង (Location Settings)',
                        style: TextStyle(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: isDark ? Colors.white70 : Colors.black87,
                        side: BorderSide(
                          color: isDark ? AppColors.borderDark : AppColors.borderLight,
                          width: 1.5,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),

                  // 6. Action Button: ចាកចេញពីកម្មវិធី (Exit App)
                  TextButton.icon(
                    onPressed: () => SystemNavigator.pop(),
                    icon: const Icon(LucideIcons.logOut, size: 16, color: Colors.grey),
                    label: const Text(
                      'ចាកចេញពីកម្មវិធី (Exit App)',
                      style: TextStyle(
                        fontSize: 13,
                        color: Colors.grey,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

