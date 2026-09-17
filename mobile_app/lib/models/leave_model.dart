class LeaveItem {
  final String id;
  final String leaveType; // Annual Leave, Sick Leave, Special Leave
  final String startDate;
  final String endDate;
  final double totalDays;
  final String reason;
  final String status; // Pending, Approved, Rejected
  final String appliedDate;
  final String? staffId;
  final String? employeeName;
  final String? employeeNameKh;
  final String? departmentName;
  final String? positionTitle;
  final String? photoUrl;
  final String? managerName;

  LeaveItem({
    required this.id,
    required this.leaveType,
    required this.startDate,
    required this.endDate,
    required this.totalDays,
    required this.reason,
    required this.status,
    required this.appliedDate,
    this.staffId,
    this.employeeName,
    this.employeeNameKh,
    this.departmentName,
    this.positionTitle,
    this.photoUrl,
    this.managerName,
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

    String? sId = json['staffId']?.toString();
    String? empName;
    String? empNameKh;
    String? deptName;
    String? posTitle;
    String? photo;

    if (json['employee'] is Map) {
      final emp = json['employee'] as Map<String, dynamic>;
      sId ??= emp['staffId']?.toString();
      empName = emp['nameEn']?.toString();
      empNameKh = emp['nameKh']?.toString();
      photo = emp['photoUrl']?.toString();
      if (emp['department'] is Map) {
        deptName = emp['department']['nameEn']?.toString() ?? emp['department']['nameKh']?.toString();
      }
      if (emp['position'] is Map) {
        posTitle = emp['position']['titleEn']?.toString() ?? emp['position']['titleKh']?.toString();
      }
    }

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
      staffId: sId,
      employeeName: empName,
      employeeNameKh: empNameKh,
      departmentName: deptName,
      positionTitle: posTitle,
      photoUrl: photo,
      managerName: json['managerName']?.toString(),
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

