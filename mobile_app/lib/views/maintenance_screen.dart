import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../core/constants/app_colors.dart';
import '../core/services/remote_config_service.dart';
import 'splash_screen.dart';

class MaintenanceScreen extends StatefulWidget {
  final String? message;
  const MaintenanceScreen({super.key, this.message});

  @override
  State<MaintenanceScreen> createState() => _MaintenanceScreenState();
}

class _MaintenanceScreenState extends State<MaintenanceScreen> {
  bool _isChecking = false;

  Future<void> _checkAgain() async {
    setState(() => _isChecking = true);
    final remoteConfig = RemoteConfigService();
    await remoteConfig.init();
    setState(() => _isChecking = false);

    if (!remoteConfig.isMaintenanceMode) {
      Get.offAll(() => const SplashScreen());
    } else {
      Get.snackbar(
        'ប្រព័ន្ធនៅតែបន្តការកែលម្អ',
        'សូមរង់ចាំ និងព្យាយាមម្តងទៀតនៅពេលក្រោយ។',
        snackPosition: SnackPosition.BOTTOM,
        backgroundColor: AppColors.warning.withValues(alpha: 0.9),
        colorText: Colors.black87,
        margin: const EdgeInsets.all(16),
        borderRadius: 12,
        icon: const Icon(LucideIcons.alertTriangle, color: Colors.black87),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final remoteConfig = RemoteConfigService();
    final message = widget.message ?? remoteConfig.maintenanceMessage;

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 28),
          child: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Maintenance Icon Badge
                Container(
                  width: 110,
                  height: 110,
                  decoration: BoxDecoration(
                    color: AppColors.warning.withValues(alpha: 0.15),
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: AppColors.warning.withValues(alpha: 0.4),
                      width: 2,
                    ),
                  ),
                  child: const Center(
                    child: Icon(
                      LucideIcons.wrench,
                      size: 52,
                      color: AppColors.warning,
                    ),
                  ),
                ),
                const SizedBox(height: 28),

                // Title
                const Text(
                  'ប្រព័ន្ធកំពុងដំណើរការកែលម្អ',
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),

                const Text(
                  'System Under Maintenance',
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.grey,
                    fontWeight: FontWeight.w500,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 20),

                // Message Box
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Theme.of(context).cardColor,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: Colors.grey.withValues(alpha: 0.2),
                    ),
                  ),
                  child: Text(
                    message.isNotEmpty
                        ? message
                        : 'ប្រព័ន្ធកំពុងដំណើរការកែលម្អ សូមព្យាយាមម្តងទៀតនៅពេលក្រោយ។',
                    style: const TextStyle(
                      fontSize: 14,
                      height: 1.5,
                      color: Colors.grey,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ),
                const SizedBox(height: 32),

                // Check Again Button
                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    onPressed: _isChecking ? null : _checkAgain,
                    icon: _isChecking
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 2.5,
                            ),
                          )
                        : const Icon(LucideIcons.refreshCw, size: 18),
                    label: Text(
                      _isChecking ? 'កំពុងពិនិត្យ...' : 'ព្យាយាមម្តងទៀត (Try Again)',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
