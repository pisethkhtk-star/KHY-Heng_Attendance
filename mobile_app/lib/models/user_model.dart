class UserModel {
  final String id;
  final String employeeId;
  final String name;
  final String email;
  final String department;
  final String position;
  final String branch;
  final String avatarUrl;
  final String shiftName;
  final String shiftStartTime;
  final String shiftEndTime;

  UserModel({
    required this.id,
    required this.employeeId,
    required this.name,
    required this.email,
    required this.department,
    required this.position,
    this.branch = 'Phnom Penh HQ',
    this.avatarUrl = '',
    this.shiftName = 'Standard Day Shift',
    this.shiftStartTime = '08:00 AM',
    this.shiftEndTime = '05:00 PM',
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
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

    return UserModel(
      id: json['id']?.toString() ?? '',
      employeeId: json['staffId']?.toString() ?? json['employeeId']?.toString() ?? 'EMP-2026',
      name: json['name'] ?? json['username'] ?? json['email']?.split('@')[0].toUpperCase() ?? 'Employee User',
      email: json['email'] ?? '',
      department: parsedDept,
      position: parsedPos,
      branch: parsedBranch,
      avatarUrl: json['avatarUrl'] ?? json['photo'] ?? '',
      shiftName: json['shiftName'] ?? 'Standard Day Shift (08:00 AM - 05:00 PM)',
      shiftStartTime: json['shiftStartTime'] ?? '08:00 AM',
      shiftEndTime: json['shiftEndTime'] ?? '05:00 PM',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'staffId': employeeId,
      'name': name,
      'email': email,
      'department': department,
      'position': position,
      'branch': branch,
      'avatarUrl': avatarUrl,
      'shiftName': shiftName,
      'shiftStartTime': shiftStartTime,
      'shiftEndTime': shiftEndTime,
    };
  }
}
