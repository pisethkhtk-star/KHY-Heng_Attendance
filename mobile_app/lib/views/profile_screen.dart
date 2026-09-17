import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:image_picker/image_picker.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../core/constants/app_colors.dart';
import '../controllers/auth_controller.dart';
import '../controllers/theme_controller.dart';
import '../controllers/language_controller.dart';
import '../widgets/custom_card.dart';
import '../widgets/face_enroll_modal_sheet.dart';
import 'login_screen.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  ImageProvider? _getAvatarImage(String? avatarUrl) {
    if (avatarUrl == null || avatarUrl.trim().isEmpty) return null;
    try {
      if (avatarUrl.startsWith('data:image') && avatarUrl.contains('base64,')) {
        final base64String = avatarUrl.split('base64,')[1].trim();
        final bytes = base64Decode(base64String);
        return MemoryImage(bytes);
      }
      if (avatarUrl.startsWith('http') || avatarUrl.startsWith('https')) {
        return NetworkImage(avatarUrl);
      }
      final bytes = base64Decode(avatarUrl.trim());
      return MemoryImage(bytes);
    } catch (_) {
      return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final authController = Get.find<AuthController>();
    final themeController = Get.find<ThemeController>();
    final langController = Get.find<LanguageController>();

    return RefreshIndicator(
      onRefresh: () async {
        await authController.refreshUserProfile();
      },
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        child: Obx(() {
          final user = authController.user;
          final avatarImage = _getAvatarImage(user?.avatarUrl);
          final isUploading = authController.isAvatarUploading;

          return Column(
            children: [
              // Profile Header Card
              CustomCard(
                padding: const EdgeInsets.all(20),
                child: Column(
                  children: [
                    // Clickable Avatar with Camera Edit Badge
                    GestureDetector(
                      onTap: isUploading ? null : () => _showPhotoOptions(context, authController, langController),
                      child: Stack(
                        alignment: Alignment.bottomRight,
                        children: [
                          Container(
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: AppColors.primary.withValues(alpha: 0.35),
                                width: 3,
                              ),
                            ),
                            child: CircleAvatar(
                              radius: 44,
                              backgroundColor: AppColors.primary,
                              backgroundImage: avatarImage,
                              child: isUploading
                                  ? const SizedBox(
                                      width: 28,
                                      height: 28,
                                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 3),
                                    )
                                  : (avatarImage == null
                                      ? Text(
                                          user?.name.isNotEmpty == true ? user!.name.substring(0, 1).toUpperCase() : 'U',
                                          style: const TextStyle(color: Colors.white, fontSize: 36, fontWeight: FontWeight.bold),
                                        )
                                      : null),
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.all(6),
                            decoration: BoxDecoration(
                              color: AppColors.primary,
                              shape: BoxShape.circle,
                              border: Border.all(color: Theme.of(context).cardColor, width: 2.5),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.2),
                                  blurRadius: 4,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                            child: const Icon(LucideIcons.camera, size: 15, color: Colors.white),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      user?.name.isNotEmpty == true ? user!.name : '-',
                      style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      user?.position.isNotEmpty == true ? user!.position : '-',
                      style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 12),
                    Wrap(
                      alignment: WrapAlignment.center,
                      spacing: 8,
                      runSpacing: 6,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                          decoration: BoxDecoration(
                            color: AppColors.primary.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            'ID: ${user?.employeeId ?? "-"}',
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.primary),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                          decoration: BoxDecoration(
                            color: (user?.isAdmin == true
                                ? AppColors.primary
                                : (user?.isHr == true
                                    ? AppColors.accent
                                    : (user?.isManager == true ? AppColors.warning : Colors.grey))).withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: (user?.isAdmin == true
                                  ? AppColors.primary
                                  : (user?.isHr == true
                                      ? AppColors.accent
                                      : (user?.isManager == true ? AppColors.warning : Colors.grey))).withValues(alpha: 0.3),
                              width: 0.8,
                            ),
                          ),
                          child: Text(
                            'Role: ${user?.role ?? "-"}',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: user?.isAdmin == true
                                  ? AppColors.primary
                                  : (user?.isHr == true
                                      ? AppColors.accent
                                      : (user?.isManager == true ? AppColors.warning : Colors.grey)),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Details Card
              CustomCard(
                child: Column(
                  children: [
                    _buildInfoTile(LucideIcons.mail, langController.tr('email'), user?.email.isNotEmpty == true ? user!.email : '-'),
                    const Divider(),
                    _buildInfoTile(LucideIcons.shieldCheck, 'Role', user?.role.isNotEmpty == true ? user!.role : '-'),
                    const Divider(),
                    _buildInfoTile(LucideIcons.building, langController.tr('department'), user?.department.isNotEmpty == true ? user!.department : '-'),
                    const Divider(),
                    _buildInfoTile(
                      LucideIcons.clock,
                      langController.tr('working_shift'),
                      (user?.formattedWorkingShift.isNotEmpty == true)
                          ? user!.formattedWorkingShift
                          : (user?.shiftName.isNotEmpty == true ? user!.shiftName : '-'),
                    ),
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

            // Strictly Role Admin has permission to access Admin Tools (Face Registration)
            if (user?.isAdmin == true) ...[
              const SizedBox(height: 20),
              Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  langController.tr('admin_tools'),
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
              ),
              const SizedBox(height: 12),
              CustomCard(
                child: ListTile(
                  leading: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(LucideIcons.scanFace, color: AppColors.primary, size: 22),
                  ),
                  title: Text(
                    langController.tr('register_employee_face'),
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                  ),
                  subtitle: const Text(
                    'ថត និងចុះឈ្មោះផ្ទៃមុខជីវមាត្របុគ្គលិក',
                    style: TextStyle(fontSize: 12, color: Colors.grey),
                  ),
                  trailing: const Icon(LucideIcons.chevronRight, size: 18, color: Colors.grey),
                  onTap: () {
                    showModalBottomSheet(
                      context: context,
                      isScrollControlled: true,
                      backgroundColor: Colors.transparent,
                      builder: (_) => const FaceEnrollModalSheet(),
                    );
                  },
                ),
              ),
            ],
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
      ),
    );
  }

  Widget _buildInfoTile(IconData icon, String title, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Icon(icon, size: 20, color: Colors.grey),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontSize: 12, color: Colors.grey)),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                  overflow: TextOverflow.ellipsis,
                  maxLines: 2,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _showPhotoOptions(
    BuildContext context,
    AuthController authController,
    LanguageController langController,
  ) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        final hasPhoto = authController.user?.avatarUrl != null &&
            authController.user!.avatarUrl.trim().isNotEmpty;

        return Container(
          decoration: BoxDecoration(
            color: Theme.of(context).cardColor,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          ),
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
          child: SafeArea(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Top drag handle
                Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey.withValues(alpha: 0.3),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(height: 18),
                Text(
                  langController.tr('change_profile_photo'),
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 4),
                Text(
                  langController.currentLanguage == 'km'
                      ? 'ជ្រើសរើសរូបថតផ្ទាល់ខ្លួនរបស់អ្នក'
                      : 'Choose an image to represent your account',
                  style: const TextStyle(fontSize: 13, color: Colors.grey),
                ),
                const SizedBox(height: 20),

                // Option 1: Camera
                ListTile(
                  contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  leading: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(LucideIcons.camera, color: AppColors.primary, size: 22),
                  ),
                  title: Text(
                    langController.tr('take_photo'),
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                  ),
                  trailing: const Icon(LucideIcons.chevronRight, size: 18, color: Colors.grey),
                  onTap: () {
                    Navigator.of(ctx).pop();
                    _pickAndUploadImage(context, ImageSource.camera, authController, langController);
                  },
                ),
                const Divider(height: 1),

                // Option 2: Gallery
                ListTile(
                  contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  leading: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.accent.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(LucideIcons.image, color: AppColors.accent, size: 22),
                  ),
                  title: Text(
                    langController.tr('choose_from_gallery'),
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                  ),
                  trailing: const Icon(LucideIcons.chevronRight, size: 18, color: Colors.grey),
                  onTap: () {
                    Navigator.of(ctx).pop();
                    _pickAndUploadImage(context, ImageSource.gallery, authController, langController);
                  },
                ),

                // Option 3: Remove photo (if has photo)
                if (hasPhoto) ...[
                  const Divider(height: 1),
                  ListTile(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    leading: Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: AppColors.danger.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(LucideIcons.trash2, color: AppColors.danger, size: 22),
                    ),
                    title: Text(
                      langController.tr('remove_photo'),
                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15, color: AppColors.danger),
                    ),
                    trailing: const Icon(LucideIcons.chevronRight, size: 18, color: Colors.grey),
                    onTap: () {
                      Navigator.of(ctx).pop();
                      _removePhoto(context, authController, langController);
                    },
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _pickAndUploadImage(
    BuildContext context,
    ImageSource source,
    AuthController authController,
    LanguageController langController,
  ) async {
    final cardBgColor = Theme.of(context).cardColor;
    try {
      final picker = ImagePicker();
      final XFile? pickedFile = await picker.pickImage(
        source: source,
        maxWidth: 512,
        maxHeight: 512,
        imageQuality: 82,
      );

      if (pickedFile == null) return;

      final bytes = await pickedFile.readAsBytes();
      final base64String = 'data:image/jpeg;base64,${base64Encode(bytes)}';

      // Show uploading indicator dialog
      Get.dialog(
        PopScope(
          canPop: false,
          child: Center(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 22),
              decoration: BoxDecoration(
                color: cardBgColor,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.2),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const CircularProgressIndicator(color: AppColors.primary),
                  const SizedBox(height: 16),
                  Text(
                    langController.tr('uploading_photo'),
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                  ),
                ],
              ),
            ),
          ),
        ),
        barrierDismissible: false,
      );

      final success = await authController.updateProfileAvatar(base64String);
      if (Get.isDialogOpen == true) {
        Get.back();
      }

      if (success) {
        Get.snackbar(
          langController.tr('success'),
          langController.tr('photo_updated_success'),
          snackPosition: SnackPosition.TOP,
          backgroundColor: AppColors.success,
          colorText: Colors.white,
          margin: const EdgeInsets.all(16),
          borderRadius: 12,
          icon: const Icon(LucideIcons.checkCircle, color: Colors.white),
          duration: const Duration(seconds: 3),
        );
      } else {
        Get.snackbar(
          langController.tr('error'),
          authController.errorMessage ?? langController.tr('photo_update_failed'),
          snackPosition: SnackPosition.TOP,
          backgroundColor: AppColors.danger,
          colorText: Colors.white,
          margin: const EdgeInsets.all(16),
          borderRadius: 12,
          icon: const Icon(LucideIcons.alertCircle, color: Colors.white),
          duration: const Duration(seconds: 3),
        );
      }
    } catch (e) {
      if (Get.isDialogOpen == true) {
        Get.back();
      }
      Get.snackbar(
        langController.tr('error'),
        langController.tr('photo_update_failed'),
        snackPosition: SnackPosition.TOP,
        backgroundColor: AppColors.danger,
        colorText: Colors.white,
        margin: const EdgeInsets.all(16),
        borderRadius: 12,
        icon: const Icon(LucideIcons.alertCircle, color: Colors.white),
      );
    }
  }

  Future<void> _removePhoto(
    BuildContext context,
    AuthController authController,
    LanguageController langController,
  ) async {
    final cardBgColor = Theme.of(context).cardColor;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            const Icon(LucideIcons.trash2, color: AppColors.danger, size: 22),
            const SizedBox(width: 8),
            Text(langController.tr('remove_photo'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          ],
        ),
        content: Text(langController.tr('remove_photo_confirm')),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(langController.tr('cancel'), style: const TextStyle(color: Colors.grey)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.danger,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(langController.tr('remove_photo')),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      Get.dialog(
        PopScope(
          canPop: false,
          child: Center(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 22),
              decoration: BoxDecoration(
                color: cardBgColor,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const CircularProgressIndicator(color: AppColors.danger),
                  const SizedBox(height: 16),
                  Text(
                    langController.tr('uploading_photo'),
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                  ),
                ],
              ),
            ),
          ),
        ),
        barrierDismissible: false,
      );

      final success = await authController.updateProfileAvatar('');
      if (Get.isDialogOpen == true) {
        Get.back();
      }

      if (success) {
        Get.snackbar(
          langController.tr('success'),
          langController.tr('photo_removed_success'),
          snackPosition: SnackPosition.TOP,
          backgroundColor: AppColors.success,
          colorText: Colors.white,
          margin: const EdgeInsets.all(16),
          borderRadius: 12,
          icon: const Icon(LucideIcons.checkCircle, color: Colors.white),
        );
      }
    }
  }
}

