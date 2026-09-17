import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:permission_handler/permission_handler.dart';

class LocalNotificationService {
  static final LocalNotificationService _instance = LocalNotificationService._internal();
  factory LocalNotificationService() => _instance;
  LocalNotificationService._internal();

  final FlutterLocalNotificationsPlugin _notificationsPlugin = FlutterLocalNotificationsPlugin();
  bool _isInitialized = false;

  FlutterLocalNotificationsPlugin get plugin => _notificationsPlugin;

  Future<void> init() async {
    if (_isInitialized) return;

    try {
      // 1. Android Initialization Settings with App Icon
      const AndroidInitializationSettings androidSettings =
          AndroidInitializationSettings('@mipmap/ic_launcher');

      // 2. iOS / Darwin Settings
      const DarwinInitializationSettings iosSettings = DarwinInitializationSettings(
        requestAlertPermission: true,
        requestBadgePermission: true,
        requestSoundPermission: true,
      );

      const InitializationSettings initSettings = InitializationSettings(
        android: androidSettings,
        iOS: iosSettings,
      );

      await _notificationsPlugin.initialize(
        settings: initSettings,
        onDidReceiveNotificationResponse: (NotificationResponse details) {
          debugPrint('[LocalNotificationService] Notification tapped, payload: ${details.payload}');
        },
      );

      final androidImpl = _notificationsPlugin
          .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();

      // 3. Create Attendance Notifications Channel
      const AndroidNotificationChannel attendanceChannel = AndroidNotificationChannel(
        'attendance_channel',
        'Attendance Notifications',
        description: 'Notifications for Employee Check-in and Check-out',
        importance: Importance.max,
        playSound: true,
        enableVibration: true,
        showBadge: true,
      );
      await androidImpl?.createNotificationChannel(attendanceChannel);

      // 4. Create Dedicated Push Notifications Channel for Background Alerts
      const AndroidNotificationChannel pushChannel = AndroidNotificationChannel(
        'attendance_push_channel',
        'Company Push Notifications',
        description: 'Real-time alerts, announcements, leave approvals, and reminders',
        importance: Importance.max,
        playSound: true,
        enableVibration: true,
        showBadge: true,
      );
      await androidImpl?.createNotificationChannel(pushChannel);

      // 5. Request Android 13+ Notification Permission
      await requestPermission();

      _isInitialized = true;
      debugPrint('[LocalNotificationService] Initialized successfully with high-priority channels!');
    } catch (e) {
      debugPrint('[LocalNotificationService Error] init: $e');
    }
  }

  Future<void> requestPermission() async {
    try {
      if (await Permission.notification.isDenied) {
        await Permission.notification.request().timeout(const Duration(seconds: 4));
      }
    } catch (e) {
      debugPrint('[LocalNotificationService] requestPermission error: $e');
    }
  }

  /// Show high-priority push notification on status bar / notification drawer (heads-up)
  Future<void> showPushNotification({
    required String title,
    required String body,
    String? payload,
    String? type,
  }) async {
    try {
      if (!_isInitialized) {
        await init();
      }

      final int notificationId = DateTime.now().millisecondsSinceEpoch ~/ 1000;

      final AndroidNotificationDetails androidDetails = AndroidNotificationDetails(
        'attendance_push_channel',
        'Company Push Notifications',
        channelDescription: 'Real-time alerts, announcements, leave approvals, and reminders',
        importance: Importance.max,
        priority: Priority.max,
        showWhen: true,
        enableVibration: true,
        playSound: true,
        icon: '@mipmap/ic_launcher',
        category: AndroidNotificationCategory.message,
        visibility: NotificationVisibility.public,
        channelShowBadge: true,
        styleInformation: BigTextStyleInformation(
          body,
          contentTitle: title,
          summaryText: type ?? 'HR chomnan',
        ),
      );

      const DarwinNotificationDetails iosDetails = DarwinNotificationDetails(
        presentAlert: true,
        presentBadge: true,
        presentSound: true,
      );

      final NotificationDetails platformDetails = NotificationDetails(
        android: androidDetails,
        iOS: iosDetails,
      );

      await _notificationsPlugin.show(
        id: notificationId,
        title: title,
        body: body,
        notificationDetails: platformDetails,
        payload: payload ?? 'push',
      );
      debugPrint('[LocalNotificationService] Push notification shown on notification bar: $title - $body');
    } catch (e) {
      debugPrint('[LocalNotificationService] showPushNotification error: $e');
    }
  }

  /// Show native system notification on top notification bar / drawer for attendance
  Future<void> showAttendanceNotification({
    required String title,
    required String body,
    bool isCheckIn = true,
  }) async {
    try {
      if (!_isInitialized) {
        await init();
      }

      final int notificationId = DateTime.now().millisecondsSinceEpoch ~/ 1000;

      const AndroidNotificationDetails androidDetails = AndroidNotificationDetails(
        'attendance_channel',
        'Attendance Notifications',
        channelDescription: 'Notifications for Employee Check-in and Check-out',
        importance: Importance.max,
        priority: Priority.high,
        showWhen: true,
        enableVibration: true,
        playSound: true,
        icon: '@mipmap/ic_launcher',
        category: AndroidNotificationCategory.status,
        visibility: NotificationVisibility.public,
      );

      const DarwinNotificationDetails iosDetails = DarwinNotificationDetails(
        presentAlert: true,
        presentBadge: true,
        presentSound: true,
      );

      const NotificationDetails platformDetails = NotificationDetails(
        android: androidDetails,
        iOS: iosDetails,
      );

      await _notificationsPlugin.show(
        id: notificationId,
        title: title,
        body: body,
        notificationDetails: platformDetails,
        payload: isCheckIn ? 'checkin' : 'checkout',
      );
      debugPrint('[LocalNotificationService] Attendance notification shown: $title - $body');
    } catch (e) {
      debugPrint('[LocalNotificationService] showAttendanceNotification error: $e');
    }
  }
}
