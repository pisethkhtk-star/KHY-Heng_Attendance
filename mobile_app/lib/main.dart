import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'core/constants/app_theme.dart';
import 'core/services/base_api_client.dart';
import 'core/services/http_api_client.dart';
import 'repositories/auth_repository.dart';
import 'repositories/attendance_repository.dart';
import 'repositories/leave_repository.dart';
import 'repositories/overtime_repository.dart';
import 'controllers/language_controller.dart';
import 'controllers/theme_controller.dart';
import 'controllers/auth_controller.dart';
import 'controllers/attendance_controller.dart';
import 'controllers/leave_controller.dart';
import 'controllers/overtime_controller.dart';
import 'controllers/notification_controller.dart';
import 'views/splash_screen.dart';
import 'package:firebase_core/firebase_core.dart';
import 'firebase_options.dart';
import 'core/services/remote_config_service.dart';
import 'core/services/analytics_service.dart';
import 'core/services/local_notification_service.dart';
import 'core/services/background_notification_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // 1. Initialize Firebase safely without blocking UI on error
  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
  } catch (e) {
    debugPrint('[Firebase Init Warning]: $e');
  }
  
  // 2. Initialize and register Network Client
  final apiClient = HttpApiClient();
  try {
    await apiClient.init();
  } catch (e) {
    debugPrint('[ApiClient Init Warning]: $e');
  }
  Get.put<BaseApiClient>(apiClient);
  
  // 3. Register Repositories
  Get.put<IAuthRepository>(AuthRepository(Get.find<BaseApiClient>()));
  Get.put<IAttendanceRepository>(AttendanceRepository(Get.find<BaseApiClient>()));
  Get.put<ILeaveRepository>(LeaveRepository(Get.find<BaseApiClient>()));
  Get.put<IOvertimeRepository>(OvertimeRepository(Get.find<BaseApiClient>()));

  // 4. Register GetX Controllers globally
  Get.put(LanguageController());
  Get.put(ThemeController());
  Get.put(AuthController());
  Get.put(NotificationController());
  Get.put(AttendanceController());
  Get.put(LeaveController());
  Get.put(OvertimeController());

  // 5. RUN APP IMMEDIATELY! Renders the Flutter UI and Splash Screen immediately
  runApp(const HrAttendanceApp());

  // 6. Initialize Remote Services, Analytics, & Background Push concurrently
  // without delaying or blocking the app startup UI
  _initAsyncServices();
}

void _initAsyncServices() {
  Future.microtask(() async {
    // A. Analytics
    try {
      await AnalyticsService().init();
    } catch (e) {
      debugPrint('[Analytics Service Init Warning]: $e');
    }

    // B. Remote Config (Dynamic IP, Maintenance Mode)
    try {
      await RemoteConfigService().init();
    } catch (e) {
      debugPrint('[RemoteConfig Service Init Warning]: $e');
    }

    // C. Local Notifications (System Channels & Alerts)
    try {
      await LocalNotificationService().init();
    } catch (e) {
      debugPrint('[LocalNotification Service Init Warning]: $e');
    }

    // D. Background Notification Service (FCM & WorkManager)
    try {
      await BackgroundNotificationService().init();
    } catch (e) {
      debugPrint('[BackgroundNotification Service Init Warning]: $e');
    }
  });
}

class HrAttendanceApp extends StatelessWidget {
  const HrAttendanceApp({super.key});

  @override
  Widget build(BuildContext context) {
    final themeController = Get.find<ThemeController>();
    final analyticsObserver = AnalyticsService().observer;

    return Obx(
      () => GetMaterialApp(
        title: 'HR Employee Attendance Management System',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        darkTheme: AppTheme.darkTheme,
        themeMode: themeController.themeMode,
        navigatorObservers: [
          ?analyticsObserver,
        ],
        home: const SplashScreen(),
      ),
    );
  }
}
