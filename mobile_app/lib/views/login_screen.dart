import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../core/constants/app_colors.dart';
import '../controllers/auth_controller.dart';
import '../controllers/language_controller.dart';
import '../widgets/scanner_modal_sheet.dart';
import 'main_layout.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _handleLogin() async {
    final authController = Get.find<AuthController>();
    final success = await authController.login(
      _emailController.text,
      _passwordController.text,
    );

    if (success && mounted) {
      Get.offAll(() => const MainLayout());
    }
  }

  void _handleQrLogin(String qrToken) async {
    final authController = Get.find<AuthController>();
    final success = await authController.loginWithQRCode(qrToken);

    if (mounted) {
      if (success) {
        Navigator.pop(context);
        Get.offAll(() => const MainLayout());
      } else {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(authController.errorMessage ?? 'QR Code Login Failed'),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final langController = Get.find<LanguageController>();
    final authController = Get.find<AuthController>();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Image.asset(
                      'assets/icon/app_icon.png',
                      width: 52,
                      height: 52,
                      fit: BoxFit.cover,
                    ),
                  ),
                  // Language Switch Button
                  Obx(
                    () => TextButton.icon(
                      onPressed: () {
                        final newLang = langController.currentLanguage == 'km' ? 'en' : 'km';
                        langController.setLanguage(newLang);
                      },
                      icon: const Icon(LucideIcons.globe, size: 18),
                      label: Text(
                        langController.currentLanguage == 'km' ? 'English' : 'ភាសាខ្មែរ',
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              Obx(() => Text(
                langController.tr('welcome_back'),
                style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
              )),
              const SizedBox(height: 6),
              Obx(() => Text(
                langController.tr('login_subtitle'),
                style: TextStyle(
                  fontSize: 13,
                  color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                ),
              )),
              const SizedBox(height: 24),

              Obx(() {
                if (authController.errorMessage == null) return const SizedBox.shrink();
                return Container(
                  margin: const EdgeInsets.only(bottom: 20),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.dangerBg,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.danger.withValues(alpha: 0.4)),
                  ),
                  child: Row(
                    children: [
                      const Icon(LucideIcons.alertCircle, color: AppColors.danger, size: 20),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          authController.errorMessage!,
                          style: const TextStyle(color: AppColors.danger, fontSize: 13, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                );
              }),

              // Email Input
              Obx(() => Text(langController.tr('email'), style: const TextStyle(fontWeight: FontWeight.w600))),
              const SizedBox(height: 8),
              TextField(
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(
                  hintText: 'name@company.com',
                  prefixIcon: Icon(LucideIcons.mail, size: 20),
                ),
              ),
              const SizedBox(height: 16),

              // Password Input
              Obx(() => Text(langController.tr('password'), style: const TextStyle(fontWeight: FontWeight.w600))),
              const SizedBox(height: 8),
              TextField(
                controller: _passwordController,
                obscureText: _obscurePassword,
                decoration: InputDecoration(
                  hintText: '••••••••',
                  prefixIcon: const Icon(LucideIcons.lock, size: 20),
                  suffixIcon: IconButton(
                    icon: Icon(_obscurePassword ? LucideIcons.eyeOff : LucideIcons.eye, size: 20),
                    onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                  ),
                ),
              ),
              const SizedBox(height: 12),

              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Checkbox(
                        value: true,
                        onChanged: (val) {},
                        activeColor: AppColors.primary,
                      ),
                      Obx(() => Text(langController.tr('remember_me'), style: const TextStyle(fontSize: 13))),
                    ],
                  ),
                  TextButton(
                    onPressed: () {},
                    child: const Text('Forgot Password?', style: TextStyle(fontSize: 13, color: AppColors.primary)),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // Sign In Button
              SizedBox(
                width: double.infinity,
                height: 52,
                child: Obx(
                  () => ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                    onPressed: authController.isLoading ? null : _handleLogin,
                    child: authController.isLoading
                        ? const CircularProgressIndicator(color: Colors.white)
                        : Text(
                            langController.tr('login'),
                            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                          ),
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Biometric / QR Option
              Center(
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  onPressed: () {
                    showModalBottomSheet(
                      context: context,
                      isScrollControlled: true,
                      shape: const RoundedRectangleBorder(
                        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
                      ),
                      builder: (_) => ScannerModalSheet(
                        initialTab: 0,
                        isLoginMode: true,
                        onLoginQrScanned: _handleQrLogin,
                      ),
                    );
                  },
                  icon: const Icon(LucideIcons.qrCode, color: AppColors.primary, size: 22),
                  label: Obx(
                    () => Text(
                      langController.tr('scan_qr_tab'),
                      style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.w600),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
