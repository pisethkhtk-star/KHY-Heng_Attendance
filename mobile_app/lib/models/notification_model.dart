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
    id: json['id']?.toString() ?? '',
    title: json['title']?.toString() ?? '',
    message: json['message']?.toString() ?? '',
    type: json['type']?.toString() ?? 'info',
    timestamp: DateTime.tryParse(json['createdAt']?.toString() ?? json['timestamp']?.toString() ?? '') ?? DateTime.now(),
    isRead: json['isRead'] == true,
    targetId: json['targetId']?.toString(),
  );
}
