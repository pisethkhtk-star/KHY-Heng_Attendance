class AppNotificationItem {
  final String id;
  final String title;
  final String message;
  final String type; // 'approved', 'rejected', 'info'
  final DateTime timestamp;
  bool isRead;
  final String? targetId;

  AppNotificationItem({
    required this.id,
    required this.title,
    required this.message,
    required this.type,
    required this.timestamp,
    this.isRead = false,
    this.targetId,
  });

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'message': message,
    'type': type,
    'timestamp': timestamp.toIso8601String(),
    'isRead': isRead,
    'targetId': targetId,
  };

  factory AppNotificationItem.fromJson(Map<String, dynamic> json) => AppNotificationItem(
    id: json['id'] ?? '',
    title: json['title'] ?? '',
    message: json['message'] ?? '',
    type: json['type'] ?? 'info',
    timestamp: DateTime.tryParse(json['timestamp'] ?? '') ?? DateTime.now(),
    isRead: json['isRead'] ?? false,
    targetId: json['targetId'],
  );
}
