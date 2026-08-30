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
    this.role = 'Employee',
  });

  factory UserModel.fromJson(Map<String, dynamic> rawJson) {
    final json = (rawJson['user'] is Map<String, dynamic>)
        ? rawJson['user'] as Map<String, dynamic>
        : (rawJson['data'] is Map<String, dynamic> ? rawJson['data'] as Map<String, dynamic> : rawJson);

    String parsedDept = 'Engineering';
    if (json['department'] != null) {
      if (json['department'] is Map) {
        parsedDept = json['department']['nameEn'] ?? json['department']['name'] ?? json['department']['nameKh'] ?? 'Engineering';
      } else {
        parsedDept = json['department'].toString();
      }
    }

    String parsedPos = 'Mobile Engineer';
    if (json['position'] != null) {
      if (json['position'] is Map) {
        parsedPos = json['position']['titleEn'] ?? json['position']['title'] ?? json['position']['titleKh'] ?? 'Mobile Engineer';
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
      shiftName: json['shiftName'] ?? 'Standard Day Shift (08:00 AM - 05:00 PM)',
      shiftStartTime: json['shiftStartTime'] ?? '08:00 AM',
      shiftEndTime: json['shiftEndTime'] ?? '05:00 PM',
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
      'role': role,
    };
  }
}
