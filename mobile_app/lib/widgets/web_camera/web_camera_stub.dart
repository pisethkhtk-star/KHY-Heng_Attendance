import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

class WebCameraPreview extends StatelessWidget {
  final bool isFrontCamera;
  final ValueChanged<String>? onQRDetected;

  const WebCameraPreview({
    super.key,
    this.isFrontCamera = false,
    this.onQRDetected,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Icon(
        LucideIcons.qrCode,
        color: Colors.white.withOpacity(0.2),
        size: 100,
      ),
    );
  }
}
