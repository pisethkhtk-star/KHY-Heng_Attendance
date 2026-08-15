class OvertimeItem {
  final String id;
  final String staffId;
  final String fromDate;
  final String toDate;
  final String startTime;
  final String endTime;
  final double amountDay;
  final String reason;
  final String status; // Pending, Approved, Rejected
  final String? comment;
  final String? managerName;
  final String? branch;
  final String requestedAt;
  final String? approvedAt;
  final String? createdBy;

  OvertimeItem({
    required this.id,
    required this.staffId,
    required this.fromDate,
    required this.toDate,
    required this.startTime,
    required this.endTime,
    required this.amountDay,
    required this.reason,
    required this.status,
    this.comment,
    this.managerName,
    this.branch,
    required this.requestedAt,
    this.approvedAt,
    this.createdBy,
  });

  factory OvertimeItem.fromJson(Map<String, dynamic> json) {
    String fDate = '';
    if (json['fromDate'] != null) {
      fDate = json['fromDate'].toString().split('T')[0];
    } else if (json['from_date'] != null) {
      fDate = json['from_date'].toString().split('T')[0];
    }

    String tDate = fDate;
    if (json['toDate'] != null) {
      tDate = json['toDate'].toString().split('T')[0];
    } else if (json['to_date'] != null) {
      tDate = json['to_date'].toString().split('T')[0];
    }

    final double daysVal = json['amountDay'] != null
        ? (double.tryParse(json['amountDay'].toString()) ?? 0.0)
        : (json['amount_day'] != null
            ? (double.tryParse(json['amount_day'].toString()) ?? 0.0)
            : 0.0);

    String mName = '';
    if (json['manager'] != null && json['manager'] is Map) {
      mName = json['manager']['nameEn']?.toString() ?? json['manager']['nameKh']?.toString() ?? '';
    }
    if (mName.isEmpty && json['managerName'] != null) {
      mName = json['managerName'].toString();
    }

    String bName = '';
    if (json['branchLocation'] != null && json['branchLocation'] is Map) {
      bName = json['branchLocation']['name']?.toString() ?? '';
    }
    if (bName.isEmpty && json['branch'] != null) {
      bName = json['branch'].toString();
    }

    return OvertimeItem(
      id: json['id']?.toString() ?? '',
      staffId: json['staffId']?.toString() ?? json['staff_id']?.toString() ?? '',
      fromDate: fDate,
      toDate: tDate,
      startTime: json['startTime']?.toString() ?? json['start_time']?.toString() ?? '',
      endTime: json['endTime']?.toString() ?? json['end_time']?.toString() ?? '',
      amountDay: daysVal,
      reason: json['reason']?.toString() ?? '',
      status: json['status']?.toString() ?? 'Pending',
      comment: json['comment']?.toString(),
      managerName: mName.isNotEmpty ? mName : null,
      branch: bName.isNotEmpty ? bName : null,
      requestedAt: json['requestedAt']?.toString().split('T')[0] ?? json['created_at']?.toString().split('T')[0] ?? fDate,
      approvedAt: json['approvedAt']?.toString().split('T')[0] ?? json['approved_at']?.toString().split('T')[0],
      createdBy: json['createdBy']?.toString() ?? json['created_by']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'staffId': staffId,
      'fromDate': fromDate,
      'toDate': toDate,
      'startTime': startTime,
      'endTime': endTime,
      'amountDay': amountDay,
      'reason': reason,
      'status': status,
      'comment': comment,
      'managerName': managerName,
      'branch': branch,
      'requestedAt': requestedAt,
      'approvedAt': approvedAt,
      'createdBy': createdBy,
    };
  }
}

class OvertimeStat {
  final int totalRequests;
  final int pendingRequests;
  final int approvedRequests;
  final int rejectedRequests;
  final double totalApprovedDays;

  OvertimeStat({
    required this.totalRequests,
    required this.pendingRequests,
    required this.approvedRequests,
    required this.rejectedRequests,
    required this.totalApprovedDays,
  });
}
