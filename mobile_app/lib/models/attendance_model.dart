import 'package:intl/intl.dart';

class AttendanceRecord {
  final String id;
  final String staffId;
  final String employeeName;
  final String department;
  final String date;
  final String rawDate;
  final String? checkIn1;
  final String? checkOut1;
  final String? checkIn2;
  final String? checkOut2;
  final String status; // Present, Late, Absent, On Leave, Early Leave
  final String totalHours;
  final String location;
  final bool isVerified;
  final String? note;

  AttendanceRecord({
    required this.id,
    this.staffId = 'EMP-001',
    this.employeeName = '',
    this.department = '',
    required this.date,
    this.rawDate = '',
    this.checkIn1,
    this.checkOut1,
    this.checkIn2,
    this.checkOut2,
    required this.status,
    required this.totalHours,
    this.location = 'Phnom Penh HQ Office',
    this.isVerified = true,
    this.note,
  });

  static String formatTime12Hour(String? timeStr) {
    if (timeStr == null || timeStr.isEmpty || timeStr == '--:--' || timeStr == '-') return '-';
    if (timeStr.contains('AM') || timeStr.contains('PM')) return timeStr;

    try {
      final parts = timeStr.split(':');
      if (parts.length >= 2) {
        int hours = int.parse(parts[0]);
        final minutes = parts[1];
        final ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        if (hours == 0) hours = 12;
        final formattedHours = hours.toString().padLeft(2, '0');
        return '$formattedHours:$minutes $ampm';
      }
    } catch (_) {}
    return timeStr;
  }

  factory AttendanceRecord.fromJson(Map<String, dynamic> json) {
    String dateVal = '';
    String rawDateVal = '';
    if (json['attendanceDate'] != null) {
      rawDateVal = json['attendanceDate'].toString().split('T')[0];
    } else if (json['date'] != null) {
      rawDateVal = json['date'].toString().split('T')[0];
    } else if (json['createdAt'] != null) {
      rawDateVal = json['createdAt'].toString().split('T')[0];
    }

    try {
      if (rawDateVal.isNotEmpty) {
        final parsedDate = DateTime.parse(rawDateVal);
        dateVal = DateFormat('EEE, dd MMM yyyy').format(parsedDate);
      }
    } catch (_) {
      dateVal = rawDateVal;
    }
    if (dateVal.isEmpty) dateVal = rawDateVal;

    final isLateBool = json['isLate'] == true;
    final isEarlyBool = json['isEarlyLeave'] == true;
    String calculatedStatus = 'Present';
    if (isLateBool) {
      calculatedStatus = 'Late';
    } else if (isEarlyBool) {
      calculatedStatus = 'Early Leave';
    } else if (json['status'] != null) {
      calculatedStatus = json['status'].toString();
    }

    final empObj = json['employee'];
    String name = '';
    String dept = '';
    String stId = json['staffId'] ?? empObj?['staffId'] ?? 'EMP-001';

    if (empObj != null) {
      name = empObj['nameEn'] ?? empObj['nameKh'] ?? '';
      if (empObj['department'] != null) {
        dept = empObj['department']['nameEn'] ?? empObj['department']['nameKh'] ?? '';
      }
    }

    return AttendanceRecord(
      id: json['id']?.toString() ?? '',
      staffId: stId,
      employeeName: name,
      department: dept,
      date: dateVal.isNotEmpty ? dateVal : rawDateVal,
      rawDate: rawDateVal,
      checkIn1: formatTime12Hour(json['checkin1'] ?? json['checkIn1'] ?? json['checkIn']),
      checkOut1: formatTime12Hour(json['checkout1'] ?? json['checkOut1'] ?? json['checkOut']),
      checkIn2: formatTime12Hour(json['checkin2'] ?? json['checkIn2']),
      checkOut2: formatTime12Hour(json['checkout2'] ?? json['checkOut2']),
      status: calculatedStatus,
      totalHours: json['totalHours'] ?? (isLateBool ? '7.5 hrs' : '8.0 hrs'),
      location: json['location'] ?? json['employee']?['branch'] ?? 'HQ Office Geofence',
      isVerified: json['isVerified'] ?? true,
      note: json['note']?.toString(),
    );
  }

  bool get isIncomplete {
    if (status.toLowerCase().contains('incomplete')) return true;
    if (status.toLowerCase() == 'on leave' || status.toLowerCase() == 'absent') return false;

    final hasIn1 = checkIn1 != null && checkIn1 != '-' && checkIn1 != '--:--' && checkIn1!.trim().isNotEmpty;
    final hasOut1 = checkOut1 != null && checkOut1 != '-' && checkOut1 != '--:--' && checkOut1!.trim().isNotEmpty;
    final hasIn2 = checkIn2 != null && checkIn2 != '-' && checkIn2 != '--:--' && checkIn2!.trim().isNotEmpty;
    final hasOut2 = checkOut2 != null && checkOut2 != '-' && checkOut2 != '--:--' && checkOut2!.trim().isNotEmpty;

    // Missing scan in Shift 1
    if ((hasIn1 && !hasOut1) || (!hasIn1 && hasOut1)) return true;
    // Missing scan in Shift 2
    if ((hasIn2 && !hasOut2) || (!hasIn2 && hasOut2)) return true;
    // Has only one shift completed and completely missing the other shift
    if ((hasIn1 || hasOut1) && (!hasIn2 && !hasOut2)) return true;
    if ((!hasIn1 && !hasOut1) && (hasIn2 || hasOut2)) return true;

    if (note != null && (note!.toLowerCase().contains('incomplete') || note!.toLowerCase().contains('missing'))) {
      return true;
    }

    return false;
  }
}


