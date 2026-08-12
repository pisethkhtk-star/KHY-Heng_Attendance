import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../core/constants/app_colors.dart';
import '../controllers/auth_controller.dart';
import '../controllers/theme_controller.dart';
import '../controllers/language_controller.dart';
import '../widgets/custom_card.dart';
import 'login_screen.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final authController = Get.find<AuthController>();
    final themeController = Get.find<ThemeController>();
    final langController = Get.find<LanguageController>();

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Obx(() {
        final user = authController.user;

        return Column(
          children: [
            // Profile Header Card
            CustomCard(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 40,
                    backgroundColor: AppColors.primary,
                    child: Text(
                      user?.name.substring(0, 1).toUpperCase() ?? 'U',
                      style: const TextStyle(color: Colors.white, fontSize: 36, fontWeight: FontWeight.bold),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    user?.name ?? 'Chomnan Heng',
                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    user?.position ?? 'Senior Developer',
                    style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      'ID: ${user?.employeeId ?? "EMP-2026"}',
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.primary),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Details Card
            CustomCard(
              child: Column(
                children: [
                  _buildInfoTile(LucideIcons.mail, langController.tr('email'), user?.email ?? 'chomnan@company.com'),
                  const Divider(),
                  _buildInfoTile(LucideIcons.building, langController.tr('department'), user?.department ?? 'Engineering'),
                  const Divider(),
                  _buildInfoTile(LucideIcons.clock, langController.tr('working_shift'), user?.shiftName ?? 'Day Shift (8AM-5PM)'),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Settings Section
            Text(
              langController.tr('settings'),
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),

            CustomCard(
              child: Column(
                children: [
                  // Dark Mode Switch
                  SwitchListTile(
                    secondary: const Icon(LucideIcons.moon, color: AppColors.primary),
                    title: Text(langController.tr('dark_mode')),
                    value: themeController.isDarkMode,
                    onChanged: (val) => themeController.toggleTheme(val),
                  ),
                  const Divider(),
                  // Language Selection Tile
                  ListTile(
                    leading: const Icon(LucideIcons.globe, color: AppColors.accent),
                    title: Text(langController.tr('language')),
                    trailing: DropdownButton<String>(
                      value: langController.currentLanguage,
                      underline: const SizedBox.shrink(),
                      items: [
                        DropdownMenuItem(value: 'km', child: Text(langController.tr('khmer'))),
                        DropdownMenuItem(value: 'en', child: Text(langController.tr('english'))),
                      ],
                      onChanged: (val) {
                        if (val != null) langController.setLanguage(val);
                      },
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Logout Button
            SizedBox(
              width: double.infinity,
              height: 52,
              child: OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.danger,
                  side: const BorderSide(color: AppColors.danger),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                onPressed: () async {
                  await authController.logout();
                  Get.offAll(() => const LoginScreen());
                },
                icon: const Icon(LucideIcons.logOut, size: 20),
                label: Text(
                  langController.tr('logout'),
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
              ),
            ),
          ],
        );
      }),
    );
  }

  Widget _buildInfoTile(IconData icon, String title, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Icon(icon, size: 20, color: Colors.grey),
          const SizedBox(width: 14),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(fontSize: 12, color: Colors.grey)),
              const SizedBox(height: 2),
              Text(value, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
            ],
          ),
        ],
      ),
    );
  }
}
