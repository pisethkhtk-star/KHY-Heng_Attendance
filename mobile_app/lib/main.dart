import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'core/constants/app_theme.dart';
import 'core/services/base_api_client.dart';
import 'core/services/http_api_client.dart';
import 'repositories/auth_repository.dart';
import 'repositories/attendance_repository.dart';
import 'repositories/leave_repository.dart';
import 'controllers/language_controller.dart';
import 'controllers/theme_controller.dart';
import 'controllers/auth_controller.dart';
import 'controllers/attendance_controller.dart';
import 'controllers/leave_controller.dart';
import 'views/splash_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize and register Network Client
  final apiClient = HttpApiClient();
  await apiClient.init();
  Get.put<BaseApiClient>(apiClient);
  
  // Register Repositories
  Get.put<IAuthRepository>(AuthRepository(Get.find<BaseApiClient>()));
  Get.put<IAttendanceRepository>(AttendanceRepository(Get.find<BaseApiClient>()));
  Get.put<ILeaveRepository>(LeaveRepository(Get.find<BaseApiClient>()));

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
