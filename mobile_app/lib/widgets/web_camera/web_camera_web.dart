// ignore_for_file: avoid_web_libraries_in_flutter, deprecated_member_use
import 'dart:html' as html;
import 'dart:ui_web' as ui_web;
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

class WebCameraPreview extends StatefulWidget {
  final bool isFrontCamera;
  final ValueChanged<String>? onQRDetected;

  const WebCameraPreview({
    super.key,
    this.isFrontCamera = false,
    this.onQRDetected,
  });

  @override
  State<WebCameraPreview> createState() => _WebCameraPreviewState();
}

class _WebCameraPreviewState extends State<WebCameraPreview> {
  html.VideoElement? _videoElement;
  late String _viewTypeId;
  bool _hasCamera = false;
  String? _errorMessage;
  bool _isDetecting = false;

  @override
  void initState() {
    super.initState();
    _viewTypeId = 'web-cam-preview-${DateTime.now().millisecondsSinceEpoch}';
    _initCamera();
  }

  @override
  void didUpdateWidget(covariant WebCameraPreview oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.isFrontCamera != widget.isFrontCamera) {
      _initCamera();
    }
  }

  Future<void> _initCamera() async {
    try {
      _videoElement ??= html.VideoElement()
        ..autoplay = true
        ..muted = true
        ..style.width = '100%'
        ..style.height = '100%'
        ..style.objectFit = 'cover';

      ui_web.platformViewRegistry.registerViewFactory(
        _viewTypeId,
        (int viewId) => _videoElement!,
      );

      final constraints = {
        'video': {
          'facingMode': widget.isFrontCamera ? 'user' : 'environment',
          'width': {'ideal': 640},
          'height': {'ideal': 640},
        }
      };

      final stream = await html.window.navigator.mediaDevices?.getUserMedia(constraints);
      if (stream != null && _videoElement != null) {
        _videoElement!.srcObject = stream;
        if (mounted) {
          setState(() {
            _hasCamera = true;
            _errorMessage = null;
          });
          _startBarcodeDetection();
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _hasCamera = false;
          _errorMessage = 'Camera access disabled or not available';
        });
      }
    }
  }

  html.CanvasElement? _canvasElement;

  void _ensureJsQRLoaded() {
    try {
      final jsWindow = html.window as dynamic;
      if (jsWindow.jsQR == null) {
        final script = html.ScriptElement()
          ..src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js'
          ..async = true;
        html.document.head?.children.add(script);
      }
    } catch (_) {}
  }

  void _startBarcodeDetection() {
    if (_videoElement == null || _isDetecting) return;
    _isDetecting = true;
    _ensureJsQRLoaded();

    html.window.animationFrame.then((_) async {
      if (!mounted || _videoElement == null) {
        _isDetecting = false;
        return;
      }

      try {
        final jsWindow = html.window as dynamic;

        // 1. Native BarcodeDetector API
        if (jsWindow.BarcodeDetector != null) {
          final detector = jsWindow.BarcodeDetector({'formats': ['qr_code']});
          final barcodes = await detector.detect(_videoElement);
          if (barcodes != null && barcodes.length > 0) {
            final String rawValue = barcodes[0].rawValue.toString();
            if (rawValue.isNotEmpty && widget.onQRDetected != null) {
              widget.onQRDetected!(rawValue);
              _isDetecting = false;
              if (mounted && _hasCamera) {
                Future.delayed(const Duration(milliseconds: 600), _startBarcodeDetection);
              }
              return;
            }
          }
        }

        // 2. Canvas jsQR Fallback Decoder for 100% Cross-Browser Support
        if (jsWindow.jsQR != null && _videoElement!.videoWidth > 0 && _videoElement!.videoHeight > 0) {
          final vWidth = _videoElement!.videoWidth;
          final vHeight = _videoElement!.videoHeight;
          _canvasElement ??= html.CanvasElement(width: vWidth, height: vHeight);
          if (_canvasElement!.width != vWidth) {
            _canvasElement!.width = vWidth;
            _canvasElement!.height = vHeight;
          }
          final ctx = _canvasElement!.context2D;
          ctx.drawImage(_videoElement!, 0, 0);
          final imageData = ctx.getImageData(0, 0, vWidth, vHeight);
          final code = jsWindow.jsQR(imageData.data, imageData.width, imageData.height);
          if (code != null && code.data != null) {
            final String rawValue = code.data.toString();
            if (rawValue.isNotEmpty && widget.onQRDetected != null) {
              widget.onQRDetected!(rawValue);
              _isDetecting = false;
              if (mounted && _hasCamera) {
                Future.delayed(const Duration(milliseconds: 600), _startBarcodeDetection);
              }
              return;
            }
          }
        }
      } catch (_) {}

      _isDetecting = false;
      if (mounted && _hasCamera) {
        Future.delayed(const Duration(milliseconds: 250), _startBarcodeDetection);
      }
    });
  }

  @override
  void dispose() {
    if (_videoElement != null && _videoElement!.srcObject != null) {
      try {
        final stream = _videoElement!.srcObject as html.MediaStream;
        for (var track in stream.getTracks()) {
          track.stop();
        }
      } catch (_) {}
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_hasCamera) {
      return HtmlElementView(viewType: _viewTypeId);
    }
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            LucideIcons.cameraOff,
            color: Colors.white.withOpacity(0.4),
            size: 48,
          ),
          const SizedBox(height: 8),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text(
              _errorMessage ?? 'Requesting Camera Permission...',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 11),
            ),
          ),
        ],
      ),
    );
  }
}
