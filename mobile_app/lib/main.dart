import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'core/constants/app_theme.dart';
import 'controllers/language_controller.dart';
import 'controllers/theme_controller.dart';
import 'controllers/auth_controller.dart';
import 'controllers/attendance_controller.dart';
import 'controllers/leave_controller.dart';
import 'core/services/api_service.dart';
import 'views/splash_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await ApiService.initBaseUrl();
  
  // Register GetX Controllers globally
  Get.put(LanguageController());
  Get.put(ThemeController());
  Get.put(AuthController());
  Get.put(AttendanceController());
  Get.put(LeaveController());

  runApp(const HrAttendanceApp());
}

class HrAttendanceApp extends StatelessWidget {
  const HrAttendanceApp({super.key});

  @override
  Widget build(BuildContext context) {
    final themeController = Get.find<ThemeController>();

    return Obx(
      () => GetMaterialApp(
        title: 'HR Employee Attendance Management System',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        darkTheme: AppTheme.darkTheme,
        themeMode: themeController.themeMode,
        home: const SplashScreen(),
      ),
    );
  }
}
