import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:permission_handler/permission_handler.dart';

class LocalNotificationService {
  static final LocalNotificationService _instance = LocalNotificationService._internal();
  factory LocalNotificationService() => _instance;
  LocalNotificationService._internal();

  final FlutterLocalNotificationsPlugin _notificationsPlugin = FlutterLocalNotificationsPlugin();
  bool _isInitialized = false;

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

      // 3. Create High Importance Notification Channel for Android
      const AndroidNotificationChannel channel = AndroidNotificationChannel(
        'attendance_channel',
        'Attendance Notifications',
        description: 'Notifications for Employee Check-in and Check-out',
        importance: Importance.max,
        playSound: true,
        enableVibration: true,
      );

      await _notificationsPlugin
          .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(channel);

      // 4. Request Android 13+ Notification Permission
      await requestPermission();

      _isInitialized = true;
      debugPrint('[LocalNotificationService] Initialized successfully!');
    } catch (e) {
      debugPrint('[LocalNotificationService Error] init: $e');
    }
  }

  Future<void> requestPermission() async {
    try {
      if (await Permission.notification.isDenied) {
        await Permission.notification.request();
      }
    } catch (e) {
      debugPrint('[LocalNotificationService] requestPermission error: $e');
    }
  }

  /// Show native system notification on top notification bar / drawer
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
      debugPrint('[LocalNotificationService] Notification shown: $title - $body');
    } catch (e) {
      debugPrint('[LocalNotificationService] showNotification error: $e');
    }
  }
}
