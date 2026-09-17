class UserModel {
  final String id;
  final String employeeId;
  final String name; // Display English Name
  final String nameEn;
  final String nameKh;
  final String email;
  final String department;
  final String position;
  final String branch;
  final String avatarUrl;
  final String shiftName;
  final String shiftStartTime;
  final String shiftEndTime;
  final String? shift1Start;
  final String? shift1End;
  final String? shift2Start;
  final String? shift2End;
  final String role;

  bool get isAdmin => role.trim().toLowerCase() == 'admin';
  bool get isHr => role.trim().toLowerCase() == 'hr';
  bool get isManager => role.trim().toLowerCase() == 'manager';
  bool get isEmployee => role.trim().toLowerCase() == 'employee';

  /// Strictly Role Admin has permission to register employee face scans per requirement
  bool get canRegisterFace => isAdmin;

  UserModel({
    required this.id,
    required this.employeeId,
    required this.name,
    this.nameEn = '',
    this.nameKh = '',
    required this.email,
    required this.department,
    required this.position,
    this.branch = 'Phnom Penh HQ',
    this.avatarUrl = '',
    this.shiftName = 'Standard Day Shift',
    this.shiftStartTime = '08:00 AM',
    this.shiftEndTime = '05:00 PM',
    this.shift1Start,
    this.shift1End,
    this.shift2Start,
    this.shift2End,
    this.role = 'Employee',
  });

  factory UserModel.fromJson(Map<String, dynamic> rawJson) {
    final json = (rawJson['user'] is Map<String, dynamic>)
        ? rawJson['user'] as Map<String, dynamic>
        : (rawJson['data'] is Map<String, dynamic> ? rawJson['data'] as Map<String, dynamic> : rawJson);

    String parsedDept = '-';
    if (json['department'] != null) {
      if (json['department'] is Map) {
        parsedDept = json['department']['nameEn'] ?? json['department']['name'] ?? json['department']['nameKh'] ?? '-';
      } else {
        parsedDept = json['department'].toString();
      }
    }

    String parsedPos = '-';
    if (json['position'] != null) {
      if (json['position'] is Map) {
        parsedPos = json['position']['titleEn'] ?? json['position']['title'] ?? json['position']['titleKh'] ?? '-';
      } else {
        parsedPos = json['position'].toString();
      }
    }

    String parsedBranch = json['branch']?.toString() ?? 'Phnom Penh HQ';
    if (parsedBranch.trim().isEmpty) parsedBranch = 'Phnom Penh HQ';

    final String nameEnStr = (json['nameEn'] ?? json['fullNameEn'] ?? json['name_en'] ?? '').toString().trim();
    final String nameKhStr = (json['nameKh'] ?? json['fullNameKh'] ?? json['name_kh'] ?? '').toString().trim();
    final String generalName = (json['name'] ?? json['username'] ?? '').toString().trim();

    // 🎯 Prioritize English Name (nameEn)
    String displayName = nameEnStr.isNotEmpty
        ? nameEnStr
        : (generalName.isNotEmpty
            ? generalName
            : (nameKhStr.isNotEmpty
                ? nameKhStr
                : (json['email'] != null && json['email'].toString().contains('@')
                    ? json['email'].toString().split('@')[0]
                    : 'Employee User')));

    final String? s1Start = json['shift1Start']?.toString().trim();
    final String? s1End = json['shift1End']?.toString().trim();
    final String? s2Start = json['shift2Start']?.toString().trim();
    final String? s2End = json['shift2End']?.toString().trim();

    String computedShiftStart = '08:00 AM';
    if (s1Start != null && s1Start.isNotEmpty && s1Start != '-') {
      computedShiftStart = formatTime12Hour(s1Start);
    } else if (json['shiftStartTime'] != null) {
      computedShiftStart = formatTime12Hour(json['shiftStartTime'].toString());
    }

    String computedShiftEnd = '05:00 PM';
    if (s2End != null && s2End.isNotEmpty && s2End != '-' && s2End != '--:--') {
      computedShiftEnd = formatTime12Hour(s2End);
    } else if (s1End != null && s1End.isNotEmpty && s1End != '-') {
      computedShiftEnd = formatTime12Hour(s1End);
    } else if (json['shiftEndTime'] != null) {
      computedShiftEnd = formatTime12Hour(json['shiftEndTime'].toString());
    }

    return UserModel(
      id: json['id']?.toString() ?? '',
      employeeId: json['staffId']?.toString() ?? json['employeeId']?.toString() ?? 'EMP-2026',
      name: displayName,
      nameEn: nameEnStr.isNotEmpty ? nameEnStr : displayName,
      nameKh: nameKhStr,
      email: json['email'] ?? '',
      department: parsedDept,
      position: parsedPos,
      branch: parsedBranch,
      avatarUrl: json['avatarUrl'] ?? json['photoUrl'] ?? json['photo'] ?? '',
      shiftName: json['shiftName'] ?? 'Shift ($computedShiftStart - $computedShiftEnd)',
      shiftStartTime: computedShiftStart,
      shiftEndTime: computedShiftEnd,
      shift1Start: s1Start,
      shift1End: s1End,
      shift2Start: s2Start,
      shift2End: s2End,
      role: () {
        final rawRole = json['role'] ?? json['roleName'];
        if (rawRole != null) {
          if (rawRole is Map && rawRole['name'] != null) {
            return rawRole['name'].toString().trim();
          }
          return rawRole.toString().trim();
        }
        return 'Employee';
      }(),
    );
  }

  static String formatTime12Hour(String? timeStr) {
    if (timeStr == null || timeStr.trim().isEmpty || timeStr == '--:--' || timeStr == '-') return '';
    if (timeStr.contains('AM') || timeStr.contains('PM')) return timeStr.trim();
    try {
      final parts = timeStr.trim().split(':');
      if (parts.length >= 2) {
        int hours = int.parse(parts[0]);
        final minutes = parts[1].padLeft(2, '0');
        final ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        if (hours == 0) hours = 12;
        final formattedHours = hours.toString().padLeft(2, '0');
        return '$formattedHours:$minutes $ampm';
      }
    } catch (_) {}
    return timeStr.trim();
  }

  String get formattedWorkingShift => '$shiftStartTime - $shiftEndTime';

  String get formattedShift1Hours {
    if (shift1Start == null || shift1Start!.isEmpty || shift1Start == '-') return '';
    final s = formatTime12Hour(shift1Start);
    final e = (shift1End != null && shift1End!.isNotEmpty && shift1End != '-') ? formatTime12Hour(shift1End) : '';
    return e.isNotEmpty ? '$s - $e' : s;
  }

  String get formattedShift2Hours {
    if (shift2Start == null || shift2Start!.isEmpty || shift2Start == '-') return '';
    final s = formatTime12Hour(shift2Start);
    final e = (shift2End != null && shift2End!.isNotEmpty && shift2End != '-') ? formatTime12Hour(shift2End) : '';
    return e.isNotEmpty ? '$s - $e' : s;
  }

  bool get hasShift2 =>
      shift2End != null &&
      shift2End!.isNotEmpty &&
      shift2End != '--:--' &&
      shift2End != '-';

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'staffId': employeeId,
      'name': name,
      'nameEn': nameEn,
      'nameKh': nameKh,
      'email': email,
      'department': department,
      'position': position,
      'branch': branch,
      'avatarUrl': avatarUrl,
      'shiftName': shiftName,
      'shiftStartTime': shiftStartTime,
      'shiftEndTime': shiftEndTime,
      'shift1Start': shift1Start,
      'shift1End': shift1End,
      'shift2Start': shift2Start,
      'shift2End': shift2End,
      'role': role,
    };
  }
}
