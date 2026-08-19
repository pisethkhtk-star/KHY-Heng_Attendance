class LeaveItem {
  final String id;
  final String leaveType; // Annual Leave, Sick Leave, Special Leave
  final String startDate;
  final String endDate;
  final double totalDays;
  final String reason;
  final String status; // Pending, Approved, Rejected
  final String appliedDate;

  LeaveItem({
    required this.id,
    required this.leaveType,
    required this.startDate,
    required this.endDate,
    required this.totalDays,
    required this.reason,
    required this.status,
    required this.appliedDate,
  });

  factory LeaveItem.fromJson(Map<String, dynamic> json) {
    String dateStr = '';
    if (json['leaveDate'] != null) {
      dateStr = json['leaveDate'].toString().split('T')[0];
    } else if (json['startDate'] != null) {
      dateStr = json['startDate'].toString().split('T')[0];
    }

    final double daysVal = json['amountDays'] != null
        ? (double.tryParse(json['amountDays'].toString()) ?? 1.0)
        : (double.tryParse((json['totalDays'] ?? '1').toString()) ?? 1.0);

    return LeaveItem(
      id: json['id']?.toString() ?? '',
      leaveType: () {
        final rawType = json['leaveType'];
        if (rawType != null) {
          if (rawType is Map) {
            return rawType['nameEn']?.toString() ?? rawType['name']?.toString() ?? rawType['code']?.toString() ?? 'Annual Leave';
          }
          return rawType.toString();
        }
        return json['leaveTypeName']?.toString() ?? 'Annual Leave';
      }(),
      startDate: dateStr,
      endDate: json['endDate']?.toString().split('T')[0] ?? dateStr,
      totalDays: daysVal,
      reason: json['reason'] ?? '',
      status: json['status'] ?? 'Pending',
      appliedDate: json['requestedAt']?.toString().split('T')[0] ?? json['createdAt']?.toString().split('T')[0] ?? dateStr,
    );
  }
}


class LeaveBalance {
  final String typeName;
  final double totalDays;
  final double usedDays;
  final double remainingDays;

  LeaveBalance({
    required this.typeName,
    required this.totalDays,
    required this.usedDays,
    required this.remainingDays,
  });

  double get percentageUsed => totalDays > 0 ? (usedDays / totalDays) : 0.0;

  static String formatDays(double val) {
    if (val % 1 == 0) {
      return val.toInt().toString();
    }
    return val.toStringAsFixed(1);
  }

  String get formattedRemaining => formatDays(remainingDays);
  String get formattedTotal => formatDays(totalDays);
  String get formattedUsed => formatDays(usedDays);
}

